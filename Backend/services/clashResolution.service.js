/**
 * ClashResolutionService
 * Persistence: MongoDB (ClashResolution collection).
 * Public API giữ nguyên signature, tất cả hàm là async.
 */
const ClashResolution = require('../models/ClashResolution');

const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const VALID_STATUSES   = new Set(['open', 'in-progress', 'resolved', 'waived']);

// ---------------------------------------------------------------------------
// Sanitizers (sync — không đổi)
// ---------------------------------------------------------------------------

const sanitizeSeverity = (value) => {
    if (typeof value !== 'string') return null;
    const n = value.trim().toLowerCase();
    return VALID_SEVERITIES.has(n) ? n : null;
};

const sanitizeStatus = (value) => {
    if (typeof value !== 'string') return null;
    const n = value.trim().toLowerCase();
    return VALID_STATUSES.has(n) ? n : null;
};

const sanitizeHistory = (history = []) =>
    Array.isArray(history)
        ? history
              .filter((e) => e && typeof e.message === 'string' && typeof e.timestamp === 'string')
              .map((e) => ({
                  id: e.id || `${e.type || 'event'}-${e.timestamp}`,
                  type: e.type || 'note-added',
                  message: e.message,
                  timestamp: e.timestamp,
                  user: e.user || null,
              }))
        : [];

// ---------------------------------------------------------------------------
// History builder (sync)
// ---------------------------------------------------------------------------

const buildHistoryEntry = (type, message, user = null, timestamp = new Date().toISOString()) => ({
    id: `${type}-${timestamp}`,
    type,
    message,
    timestamp,
    user,
});

// ---------------------------------------------------------------------------
// Helper: chuyển Mongoose document → plain object (giữ backward compat)
// ---------------------------------------------------------------------------

const toPlain = (doc) => {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    delete obj._id;
    delete obj.__v;
    return obj;
};

// ---------------------------------------------------------------------------
// Public API (tất cả async)
// ---------------------------------------------------------------------------

/**
 * Lấy resolution của một clash cụ thể.
 */
const getClashResolution = async (projectSlug, clashId) => {
    const doc = await ClashResolution.findOne({ projectSlug, clashId }).lean();
    if (!doc) return null;
    const { _id, __v, projectSlug: _ps, clashId: _ci, ...rest } = doc;
    return rest;
};

/**
 * Lấy toàn bộ resolutions của một project.
 * Trả về object { [clashId]: resolutionData } — giữ nguyên format cũ.
 */
const getProjectResolutions = async (projectSlug) => {
    const docs = await ClashResolution.find({ projectSlug }).lean();
    const map = {};
    for (const doc of docs) {
        const { _id, __v, projectSlug: _ps, clashId, ...rest } = doc;
        map[clashId] = rest;
    }
    return map;
};

/**
 * Upsert resolution cho một clash.
 * Payload: { resolved, note, severity, history, assignedTo, dueDate, status, waived, user }
 */
const upsertClashResolution = async (projectSlug, clashId, payload = {}) => {
    if (!projectSlug) throw new Error('Project slug is required');
    if (typeof clashId !== 'string' || !clashId.trim()) throw new Error('Clash id is required');

    const prev = await ClashResolution.findOne({ projectSlug, clashId }).lean() || {};
    const timestamp = new Date().toISOString();

    // --- severity ---
    const nextSeverity =
        typeof payload.severity === 'undefined'
            ? prev.severity ?? null
            : sanitizeSeverity(payload.severity);
    if (typeof payload.severity !== 'undefined' && !nextSeverity) {
        throw new Error('Severity must be one of: low, medium, high, critical');
    }

    // --- status logic ---
    let nextStatus;
    if (typeof payload.status !== 'undefined') {
        nextStatus = sanitizeStatus(payload.status);
        if (!nextStatus) throw new Error('Status must be one of: open, in-progress, resolved, waived');
    } else if (payload.waived) {
        nextStatus = 'waived';
    } else if (payload.resolved) {
        nextStatus = 'resolved';
    } else {
        nextStatus = prev.status || 'open';
    }

    const isResolved = nextStatus === 'resolved';
    const isWaived   = nextStatus === 'waived';

    // --- history ---
    const baseHistory     = sanitizeHistory(prev.history);
    const incomingHistory = sanitizeHistory(payload.history);
    const mergedHistory   = incomingHistory.length > 0 ? incomingHistory : baseHistory;

    const autoEvent = isResolved
        ? buildHistoryEntry('resolved', 'Marked clash as resolved.', payload.user ?? null, timestamp)
        : isWaived
        ? buildHistoryEntry('waived', 'Clash waived (acknowledged, no fix required).', payload.user ?? null, timestamp)
        : payload.assignedTo && payload.assignedTo !== prev.assignedTo
        ? buildHistoryEntry('assigned', `Assigned to ${payload.assignedTo}.`, payload.user ?? null, timestamp)
        : buildHistoryEntry('note-added', 'Resolution details updated.', payload.user ?? null, timestamp);

    const update = {
        resolved:   isResolved,
        waived:     isWaived,
        status:     nextStatus,
        note:       typeof payload.note === 'string' ? payload.note : prev.note || '',
        severity:   nextSeverity || prev.severity || null,
        assignedTo: typeof payload.assignedTo === 'string' ? payload.assignedTo : prev.assignedTo || null,
        dueDate:    typeof payload.dueDate !== 'undefined' ? (payload.dueDate || null) : (prev.dueDate || null),
        updatedAt:  new Date(timestamp),
        history:    [...mergedHistory, autoEvent],
        $setOnInsert: { createdAt: new Date(timestamp) },
    };

    const doc = await ClashResolution.findOneAndUpdate(
        { projectSlug, clashId },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const { _id, __v, projectSlug: _ps, clashId: _ci, ...result } = doc;
    return result;
};

/**
 * Merge resolution data vào mảng clash từ detection.
 */
const mergeResolutionIntoClashes = async (clashes, projectSlug) => {
    const resolutionMap = await getProjectResolutions(projectSlug);

    return clashes.map((clash) => {
        const res = resolutionMap[clash.id];
        if (!res) return clash;

        return {
            ...clash,
            severity:   res.severity  || clash.severity,
            resolved:   Boolean(res.resolved),
            waived:     Boolean(res.waived),
            status:     res.status    || clash.status,
            note:       res.note      || '',
            assignedTo: res.assignedTo || null,
            dueDate:    res.dueDate    || null,
            updatedAt:  res.updatedAt,
            history:    sanitizeHistory(res.history),
        };
    });
};

/**
 * Stale clash detection: thêm các clashes đã từng tồn tại nhưng không còn detect được.
 */
const appendStaleClashes = async (currentClashes, projectSlug) => {
    const resolutionMap = await getProjectResolutions(projectSlug);
    const currentIds    = new Set(currentClashes.map((c) => c.id));
    const staleClashes  = [];

    for (const [clashId, res] of Object.entries(resolutionMap)) {
        if (currentIds.has(clashId))      continue;
        if (res.resolved || res.waived)   continue;

        const [idA, idB] = clashId.split('__');
        staleClashes.push({
            id:               clashId,
            objectA:          idA || clashId,
            objectB:          idB || clashId,
            objectAType:      null,
            objectBType:      null,
            objectABBox:      null,
            objectBBBox:      null,
            position:         [0, 0, 0],
            severity:         res.severity || 'low',
            clashType:        'hard',
            intersectionVolume: 0,
            distance:         0,
            groupKey:         'stale',
            stale:            true,
            resolved:         Boolean(res.resolved),
            waived:           Boolean(res.waived),
            status:           res.status || 'open',
            note:             res.note || '',
            assignedTo:       res.assignedTo || null,
            dueDate:          res.dueDate || null,
            updatedAt:        res.updatedAt || null,
            history:          sanitizeHistory(res.history),
        });
    }

    return [...currentClashes, ...staleClashes];
};

/**
 * Đánh dấu một clash là stale.
 */
const markClashStale = async (projectSlug, clashId) => {
    const existing = await ClashResolution.findOne({ projectSlug, clashId }).lean();
    if (!existing) return;

    const timestamp = new Date().toISOString();
    const newEntry  = buildHistoryEntry(
        'stale',
        'Clash no longer detected — objects may have been moved or modified.',
        null,
        timestamp
    );

    await ClashResolution.updateOne(
        { projectSlug, clashId },
        {
            stale:     true,
            updatedAt: new Date(timestamp),
            $push:     { history: newEntry },
        }
    );
};

module.exports = {
    getClashResolution,
    getProjectResolutions,
    mergeResolutionIntoClashes,
    appendStaleClashes,
    markClashStale,
    upsertClashResolution,
};
