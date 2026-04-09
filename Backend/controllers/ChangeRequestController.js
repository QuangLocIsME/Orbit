const ChangeRequestRepository = require('../repositories/ChangeRequestRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const { errorResponse } = require('../utils/response');

const normalizeString = (val) => {
    if (typeof val !== 'string') return '';
    return val.trim();
};

class ChangeRequestController {
    async listByProject(req, res) {
        try {
            const projectId = req.params?.projectSlug || req.body?.projectId || req.query?.projectId;
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
                })),
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list change requests');
        }
    }

    async create(req, res) {
        try {
            const projectId = req.params?.projectSlug || req.body?.projectId;
            const { title, description, priority, affectedModels, disciplineId, assignedTo, reviewers, estimatedImpact, estimatedCost, estimatedDuration, deadline, detailedDescription } = req.body || {};

            if (!projectId) {
                return errorResponse(res, 400, 'Missing projectId');
            }

            if (!normalizeString(title)) {
                return errorResponse(res, 400, 'Title is required');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.role === 'viewer') {
                return errorResponse(res, 403, 'Forbidden');
            }

            const normalizedTitle = normalizeString(title);
            const normalizedDescription = normalizeString(description);
            const normalizedPriority = ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium';
            const normalizedAffectedModels = Array.isArray(affectedModels) ? affectedModels : [];
            const normalizedDisciplineId = normalizeString(disciplineId) || null;

            const normalizedAssignedTo = Array.isArray(assignedTo) ? assignedTo : [];
            const normalizedReviewers = Array.isArray(reviewers) ? reviewers : [];
            const normalizedEstimatedImpact = ['low', 'medium', 'high'].includes(estimatedImpact) ? estimatedImpact : null;
            const normalizedEstimatedCost = estimatedCost != null && !isNaN(Number(estimatedCost)) ? Number(estimatedCost) : null;
            const normalizedEstimatedDuration = normalizeString(estimatedDuration);
            const normalizedDeadline = deadline ? new Date(deadline) : null;
            const normalizedDetailedDescription = normalizeString(detailedDescription);

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
                createdBy: userId,
                status: 'pending',
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
                    estimatedImpact: changeRequest.estimatedImpact || null,
                    estimatedCost: changeRequest.estimatedCost ?? null,
                    estimatedDuration: changeRequest.estimatedDuration || '',
                    deadline: changeRequest.deadline || null,
                    detailedDescription: changeRequest.detailedDescription || '',
                    createdBy: changeRequest.createdBy,
                    createdAt: changeRequest.createdAt,
                    updatedAt: changeRequest.updatedAt,
                },
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to create change request');
        }
    }

    async updateStatus(req, res) {
        try {
            const { crId, status } = req.body || {};
            const normalizedCrId = normalizeString(crId);
            const normalizedStatus = ['pending', 'in-progress', 'approved', 'completed', 'rejected'].includes(status) ? status : null;

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

            const updated = await ChangeRequestRepository.updateStatus(normalizedCrId, normalizedStatus);

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
            if (!member || member.role !== 'admin') {
                return errorResponse(res, 403, 'Forbidden');
            }

            await ChangeRequestRepository.delete(normalizedCrId);

            return res.status(200).json({
                success: true,
                message: 'Change request deleted',
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to delete change request');
        }
    }
}

module.exports = new ChangeRequestController();
