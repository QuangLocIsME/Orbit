const ChangeRequestRepository = require('../repositories/ChangeRequestRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const Project = require('../models/Project');
const { errorResponse } = require('../utils/response');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, S3_BUCKET, buildS3Url, assertS3Configured } = require('../config/s3');
const CRVersionRepository = require('../repositories/CRVersionRepository');
const Task = require('../models/Task');
const socketService = require('../services/socketService');
const { publishProjectBlockRefresh, publishProjectBlockUpdate } = require('../services/blockRealtimePublisher.service');
const NotificationRepository = require('../repositories/NotificationRepository');
const User = require('../models/User');
const { resolveUserDisplayName } = require('../utils/userDisplayName');

const MAX_ATTACH_SIZE_MB = Number(process.env.CR_ATTACHMENT_MAX_SIZE_MB) || 50;
const MAX_ATTACH_SIZE_BYTES = MAX_ATTACH_SIZE_MB * 1024 * 1024;

// Valid status transitions
const STATUS_TRANSITIONS = {
    'pending':       ['in-progress', 'rejected'],
    'in-progress':   ['approved', 'rejected'],
    'approved':       ['completed', 'rejected'],
    'completed':      ['published', 'rejected'],
    'published':      [],
    'rejected':       [],
};

const normalizeStatus = (val) => {
    if (typeof val !== 'string') return null;
    const normalized = val.trim().toLowerCase();
    return ['pending', 'in-progress', 'approved', 'completed', 'published', 'rejected'].includes(normalized)
        ? normalized : null;
};

// Validate attachment size - reject if any file exceeds limit
function validateAttachmentSize(files) {
    if (!Array.isArray(files) || files.length === 0) return null;
    for (const file of files) {
        if (file.size > MAX_ATTACH_SIZE_BYTES) {
            return {
                error: `"${file.originalname}" exceeds ${MAX_ATTACH_SIZE_MB} MB limit`,
                size: file.size,
                maxSize: MAX_ATTACH_SIZE_BYTES,
            };
        }
    }
    return null;
}

const normalizeString = (val) => {
    if (typeof val !== 'string') return '';
    return val.trim();
};

/**
 * Đọc giá trị từ req.body, hỗ trợ cả JSON và multipart/form-data.
 * multipart gửi key dạng "field[]" → đọc cả req.body['field[]'] lẫn req.body.field.
 */
function getField(body, key, arrayKey) {
    if (body[key] !== undefined) return body[key];
    if (arrayKey && body[arrayKey] !== undefined) return body[arrayKey];
    return undefined;
}

function getArrayField(body, key, arrayKey) {
    const val = getField(body, key, arrayKey);
    if (Array.isArray(val)) return val;
    if (val !== undefined) return [val];
    return undefined;
}

async function notifyCrParticipants({
    projectId,
    actorUserId,
    assignedTo = [],
    reviewers = [],
    title,
    message,
    link,
    refId,
}) {
    const actor = actorUserId
        ? await User.findById(actorUserId).select('publicId').lean()
        : null;
    const actorPublicId = normalizeString(actor?.publicId);

    const targets = [...new Set([...(assignedTo || []), ...(reviewers || [])])]
        .map((id) => normalizeString(id))
        .filter((id) => id && id !== actorUserId && id !== actorPublicId);

    if (targets.length === 0) return;

    const userDocs = await User.find({ publicId: { $in: targets } }).select('_id publicId').lean();
    const mongoIdMap = new Map(userDocs.map((user) => [user.publicId, String(user._id)]));

    for (const targetPublicId of targets) {
        const mongoId = mongoIdMap.get(targetPublicId);
        if (!mongoId) continue;

        const notification = await NotificationRepository.create({
            userId: mongoId,
            type: 'info',
            title,
            message,
            link,
            read: false,
            refType: 'cr',
            refId,
        });

        socketService.notifyUser(mongoId, 'notification:new', {
            id: String(notification._id),
            type: 'info',
            title,
            message,
            link,
            read: false,
            createdAt: notification.createdAt.toISOString(),
        });
    }
}

class ChangeRequestController {
    async listByProject(req, res) {
        try {
            const projectId = req.params?.projectId || req.params?.projectSlug || req.body?.projectId || req.query?.projectId;
            if (!projectId) {
                return errorResponse(res, 400, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) {
                return errorResponse(res, 403, 'Forbidden');
            }

            const changeRequests = await ChangeRequestRepository.listByProject(projectId);

            return res.status(200).json({
                success: true,
                data: changeRequests.map((cr) => ({
                    publicId: cr.publicId,
                    crId: cr.crId,
                    title: cr.title,
                    description: cr.description,
                    status: cr.status,
                    priority: cr.priority,
                    affectedModels: Array.isArray(cr.affectedModels) ? cr.affectedModels : [],
                    disciplineId: cr.disciplineId || null,
                    assignedTo: Array.isArray(cr.assignedTo) ? cr.assignedTo : (cr.assignedTo ? [cr.assignedTo] : []),
                    reviewers: Array.isArray(cr.reviewers) ? cr.reviewers : [],
                    attachments: Array.isArray(cr.attachments) ? cr.attachments : [],
                    estimatedImpact: cr.estimatedImpact || null,
                    estimatedCost: cr.estimatedCost ?? null,
                    estimatedDuration: cr.estimatedDuration || '',
                    deadline: cr.deadline || null,
                    detailedDescription: cr.detailedDescription || '',
                    createdBy: cr.createdBy,
                    createdAt: cr.createdAt,
                    updatedAt: cr.updatedAt,
                    // New fields
                    linkedTaskIds: Array.isArray(cr.linkedTaskIds) ? cr.linkedTaskIds : [],
                    primaryTaskId: cr.primaryTaskId || null,
                    affectedDocuments: Array.isArray(cr.affectedDocuments) ? cr.affectedDocuments : [],
                    derivedPackageIds: Array.isArray(cr.derivedPackageIds) ? cr.derivedPackageIds : [],
                    structuredSections: cr.structuredSections || null,
                    resultAttachments: Array.isArray(cr.resultAttachments) ? cr.resultAttachments : [],
                })),
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list change requests');
        }
    }

    async getDetail(req, res) {
        try {
            const { crId } = req.body;
            if (!crId) {
                return errorResponse(res, 400, 'Missing crId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const cr = await ChangeRequestRepository.findByPublicId(crId);
            if (!cr) {
                return errorResponse(res, 404, 'Change request not found');
            }

            // Check membership
            const member = await ProjectMemberRepository.findMember(cr.projectId, userId);
            if (!member) {
                return errorResponse(res, 403, 'Forbidden');
            }

            return res.status(200).json({
                success: true,
                data: {
                    publicId: cr.publicId,
                    crId: cr.crId,
                    title: cr.title,
                    description: cr.description || '',
                    status: cr.status,
                    priority: cr.priority,
                    affectedModels: Array.isArray(cr.affectedModels) ? cr.affectedModels : [],
                    disciplineId: cr.disciplineId || null,
                    assignedTo: Array.isArray(cr.assignedTo) ? cr.assignedTo : (cr.assignedTo ? [cr.assignedTo] : []),
                    reviewers: Array.isArray(cr.reviewers) ? cr.reviewers : [],
                    attachments: Array.isArray(cr.attachments) ? cr.attachments : [],
                    estimatedImpact: cr.estimatedImpact || null,
                    estimatedCost: cr.estimatedCost ?? null,
                    estimatedDuration: cr.estimatedDuration || '',
                    deadline: cr.deadline || null,
                    detailedDescription: cr.detailedDescription || '',
                    createdBy: cr.createdBy,
                    createdAt: cr.createdAt,
                    updatedAt: cr.updatedAt,
                    linkedTaskIds: Array.isArray(cr.linkedTaskIds) ? cr.linkedTaskIds : [],
                    primaryTaskId: cr.primaryTaskId || null,
                    affectedDocuments: Array.isArray(cr.affectedDocuments) ? cr.affectedDocuments : [],
                    derivedPackageIds: Array.isArray(cr.derivedPackageIds) ? cr.derivedPackageIds : [],
                    structuredSections: cr.structuredSections || null,
                    resultAttachments: Array.isArray(cr.resultAttachments) ? cr.resultAttachments : [],
                },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to get change request detail');
        }
    }

    async create(req, res) {
        try {
            const projectId = req.params?.projectSlug || req.body?.projectId;
            const isMultipart = req.is('multipart/form-data');
            const body = req.body || {};

            // Đọc fields từ body (JSON hoặc multipart được multer parse)
            const rawTitle       = getField(body, 'title', null);
            const rawDesc        = getField(body, 'description', null);
            const rawPriority    = getField(body, 'priority', null);
            const rawAffected    = getArrayField(body, 'affectedModels', 'affectedModels[]');
            const rawDiscipline  = getField(body, 'discipline', 'disciplineId');
            const rawAssigned    = getArrayField(body, 'assignedTo', 'assignedTo[]');
            const rawReviewers   = getArrayField(body, 'reviewers', 'reviewers[]');
            const rawImpact      = getField(body, 'estimatedImpact', null);
            const rawCost        = getField(body, 'estimatedCost', null);
            const rawDuration    = getField(body, 'estimatedDuration', null);
            const rawDeadline    = getField(body, 'deadline', null);
            const rawDetailed    = getField(body, 'detailedDescription', null);
            const rawProposed    = getField(body, 'proposedChange', null);
            const rawClash       = getField(body, 'clashCheckRequired', null);

            if (!projectId) {
                return errorResponse(res, 400, 'Missing projectId');
            }

            if (!normalizeString(rawTitle)) {
                return errorResponse(res, 400, 'Title is required');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) {
                return errorResponse(res, 403, 'You are not a member of this project');
            }
            if (member.role === 'viewer') {
                return errorResponse(res, 403, 'You do not have permission to create change requests. Viewers can only view.');
            }

            const normalizedTitle       = normalizeString(rawTitle);
            const normalizedDescription = normalizeString(rawDesc);
            const normalizedPriority    = ['low', 'medium', 'high', 'urgent'].includes(rawPriority) ? rawPriority : 'medium';
            const normalizedAffectedModels = Array.isArray(rawAffected) ? rawAffected : [];
            const normalizedDisciplineId = normalizeString(rawDiscipline) || null;

            const normalizedAssignedTo  = Array.isArray(rawAssigned) ? rawAssigned : [];
            const normalizedReviewers    = Array.isArray(rawReviewers) ? rawReviewers : [];
            const normalizedEstimatedImpact = ['low', 'medium', 'high'].includes(rawImpact) ? rawImpact : null;
            const normalizedEstimatedCost = rawCost != null && !isNaN(Number(rawCost)) ? Number(rawCost) : null;
            const normalizedEstimatedDuration = normalizeString(rawDuration);
            const normalizedDeadline = rawDeadline ? new Date(rawDeadline) : null;
            const normalizedDetailedDescription = normalizeString(rawDetailed);
            const normalizedProposedChange = normalizeString(rawProposed);
            const normalizedClashCheck = rawClash === 'true' || rawClash === true;

            // Xử lý attachments từ multer (dùng S3 SDK để upload lên bucket orbit-files)
            const uploadedFiles = req.files || [];

            // Validate file sizes
            const sizeError = validateAttachmentSize(uploadedFiles);
            if (sizeError) {
                return errorResponse(res, 400, sizeError.error);
            }

            const attachments = [];

            if (uploadedFiles.length > 0) {
                assertS3Configured();

                for (const file of uploadedFiles) {
                    try {
                        const safeName = (file.originalname || 'file')
                            .replace(/[^a-zA-Z0-9_\-. ]/g, '-')
                            .replace(/\s+/g, '-')
                            .substring(0, 200);
                        const s3Key = `projects/${projectId}/attachments/${Date.now()}-${safeName}`;

                        await s3Client.send(new PutObjectCommand({
                            Bucket: S3_BUCKET,
                            Key: s3Key,
                            Body: file.buffer,
                            ContentType: file.mimetype || 'application/octet-stream',
                        }));

                        attachments.push({
                            name: file.originalname,
                            size: file.size,
                            url: buildS3Url(s3Key),
                            mimeType: file.mimetype || '',
                        });
                    } catch (uploadErr) {
                        console.warn(`[ChangeRequestController] Attachment upload failed for "${file.originalname}":`, uploadErr.message);
                    }
                }
            }

            const changeRequest = await ChangeRequestRepository.create({
                projectId,
                title: normalizedTitle,
                description: normalizedDescription,
                priority: normalizedPriority,
                affectedModels: normalizedAffectedModels,
                disciplineId: normalizedDisciplineId,
                assignedTo: normalizedAssignedTo,
                reviewers: normalizedReviewers,
                estimatedImpact: normalizedEstimatedImpact,
                estimatedCost: normalizedEstimatedCost,
                estimatedDuration: normalizedEstimatedDuration,
                deadline: normalizedDeadline,
                detailedDescription: normalizedDetailedDescription,
                attachments,
                structuredSections: {
                    context: normalizedDescription,
                    problem: normalizedDetailedDescription,
                    proposedChange: normalizedProposedChange,
                    impact: {
                        estimatedImpact: normalizedEstimatedImpact,
                        affectedModels: normalizedAffectedModels,
                        clashCheckRequired: normalizedClashCheck,
                    },
                },
                createdBy: userId,
                status: 'pending',
            });

            // Broadcast to all project members
            socketService.broadcastProject(projectId, 'cr:created', {
                projectId,
                publicId: changeRequest.publicId,
                crId: changeRequest.crId,
                title: changeRequest.title,
                status: changeRequest.status,
                priority: changeRequest.priority,
                assignedTo: changeRequest.assignedTo,
                reviewers: changeRequest.reviewers,
                createdBy: changeRequest.createdBy,
                createdAt: changeRequest.createdAt,
            });
            await publishProjectBlockUpdate({ projectId, scope: 'changes', blockId: 'list', userId });
            await publishProjectBlockUpdate({ projectId, scope: 'tasks', blockId: 'list', userId });

            // Notify assignees and reviewers (excluding the creator)
            const crLink = `/projects/${projectId}/change-requests/${changeRequest.publicId}`;
            const creatorName = await resolveUserDisplayName(userId, 'Unknown');
            await notifyCrParticipants({
                projectId,
                actorUserId: userId,
                assignedTo: normalizedAssignedTo,
                reviewers: normalizedReviewers,
                title: 'New change request assigned',
                message: `${creatorName} created CR "${changeRequest.title}" (${changeRequest.crId})`,
                link: crLink,
                refId: changeRequest.publicId,
            });

            return res.status(201).json({
                success: true,
                message: 'Change request created',
                data: {
                    publicId: changeRequest.publicId,
                    crId: changeRequest.crId,
                    title: changeRequest.title,
                    description: changeRequest.description,
                    status: changeRequest.status,
                    priority: changeRequest.priority,
                    affectedModels: changeRequest.affectedModels,
                    disciplineId: changeRequest.disciplineId,
                    assignedTo: changeRequest.assignedTo,
                    reviewers: changeRequest.reviewers,
                    attachments: Array.isArray(changeRequest.attachments) ? changeRequest.attachments : [],
                    estimatedImpact: changeRequest.estimatedImpact || null,
                    estimatedCost: changeRequest.estimatedCost ?? null,
                    estimatedDuration: changeRequest.estimatedDuration || '',
                    deadline: changeRequest.deadline || null,
                    detailedDescription: changeRequest.detailedDescription || '',
                    createdBy: changeRequest.createdBy,
                    createdAt: changeRequest.createdAt,
                    updatedAt: changeRequest.updatedAt,
                    linkedTaskIds: [],
                    primaryTaskId: null,
                    affectedDocuments: [],
                    derivedPackageIds: [],
                    structuredSections: null,
                    resultAttachments: [],
                },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to create change request');
        }
    }

    async update(req, res) {
        try {
            const { crId, title, description, priority, affectedModels, disciplineId, assignedTo, reviewers, estimatedImpact, estimatedCost, estimatedDuration, deadline, detailedDescription, proposedChange, clashCheckRequired } = req.body || {};
            const normalizedCrId = normalizeString(crId);

            if (!normalizedCrId) return errorResponse(res, 400, 'Missing crId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const changeRequest = await ChangeRequestRepository.findByPublicId(normalizedCrId);
            if (!changeRequest) return errorResponse(res, 404, 'Change request not found');

            const member = await ProjectMemberRepository.findMember(changeRequest.projectId, userId);
            if (!member || member.role === 'viewer') return errorResponse(res, 403, 'Forbidden');

            const isAdmin   = member.role === 'admin';
            const isCreator = changeRequest.createdBy === userId;
            if (!isAdmin && !isCreator) {
                return errorResponse(res, 403, 'Only admins and the CR creator can edit this change request');
            }

            const updates = { $set: {} };
            if (title !== undefined)              updates.$set.title = normalizeString(title);
            if (description !== undefined)        updates.$set.description = normalizeString(description);
            if (priority !== undefined && ['low','medium','high','urgent'].includes(priority)) updates.$set.priority = priority;
            if (affectedModels !== undefined)     updates.$set.affectedModels = Array.isArray(affectedModels) ? affectedModels : [];
            if (disciplineId !== undefined)       updates.$set.disciplineId = normalizeString(disciplineId) || null;
            if (assignedTo !== undefined)         updates.$set.assignedTo = Array.isArray(assignedTo) ? assignedTo : [];
            if (reviewers !== undefined)          updates.$set.reviewers = Array.isArray(reviewers) ? reviewers : [];
            if (estimatedImpact !== undefined)    updates.$set.estimatedImpact = ['low','medium','high'].includes(estimatedImpact) ? estimatedImpact : null;
            if (estimatedCost !== undefined)      updates.$set.estimatedCost = estimatedCost != null && !isNaN(Number(estimatedCost)) ? Number(estimatedCost) : null;
            if (estimatedDuration !== undefined)  updates.$set.estimatedDuration = normalizeString(estimatedDuration);
            if (deadline !== undefined)          updates.$set.deadline = deadline ? new Date(deadline) : null;
            if (detailedDescription !== undefined) updates.$set.detailedDescription = normalizeString(detailedDescription);
            if (proposedChange !== undefined)    updates.$set['structuredSections.proposedChange'] = normalizeString(proposedChange);
            if (clashCheckRequired !== undefined) updates.$set['structuredSections.impact.clashCheckRequired'] = !!clashCheckRequired;

            const updated = await ChangeRequestRepository.update(normalizedCrId, updates);

            // Broadcast to all project members
            socketService.broadcastProject(changeRequest.projectId, 'cr:updated', {
                projectId: changeRequest.projectId,
                publicId: updated.publicId,
                crId: updated.crId,
                title: updated.title,
                description: updated.description,
                status: updated.status,
                priority: updated.priority,
                assignedTo: updated.assignedTo,
                reviewers: updated.reviewers,
                updatedAt: updated.updatedAt,
            });
            await publishProjectBlockUpdate({ projectId: changeRequest.projectId, scope: 'changes', blockId: 'list', userId });
            await publishProjectBlockUpdate({ projectId: changeRequest.projectId, scope: 'tasks', blockId: 'list', userId });

            // Notify assignees and reviewers (excluding the editor)
            const crLink = `/projects/${changeRequest.projectId}/change-requests/${updated.publicId}`;
            const editorName = await resolveUserDisplayName(userId, 'Unknown');
            await notifyCrParticipants({
                projectId: changeRequest.projectId,
                actorUserId: userId,
                assignedTo: updated.assignedTo || [],
                reviewers: updated.reviewers || [],
                title: 'Change request updated',
                message: `${editorName} updated CR "${updated.title}" (${updated.crId})`,
                link: crLink,
                refId: updated.publicId,
            });

            return res.status(200).json({
                success: true,
                message: 'Change request updated',
                data: {
                    publicId: updated.publicId,
                    crId: updated.crId,
                    title: updated.title,
                    description: updated.description,
                    status: updated.status,
                    priority: updated.priority,
                    affectedModels: Array.isArray(updated.affectedModels) ? updated.affectedModels : [],
                    disciplineId: updated.disciplineId || null,
                    assignedTo: Array.isArray(updated.assignedTo) ? updated.assignedTo : [],
                    reviewers: Array.isArray(updated.reviewers) ? updated.reviewers : [],
                    attachments: Array.isArray(updated.attachments) ? updated.attachments : [],
                    estimatedImpact: updated.estimatedImpact || null,
                    estimatedCost: updated.estimatedCost ?? null,
                    estimatedDuration: updated.estimatedDuration || '',
                    deadline: updated.deadline || null,
                    detailedDescription: updated.detailedDescription || '',
                    createdBy: updated.createdBy,
                    createdAt: updated.createdAt,
                    updatedAt: updated.updatedAt,
                    linkedTaskIds: Array.isArray(updated.linkedTaskIds) ? updated.linkedTaskIds : [],
                    primaryTaskId: updated.primaryTaskId || null,
                    affectedDocuments: Array.isArray(updated.affectedDocuments) ? updated.affectedDocuments : [],
                    derivedPackageIds: Array.isArray(updated.derivedPackageIds) ? updated.derivedPackageIds : [],
                    structuredSections: updated.structuredSections || null,
                    resultAttachments: Array.isArray(updated.resultAttachments) ? updated.resultAttachments : [],
                },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to update change request');
        }
    }

    async updateStatus(req, res) {
        try {
            const { crId, status } = req.body || {};
            const normalizedCrId = normalizeString(crId);
            const normalizedStatus = normalizeStatus(status);

            if (!normalizedCrId) {
                return errorResponse(res, 400, 'Missing crId');
            }

            if (!normalizedStatus) {
                return errorResponse(res, 400, 'Invalid status');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const changeRequest = await ChangeRequestRepository.findByPublicId(normalizedCrId);
            if (!changeRequest) {
                return errorResponse(res, 404, 'Change request not found');
            }

            const member = await ProjectMemberRepository.findMember(changeRequest.projectId, userId);
            if (!member || member.role === 'viewer') {
                return errorResponse(res, 403, 'Forbidden');
            }

            // Only admin or CR creator can change status
            const isAdmin   = member.role === 'admin';
            const isCreator = changeRequest.createdBy === userId;
            if (!isAdmin && !isCreator) {
                return errorResponse(res, 403, 'Only admins and the CR creator can update status');
            }

            // Enforce status transition rules
            const allowedTransitions = STATUS_TRANSITIONS[changeRequest.status] || [];
            const currentStatus = changeRequest.status;
            if (currentStatus !== normalizedStatus && !allowedTransitions.includes(normalizedStatus)) {
                return errorResponse(res, 400, `Cannot transition from "${currentStatus}" to "${normalizedStatus}". Allowed transitions: ${allowedTransitions.join(', ') || 'none'}.`);
            }

            const updated = await ChangeRequestRepository.updateStatus(normalizedCrId, normalizedStatus);

            // Auto-create version snapshot when CR is marked completed
            if (normalizedStatus === 'completed') {
                try {
                    await CRVersionRepository.create({
                        crId: normalizedCrId,
                        projectId: changeRequest.projectId,
                        versionLabel: `${changeRequest.crId} v1`,
                        snapshot: {
                            title:            changeRequest.title,
                            description:      changeRequest.description,
                            priority:        changeRequest.priority,
                            estimatedImpact: changeRequest.estimatedImpact || null,
                            affectedModels:  Array.isArray(changeRequest.affectedModels) ? changeRequest.affectedModels : [],
                            disciplineId:    changeRequest.disciplineId || null,
                            attachments:      Array.isArray(changeRequest.attachments) ? changeRequest.attachments : [],
                            structuredSections: changeRequest.structuredSections || null,
                            taskIds:        Array.isArray(changeRequest.linkedTaskIds) ? changeRequest.linkedTaskIds : [],
                            completedBy:    userId,
                            completedAt:     new Date(),
                        },
                        resultFiles: [],
                    });
                } catch (versionErr) {
                    console.warn('[ChangeRequestController] Auto-version creation failed:', versionErr.message);
                }
            }

            // Broadcast status change to all project members
            socketService.broadcastProject(changeRequest.projectId, 'cr:status-changed', {
                projectId: changeRequest.projectId,
                crId: updated.crId,
                publicId: updated.publicId,
                status: updated.status,
            });
            await publishProjectBlockUpdate({ projectId: changeRequest.projectId, scope: 'changes', blockId: 'list', userId });
            await publishProjectBlockUpdate({ projectId: changeRequest.projectId, scope: 'tasks', blockId: 'list', userId });

            const crLink = `/projects/${changeRequest.projectId}/change-requests/${updated.publicId}`;
            const actorName = await resolveUserDisplayName(userId, 'Unknown');
            await notifyCrParticipants({
                projectId: changeRequest.projectId,
                actorUserId: userId,
                assignedTo: changeRequest.assignedTo || [],
                reviewers: changeRequest.reviewers || [],
                title: 'Change request moved to next stage',
                message: `${actorName} changed CR "${changeRequest.title}" (${changeRequest.crId}) to ${updated.status}`,
                link: crLink,
                refId: updated.publicId,
            });

            return res.status(200).json({
                success: true,
                message: 'Change request status updated',
                data: {
                    publicId: updated.publicId,
                    crId: updated.crId,
                    status: updated.status,
                },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to update change request status');
        }
    }

    async listComments(req, res) {
        try {
            const { crId, projectId } = req.body || {};
            if (!crId || !projectId) return errorResponse(res, 400, 'Missing crId or projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return errorResponse(res, 403, 'Forbidden');

            const CRComment = require('../models/CRComment');
            const mongoose = require('mongoose');

            const comments = await CRComment.find({ crId, projectId }).sort({ createdAt: 1 }).lean();

            const authorIds = [...new Set(comments.map(c => c.authorId).filter(Boolean))];
            let authorMap = {};
            if (authorIds.length > 0) {
                const validIds = authorIds.filter(id => { try { return mongoose.Types.ObjectId.isValid(id); } catch { return false; } });
                if (validIds.length > 0) {
                    const users = await User.find({ _id: { $in: validIds } }, { _id: 1, fullName: 1, avatar: 1 }).lean();
                    authorMap = Object.fromEntries(users.map(u => [u._id.toString(), { fullName: u.fullName, avatar: u.avatar || '' }]));
                }
            }

            const data = comments.map(c => ({
                publicId: c.publicId,
                authorId: c.authorId,
                authorName: authorMap[c.authorId]?.fullName || 'Unknown',
                avatar: authorMap[c.authorId]?.avatar || '',
                content: c.content,
                createdAt: c.createdAt,
            }));

            return res.status(200).json({ success: true, data });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list comments');
        }
    }

    async createComment(req, res) {
        try {
            const { crId, projectId, content } = req.body || {};
            if (!crId || !projectId) return errorResponse(res, 400, 'Missing crId or projectId');
            if (!normalizeString(content)) return errorResponse(res, 400, 'Comment content is required');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return errorResponse(res, 403, 'Forbidden');

            const CRComment = require('../models/CRComment');
            const mongoose = require('mongoose');

            // Fetch CR to get assignees/reviewers for notifications
            const changeRequest = await ChangeRequestRepository.findByPublicId(crId);
            const crAssignedTo = Array.isArray(changeRequest?.assignedTo) ? changeRequest.assignedTo : [];
            const crReviewers = Array.isArray(changeRequest?.reviewers) ? changeRequest.reviewers : [];

            const comment = await CRComment.create({
                crId,
                projectId,
                authorId: userId,
                content: normalizeString(content),
            });

            let authorName = 'Unknown';
            let authorAvatar = '';
            if (mongoose.Types.ObjectId.isValid(userId)) {
                const user = await User.findById(userId).select('fullName avatar').lean();
                authorName = user?.fullName || 'Unknown';
                authorAvatar = user?.avatar || '';
            }

            // Broadcast comment to project room
            socketService.broadcastProject(projectId, 'cr:comment_added', {
                projectId,
                crId,
                comment: {
                    publicId: comment.publicId,
                    authorId: comment.authorId,
                    authorName,
                    avatar: authorAvatar,
                    content: comment.content,
                    createdAt: comment.createdAt,
                },
            });
            await publishProjectBlockRefresh({
                projectId,
                scope: 'changes',
                blockId: `comments:change-request:${crId}`,
            });
            await publishProjectBlockUpdate({ projectId, scope: 'changes', blockId: 'list', userId });
            await publishProjectBlockUpdate({ projectId, scope: 'tasks', blockId: 'list', userId });

            // Notify CR assignees and reviewers (excluding the comment author)
            const crLink = `/projects/${projectId}/change-requests/${crId}`;
            const notifyTargets = [...new Set([...crAssignedTo, ...crReviewers])].filter(id => id !== userId);

            const userDocs = await User.find({ publicId: { $in: notifyTargets } }).select('_id publicId').lean();
            const mongoIdMap = new Map(userDocs.map(u => [u.publicId, String(u._id)]));

            for (const targetPublicId of notifyTargets) {
                const mongoId = mongoIdMap.get(targetPublicId);
                if (!mongoId) continue;
                const notification = await NotificationRepository.create({
                    userId: mongoId,
                    type: 'info',
                    title: 'New comment on CR',
                    message: `${authorName} commented on CR`,
                    link: crLink,
                    read: false,
                    refType: 'cr',
                    refId: crId,
                });
                socketService.notifyUser(mongoId, 'notification:new', {
                    id: String(notification._id),
                    type: 'info',
                    title: 'New comment on CR',
                    message: `${authorName} commented on CR`,
                    link: crLink,
                    read: false,
                    createdAt: notification.createdAt.toISOString(),
                });
            }

            return res.status(201).json({
                success: true,
                data: {
                    publicId: comment.publicId,
                    authorId: comment.authorId,
                    authorName,
                    avatar: authorAvatar,
                    content: comment.content,
                    createdAt: comment.createdAt,
                },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to create comment');
        }
    }

    async updateComment(req, res) {
        try {
            const { commentId, content } = req.body || {};
            if (!commentId) return errorResponse(res, 400, 'Missing commentId');
            if (!normalizeString(content)) return errorResponse(res, 400, 'Comment content is required');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const CRComment = require('../models/CRComment');
            const comment = await CRComment.findOne({ publicId: commentId });
            if (!comment) return errorResponse(res, 404, 'Comment not found');

            // Only author can edit their own comment
            if (comment.authorId !== userId) return errorResponse(res, 403, 'Forbidden');

            comment.content = normalizeString(content);
            comment.isEdited = true;
            comment.updatedAt = new Date();
            await comment.save();

            let authorName = 'Unknown';
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(userId)) {
                const User = require('../models/User');
                const user = await User.findById(userId).select('fullName').lean();
                authorName = user?.fullName || 'Unknown';
            }

            socketService.broadcastProject(comment.projectId, 'cr:comment_updated', {
                projectId: comment.projectId,
                crId: comment.crId,
                commentId,
                comment: {
                    publicId: comment.publicId,
                    authorId: comment.authorId,
                    authorName,
                    content: comment.content,
                    createdAt: comment.createdAt,
                    updatedAt: comment.updatedAt,
                    isEdited: comment.isEdited,
                },
            });
            await publishProjectBlockRefresh({
                projectId: comment.projectId,
                scope: 'changes',
                blockId: `comments:change-request:${comment.crId}`,
            });
            await publishProjectBlockUpdate({ projectId: comment.projectId, scope: 'changes', blockId: 'list', userId });
            await publishProjectBlockUpdate({ projectId: comment.projectId, scope: 'tasks', blockId: 'list', userId });

            return res.status(200).json({
                success: true,
                data: {
                    publicId: comment.publicId,
                    authorId: comment.authorId,
                    authorName,
                    content: comment.content,
                    createdAt: comment.createdAt,
                    updatedAt: comment.updatedAt,
                    isEdited: comment.isEdited,
                },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to update comment');
        }
    }

    async deleteComment(req, res) {
        try {
            const { commentId } = req.body || {};
            if (!commentId) return errorResponse(res, 400, 'Missing commentId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const CRComment = require('../models/CRComment');
            const comment = await CRComment.findOne({ publicId: commentId });
            if (!comment) return errorResponse(res, 404, 'Comment not found');

            const member = await ProjectMemberRepository.findMember(comment.projectId, userId);
            const isAdmin = member && member.role === 'admin';
            const isAuthor = comment.authorId === userId;

            // Only author or admin can delete
            if (!isAuthor && !isAdmin) return errorResponse(res, 403, 'Forbidden');

            await CRComment.deleteOne({ publicId: commentId });

            socketService.broadcastProject(comment.projectId, 'cr:comment_deleted', {
                projectId: comment.projectId,
                crId: comment.crId,
                commentId,
            });
            await publishProjectBlockRefresh({
                projectId: comment.projectId,
                scope: 'changes',
                blockId: `comments:change-request:${comment.crId}`,
            });
            await publishProjectBlockUpdate({ projectId: comment.projectId, scope: 'changes', blockId: 'list', userId });
            await publishProjectBlockUpdate({ projectId: comment.projectId, scope: 'tasks', blockId: 'list', userId });

            return res.status(200).json({
                success: true,
                message: 'Comment deleted',
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to delete comment');
        }
    }

    async delete(req, res) {
        try {
            const { crId } = req.body || {};
            const normalizedCrId = normalizeString(crId);

            if (!normalizedCrId) {
                return errorResponse(res, 400, 'Missing crId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const changeRequest = await ChangeRequestRepository.findByPublicId(normalizedCrId);
            if (!changeRequest) {
                return errorResponse(res, 404, 'Change request not found');
            }

            const member = await ProjectMemberRepository.findMember(changeRequest.projectId, userId);
            if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
                return errorResponse(res, 403, 'Forbidden');
            }

            await ChangeRequestRepository.delete(normalizedCrId);

            // Broadcast deletion to all project members
            socketService.broadcastProject(changeRequest.projectId, 'cr:deleted', {
                projectId: changeRequest.projectId,
                crId: normalizedCrId,
            });
            await publishProjectBlockUpdate({ projectId: changeRequest.projectId, scope: 'changes', blockId: 'list', userId });
            await publishProjectBlockUpdate({ projectId: changeRequest.projectId, scope: 'tasks', blockId: 'list', userId });

            const actorName = await resolveUserDisplayName(userId, 'Unknown');
            await notifyCrParticipants({
                projectId: changeRequest.projectId,
                actorUserId: userId,
                assignedTo: changeRequest.assignedTo || [],
                reviewers: changeRequest.reviewers || [],
                title: 'Change request deleted',
                message: `${actorName} deleted CR "${changeRequest.title}" (${changeRequest.crId})`,
                link: `/projects/${changeRequest.projectId}?tab=changes`,
                refId: changeRequest.publicId,
            });

            return res.status(200).json({
                success: true,
                message: 'Change request deleted',
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to delete change request');
        }
    }

    // ── Task linking ───────────────────────────────────────────────────────────

    async createTaskFromCR(req, res) {
        try {
            const { crId, taskTitle, taskDescription, assigneeIds, priority, dueDate, affectedModels } = req.body || {};
            const normalizedCrId = normalizeString(crId);

            if (!normalizedCrId) return errorResponse(res, 400, 'Missing crId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const changeRequest = await ChangeRequestRepository.findByPublicId(normalizedCrId);
            if (!changeRequest) return errorResponse(res, 404, 'Change request not found');

            const member = await ProjectMemberRepository.findMember(changeRequest.projectId, userId);
            if (!member || member.role === 'viewer') return errorResponse(res, 403, 'Forbidden');

            const taskTitleStr = normalizeString(taskTitle) || `[${changeRequest.crId}] ${changeRequest.title}`;
            const taskDescStr = normalizeString(taskDescription)
                || `Task for Change Request ${changeRequest.crId}: ${changeRequest.description}`;

            // Get the first stage of the project's workflow as default status
            let defaultStatus = 'backlog';
            try {
                const project = await Project.findOne({ publicId: changeRequest.projectId })
                    .select('workflow workflowTemplateId').lean();
                if (project) {
                    const stages = Array.isArray(project.workflow?.stages) && project.workflow.stages.length > 0
                        ? project.workflow.stages
                        : null;
                    if (stages && stages[0]?.id) {
                        defaultStatus = stages[0].id;
                    }
                }
            } catch {
                // Fall back to 'backlog' if project lookup fails
            }

            const task = await Task.create({
                projectId: changeRequest.projectId,
                title: taskTitleStr,
                description: taskDescStr,
                priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : changeRequest.priority || 'medium',
                status: defaultStatus,
                assigneeId: Array.isArray(assigneeIds) && assigneeIds.length > 0 ? assigneeIds[0] : (changeRequest.assignedTo?.[0] || ''),
                assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : (changeRequest.assignedTo || []),
                dueDate: dueDate ? new Date(dueDate) : (changeRequest.deadline || null),
                linkedUrl: `cr:${normalizedCrId}`,
                createdBy: userId,
                affectedModels: Array.isArray(affectedModels) ? affectedModels : (changeRequest.affectedModels || []),
            });

            // Update CR with task link
            const linkedTaskIds = [...new Set([...(changeRequest.linkedTaskIds || []), task.publicId])];
            await ChangeRequestRepository.update(normalizedCrId, {
                linkedTaskIds,
                primaryTaskId: changeRequest.primaryTaskId || task.publicId,
            });

            socketService.broadcastProject(changeRequest.projectId, 'task:created', {
                projectId: changeRequest.projectId,
                packageId: null,
                taskId: task.publicId,
            });
            socketService.broadcastProject(changeRequest.projectId, 'cr:updated', {
                projectId: changeRequest.projectId,
                publicId: normalizedCrId,
                crId: changeRequest.crId,
                linkedTaskIds,
                primaryTaskId: changeRequest.primaryTaskId || task.publicId,
            });

            return res.status(201).json({
                success: true,
                message: 'Task created and linked to CR',
                data: {
                    task: {
                        publicId: task.publicId,
                        title: task.title,
                        description: task.description,
                        status: task.status,
                        priority: task.priority,
                        assigneeId: task.assigneeId,
                        assigneeIds: task.assigneeIds,
                        dueDate: task.dueDate,
                        createdBy: task.createdBy,
                        createdAt: task.createdAt,
                        affectedModels: task.affectedModels,
                    },
                    linkedTaskIds,
                    primaryTaskId: changeRequest.primaryTaskId || task.publicId,
                },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to create task from CR');
        }
    }

    async linkTaskToCR(req, res) {
        try {
            const { crId, taskId } = req.body || {};
            const normalizedCrId = normalizeString(crId);
            const normalizedTaskId = normalizeString(taskId);

            if (!normalizedCrId) return errorResponse(res, 400, 'Missing crId');
            if (!normalizedTaskId) return errorResponse(res, 400, 'Missing taskId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const changeRequest = await ChangeRequestRepository.findByPublicId(normalizedCrId);
            if (!changeRequest) return errorResponse(res, 404, 'Change request not found');

            const member = await ProjectMemberRepository.findMember(changeRequest.projectId, userId);
            if (!member || member.role === 'viewer') return errorResponse(res, 403, 'Forbidden');

            // Verify task belongs to same project
            const task = await Task.findOne({ publicId: normalizedTaskId });
            if (!task) return errorResponse(res, 404, 'Task not found');
            if (task.projectId !== changeRequest.projectId) {
                return errorResponse(res, 400, 'Task must belong to the same project as the CR');
            }

            const linkedTaskIds = [...new Set([...(changeRequest.linkedTaskIds || []), normalizedTaskId])];
            const updated = await ChangeRequestRepository.update(normalizedCrId, { linkedTaskIds });

            // Update task's linkedUrl
            await Task.updateOne(
                { publicId: normalizedTaskId },
                { linkedUrl: `cr:${normalizedCrId}` }
            );

            socketService.broadcastProject(changeRequest.projectId, 'cr:updated', {
                projectId: changeRequest.projectId,
                publicId: normalizedCrId,
                crId: changeRequest.crId,
                linkedTaskIds: updated.linkedTaskIds,
                primaryTaskId: updated.primaryTaskId,
            });
            socketService.broadcastProject(changeRequest.projectId, 'task:updated', {
                projectId: changeRequest.projectId,
                packageId: task.packageId || null,
                taskId: normalizedTaskId,
                changes: { linkedUrl: `cr:${normalizedCrId}` },
            });

            return res.status(200).json({
                success: true,
                message: 'Task linked to CR',
                data: { linkedTaskIds: updated.linkedTaskIds },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to link task to CR');
        }
    }

    async unlinkTaskFromCR(req, res) {
        try {
            const { crId, taskId } = req.body || {};
            const normalizedCrId = normalizeString(crId);
            const normalizedTaskId = normalizeString(taskId);

            if (!normalizedCrId) return errorResponse(res, 400, 'Missing crId');
            if (!normalizedTaskId) return errorResponse(res, 400, 'Missing taskId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const changeRequest = await ChangeRequestRepository.findByPublicId(normalizedCrId);
            if (!changeRequest) return errorResponse(res, 404, 'Change request not found');

            const member = await ProjectMemberRepository.findMember(changeRequest.projectId, userId);
            if (!member || member.role === 'viewer') return errorResponse(res, 403, 'Forbidden');

            const linkedTaskIds = (changeRequest.linkedTaskIds || []).filter(id => id !== normalizedTaskId);
            const primaryTaskId = changeRequest.primaryTaskId === normalizedTaskId
                ? (linkedTaskIds[0] || null)
                : changeRequest.primaryTaskId;

            const updated = await ChangeRequestRepository.update(normalizedCrId, { linkedTaskIds, primaryTaskId });

            // Clear task's linkedUrl
            await Task.updateOne(
                { publicId: normalizedTaskId },
                { linkedUrl: '' }
            );

            const task = await Task.findOne({ publicId: normalizedTaskId }).select('packageId').lean();
            socketService.broadcastProject(changeRequest.projectId, 'cr:updated', {
                projectId: changeRequest.projectId,
                publicId: normalizedCrId,
                crId: changeRequest.crId,
                linkedTaskIds: updated.linkedTaskIds,
                primaryTaskId: updated.primaryTaskId,
            });
            socketService.broadcastProject(changeRequest.projectId, 'task:updated', {
                projectId: changeRequest.projectId,
                packageId: task?.packageId || null,
                taskId: normalizedTaskId,
                changes: { linkedUrl: '' },
            });

            return res.status(200).json({
                success: true,
                message: 'Task unlinked from CR',
                data: { linkedTaskIds: updated.linkedTaskIds, primaryTaskId: updated.primaryTaskId },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to unlink task from CR');
        }
    }
}

module.exports = new ChangeRequestController();
