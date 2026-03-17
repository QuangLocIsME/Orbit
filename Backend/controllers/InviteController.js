const crypto = require('node:crypto');
const ProjectInviteRepository = require('../repositories/ProjectInviteRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const UserRepository = require('../repositories/UserRepository');
const { errorResponse } = require('../utils/response');

const INVITE_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

class InviteController {
    async createInvite(req, res) {
        try {
            const { projectId, email, role } = req.body || {};
            const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
            const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
            const normalizedRole = typeof role === 'string' ? role.trim() : '';
            if (!normalizedProjectId || !normalizedEmail) {
                return errorResponse(res, 400, 'Missing projectId or email');
            }

            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = hashToken(token);

            const invite = await ProjectInviteRepository.createInvite({
                projectId: normalizedProjectId,
                email: normalizedEmail,
                role: normalizedRole || 'member',
                tokenHash,
                status: 'pending',
                invitedBy: req.user?.id || 'system',
                expiresAt: new Date(Date.now() + INVITE_EXPIRES_MS),
            });

            return res.status(201).json({
                success: true,
                message: 'Invite created',
                data: {
                    inviteId: invite._id,
                    token,
                    expiresAt: invite.expiresAt,
                },
            });
        } catch (error) {
            return errorResponse(res, 400, 'Create invite failed');
        }
    }

    async acceptInvite(req, res) {
        try {
            const { token } = req.body || {};
            const normalizedToken = typeof token === 'string' ? token.trim() : '';
            if (!normalizedToken) {
                return errorResponse(res, 400, 'Missing token');
            }

            const tokenHash = hashToken(normalizedToken);
            const invite = await ProjectInviteRepository.findByTokenHash(tokenHash);

            if (!invite || invite.status !== 'pending') {
                return errorResponse(res, 404, 'Invite not found or invalid');
            }

            if (invite.expiresAt <= new Date()) {
                await ProjectInviteRepository.revokeInvite(invite._id);
                return errorResponse(res, 400, 'Invite expired');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const profile = await UserRepository.getProfileById(userId);
            if (!profile || profile.email !== invite.email) {
                return errorResponse(res, 403, 'Forbidden');
            }

            await ProjectMemberRepository.addMember({
                projectId: invite.projectId,
                userId,
                role: invite.role,
                status: 'accepted',
                invitedBy: invite.invitedBy,
            });

            await ProjectInviteRepository.markAccepted(invite._id);

            return res.status(200).json({
                success: true,
                message: 'Invite accepted',
            });
        } catch (error) {
            return errorResponse(res, 400, 'Accept invite failed');
        }
    }

    async revokeInvite(req, res) {
        try {
            const { inviteId } = req.body || {};
            const normalizedInviteId = typeof inviteId === 'string' ? inviteId.trim() : '';
            if (!normalizedInviteId) {
                return errorResponse(res, 400, 'Missing inviteId');
            }

            const invite = await ProjectInviteRepository.revokeInvite(normalizedInviteId);
            if (!invite) {
                return errorResponse(res, 404, 'Invite not found');
            }

            return res.status(200).json({
                success: true,
                message: 'Invite revoked',
            });
        } catch (error) {
            return errorResponse(res, 400, 'Revoke invite failed');
        }
    }

    async listInvites(req, res) {
        try {
            const { projectId } = req.body || {};
            const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
            if (!normalizedProjectId) {
                return errorResponse(res, 400, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || member.role !== 'admin') {
                return errorResponse(res, 403, 'Forbidden');
            }

            const invites = await ProjectInviteRepository.listByProject(normalizedProjectId);

            return res.status(200).json({
                success: true,
                data: invites,
            });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to load invites');
        }
    }
}

module.exports = new InviteController();
