const path = require('path');

const mockObjects = require(path.resolve(__dirname, '../data/mockObjects.json'));
const { errorResponse } = require('../utils/response');
const { detectClashes } = require('../services/clash.service');

const VALID_SEVERITIES = new Set(['low', 'medium', 'high']);

const normalizeSeverity = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim().toLowerCase();
    return VALID_SEVERITIES.has(normalizedValue) ? normalizedValue : null;
};

const filterBySeverity = (clashes, severity) => {
    if (!severity) {
        return clashes;
    }

    return clashes.filter((clash) => clash.severity === severity);
};

const buildSummary = (clashes) => ({
    total: clashes.length,
    highSeverity: clashes.filter((clash) => clash.severity === 'high').length,
    mediumSeverity: clashes.filter((clash) => clash.severity === 'medium').length,
    lowSeverity: clashes.filter((clash) => clash.severity === 'low').length,
});

const buildGroups = (clashes) => {
    const groupsMap = new Map();

    clashes.forEach((clash) => {
        const groupId = clash.groupKey || 'ungrouped';

        if (!groupsMap.has(groupId)) {
            groupsMap.set(groupId, {
                id: groupId,
                name: groupId.split('__').join(' vs '),
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
    groups: buildGroups(clashes),
});

class ClashController {
    detect(req, res) {
        try {
            const payloadObjects = req.body?.objects;
            const objects = typeof payloadObjects === 'undefined' ? mockObjects : payloadObjects;

            if (!Array.isArray(objects)) {
                return errorResponse(res, 400, '`objects` must be an array when provided');
            }

            const clashes = detectClashes(objects);

            return res.status(200).json(buildResponse(clashes));
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to detect clashes');
        }
    }

    list(req, res) {
        try {
            const requestedSeverity = req.query?.severity;
            const normalizedSeverity =
                typeof requestedSeverity === 'undefined'
                    ? null
                    : normalizeSeverity(requestedSeverity);

            if (typeof requestedSeverity !== 'undefined' && !normalizedSeverity) {
                return errorResponse(res, 400, 'Severity must be one of: low, medium, high');
            }

            const clashes = filterBySeverity(detectClashes(mockObjects), normalizedSeverity);

            return res.status(200).json(buildResponse(clashes));
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list clashes');
        }
    }
}

module.exports = new ClashController();
