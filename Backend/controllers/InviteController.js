const crypto = require('crypto');
const ProjectInviteRepository = require('../repositories/ProjectInviteRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const UserRepository = require('../repositories/UserRepository');

const INVITE_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

class InviteController {
    async createInvite(req, res) {
        try {
            const { projectId, email, role } = req.body || {};
            if (!projectId || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing projectId or email',
                });
            }

            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = hashToken(token);
            const normalizedEmail = email.toLowerCase().trim();

            const invite = await ProjectInviteRepository.createInvite({
                projectId,
                email: normalizedEmail,
                role: role || 'member',
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Create invite failed',
            });
        }
    }

    async acceptInvite(req, res) {
        try {
            const { token } = req.body || {};
            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing token',
                });
            }

            const tokenHash = hashToken(token);
            const invite = await ProjectInviteRepository.findByTokenHash(tokenHash);

            if (!invite || invite.status !== 'pending') {
                return res.status(404).json({
                    success: false,
                    message: 'Invite not found or invalid',
                });
            }

            if (invite.expiresAt <= new Date()) {
                await ProjectInviteRepository.revokeInvite(invite._id);
                return res.status(400).json({
                    success: false,
                    message: 'Invite expired',
                });
            }

            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
                });
            }

            const profile = await UserRepository.getProfileById(userId);
            if (!profile || profile.email !== invite.email) {
                return res.status(403).json({
                    success: false,
                    message: 'Invite email mismatch',
                });
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
            return res.status(400).json({
                success: false,
                message: error.message || 'Accept invite failed',
            });
        }
    }

    async revokeInvite(req, res) {
        try {
            const { inviteId } = req.body || {};
            if (!inviteId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing inviteId',
                });
            }

            const invite = await ProjectInviteRepository.revokeInvite(inviteId);
            if (!invite) {
                return res.status(404).json({
                    success: false,
                    message: 'Invite not found',
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Invite revoked',
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Revoke invite failed',
            });
        }
    }

    async listInvites(req, res) {
        try {
            const { projectId } = req.body || {};
            if (!projectId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing projectId',
                });
            }

            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Missing access token',
                });
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only project admins can view invites',
                });
            }

            const invites = await ProjectInviteRepository.listByProject(projectId);

            return res.status(200).json({
                success: true,
                data: invites,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to load invites',
            });
        }
    }
}

module.exports = new InviteController();
