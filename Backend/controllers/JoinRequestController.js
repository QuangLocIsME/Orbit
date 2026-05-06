const JoinRequest = require('../models/JoinRequest');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const UserRepository = require('../repositories/UserRepository');
const socketService = require('../services/socketService');
const { errorResponse } = require('../utils/response');

class JoinRequestController {
    async createRequest(req, res) {
        try {
            const { projectId, message } = req.body || {};
            const pId = typeof projectId === 'string' ? projectId.trim() : '';

            if (!pId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const profile = await UserRepository.getProfileById(userId);
            if (!profile) return errorResponse(res, 401, 'Unauthorized');

            const existing = await JoinRequest.findOne({
                projectId: pId,
                requestedBy: userId,
                status: 'pending',
            });
            if (existing) {
                return errorResponse(res, 409, 'You already have a pending join request for this project');
            }

            const member = await ProjectMemberRepository.findMember(pId, userId);
            if (member) {
                return errorResponse(res, 409, 'You are already a member of this project');
            }

            const joinRequest = new JoinRequest({
                projectId: pId,
                requestedBy: userId,
                requestedByEmail: profile.email,
                requestedByName: profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
                message: typeof message === 'string' ? message.trim() : '',
                status: 'pending',
            });
            await joinRequest.save();

            const owners = await ProjectMemberRepository.findMembersByRole(pId, ['owner', 'admin']);
            for (const owner of owners) {
                socketService.notifyUser(owner.userId, 'join-request:new', {
                    requestId: String(joinRequest._id),
                    projectId: pId,
                    requestedBy: profile.fullName || profile.email,
                    requestedByEmail: profile.email,
                    message: joinRequest.message,
                });
            }

            return res.status(201).json({
                success: true,
                message: 'Join request sent',
                data: { requestId: String(joinRequest._id) },
            });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to create join request');
        }
    }

    async listRequests(req, res) {
        try {
            const { projectId, status } = req.query || {};
            const pId = typeof projectId === 'string' ? projectId.trim() : '';

            if (!pId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(pId, userId);
            if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
                return errorResponse(res, 403, 'Forbidden');
            }

            const query = { projectId: pId };
            if (status) query.status = status;

            const requests = await JoinRequest.find(query).sort({ createdAt: -1 });
            return res.status(200).json({
                success: true,
                data: requests.map(r => ({
                    id: String(r._id),
                    projectId: r.projectId,
                    requestedBy: r.requestedBy,
                    requestedByEmail: r.requestedByEmail,
                    requestedByName: r.requestedByName,
                    role: r.role,
                    message: r.message,
                    status: r.status,
                    reviewedBy: r.reviewedBy,
                    reviewedAt: r.reviewedAt,
                    createdAt: r.createdAt,
                })),
            });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to list join requests');
        }
    }

    async approveRequest(req, res) {
        try {
            const { requestId } = req.body || {};
            const reqId = typeof requestId === 'string' ? requestId.trim() : '';

            if (!reqId) return errorResponse(res, 400, 'Missing requestId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const joinRequest = await JoinRequest.findById(reqId);
            if (!joinRequest || joinRequest.status !== 'pending') {
                return errorResponse(res, 404, 'Join request not found');
            }

            const member = await ProjectMemberRepository.findMember(joinRequest.projectId, userId);
            if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
                return errorResponse(res, 403, 'Forbidden');
            }

            await ProjectMemberRepository.addMember({
                projectId: joinRequest.projectId,
                userId: joinRequest.requestedBy,
                role: joinRequest.role,
                status: 'accepted',
                invitedBy: userId,
            });

            await socketService.invalidateMembershipCache(joinRequest.projectId, joinRequest.requestedBy);

            joinRequest.status = 'approved';
            joinRequest.reviewedBy = userId;
            joinRequest.reviewedAt = new Date();
            await joinRequest.save();

            socketService.notifyUser(joinRequest.requestedBy, 'join-request:approved', {
                requestId: String(joinRequest._id),
                projectId: joinRequest.projectId,
                role: joinRequest.role,
            });

            socketService.invalidateUserCache(joinRequest.requestedBy, ['projects']);

            return res.status(200).json({ success: true, message: 'Join request approved' });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to approve join request');
        }
    }

    async rejectRequest(req, res) {
        try {
            const { requestId } = req.body || {};
            const reqId = typeof requestId === 'string' ? requestId.trim() : '';

            if (!reqId) return errorResponse(res, 400, 'Missing requestId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const joinRequest = await JoinRequest.findById(reqId);
            if (!joinRequest || joinRequest.status !== 'pending') {
                return errorResponse(res, 404, 'Join request not found');
            }

            const member = await ProjectMemberRepository.findMember(joinRequest.projectId, userId);
            if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
                return errorResponse(res, 403, 'Forbidden');
            }

            joinRequest.status = 'rejected';
            joinRequest.reviewedBy = userId;
            joinRequest.reviewedAt = new Date();
            await joinRequest.save();

            socketService.notifyUser(joinRequest.requestedBy, 'join-request:rejected', {
                requestId: String(joinRequest._id),
                projectId: joinRequest.projectId,
            });

            return res.status(200).json({ success: true, message: 'Join request rejected' });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to reject join request');
        }
    }

    async cancelRequest(req, res) {
        try {
            const { requestId } = req.body || {};
            const reqId = typeof requestId === 'string' ? requestId.trim() : '';

            if (!reqId) return errorResponse(res, 400, 'Missing requestId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const joinRequest = await JoinRequest.findById(reqId);
            if (!joinRequest) return errorResponse(res, 404, 'Join request not found');
            if (joinRequest.requestedBy !== userId) return errorResponse(res, 403, 'Forbidden');
            if (joinRequest.status !== 'pending') return errorResponse(res, 400, 'Request already processed');

            await JoinRequest.deleteOne({ _id: reqId });
            return res.status(200).json({ success: true, message: 'Request cancelled' });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to cancel join request');
        }
    }
}

module.exports = new JoinRequestController();
