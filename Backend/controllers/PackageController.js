const { errorResponse } = require('../utils/response');
const { normalizeString } = require('../utils/sanitize');

const ProjectRepository = require('../repositories/ProjectRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');

const badRequest = (res, message) => errorResponse(res, 400, message);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const forbidden = (res, message) => errorResponse(res, 403, message || 'Forbidden');
const notFound = (res, message) => errorResponse(res, 404, message || 'Not found');
const serverError = (res, message) =>
    errorResponse(res, 500, message || 'Internal server error');

function parseDueDate(dueDate) {
    if (dueDate === undefined || dueDate === null) return null;
    if (typeof dueDate !== 'string' && !(dueDate instanceof Date)) return null;
    const date = dueDate instanceof Date ? dueDate : new Date(dueDate);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function getUserIdOr401(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        unauthorized(res);
        return null;
    }
    return userId;
}

async function getAcceptedMemberOr403(projectId, userId, res, message) {
    const member = await ProjectMemberRepository.findMember(projectId, userId);
    if (!member || member.status !== 'accepted') {
        forbidden(res, message);
        return null;
    }
    return member;
}

function requireNotViewerOr403(member, res, message) {
    if (member.role === 'viewer') {
        forbidden(res, message);
        return false;
    }
    return true;
}

async function getProjectOr404(projectId, res) {
    const project = await ProjectRepository.findByPublicId(projectId);
    if (!project) {
        notFound(res, 'Project not found');
        return null;
    }
    return project;
}

async function getPackageOr404(projectId, packageId, res) {
    const pkg = await PackageRepository.findByPublicIdInProject(packageId, projectId);
    if (!pkg) {
        notFound(res, 'Package not found');
        return null;
    }
    return pkg;
}

class PackageController {
    /**
     * UC-PKG-001: Create New Package
     */
    async createPackage(req, res) {
        try {
            const {
                projectId,
                name,
                description,
                type,
                dueDate,
                teamMemberIds,
            } = req.body || {};

            const normalizedProjectId = normalizeString(projectId);
            const normalizedName = normalizeString(name);

            if (!normalizedProjectId || !normalizedName) {
                return badRequest(res, 'projectId and name are required');
            }

            const userId = getUserIdOr401(req, res);
            if (!userId) return;

            const project = await getProjectOr404(normalizedProjectId, res);
            if (!project) return;

            const member = await getAcceptedMemberOr403(
                normalizedProjectId,
                userId,
                res,
                'Only project members can create packages'
            );
            if (!member) return;
            if (
                !requireNotViewerOr403(
                    member,
                    res,
                    'Viewers do not have package management permission'
                )
            )
                return;

            const existing = await PackageRepository.findByProjectIdAndName(
                normalizedProjectId,
                normalizedName
            );
            if (existing) {
                return badRequest(
                    res,
                    'A package with this name already exists in the project. Please use a unique name.'
                );
            }

            const packageDoc = await PackageRepository.create({
                projectId: normalizedProjectId,
                name: normalizedName,
                description: description != null ? normalizeString(description) : '',
                packageType: type != null ? normalizeString(type) : '',
                status: 'Draft',
                dueDate: parseDueDate(dueDate),
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
                data: {
                    publicId: packageDoc.publicId,
                    projectId: packageDoc.projectId,
                    name: packageDoc.name,
                    description: packageDoc.description,
                    packageType: packageDoc.packageType,
                    status: packageDoc.status,
                    dueDate: packageDoc.dueDate,
                    creatorId: packageDoc.creatorId,
                    teamMemberIds: packageDoc.teamMemberIds,
                    archivedAt: packageDoc.archivedAt || null,
                    createdAt: packageDoc.createdAt,
                    updatedAt: packageDoc.updatedAt,
                },
            });
        } catch (error) {
            if (error && error.code === 11000) {
                return badRequest(
                    res,
                    'A package with this name already exists in the project. Please use a unique name.'
                );
            }
            return serverError(res, error.message || 'Create package failed');
        }
    }

    /**
     * List packages
     * listType: 'active' (default), 'archived', 'all'
     */
    async listPackages(req, res) {
        try {
            const { projectId, listType } = req.body || {};

            const normalizedProjectId = normalizeString(projectId);
            if (!normalizedProjectId) return badRequest(res, 'projectId is required');

            const userId = getUserIdOr401(req, res);
            if (!userId) return;

            const member = await getAcceptedMemberOr403(
                normalizedProjectId,
                userId,
                res,
                'Only project members can view packages'
            );
            if (!member) return;

            const scope =
                listType === 'archived' ? 'archived' : listType === 'all' ? 'all' : 'active';

            const packages = await PackageRepository.listByProjectIdSorted(
                normalizedProjectId,
                scope
            );

            return res.status(200).json({
                success: true,
                listType: scope,
                data: packages,
            });
        } catch (error) {
            return serverError(res, error.message || 'Failed to load packages');
        }
    }

    /**
     * Cập nhật thông tin package (Draft/Active). Package Archived không sửa được.
     */
    async updatePackage(req, res) {
        try {
            const {
                projectId,
                packageId,
                name,
                description,
                type,
                dueDate,
                teamMemberIds,
            } = req.body || {};

            const normalizedProjectId = normalizeString(projectId);
            const normalizedPackageId = normalizeString(packageId);

            if (!normalizedProjectId || !normalizedPackageId) {
                return badRequest(res, 'projectId and packageId are required');
            }

            const hasUpdate =
                name !== undefined ||
                description !== undefined ||
                type !== undefined ||
                dueDate !== undefined ||
                teamMemberIds !== undefined;
            if (!hasUpdate) {
                return badRequest(
                    res,
                    'Provide at least one field to update: name, description, type, dueDate, teamMemberIds'
                );
            }

            const userId = getUserIdOr401(req, res);
            if (!userId) return;

            const member = await getAcceptedMemberOr403(
                normalizedProjectId,
                userId,
                res,
                'Only project members can update packages'
            );
            if (!member) return;
            if (
                !requireNotViewerOr403(
                    member,
                    res,
                    'Viewers do not have package management permission'
                )
            )
                return;

            const pkg = await getPackageOr404(normalizedProjectId, normalizedPackageId, res);
            if (!pkg) return;

            if (pkg.status === 'Archived') {
                return badRequest(
                    res,
                    'Archived packages cannot be updated. Reactivate or use a non-archived package.'
                );
            }

            const updateFields = {};

            if (name !== undefined) {
                const nextName = normalizeString(name);
                if (!nextName) {
                    return badRequest(res, 'name cannot be empty');
                }
                if (nextName !== pkg.name) {
                    const duplicate = await PackageRepository.findAnotherByProjectIdAndName(
                        normalizedProjectId,
                        nextName,
                        normalizedPackageId
                    );
                    if (duplicate) {
                        return badRequest(
                            res,
                            'A package with this name already exists in the project. Please use a unique name.'
                        );
                    }
                }
                updateFields.name = nextName;
            }

            if (description !== undefined) {
                updateFields.description =
                    description === null ? '' : normalizeString(description);
            }

            if (type !== undefined) {
                updateFields.packageType =
                    type === null ? '' : normalizeString(type);
            }

            if (dueDate !== undefined) {
                if (dueDate === null || dueDate === '') {
                    updateFields.dueDate = null;
                } else {
                    const d = parseDueDate(dueDate);
                    if (!d) {
                        return badRequest(res, 'dueDate is invalid');
                    }
                    updateFields.dueDate = d;
                }
            }

            if (teamMemberIds !== undefined) {
                if (!Array.isArray(teamMemberIds)) {
                    return badRequest(res, 'teamMemberIds must be an array');
                }
                updateFields.teamMemberIds = teamMemberIds;
            }

            const updated = await PackageRepository.updateByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId,
                updateFields
            );

            if (!updated) {
                return notFound(res, 'Package not found');
            }

            return res.status(200).json({
                success: true,
                message: 'Package updated',
                data: {
                    publicId: updated.publicId,
                    projectId: updated.projectId,
                    name: updated.name,
                    description: updated.description,
                    packageType: updated.packageType,
                    status: updated.status,
                    dueDate: updated.dueDate,
                    creatorId: updated.creatorId,
                    teamMemberIds: updated.teamMemberIds,
                    archivedAt: updated.archivedAt || null,
                    createdAt: updated.createdAt,
                    updatedAt: updated.updatedAt,
                },
            });
        } catch (error) {
            if (error && error.code === 11000) {
                return badRequest(
                    res,
                    'A package with this name already exists in the project. Please use a unique name.'
                );
            }
            return serverError(res, error.message || 'Update package failed');
        }
    }

    /**
     * UC-PKG-002: Archive Package
     * Draft/Active -> Archived
     */
    async archivePackage(req, res) {
        try {
            const { projectId, packageId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedPackageId = normalizeString(packageId);

            if (!normalizedProjectId || !normalizedPackageId) {
                return badRequest(res, 'projectId and packageId are required');
            }

            const userId = getUserIdOr401(req, res);
            if (!userId) return;

            const member = await getAcceptedMemberOr403(
                normalizedProjectId,
                userId,
                res,
                'Only project members can archive packages'
            );
            if (!member) return;
            if (
                !requireNotViewerOr403(
                    member,
                    res,
                    'Viewers do not have package management permission'
                )
            )
                return;

            const pkg = await getPackageOr404(normalizedProjectId, normalizedPackageId, res);
            if (!pkg) return;

            if (pkg.status === 'Archived') {
                return badRequest(res, 'Package is already archived');
            }
            if (pkg.status !== 'Draft' && pkg.status !== 'Active') {
                return badRequest(res, 'Only Draft or Active packages can be archived');
            }

            const updated = await PackageRepository.archiveByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId
            );

            return res.status(200).json({
                success: true,
                message: 'Package archived (moved to archive page)',
                data: {
                    publicId: updated.publicId,
                    projectId: updated.projectId,
                    name: updated.name,
                    status: updated.status,
                    archivedAt: updated.archivedAt,
                },
            });
        } catch (error) {
            return serverError(res, error.message || 'Archive package failed');
        }
    }

    /**
     * Delete package only when status === Archived
     */
    async deletePackage(req, res) {
        try {
            const { projectId, packageId } = req.body || {};
            const normalizedProjectId = normalizeString(projectId);
            const normalizedPackageId = normalizeString(packageId);

            if (!normalizedProjectId || !normalizedPackageId) {
                return badRequest(res, 'projectId and packageId are required');
            }

            const userId = getUserIdOr401(req, res);
            if (!userId) return;

            const member = await getAcceptedMemberOr403(
                normalizedProjectId,
                userId,
                res,
                'Only project members can delete packages'
            );
            if (!member) return;
            if (
                !requireNotViewerOr403(
                    member,
                    res,
                    'Viewers do not have package management permission'
                )
            )
                return;

            const pkg = await getPackageOr404(normalizedProjectId, normalizedPackageId, res);
            if (!pkg) return;

            if (pkg.status !== 'Archived') {
                return badRequest(
                    res,
                    'Only archived packages can be deleted. Archive the package first.'
                );
            }

            await PackageRepository.deleteByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId
            );

            return res.status(200).json({
                success: true,
                message: 'Package deleted permanently',
            });
        } catch (error) {
            return serverError(res, error.message || 'Delete package failed');
        }
    }
}

module.exports = new PackageController();