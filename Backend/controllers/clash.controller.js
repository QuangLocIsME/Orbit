const { errorResponse } = require('../utils/response');
const { detectClashes } = require('../services/clash.service');
const { getObjects, saveObjects } = require('../data/projectObjectRepository');
const {
    getClashResolution,
    getProjectResolutions,
    mergeResolutionIntoClashes,
    appendStaleClashes,
    markClashStale,
    upsertClashResolution,
} = require('../services/clashResolution.service');
const {
    getPositionOverride,
    savePositionOverride,
    deletePositionOverride,
} = require('../services/positionOverride.service');
const { buildBCFDocument } = require('../services/bcfExport.service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

const normalizeSeverity = (value) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return VALID_SEVERITIES.has(normalized) ? normalized : null;
};

const filterBySeverity = (clashes, severity) =>
    severity ? clashes.filter((c) => c.severity === severity) : clashes;

const buildSummary = (clashes) => {
    const active = clashes.filter((c) => !c.stale);
    return {
        total:           active.length,
        stale:           clashes.filter((c) => c.stale).length,
        criticalSeverity: active.filter((c) => c.severity === 'critical').length,
        highSeverity:    active.filter((c) => c.severity === 'high' || c.severity === 'critical').length,
        mediumSeverity:  active.filter((c) => c.severity === 'medium').length,
        lowSeverity:     active.filter((c) => c.severity === 'low').length,
        hardClashes:     active.filter((c) => c.clashType === 'hard' || !c.clashType).length,
        softClashes:     active.filter((c) => c.clashType === 'soft').length,
        resolved:        clashes.filter((c) => c.resolved).length,
        waived:          clashes.filter((c) => c.waived).length,
    };
};

const buildGroups = (clashes) => {
    const groupsMap = new Map();

    clashes.forEach((clash) => {
        const groupId = clash.groupKey || 'ungrouped';
        if (!groupsMap.has(groupId)) {
            groupsMap.set(groupId, {
                id:    groupId,
                name:  groupId.split('__').join(' vs '),
                count: 0,
                items: [],
            });
        }
        const group = groupsMap.get(groupId);
        group.items.push(clash);
        group.count = group.items.length;
    });

    return Array.from(groupsMap.values());
};

const buildResponse = (clashes) => ({
    clashes,
    summary: buildSummary(clashes),
    groups:  buildGroups(clashes),
});

const getProjectSlug = (req) =>
    req.params?.projectSlug || req.body?.projectSlug || req.query?.projectSlug || null;

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

class ClashController {
    /**
     * POST /projects/:slug/clash-detect
     */
    async detect(req, res) {
        try {
            const projectSlug        = getProjectSlug(req);
            const payloadObjects     = req.body?.objects;
            const clearanceThreshold = typeof req.body?.clearanceThreshold === 'number'
                ? req.body.clearanceThreshold : 0;
            const rules              = Array.isArray(req.body?.rules) ? req.body.rules : [];
            const includeStale       = req.body?.includeStale !== false;

            const objects = typeof payloadObjects === 'undefined'
                ? getObjects(projectSlug)
                : payloadObjects;

            if (!Array.isArray(objects)) {
                return errorResponse(res, 400, '`objects` must be an array when provided');
            }

            const rawClashes = detectClashes(objects, { clearanceThreshold, rules });

            // Đánh dấu stale cho clashes không còn detect được
            if (projectSlug) {
                const currentIds    = new Set(rawClashes.map((c) => c.id));
                const allResolutions = await getProjectResolutions(projectSlug);
                const stalePromises  = Object.keys(allResolutions)
                    .filter((id) => !currentIds.has(id))
                    .map((id) => markClashStale(projectSlug, id));
                await Promise.all(stalePromises);
            }

            const merged  = await mergeResolutionIntoClashes(rawClashes, projectSlug);
            const clashes = includeStale
                ? await appendStaleClashes(merged, projectSlug)
                : merged;

            return res.status(200).json(buildResponse(clashes));
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to detect clashes');
        }
    }

    /**
     * GET /projects/:slug/clashes
     */
    async list(req, res) {
        try {
            const projectSlug        = getProjectSlug(req);
            const requestedSeverity  = req.query?.severity;
            const clashTypeFilter    = req.query?.clashType || null;
            const statusFilter       = req.query?.status   || null;
            const includeStale       = req.query?.includeStale !== 'false';

            const normalizedSeverity = typeof requestedSeverity === 'undefined'
                ? null
                : normalizeSeverity(requestedSeverity);

            if (typeof requestedSeverity !== 'undefined' && !normalizedSeverity) {
                return errorResponse(res, 400, 'Severity must be one of: low, medium, high, critical');
            }

            const raw    = detectClashes(getObjects(projectSlug));
            const merged = await mergeResolutionIntoClashes(raw, projectSlug);
            let clashes  = includeStale ? await appendStaleClashes(merged, projectSlug) : merged;

            clashes = filterBySeverity(clashes, normalizedSeverity);

            if (clashTypeFilter === 'hard' || clashTypeFilter === 'soft') {
                clashes = clashes.filter((c) =>
                    clashTypeFilter === 'hard'
                        ? c.clashType === 'hard' || !c.clashType
                        : c.clashType === 'soft'
                );
            }

            if (statusFilter) {
                if      (statusFilter === 'resolved')   clashes = clashes.filter((c) => c.resolved);
                else if (statusFilter === 'unresolved') clashes = clashes.filter((c) => !c.resolved && !c.waived);
                else if (statusFilter === 'waived')     clashes = clashes.filter((c) => c.waived);
                else if (statusFilter === 'stale')      clashes = clashes.filter((c) => c.stale);
            }

            return res.status(200).json(buildResponse(clashes));
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list clashes');
        }
    }

    /**
     * GET  /projects/:slug/clashes/:clashId
     * PATCH /projects/:slug/clashes/:clashId
     */
    async resolve(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const clashId     = req.params?.clashId;

            if (req.method === 'GET') {
                const resolution = await getClashResolution(projectSlug, clashId);
                if (!resolution) return errorResponse(res, 404, 'Clash resolution not found');
                return res.status(200).json({ clashId, projectSlug, ...resolution });
            }

            const nextResolution = await upsertClashResolution(projectSlug, clashId, req.body || {});
            return res.status(200).json({ success: true, clashId, projectSlug, resolution: nextResolution });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to update clash resolution');
        }
    }

    /**
     * PATCH /projects/:slug/clashes/:clashId/assign
     */
    async assign(req, res) {
        try {
            const projectSlug          = getProjectSlug(req);
            const clashId              = req.params?.clashId;
            const { assignedTo, dueDate, user } = req.body || {};

            if (typeof assignedTo !== 'string' || !assignedTo.trim()) {
                return errorResponse(res, 400, '`assignedTo` is required');
            }

            const nextResolution = await upsertClashResolution(projectSlug, clashId, {
                assignedTo: assignedTo.trim(),
                dueDate:    dueDate || null,
                user:       user   || null,
            });

            return res.status(200).json({ success: true, clashId, projectSlug, resolution: nextResolution });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to assign clash');
        }
    }

    /**
     * GET /projects/:slug/clashes/:clashId/positions
     */
    async getPositions(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const clashId     = req.params?.clashId;
            const override    = await getPositionOverride(projectSlug, clashId);
            if (!override) return res.status(200).json({ objects: null });
            return res.status(200).json(override);
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to get positions');
        }
    }

    /**
     * PATCH /projects/:slug/clashes/:clashId/positions
     */
    async savePositions(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const clashId     = req.params?.clashId;
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

    /**
     * DELETE /projects/:slug/clashes/:clashId/positions
     */
    async resetPositions(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const clashId     = req.params?.clashId;
            await deletePositionOverride(projectSlug, clashId);
            return res.status(200).json({ success: true, clashId, projectSlug });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to reset positions');
        }
    }

    /**
     * GET /projects/:slug/objects
     */
    listObjects(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const objects     = getObjects(projectSlug);
            return res.status(200).json({ projectSlug, objects });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list objects');
        }
    }

    /**
     * PUT /projects/:slug/objects
     */
    saveProjectObjects(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const { objects } = req.body || {};

            if (!Array.isArray(objects)) {
                return errorResponse(res, 400, '`objects` must be an array');
            }

            saveObjects(projectSlug, objects);
            return res.status(200).json({ success: true, projectSlug, count: objects.length });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to save project objects');
        }
    }

    /**
     * GET /projects/:slug/clashes/export/bcf
     */
    async exportBCF(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const raw         = detectClashes(getObjects(projectSlug));
            const allClashes  = await mergeResolutionIntoClashes(raw, projectSlug);

            const projectName = req.query?.projectName || projectSlug || 'ORBIT Project';
            const bcf         = buildBCFDocument(allClashes, projectName);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${projectSlug}-clashes.bcf.json"`
            );
            return res.status(200).json(bcf);
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to export BCF');
        }
    }
}

module.exports = new ClashController();
