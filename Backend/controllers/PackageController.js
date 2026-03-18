const ProjectRepository = require('../repositories/ProjectRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');

function canManagePackages(member) {
    if (!member || member.status !== 'accepted') return false;
    if (member.role === 'viewer') return false;
    return true;
}

function assertProjectAndMember(projectId, userId, res) {
    return ProjectRepository.findByPublicId(projectId).then(async (project) => {
        if (!project) {
            res.status(404).json({ success: false, message: 'Project not found' });
            return null;
        }
        const member = await ProjectMemberRepository.findMember(projectId, userId);
        if (!member || member.status !== 'accepted') {
            res.status(403).json({
                success: false,
                message: 'Only project members can access packages',
            });
            return null;
        }
        return { project, member };
    });
}

/**
 * UC-PKG-001: Create New Package
 */
async function createPackage(req, res) {
    try {
        const { projectId, name, description, type, dueDate, teamMemberIds } = req.body || {};

        if (!projectId || !name) {
            return res.status(400).json({
                success: false,
                message: 'projectId and name are required',
            });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Missing access token',
            });
        }

        const ctx = await assertProjectAndMember(projectId, userId, res);
        if (!ctx) return;
        if (!canManagePackages(ctx.member)) {
            return res.status(403).json({
                success: false,
                message: 'Viewers do not have package management permission',
            });
        }

        const nameTrimmed = name.trim();
        const existing = await PackageRepository.findByProjectIdAndName(projectId, nameTrimmed);
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'A package with this name already exists in the project. Please use a unique name.',
            });
        }

        const packageDoc = await PackageRepository.create({
            projectId,
            name: nameTrimmed,
            description: description != null ? String(description).trim() : '',
            packageType: type != null ? String(type).trim() : '',
            status: 'Draft',
            dueDate: dueDate ? new Date(dueDate) : null,
            creatorId: userId,
            teamMemberIds: Array.isArray(teamMemberIds) ? teamMemberIds : [],
            documentIds: [],
            taskIds: [],
            archivedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return res.status(201).json({
            success: true,
            message: 'Package created',
            data: formatPackageResponse(packageDoc),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A package with this name already exists in the project. Please use a unique name.',
            });
        }
        return res.status(500).json({
            success: false,
            message: error.message || 'Create package failed',
        });
    }
}

function formatPackageResponse(doc) {
    return {
        publicId: doc.publicId,
        projectId: doc.projectId,
        name: doc.name,
        description: doc.description,
        packageType: doc.packageType,
        status: doc.status,
        dueDate: doc.dueDate,
        creatorId: doc.creatorId,
        teamMemberIds: doc.teamMemberIds,
        archivedAt: doc.archivedAt || null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

/**
 * Danh sách package theo trang:
 * listType: 'active' (mặc định) — Draft + Active, dùng cho trang chính
 * listType: 'archived' — chỉ Archived, dùng cho trang Archive
 * listType: 'all' — toàn bộ
 */
async function getPackagesByProject(req, res) {
    try {
        const { projectId, listType } = req.body || req.query || {};

        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: 'projectId is required',
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
        if (!member || member.status !== 'accepted') {
            return res.status(403).json({
                success: false,
                message: 'Only project members can view packages',
            });
        }

        const scope =
            listType === 'archived' ? 'archived' : listType === 'all' ? 'all' : 'active';

        const packages = await PackageRepository.findByProjectIdSorted(projectId, scope);

        return res.status(200).json({
            success: true,
            listType: scope,
            data: packages,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to load packages',
        });
    }
}

/**
 * UC-PKG-002: Archive Package — Draft/Active → Archived (read-only, chuyển sang trang archive)
 */
async function archivePackage(req, res) {
    try {
        const { projectId, packageId } = req.body || {};

        if (!projectId || !packageId) {
            return res.status(400).json({
                success: false,
                message: 'projectId and packageId are required',
            });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Missing access token' });
        }

        const ctx = await assertProjectAndMember(projectId, userId, res);
        if (!ctx) return;
        if (!canManagePackages(ctx.member)) {
            return res.status(403).json({
                success: false,
                message: 'Only members with package management permission can archive',
            });
        }

        const pkg = await PackageRepository.findByPublicIdInProject(packageId, projectId);
        if (!pkg) {
            return res.status(404).json({ success: false, message: 'Package not found' });
        }
        if (pkg.status === 'Archived') {
            return res.status(400).json({
                success: false,
                message: 'Package is already archived',
            });
        }
        if (pkg.status !== 'Draft' && pkg.status !== 'Active') {
            return res.status(400).json({
                success: false,
                message: 'Only Draft or Active packages can be archived',
            });
        }

        const updated = await PackageRepository.updateByPublicIdInProject(packageId, projectId, {
            status: 'Archived',
            archivedAt: new Date(),
        });

        return res.status(200).json({
            success: true,
            message: 'Package archived. Contents are read-only for team members.',
            data: formatPackageResponse(updated),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Archive package failed',
        });
    }
}

/**
 * Reactivate: Archived → Active (SRS alternative flow)
 */
async function reactivatePackage(req, res) {
    try {
        const { projectId, packageId } = req.body || {};

        if (!projectId || !packageId) {
            return res.status(400).json({
                success: false,
                message: 'projectId and packageId are required',
            });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Missing access token' });
        }

        const ctx = await assertProjectAndMember(projectId, userId, res);
        if (!ctx) return;
        if (!canManagePackages(ctx.member)) {
            return res.status(403).json({
                success: false,
                message: 'Only members with package management permission can reactivate',
            });
        }

        const pkg = await PackageRepository.findByPublicIdInProject(packageId, projectId);
        if (!pkg) {
            return res.status(404).json({ success: false, message: 'Package not found' });
        }
        if (pkg.status !== 'Archived') {
            return res.status(400).json({
                success: false,
                message: 'Only archived packages can be reactivated',
            });
        }

        const updated = await PackageRepository.updateByPublicIdInProject(packageId, projectId, {
            status: 'Active',
            archivedAt: null,
        });

        return res.status(200).json({
            success: true,
            message: 'Package reactivated',
            data: formatPackageResponse(updated),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Reactivate package failed',
        });
    }
}

/**
 * Draft → Active (đánh dấu package đang hoạt động / sẵn sàng giao)
 */
async function setPackageActive(req, res) {
    try {
        const { projectId, packageId } = req.body || {};

        if (!projectId || !packageId) {
            return res.status(400).json({
                success: false,
                message: 'projectId and packageId are required',
            });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Missing access token' });
        }

        const ctx = await assertProjectAndMember(projectId, userId, res);
        if (!ctx) return;
        if (!canManagePackages(ctx.member)) {
            return res.status(403).json({
                success: false,
                message: 'Only members with package management permission can update status',
            });
        }

        const pkg = await PackageRepository.findByPublicIdInProject(packageId, projectId);
        if (!pkg) {
            return res.status(404).json({ success: false, message: 'Package not found' });
        }
        if (pkg.status !== 'Draft') {
            return res.status(400).json({
                success: false,
                message: 'Only Draft packages can be set to Active',
            });
        }

        const updated = await PackageRepository.updateByPublicIdInProject(packageId, projectId, {
            status: 'Active',
        });

        return res.status(200).json({
            success: true,
            message: 'Package is now Active',
            data: formatPackageResponse(updated),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Set active failed',
        });
    }
}

/**
 * Xóa package — chỉ khi trạng thái Archived
 */
async function deletePackage(req, res) {
    try {
        const { projectId, packageId } = req.body || {};

        if (!projectId || !packageId) {
            return res.status(400).json({
                success: false,
                message: 'projectId and packageId are required',
            });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Missing access token' });
        }

        const ctx = await assertProjectAndMember(projectId, userId, res);
        if (!ctx) return;
        if (!canManagePackages(ctx.member)) {
            return res.status(403).json({
                success: false,
                message: 'Only members with package management permission can delete packages',
            });
        }

        const pkg = await PackageRepository.findByPublicIdInProject(packageId, projectId);
        if (!pkg) {
            return res.status(404).json({ success: false, message: 'Package not found' });
        }
        if (pkg.status !== 'Archived') {
            return res.status(400).json({
                success: false,
                message: 'Only archived packages can be deleted. Archive the package first.',
            });
        }

        await PackageRepository.deleteByPublicIdInProject(packageId, projectId);

        return res.status(200).json({
            success: true,
            message: 'Package deleted permanently',
            data: { packageId, projectId },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Delete package failed',
        });
    }
}

module.exports = {
    createPackage,
    getPackagesByProject,
    archivePackage,
    reactivatePackage,
    setPackageActive,
    deletePackage,
};
