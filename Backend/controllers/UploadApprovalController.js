const { errorResponse } = require('../utils/response');
const { normalizeString } = require('../utils/sanitize');
const path = require('path');

const UploadApprovalRepository = require('../repositories/UploadApprovalRepository');
const UploadApprovalComment = require('../models/UploadApprovalComment');
const DocumentRepository = require('../repositories/DocumentRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const User = require('../models/User');
const ActivityService = require('../services/activityService');
const { broadcastProject } = require('../services/socketService');
const { publishIfcConversionJob } = require('../queues/ifcConversionQueue');

const badRequest = (res, message) => errorResponse(res, 400, message);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const forbidden = (res, message) => errorResponse(res, 403, message || 'Forbidden');
const notFound = (res, message) => errorResponse(res, 404, message || 'Not found');
const serverError = (res, message) => errorResponse(res, 500, message || 'Internal server error');

class UploadApprovalController {
    async listPending(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { projectId, status } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedStatus = normalizeString(status);

            if (!normalizedProjectId) {
                return badRequest(res, 'projectId is required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view upload approvals');
            }

            const approvals = await UploadApprovalRepository.findByProject(normalizedProjectId, {
                status: normalizedStatus || undefined,
            });

            // Batch-fetch documents to get conversionStatus for each approval
            const documentIds = approvals.map((a) => a.documentId).filter(Boolean);
            let docMap = new Map();
            if (documentIds.length > 0) {
                const docs = await DocumentRepository.findByPublicIds(documentIds);
                for (const doc of docs) {
                    if (doc) docMap.set(doc.publicId, doc);
                }
            }

            const uploaderIds = [...new Set(approvals.map((a) => a.uploaderId))];
            const validIds = uploaderIds.filter((id) => {
                try {
                    const mongoose = require('mongoose');
                    return mongoose.Types.ObjectId.isValid(id);
                } catch {
                    return false;
                }
            });

            let userMap = new Map();
            if (validIds.length > 0) {
                const users = await User.find({ _id: { $in: validIds } })
                    .select('publicId fullName avatar email')
                    .lean();
                for (const u of users) userMap.set(String(u._id), u);
            }

            return res.status(200).json({
                success: true,
                data: {
                    approvals: approvals.map((a) => {
                        const uploader = userMap.get(String(a.uploaderId));
                        const doc = docMap.get(a.documentId);
                        return {
                            publicId: a.publicId,
                            documentId: a.documentId,
                            jobId: a.jobId,
                            originalName: a.originalName,
                            mimeType: a.mimeType,
                            size: a.size,
                            folderType: a.folderType,
                            folderPath: a.folderPath,
                            versionGroupId: a.versionGroupId,
                            versionNumber: a.versionNumber,
                            versionLabel: a.versionLabel,
                            versionDescription: a.versionDescription,
                            isNewVersion: a.isNewVersion,
                            status: a.status,
                            fileUrl: a.fileUrl,
                            s3Key: a.s3Key,
                            supabaseFileKey: a.supabaseFileKey,
                            reviewedBy: a.reviewedBy,
                            reviewedAt: a.reviewedAt,
                            rejectionReason: a.rejectionReason,
                            approvedAt: a.approvedAt,
                            uploader: uploader
                                ? {
                                      id: uploader.publicId,
                                      name: uploader.fullName,
                                      email: uploader.email,
                                      avatar: uploader.avatar || null,
                                  }
                                : null,
                            conversionStatus: doc ? doc.conversionStatus : null,
                            createdAt: a.createdAt,
                            updatedAt: a.updatedAt,
                        };
                    }),
                },
            });
        } catch (error) {
            console.error('[UploadApprovalController.listPending] error:', error);
            return serverError(res, error.message || 'Failed to list upload approvals');
        }
    }

    async getPendingCount(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { projectId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);

            if (!normalizedProjectId) {
                return badRequest(res, 'projectId is required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view upload approvals');
            }

            const count = await UploadApprovalRepository.countPendingByProject(normalizedProjectId);

            return res.status(200).json({ success: true, data: { count } });
        } catch (error) {
            console.error('[UploadApprovalController.getPendingCount] error:', error);
            return serverError(res, error.message || 'Failed to get pending count');
        }
    }

    async approve(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { approvalId, projectId } = req.body || {};
            const normalizedApprovalId = normalizeString(approvalId);
            const normalizedProjectId = normalizeString(projectId);

            if (!normalizedApprovalId || !normalizedProjectId) {
                return badRequest(res, 'approvalId and projectId are required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can review uploads');
            }
            if (member.role !== 'owner' && member.role !== 'admin' && member.role !== 'manager') {
                return forbidden(res, 'Only owner, admin, or manager can approve uploads');
            }

            const approval = await UploadApprovalRepository.findByPublicId(normalizedApprovalId);
            if (!approval) {
                return notFound(res, 'Upload approval not found');
            }
            if (approval.projectId !== normalizedProjectId) {
                return notFound(res, 'Upload approval not found in this project');
            }
            if (approval.status !== 'pending') {
                return badRequest(res, `Upload has already been ${approval.status}`);
            }

            const updated = await UploadApprovalRepository.approve(normalizedApprovalId, userId);

            await DocumentRepository.updateApprovalStatus(approval.documentId, 'approved');

            // Trigger IFC-to-XKT conversion for approved IFC files
            const doc = await DocumentRepository.findByPublicId(approval.documentId);
            if (doc) {
                const ext = path.extname(doc.originalName || '').toLowerCase();
                if (ext === '.ifc') {
                    try {
                        await publishIfcConversionJob({
                            projectId: doc.projectId,
                            documentId: doc.publicId,
                            versionId: doc.publicId,
                            ifcS3Bucket: doc.s3Bucket,
                            ifcS3Key: doc.s3Key,
                            requestedBy: userId,
                        });
                    } catch (convErr) {
                        console.error('[UploadApprovalController.approve] IFC conversion job publish failed:', convErr.message);
                    }
                }
            }

            await ActivityService.log({
                projectId: normalizedProjectId,
                packageId: null,
                userId,
                type: 'upload_approved',
                targetId: approval.documentId,
                targetName: approval.originalName,
                metadata: {
                    versionLabel: approval.versionLabel,
                    versionNumber: approval.versionNumber,
                    uploaderId: approval.uploaderId,
                },
            });

            broadcastProject(normalizedProjectId, 'approval:updated', {
                projectId: normalizedProjectId,
                approvalId: normalizedApprovalId,
                status: 'approved',
            });

            return res.status(200).json({
                success: true,
                message: 'Upload approved',
                data: { approval: updated },
            });
        } catch (error) {
            console.error('[UploadApprovalController.approve] error:', error);
            return serverError(res, error.message || 'Failed to approve upload');
        }
    }

    async reject(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { approvalId, projectId, reason } = req.body || {};
            const normalizedApprovalId = normalizeString(approvalId);
            const normalizedProjectId = normalizeString(projectId);
            const normalizedReason = normalizeString(reason) || '';

            if (!normalizedApprovalId || !normalizedProjectId) {
                return badRequest(res, 'approvalId and projectId are required');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can review uploads');
            }
            if (member.role !== 'owner' && member.role !== 'admin' && member.role !== 'manager') {
                return forbidden(res, 'Only owner, admin, or manager can reject uploads');
            }

            const approval = await UploadApprovalRepository.findByPublicId(normalizedApprovalId);
            if (!approval) {
                return notFound(res, 'Upload approval not found');
            }
            if (approval.projectId !== normalizedProjectId) {
                return notFound(res, 'Upload approval not found in this project');
            }
            if (approval.status !== 'pending') {
                return badRequest(res, `Upload has already been ${approval.status}`);
            }

            const updated = await UploadApprovalRepository.reject(normalizedApprovalId, userId, normalizedReason);

            await DocumentRepository.updateApprovalStatus(approval.documentId, 'rejected');

            await ActivityService.log({
                projectId: normalizedProjectId,
                packageId: null,
                userId,
                type: 'upload_rejected',
                targetId: approval.documentId,
                targetName: approval.originalName,
                metadata: {
                    versionLabel: approval.versionLabel,
                    versionNumber: approval.versionNumber,
                    uploaderId: approval.uploaderId,
                    rejectionReason: normalizedReason,
                },
            });

            broadcastProject(normalizedProjectId, 'approval:updated', {
                projectId: normalizedProjectId,
                approvalId: normalizedApprovalId,
                status: 'rejected',
            });

            return res.status(200).json({
                success: true,
                message: 'Upload rejected',
                data: { approval: updated },
            });
        } catch (error) {
            console.error('[UploadApprovalController.reject] error:', error);
            return serverError(res, error.message || 'Failed to reject upload');
        }
    }

    async listComments(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { approvalId } = req.body || {};
            const normalizedApprovalId = normalizeString(approvalId);

            if (!normalizedApprovalId) {
                return badRequest(res, 'approvalId is required');
            }

            const approval = await UploadApprovalRepository.findByPublicId(normalizedApprovalId);
            if (!approval) return notFound(res, 'Upload approval not found');

            const member = await ProjectMemberRepository.findMember(approval.projectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can view comments');
            }

            const comments = await UploadApprovalComment.find({ approvalId: normalizedApprovalId })
                .sort({ createdAt: -1 });

            const authorIds = [...new Set(comments.map(c => c.authorId))];
            const validIds = authorIds.filter(id => {
                try {
                    const mongoose = require('mongoose');
                    return mongoose.Types.ObjectId.isValid(id);
                } catch { return false; }
            });

            let userMap = new Map();
            if (validIds.length > 0) {
                const users = await User.find({ _id: { $in: validIds } })
                    .select('publicId fullName avatar email')
                    .lean();
                for (const u of users) userMap.set(String(u._id), u);
            }

            return res.status(200).json({
                success: true,
                data: {
                    comments: comments.map(c => {
                        const author = userMap.get(String(c.authorId));
                        return {
                            publicId: c.publicId,
                            approvalId: c.approvalId,
                            content: c.content,
                            author: author
                                ? { id: author.publicId, name: author.fullName, email: author.email, avatar: author.avatar || null }
                                : null,
                            createdAt: c.createdAt,
                            updatedAt: c.updatedAt,
                        };
                    }),
                },
            });
        } catch (error) {
            console.error('[UploadApprovalController.listComments] error:', error);
            return serverError(res, 'Failed to list comments');
        }
    }

    async addComment(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { approvalId, content } = req.body || {};
            const normalizedApprovalId = normalizeString(approvalId);
            const normalizedContent = normalizeString(content);

            if (!normalizedApprovalId || !normalizedContent) {
                return badRequest(res, 'approvalId and content are required');
            }

            const approval = await UploadApprovalRepository.findByPublicId(normalizedApprovalId);
            if (!approval) return notFound(res, 'Upload approval not found');

            const member = await ProjectMemberRepository.findMember(approval.projectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can comment');
            }

            const comment = await UploadApprovalComment.create({
                approvalId: normalizedApprovalId,
                projectId: approval.projectId,
                authorId: userId,
                content: normalizedContent,
            });

            const author = await User.findById(userId).select('publicId fullName avatar email').lean();

            broadcastProject(approval.projectId, 'approval:updated', {
                projectId: approval.projectId,
                approvalId: normalizedApprovalId,
                status: 'comment_added',
            });

            return res.status(201).json({
                success: true,
                data: {
                    comment: {
                        publicId: comment.publicId,
                        approvalId: comment.approvalId,
                        content: comment.content,
                        author: author
                            ? { id: author.publicId, name: author.fullName, email: author.email, avatar: author.avatar || null }
                            : null,
                        createdAt: comment.createdAt,
                        updatedAt: comment.updatedAt,
                    },
                },
            });
        } catch (error) {
            console.error('[UploadApprovalController.addComment] error:', error);
            return serverError(res, 'Failed to add comment');
        }
    }

    async deleteComment(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const { commentId } = req.body || {};
            const normalizedCommentId = normalizeString(commentId);

            if (!normalizedCommentId) {
                return badRequest(res, 'commentId is required');
            }

            const comment = await UploadApprovalComment.findOne({ publicId: normalizedCommentId });
            if (!comment) return notFound(res, 'Comment not found');

            const member = await ProjectMemberRepository.findMember(comment.projectId, userId);
            const isAdmin = member && ['owner', 'admin', 'manager'].includes(member.role);

            if (comment.authorId !== userId && !isAdmin) {
                return forbidden(res, 'Only the author or admin can delete this comment');
            }

            await UploadApprovalComment.deleteOne({ publicId: normalizedCommentId });

            return res.status(200).json({ success: true, message: 'Comment deleted' });
        } catch (error) {
            console.error('[UploadApprovalController.deleteComment] error:', error);
            return serverError(res, 'Failed to delete comment');
        }
    }
}

module.exports = new UploadApprovalController();
