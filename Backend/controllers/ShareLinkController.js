const crypto = require('crypto');
const ShareLink = require('../models/ShareLink');
const Package = require('../models/Package');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const socketService = require('../services/socketService');
const { errorResponse } = require('../utils/response');

const SHARE_TYPES = new Set(['project', 'packages', 'team']);
const ACCESS_ROLES = new Set(['guest', 'viewer', 'member', 'contractor']);
const ALLOWED_PAGES = new Set(['overview', 'documents', 'versions', 'tasks', 'changes', 'clashes']);

const normalizeStringList = (value) => (
    Array.isArray(value)
        ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
        : []
);

const normalizeShareType = (shareType, packageIds = []) => {
    const type = typeof shareType === 'string' ? shareType.trim() : '';
    if (SHARE_TYPES.has(type)) return type;
    return packageIds.length > 0 ? 'packages' : 'project';
};

const normalizeAllowedRoles = (roles) => {
    const next = normalizeStringList(roles).filter((role) => ACCESS_ROLES.has(role));
    return next.length > 0 ? next : ['guest'];
};

const normalizeAllowedPages = (pages) => {
    const next = normalizeStringList(pages).filter((page) => ALLOWED_PAGES.has(page));
    return next.length > 0 ? next : ['overview', 'documents'];
};

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

    async normalizeScope({ projectId, shareType, packageIds }) {
        const pkgIds = normalizeStringList(packageIds);
        const type = normalizeShareType(shareType, pkgIds);

        if (type === 'project') {
            return { shareType: 'project', packageIds: [] };
        }

        if (type === 'packages') {
            if (pkgIds.length === 0) {
                return { error: 'Please select at least one package to share' };
            }

            const packages = await Package.find({
                projectId,
                publicId: { $in: pkgIds },
                trashedAt: null,
            }).select('publicId').lean();
            const validIds = new Set(packages.map((pkg) => String(pkg.publicId)));
            const missingIds = pkgIds.filter((id) => !validIds.has(id));
            if (missingIds.length > 0) {
                return { error: 'One or more selected packages are invalid' };
            }

            return { shareType: 'packages', packageIds: pkgIds };
        }

        return { shareType: type, packageIds: pkgIds };
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

            const scope = await this.normalizeScope({ projectId: pId, shareType, packageIds });
            if (scope.error) return errorResponse(res, 400, scope.error);
            const tIds = normalizeStringList(teamIds);
            const allowedRoleList = normalizeAllowedRoles(allowedRoles);
            const allowedPageList = normalizeAllowedPages(allowedPages);
            const allowedTeamList = normalizeStringList(allowedTeamIds);

            const rawToken = this.generateToken();
            const tokenHash = this.hashToken(rawToken);
            const shareUrl = this.buildShareUrl(rawToken);

            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            const shareLink = new ShareLink({
                projectId: pId,
                packageIds: scope.packageIds,
                teamIds: tIds,
                tokenHash,
                shareUrl,
                label: typeof label === 'string' ? label.trim() : '',
                shareType: scope.shareType,
                allowedRoles: allowedRoleList,
                allowedPages: allowedPageList,
                allowedTeamIds: allowedTeamList,
                createdBy: userId,
                expiresAt,
                isActive: true,
            });
            await shareLink.save();
            socketService.broadcastProject(pId, 'share-links:changed', {
                projectId: pId,
                action: 'created',
                shareId: String(shareLink._id),
            });

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
                socketService.broadcastProject(pId, 'share-links:changed', {
                    projectId: pId,
                    action: 'deleted',
                    shareId: sId,
                });
            } else {
                const query = { projectId: pId, isActive: true };
                if (packageId) {
                    query.packageIds = typeof packageId === 'string' ? packageId.trim() : packageId;
                }
                await ShareLink.updateMany(query, { isActive: false });
                socketService.broadcastProject(pId, 'share-links:changed', {
                    projectId: pId,
                    action: 'bulk_deleted',
                    packageId: packageId ? String(packageId).trim() : undefined,
                });
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

            const nextPackageIds = Array.isArray(packageIds) ? packageIds : link.packageIds;
            const nextShareType = typeof shareType === 'string' ? shareType : link.shareType;
            const scope = await this.normalizeScope({ projectId: pId, shareType: nextShareType, packageIds: nextPackageIds });
            if (scope.error) return errorResponse(res, 400, scope.error);

            if (Array.isArray(allowedRoles)) link.allowedRoles = normalizeAllowedRoles(allowedRoles);
            if (Array.isArray(allowedPages)) link.allowedPages = normalizeAllowedPages(allowedPages);
            if (Array.isArray(allowedTeamIds)) link.allowedTeamIds = normalizeStringList(allowedTeamIds);
            if (typeof label === 'string') link.label = label.trim();
            link.shareType = scope.shareType;
            link.packageIds = scope.packageIds;
            if (Array.isArray(teamIds)) link.teamIds = normalizeStringList(teamIds);

            await link.save();
            socketService.broadcastProject(pId, 'share-links:changed', {
                projectId: pId,
                action: 'updated',
                shareId: sId,
            });

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
