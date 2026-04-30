const crypto = require('crypto');
const ShareLink = require('../models/ShareLink');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const { errorResponse } = require('../utils/response');

class ShareLinkController {
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    getBaseUrl() {
        if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
        if (process.env.NODE_ENV === 'production') return 'https://ssorbit.com';
        return 'http://localhost:4321';
    }

    buildShareUrl(token) {
        return `${this.getBaseUrl()}/share/${token}`;
    }

    async createShareLink(req, res) {
        try {
            const { projectId, packageIds, teamIds, shareType, label, allowedRoles, allowedPages, allowedTeamIds } = req.body || {};
            const pId = typeof projectId === 'string' ? projectId.trim() : '';

            if (!pId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(pId, userId);
            if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
                return errorResponse(res, 403, 'Only owner or admin can create share links');
            }

            const type = shareType || (packageIds && packageIds.length > 0 ? 'packages' : 'project');
            const pkgIds = Array.isArray(packageIds) ? packageIds.filter(Boolean).map(id => id.trim()) : [];
            const tIds = Array.isArray(teamIds) ? teamIds.filter(Boolean).map(id => id.trim()) : [];
            const allowedRoleList = Array.isArray(allowedRoles) ? allowedRoles : ['guest'];
            const allowedPageList = Array.isArray(allowedPages) ? allowedPages : ['overview', 'documents', 'tasks'];
            const allowedTeamList = Array.isArray(allowedTeamIds) ? allowedTeamIds.filter(Boolean).map(id => id.trim()) : [];

            const existing = await ShareLink.findOne({
                projectId: pId,
                shareType: type,
                packageIds: pkgIds,
                teamIds: tIds,
                isActive: true,
            });
            if (existing) {
                return res.status(200).json({
                    success: true,
                    message: 'Share link already exists',
                    data: {
                        id: String(existing._id),
                        projectId: existing.projectId,
                        packageIds: existing.packageIds,
                        teamIds: existing.teamIds,
                        shareType: existing.shareType,
                        shareUrl: existing.shareUrl,
                        label: existing.label,
                        allowedRoles: existing.allowedRoles,
                        allowedPages: existing.allowedPages,
                        allowedTeamIds: existing.allowedTeamIds,
                        createdAt: existing.createdAt,
                        expiresAt: existing.expiresAt,
                    },
                });
            }

            const rawToken = this.generateToken();
            const tokenHash = this.hashToken(rawToken);
            const shareUrl = this.buildShareUrl(rawToken);

            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            const shareLink = new ShareLink({
                projectId: pId,
                packageIds: pkgIds,
                teamIds: tIds,
                tokenHash,
                shareUrl,
                label: typeof label === 'string' ? label.trim() : '',
                shareType: type,
                allowedRoles: allowedRoleList,
                allowedPages: allowedPageList,
                allowedTeamIds: allowedTeamList,
                createdBy: userId,
                expiresAt,
                isActive: true,
            });
            await shareLink.save();

            return res.status(201).json({
                success: true,
                message: 'Share link created',
                data: {
                    id: String(shareLink._id),
                    projectId: shareLink.projectId,
                    packageIds: shareLink.packageIds,
                    teamIds: shareLink.teamIds,
                    shareType: shareLink.shareType,
                    shareUrl: shareLink.shareUrl,
                    label: shareLink.label,
                    allowedRoles: shareLink.allowedRoles,
                    allowedPages: shareLink.allowedPages,
                    allowedTeamIds: shareLink.allowedTeamIds,
                    createdAt: shareLink.createdAt,
                    expiresAt: shareLink.expiresAt,
                },
            });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to create share link');
        }
    }

    async getShareLink(req, res) {
        try {
            const { projectId, packageId, shareType } = req.query || {};
            const pId = typeof projectId === 'string' ? projectId.trim() : '';

            if (!pId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(pId, userId);
            if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
                return errorResponse(res, 403, 'Forbidden');
            }

            const query = { projectId: pId, isActive: true };
            if (packageId) {
                query.packageIds = typeof packageId === 'string' ? packageId.trim() : packageId;
            }
            if (shareType) {
                query.shareType = typeof shareType === 'string' ? shareType.trim() : shareType;
            }

            const links = await ShareLink.find(query).sort({ createdAt: -1 });

            return res.status(200).json({
                success: true,
                data: links.map(l => ({
                    id: String(l._id),
                    projectId: l.projectId,
                    packageIds: l.packageIds,
                    teamIds: l.teamIds,
                    shareType: l.shareType,
                    shareUrl: l.shareUrl,
                    label: l.label,
                    allowedRoles: l.allowedRoles,
                    allowedPages: l.allowedPages,
                    allowedTeamIds: l.allowedTeamIds,
                    createdAt: l.createdAt,
                    expiresAt: l.expiresAt,
                })),
            });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to get share links');
        }
    }

    async deleteShareLink(req, res) {
        try {
            const { shareId, projectId, packageId } = req.body || {};
            const pId = typeof projectId === 'string' ? projectId.trim() : '';

            if (!pId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(pId, userId);
            if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
                return errorResponse(res, 403, 'Only owner or admin can delete share links');
            }

            if (shareId) {
                const sId = typeof shareId === 'string' ? shareId.trim() : '';
                const link = await ShareLink.findOne({ _id: sId, projectId: pId });
                if (!link) return errorResponse(res, 404, 'Share link not found');
                link.isActive = false;
                await link.save();
            } else {
                const query = { projectId: pId, isActive: true };
                if (packageId) {
                    query.packageIds = typeof packageId === 'string' ? packageId.trim() : packageId;
                }
                await ShareLink.updateMany(query, { isActive: false });
            }

            return res.status(200).json({ success: true, message: 'Share link removed' });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to delete share link');
        }
    }

    async updateShareLink(req, res) {
        try {
            const { shareId, projectId, shareType, packageIds, teamIds, label, allowedRoles, allowedPages, allowedTeamIds } = req.body || {};
            const pId = typeof projectId === 'string' ? projectId.trim() : '';
            const sId = typeof shareId === 'string' ? shareId.trim() : '';

            if (!pId) return errorResponse(res, 400, 'Missing projectId');
            if (!sId) return errorResponse(res, 400, 'Missing shareId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(pId, userId);
            if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
                return errorResponse(res, 403, 'Only owner or admin can update share links');
            }

            const link = await ShareLink.findOne({ _id: sId, projectId: pId, isActive: true });
            if (!link) return errorResponse(res, 404, 'Share link not found');

            if (Array.isArray(allowedRoles)) link.allowedRoles = allowedRoles;
            if (Array.isArray(allowedPages)) link.allowedPages = allowedPages;
            if (Array.isArray(allowedTeamIds)) link.allowedTeamIds = allowedTeamIds.filter(Boolean).map(id => id.trim());
            if (typeof label === 'string') link.label = label.trim();
            if (typeof shareType === 'string') link.shareType = shareType;
            if (Array.isArray(packageIds)) link.packageIds = packageIds.filter(Boolean).map(id => id.trim());
            if (Array.isArray(teamIds)) link.teamIds = teamIds.filter(Boolean).map(id => id.trim());

            await link.save();

            return res.status(200).json({
                success: true,
                message: 'Share link updated',
                data: {
                    id: String(link._id),
                    projectId: link.projectId,
                    packageIds: link.packageIds,
                    teamIds: link.teamIds,
                    shareType: link.shareType,
                    shareUrl: link.shareUrl,
                    label: link.label,
                    allowedRoles: link.allowedRoles,
                    allowedPages: link.allowedPages,
                    allowedTeamIds: link.allowedTeamIds,
                    createdAt: link.createdAt,
                    expiresAt: link.expiresAt,
                },
            });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to update share link');
        }
    }

    async resolveShareLink(req, res) {
        try {
            const { token } = req.params;
            const rawToken = typeof token === 'string' ? token.trim() : '';

            if (!rawToken) return errorResponse(res, 400, 'Missing token');

            const tokenHash = this.hashToken(rawToken);
            const link = await ShareLink.findOne({ tokenHash, isActive: true });

            if (!link) return errorResponse(res, 404, 'Share link not found or has been revoked');
            if (new Date() > link.expiresAt) return errorResponse(res, 410, 'Share link has expired');

            return res.status(200).json({
                success: true,
                data: {
                    projectId: link.projectId,
                    packageIds: link.packageIds,
                    teamIds: link.teamIds,
                    shareType: link.shareType,
                    shareUrl: link.shareUrl,
                    label: link.label,
                    allowedRoles: link.allowedRoles,
                    allowedPages: link.allowedPages,
                    allowedTeamIds: link.allowedTeamIds,
                    role: 'guest',
                },
            });
        } catch (error) {
            return errorResponse(res, 500, 'Failed to resolve share link');
        }
    }
}

module.exports = new ShareLinkController();
