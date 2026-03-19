const { errorResponse } = require('../utils/response');
const { normalizeString } = require('../utils/sanitize');

const ProjectRepository = require('../repositories/ProjectRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');

const badRequest = (res, message) => errorResponse(res, 400, message);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const forbidden = (res, message) => errorResponse(res, 403, message || 'Forbidden');
const notFound = (res, message) => errorResponse(res, 404, message || 'Not found');
const serverError = (res, message) => errorResponse(res, 500, message || 'Internal server error');

function parseDueDate(dueDate) {
    if (dueDate === undefined || dueDate === null) return null;
    if (typeof dueDate !== 'string' && !(dueDate instanceof Date)) return null;
    const date = dueDate instanceof Date ? dueDate : new Date(dueDate);
    if (Number.isNaN(date.getTime())) return null;
    return date;
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

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const project = await ProjectRepository.findByPublicId(normalizedProjectId);
            if (!project) return notFound(res, 'Project not found');

            const member = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                userId
            );
            if (member?.status !== 'accepted') {
                return forbidden(res, 'Only project members can create packages');
            }
            if (member?.role === 'viewer') {
                return forbidden(res, 'Viewers do not have package management permission');
            }

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
                description: normalizeString(description ?? ''),
                packageType: normalizeString(type ?? ''),
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

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                userId
            );
            if (member?.status !== 'accepted') {
                return forbidden(res, 'Only project members can view packages');
            }

            const scope = listType === 'archived'
                ? 'archived'
                : listType === 'all'
                    ? 'all'
                    : 'active';

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

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                userId
            );
            if (member?.status !== 'accepted') {
                return forbidden(res, 'Only project members can archive packages');
            }
            if (member?.role === 'viewer') {
                return forbidden(res, 'Viewers do not have package management permission');
            }

            const pkg = await PackageRepository.findByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId
            );
            if (!pkg) return notFound(res, 'Package not found');

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

            const userId = req.user?.id;
            if (!userId) return unauthorized(res);

            const member = await ProjectMemberRepository.findMember(
                normalizedProjectId,
                userId
            );
            if (member?.status !== 'accepted') {
                return forbidden(res, 'Only project members can delete packages');
            }
            if (member?.role === 'viewer') {
                return forbidden(res, 'Viewers do not have package management permission');
            }

            const pkg = await PackageRepository.findByPublicIdInProject(
                normalizedPackageId,
                normalizedProjectId
            );
            if (!pkg) return notFound(res, 'Package not found');

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