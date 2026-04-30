const CRVersionRepository = require('../repositories/CRVersionRepository');
const ChangeRequestRepository = require('../repositories/ChangeRequestRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const Task = require('../models/Task');
const Document = require('../models/Document');
const ChangeRequest = require('../models/ChangeRequest');
const { errorResponse } = require('../utils/response');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, S3_BUCKET, buildS3Url, assertS3Configured } = require('../config/s3');
const { publishIfcConversionJob } = require('../queues/ifcConversionQueue');

const normalizeString = (val) => {
    if (typeof val !== 'string') return '';
    return val.trim();
};

class CRVersionController {
    async listByCR(req, res) {
        try {
            const { crId } = req.params;
            const { projectId } = req.query;

            if (!crId) return errorResponse(res, 400, 'Missing crId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            if (projectId) {
                const member = await ProjectMemberRepository.findMember(projectId, userId);
                if (!member) return errorResponse(res, 403, 'Forbidden');
            }

            const versions = await CRVersionRepository.listByCrId(crId);

            return res.status(200).json({
                success: true,
                data: versions,
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list versions');
        }
    }

    async listByProject(req, res) {
        try {
            const { projectId } = req.params;

            if (!projectId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return errorResponse(res, 403, 'Forbidden');

            const versions = await CRVersionRepository.listByProject(projectId);

            // Populate CR info for each version
            const crIds = [...new Set(versions.map(v => v.crId).filter(Boolean))];
            const crs = await ChangeRequest.find({ publicId: { $in: crIds } })
                .select('publicId crId title status priority createdBy').lean();
            const crMap = new Map(crs.map(cr => [cr.publicId, cr]));

            const enriched = versions.map(v => ({
                ...v,
                changeRequest: crMap.get(v.crId) || null,
            }));

            return res.status(200).json({
                success: true,
                data: enriched,
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list project versions');
        }
    }

    async create(req, res) {
        try {
            const { crId } = req.params;
            const { versionLabel, projectId } = req.body || {};
            const isMultipart = req.is('multipart/form-data');

            if (!crId) return errorResponse(res, 400, 'Missing crId');
            if (!projectId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return errorResponse(res, 403, 'Forbidden');
            if (member.role === 'viewer') {
                return errorResponse(res, 403, 'Forbidden');
            }

            const changeRequest = await ChangeRequestRepository.findByPublicId(crId);
            if (!changeRequest) return errorResponse(res, 404, 'Change request not found');

            // Build snapshot from current CR state
            const snapshot = {
                title:              changeRequest.title,
                description:        changeRequest.description,
                priority:          changeRequest.priority,
                estimatedImpact:   changeRequest.estimatedImpact || null,
                affectedModels:    Array.isArray(changeRequest.affectedModels) ? changeRequest.affectedModels : [],
                disciplineId:       changeRequest.disciplineId || null,
                attachments:        Array.isArray(changeRequest.attachments) ? changeRequest.attachments : [],
                structuredSections: changeRequest.structuredSections || null,
                taskIds:           Array.isArray(changeRequest.linkedTaskIds) ? changeRequest.linkedTaskIds : [],
                completedBy:       userId,
                completedAt:       new Date(),
            };

            // Gather attachments from all linked tasks
            const linkedTaskIds = Array.isArray(changeRequest.linkedTaskIds) ? changeRequest.linkedTaskIds : [];
            let taskAttachments = [];
            if (linkedTaskIds.length > 0) {
                try {
                    const tasks = await Task.find({
                        publicId: { $in: linkedTaskIds }
                    }).select('publicId title attachments').lean();
                    for (const task of tasks) {
                        const taskFiles = Array.isArray(task.attachments) ? task.attachments : [];
                        for (const file of taskFiles) {
                            taskAttachments.push({
                                name:      file.name || 'Untitled',
                                size:      file.size || 0,
                                url:       file.url || '',
                                mimeType:  file.mimeType || '',
                                sourceDocumentId: task.publicId || '',
                            });
                        }
                    }
                } catch (taskErr) {
                    console.warn('[CRVersionController] Failed to fetch task attachments:', taskErr.message);
                }
            }

            // Handle optional result file uploads
            const uploadedFiles = req.files || [];
            const resultFiles = [...taskAttachments];

            if (uploadedFiles.length > 0) {
                assertS3Configured();
                for (const file of uploadedFiles) {
                    try {
                        const safeName = (file.originalname || 'file')
                            .replace(/[^a-zA-Z0-9_\-. ]/g, '-')
                            .replace(/\s+/g, '-')
                            .substring(0, 200);
                        const s3Key = `projects/${projectId}/cr-versions/${crId}/${Date.now()}-${safeName}`;

                        await s3Client.send(new PutObjectCommand({
                            Bucket: S3_BUCKET,
                            Key: s3Key,
                            Body: file.buffer,
                            ContentType: file.mimetype || 'application/octet-stream',
                        }));

                        resultFiles.push({
                            name:     file.originalname,
                            size:     file.size,
                            url:      buildS3Url(s3Key),
                            mimeType: file.mimetype || '',
                            sourceDocumentId: '',
                        });
                    } catch (uploadErr) {
                        console.warn(`[CRVersionController] Result file upload failed:`, uploadErr.message);
                    }
                }
            }

            const version = await CRVersionRepository.create({
                crId,
                projectId: changeRequest.projectId,
                versionLabel: normalizeString(versionLabel) || '',
                snapshot,
                resultFiles,
            });

            return res.status(201).json({
                success: true,
                data: version,
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to create version');
        }
    }

    async getVersion(req, res) {
        try {
            const { versionId } = req.params;

            if (!versionId) return errorResponse(res, 400, 'Missing versionId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const version = await CRVersionRepository.findByPublicId(versionId);
            if (!version) return errorResponse(res, 404, 'Version not found');

            const member = await ProjectMemberRepository.findMember(version.projectId, userId);
            if (!member) return errorResponse(res, 403, 'Forbidden');

            return res.status(200).json({
                success: true,
                data: version,
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to get version');
        }
    }

    async approve(req, res) {
        try {
            const { versionId } = req.params;
            const { projectId } = req.body || {};

            if (!versionId) return errorResponse(res, 400, 'Missing versionId');
            if (!projectId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.status !== 'accepted') {
                return errorResponse(res, 403, 'Only project members can review versions');
            }
            if (member.role !== 'owner' && member.role !== 'admin' && member.role !== 'manager') {
                return errorResponse(res, 403, 'Only owner, admin, or manager can approve versions');
            }

            const version = await CRVersionRepository.findByPublicId(versionId);
            if (!version) return errorResponse(res, 404, 'Version not found');

            if (version.status !== 'pending') {
                return errorResponse(res, 400, `Version has already been ${version.status}`);
            }

            // Update version status to approved
            await CRVersionRepository.updateStatus(versionId, 'approved', userId);

            // For each task attachment in the version's resultFiles, create/update a Document
            const snapshot = version.snapshot || {};
            const taskIds = snapshot.taskIds || [];
            const taskAttachments = [];

            if (taskIds.length > 0) {
                try {
                    const tasks = await Task.find({
                        publicId: { $in: taskIds }
                    }).select('publicId title attachments').lean();

                    for (const task of tasks) {
                        const taskFiles = Array.isArray(task.attachments) ? task.attachments : [];
                        for (const file of taskFiles) {
                            taskAttachments.push({
                                name: file.name || 'Untitled',
                                size: file.size || 0,
                                url: file.url || '',
                                mimeType: file.mimeType || '',
                                sourceDocumentId: task.publicId || '',
                            });
                        }
                    }
                } catch (taskErr) {
                    console.warn('[CRVersionController] Failed to fetch task attachments:', taskErr.message);
                }
            }

            // Create Document records from task attachments
            for (const attachment of taskAttachments) {
                if (!attachment.url) continue;

                try {
                    // Find existing document by same name in project (to get versionGroupId)
                    const existingDoc = await Document.findOne({
                        projectId: version.projectId,
                        originalName: attachment.name,
                        approvalStatus: 'approved',
                    }).sort({ versionNumber: -1 }).lean();

                    const nextVersionNumber = existingDoc ? (existingDoc.versionNumber || 1) + 1 : 1;
                    const versionGroupId = existingDoc?.versionGroupId || `VG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                    const newDoc = new Document({
                        projectId: version.projectId,
                        originalName: attachment.name,
                        storedName: attachment.name,
                        mimeType: attachment.mimeType || '',
                        size: attachment.size || 0,
                        s3Bucket: S3_BUCKET || '',
                        s3Key: attachment.url || '',
                        s3Url: attachment.url || '',
                        supabaseFileKey: '',
                        supabaseFileUrl: '',
                        uploadedBy: userId,
                        versionGroupId,
                        versionNumber: nextVersionNumber,
                        versionLabel: `${version.versionLabel || `v${version.versionNumber}`}`,
                        versionDescription: `Created from CR Version ${version.versionLabel || version.versionNumber}`,
                        approvalStatus: 'approved',
                        folderType: 'files',
                        folderPath: '',
                    });
                    await newDoc.save();

                    // Trigger IFC conversion for approved IFC files
                    const ext = (attachment.name || '').toLowerCase();
                    if (ext.endsWith('.ifc')) {
                        try {
                            await publishIfcConversionJob({
                                projectId: version.projectId,
                                documentId: newDoc.publicId,
                                versionId: newDoc.publicId,
                                ifcS3Bucket: newDoc.s3Bucket,
                                ifcS3Key: newDoc.s3Key,
                                requestedBy: userId,
                            });
                        } catch (convErr) {
                            console.warn('[CRVersionController] IFC conversion job publish failed:', convErr.message);
                        }
                    }
                } catch (docErr) {
                    console.warn('[CRVersionController] Failed to create document from attachment:', docErr.message);
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Version approved and files published',
                data: { status: 'approved' },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to approve version');
        }
    }

    async reject(req, res) {
        try {
            const { versionId } = req.params;
            const { projectId, reason } = req.body || {};

            if (!versionId) return errorResponse(res, 400, 'Missing versionId');
            if (!projectId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.status !== 'accepted') {
                return errorResponse(res, 403, 'Only project members can review versions');
            }
            if (member.role !== 'owner' && member.role !== 'admin' && member.role !== 'manager') {
                return errorResponse(res, 403, 'Only owner, admin, or manager can reject versions');
            }

            const version = await CRVersionRepository.findByPublicId(versionId);
            if (!version) return errorResponse(res, 404, 'Version not found');

            if (version.status !== 'pending') {
                return errorResponse(res, 400, `Version has already been ${version.status}`);
            }

            await CRVersionRepository.updateStatus(versionId, 'rejected', userId);

            return res.status(200).json({
                success: true,
                message: 'Version rejected',
                data: { status: 'rejected', rejectionReason: reason },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to reject version');
        }
    }
}

module.exports = new CRVersionController();
