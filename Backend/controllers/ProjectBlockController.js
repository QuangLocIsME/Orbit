const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const { getProjectBlockSnapshot } = require('../services/blockSnapshot.service');
const { errorResponse } = require('../utils/response');

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

class ProjectBlockController {
    async getBlock(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return errorResponse(res, 401, 'Unauthorized');
            }

            const projectId = normalizeString(req.body?.projectId);
            const scope = normalizeString(req.body?.scope);
            const blockId = normalizeString(req.body?.blockId);
            const packageId = normalizeString(req.body?.packageId) || null;

            if (!projectId || !scope || !blockId) {
                return errorResponse(res, 400, 'projectId, scope, and blockId are required');
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.status !== 'accepted') {
                return errorResponse(res, 403, 'Forbidden');
            }

            const snapshot = await getProjectBlockSnapshot({
                projectId,
                scope,
                blockId,
                userId,
                packageId,
            });

            if (!snapshot) {
                return errorResponse(res, 404, 'Block not found');
            }

            return res.status(200).json({
                success: true,
                data: snapshot,
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to load block');
        }
    }
}

module.exports = new ProjectBlockController();
