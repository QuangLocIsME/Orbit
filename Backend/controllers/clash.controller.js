const { errorResponse } = require('../utils/response');
const {
    getPositionOverride,
    savePositionOverride,
    deletePositionOverride,
} = require('../services/positionOverride.service');

const getProjectSlug = (req) => req.params?.projectSlug || req.body?.projectSlug || req.query?.projectSlug || null;

/**
 * Legacy clash UI đã chuyển sang Navisworks workspace.
 * Controller này chỉ giữ API position overrides cho viewer (clashStore).
 */
class ClashController {
    async getPositions(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const clashId = req.params?.clashId;
            const override = await getPositionOverride(projectSlug, clashId);
            if (!override) return res.status(200).json({ objects: null });
            return res.status(200).json(override);
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to get positions');
        }
    }

    async savePositions(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const clashId = req.params?.clashId;
            const { objects } = req.body || {};

            if (!Array.isArray(objects)) {
                return errorResponse(res, 400, '`objects` must be an array');
            }

            const saved = await savePositionOverride(projectSlug, clashId, objects);
            return res.status(200).json({ success: true, clashId, projectSlug, ...saved });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to save positions');
        }
    }

    async resetPositions(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const clashId = req.params?.clashId;
            await deletePositionOverride(projectSlug, clashId);
            return res.status(200).json({ success: true, clashId, projectSlug });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to reset positions');
        }
    }
}

module.exports = new ClashController();
