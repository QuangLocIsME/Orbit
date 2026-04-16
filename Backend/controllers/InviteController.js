const crypto = require('node:crypto');
const ProjectInviteRepository = require('../repositories/ProjectInviteRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const UserRepository = require('../repositories/UserRepository');
const socketService = require('../services/socketService');
const emailService = require('../services/emailService');
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

            const callerId = req.user?.id;
            if (!callerId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            // RBAC: owner and admin can invite members
            const callerMember = await ProjectMemberRepository.findMember(normalizedProjectId, callerId);
            if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'owner')) {
                return errorResponse(res, 403, 'Only admins and project owners can invite members');
            }

            // Check for duplicate pending invite
            const existing = await ProjectInviteRepository.findPendingByEmailAndProject(normalizedEmail, normalizedProjectId);
            if (existing) {
                return errorResponse(res, 409, 'A pending invite already exists for this email in this project');
            }

            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = hashToken(token);

            const invite = await ProjectInviteRepository.createInvite({
                projectId: normalizedProjectId,
                email: normalizedEmail,
                role: normalizedRole || 'member',
                tokenHash,
                status: 'pending',
                invitedBy: callerId,
                expiresAt: new Date(Date.now() + INVITE_EXPIRES_MS),
            });

            // Look up invitee's userId for real-time notification
            const inviteeProfile = await UserRepository.findByEmail(normalizedEmail);
            const frontendBase =
                process.env.FRONTEND_URI ||
                process.env.FRONTED_URI ||
                'http://localhost:4321';
            const acceptUrl = `${frontendBase.replace(/\/$/, '')}/invite/${token}`;

            // Real-time notification if invitee has an account
            if (inviteeProfile) {
                const inviterProfile = await UserRepository.getProfileById(callerId);
                socketService.notifyUser(String(inviteeProfile._id), 'invite:new', {
                    inviteId: String(invite._id),
                    token, // raw token — needed for accept endpoint
                    projectId: normalizedProjectId,
                    projectName: req.body?.projectName || 'a project',
                    role: invite.role,
                    inviterName: inviterProfile?.fullName || 'Someone',
                    acceptUrl,
                });
            }

            // Send invite email (fire-and-forget — don't block the response)
            const inviterProfile = await UserRepository.getProfileById(callerId);
            emailService.sendInviteEmail({
                toEmail: normalizedEmail,
                inviterName: inviterProfile?.fullName || 'Someone',
                projectName: req.body?.projectName || 'a project',
                role: invite.role,
                acceptUrl,
            }).catch((err) => console.warn('[Invite] Email send failed:', err.message));

            return res.status(201).json({
                success: true,
                message: 'Invite created',
                data: {
                    inviteId: String(invite._id),
                    token,
                    expiresAt: invite.expiresAt,
                    acceptUrl,
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
                return errorResponse(res, 403, 'This invitation was sent to a different email address');
            }

            await ProjectMemberRepository.addMember({
                projectId: invite.projectId,
                userId,
                role: invite.role,
                status: 'accepted',
                invitedBy: invite.invitedBy,
            });

            await ProjectInviteRepository.markAccepted(invite._id);

            // Notify inviter in real-time
            socketService.notifyUser(String(invite.invitedBy), 'invite:accepted', {
                projectId: invite.projectId,
                inviteId: String(invite._id),
                acceptedBy: profile.fullName,
            });

            // Bust inviter's project list cache so new member appears
            socketService.invalidateUserCache(String(invite.invitedBy), ['projects']);

            // Bust B's own project list cache (B is now a member of this project)
            socketService.invalidateUserCache(userId, ['projects']);

            // Tell all project members (including inviter) that a new member joined
            socketService.broadcastProject(invite.projectId, 'project:member:joined', {
                projectId: invite.projectId,
                userId,
                fullName: profile.fullName,
            });

            return res.status(200).json({
                success: true,
                message: 'Invite accepted',
            });
        } catch (error) {
            return errorResponse(res, 400, 'Accept invite failed');
        }
    }

    /**
     * Decline invite — called by invitee when they reject via AlertDialog.
     * Sends invite:declined to inviter so their invites list refreshes.
     */
    async declineInvite(req, res) {
        try {
            const { inviteId } = req.body || {};
            const normalizedInviteId = typeof inviteId === 'string' ? inviteId.trim() : '';
            if (!normalizedInviteId) {
                return errorResponse(res, 400, 'Missing inviteId');
            }

            const invite = await ProjectInviteRepository.findById(normalizedInviteId);
            if (!invite) {
                return errorResponse(res, 404, 'Invite not found');
            }

            // Verify the caller is the invitee
            const callerId = req.user?.id;
            if (!callerId) return errorResponse(res, 401, 'Unauthorized');
            const profile = await UserRepository.getProfileById(callerId);
            if (!profile || profile.email !== invite.email) {
                return errorResponse(res, 403, 'Not authorized to decline this invite');
            }

            await ProjectInviteRepository.revokeInvite(normalizedInviteId);

            // Tell inviter their invite was declined
            if (invite.invitedBy) {
                socketService.notifyUser(String(invite.invitedBy), 'invite:declined', {
                    projectId: invite.projectId,
                    inviteId: normalizedInviteId,
                    declinedBy: profile.fullName,
                });
            }

            return res.status(200).json({ success: true, message: 'Invite declined' });
        } catch (error) {
            return errorResponse(res, 400, 'Decline invite failed');
        }
    }

    async revokeInvite(req, res) {
        try {
            const { inviteId } = req.body || {};
            const normalizedInviteId = typeof inviteId === 'string' ? inviteId.trim() : '';
            if (!normalizedInviteId) {
                return errorResponse(res, 400, 'Missing inviteId');
            }

            const callerId = req.user?.id;
            if (!callerId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            // Find the invite to get projectId for RBAC check
            const invite = await ProjectInviteRepository.findById(normalizedInviteId);
            if (!invite) {
                return errorResponse(res, 404, 'Invite not found');
            }

            const callerMember = await ProjectMemberRepository.findMember(invite.projectId, callerId);
            if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'owner')) {
                return errorResponse(res, 403, 'Only admins and project owners can revoke invites');
            }

            const revoked = await ProjectInviteRepository.revokeInvite(normalizedInviteId);

            // Notify project members that invite was revoked
            socketService.broadcastProject(invite.projectId, 'invite:revoked', {
                projectId: invite.projectId,
                inviteId: normalizedInviteId,
            });

            return res.status(200).json({
                success: true,
                message: 'Invite revoked',
                data: revoked,
            });
        } catch (error) {
            return errorResponse(res, 400, 'Revoke invite failed');
        }
    }

    async listInvites(req, res) {
        try {
            // Support both GET (query) and POST (body) for backward compat
            const normalizedProjectId = req.query?.projectId
                ? String(req.query.projectId).trim()
                : req.body?.projectId
                    ? String(req.body.projectId).trim()
                    : '';

            if (!normalizedProjectId) {
                return errorResponse(res, 400, 'Missing projectId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            // RBAC: owner and admin can list pending invites
            const member = await ProjectMemberRepository.findMember(normalizedProjectId, userId);
            if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
                return errorResponse(res, 403, 'Forbidden');
            }

            const invites = await ProjectInviteRepository.listByProject(normalizedProjectId);
            const normalizedInvites = invites.map((inviteDoc) => {
                const invite = typeof inviteDoc.toObject === 'function'
                    ? inviteDoc.toObject()
                    : inviteDoc;
                return {
                    ...invite,
                    publicId: String(invite._id),
                };
            });

            return res.status(200).json({
                success: true,
                data: normalizedInvites,
            });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to load invites');
        }
    }
}

module.exports = new InviteController();
