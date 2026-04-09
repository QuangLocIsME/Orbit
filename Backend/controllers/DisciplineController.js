const DisciplineRepository = require('../repositories/DisciplineRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const { errorResponse } = require('../utils/response');

const normalizeString = (val) => {
    if (typeof val !== 'string') return '';
    return val.trim();
};

class DisciplineController {
    async listByProject(req, res) {
        try {
            const projectId = req.params?.projectSlug || req.query?.projectId;
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

            const disciplines = await DisciplineRepository.listByProject(projectId);

            return res.status(200).json({
                success: true,
                data: disciplines.map((d) => ({
                    id: d.publicId,
                    name: d.name,
                    description: d.description,
                    color: d.color,
                    createdBy: d.createdBy,
                    createdAt: d.createdAt,
                    updatedAt: d.updatedAt,
                })),
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list disciplines');
        }
    }

    async create(req, res) {
        try {
            const projectId = req.params?.projectSlug;
            const { name, description, color } = req.body || {};

            if (!projectId) {
                return errorResponse(res, 400, 'Missing projectId');
            }

            if (!normalizeString(name)) {
                return errorResponse(res, 400, 'Name is required');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.role === 'viewer') {
                return errorResponse(res, 403, 'Forbidden');
            }

            const normalizedName = normalizeString(name);
            const existing = await DisciplineRepository.existsByName(projectId, normalizedName);
            if (existing) {
                return errorResponse(res, 409, 'Discipline with this name already exists');
            }

            const discipline = await DisciplineRepository.create({
                projectId,
                name: normalizedName,
                description: normalizeString(description),
                color: color || '#6366f1',
                createdBy: userId,
            });

            return res.status(201).json({
                success: true,
                message: 'Discipline created',
                data: {
                    id: discipline.publicId,
                    name: discipline.name,
                    description: discipline.description,
                    color: discipline.color,
                    createdBy: discipline.createdBy,
                    createdAt: discipline.createdAt,
                },
            });
        } catch (error) {
            if (error.code === 11000) {
                return errorResponse(res, 409, 'Discipline with this name already exists');
            }
            return errorResponse(res, 500, error.message || 'Failed to create discipline');
        }
    }

    async update(req, res) {
        try {
            const { disciplineId } = req.params;
            const { name, description, color } = req.body || {};

            if (!normalizeString(disciplineId)) {
                return errorResponse(res, 400, 'Missing disciplineId');
            }

            if (!normalizeString(name)) {
                return errorResponse(res, 400, 'Name is required');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const discipline = await DisciplineRepository.findByPublicId(null, disciplineId);
            if (!discipline) {
                return errorResponse(res, 404, 'Discipline not found');
            }

            const member = await ProjectMemberRepository.findMember(discipline.projectId, userId);
            if (!member || member.role === 'viewer') {
                return errorResponse(res, 403, 'Forbidden');
            }

            const normalizedName = normalizeString(name);
            const existing = await DisciplineRepository.existsByName(
                discipline.projectId,
                normalizedName,
                disciplineId
            );
            if (existing) {
                return errorResponse(res, 409, 'Discipline with this name already exists');
            }

            const updated = await DisciplineRepository.update(disciplineId, {
                name: normalizedName,
                description: normalizeString(description),
                color: color || discipline.color,
            });

            return res.status(200).json({
                success: true,
                message: 'Discipline updated',
                data: {
                    id: updated.publicId,
                    name: updated.name,
                    description: updated.description,
                    color: updated.color,
                    createdBy: updated.createdBy,
                    createdAt: updated.createdAt,
                    updatedAt: updated.updatedAt,
                },
            });
        } catch (error) {
            if (error.code === 11000) {
                return errorResponse(res, 409, 'Discipline with this name already exists');
            }
            return errorResponse(res, 500, error.message || 'Failed to update discipline');
        }
    }

    async delete(req, res) {
        try {
            const { disciplineId } = req.params;

            if (!normalizeString(disciplineId)) {
                return errorResponse(res, 400, 'Missing disciplineId');
            }

            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const discipline = await DisciplineRepository.findByPublicId(null, disciplineId);
            if (!discipline) {
                return errorResponse(res, 404, 'Discipline not found');
            }

            const member = await ProjectMemberRepository.findMember(discipline.projectId, userId);
            if (!member || member.role !== 'admin') {
                return errorResponse(res, 403, 'Forbidden: admin role required');
            }

            await DisciplineRepository.delete(disciplineId);

            return res.status(200).json({
                success: true,
                message: 'Discipline deleted',
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to delete discipline');
        }
    }
}

module.exports = new DisciplineController();
