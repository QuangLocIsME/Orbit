/**
 * PositionOverrideService
 * Persistence: MongoDB (PositionOverride collection).
 * Public API giữ nguyên signature, tất cả hàm là async.
 */
const PositionOverride = require('../models/PositionOverride');

// ---------------------------------------------------------------------------
// Validation (sync)
// ---------------------------------------------------------------------------

const isVec3 = (v) =>
    Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n));

const validateObjectOverride = (obj, index) => {
    if (!obj || typeof obj !== 'object')
        throw new Error(`Invalid object override at index ${index}`);
    if (typeof obj.id !== 'string' || !obj.id.trim())
        throw new Error(`Object override at index ${index} missing valid id`);
    if (!isVec3(obj.position))
        throw new Error(`Object override "${obj.id}" has invalid position (must be [x, y, z])`);
};

// ---------------------------------------------------------------------------
// Public API (async)
// ---------------------------------------------------------------------------

/**
 * Lấy position overrides cho một clash.
 * @returns { objects: [{id, position}], savedAt } | null
 */
const getPositionOverride = async (projectSlug, clashId) => {
    const doc = await PositionOverride.findOne({ projectSlug, clashId }).lean();
    if (!doc) return null;
    return {
        objects: doc.objects,
        savedAt: doc.savedAt,
    };
};

/**
 * Lưu position overrides cho một clash.
 */
const savePositionOverride = async (projectSlug, clashId, objects) => {
    if (!projectSlug) throw new Error('Project slug is required');
    if (typeof clashId !== 'string' || !clashId.trim()) throw new Error('Clash id is required');
    if (!Array.isArray(objects)) throw new Error('objects must be an array');

    objects.forEach(validateObjectOverride);

    const savedAt = new Date();
    const cleanObjects = objects.map((o) => ({ id: o.id, position: o.position }));

    await PositionOverride.findOneAndUpdate(
        { projectSlug, clashId },
        { objects: cleanObjects, savedAt },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return { objects: cleanObjects, savedAt: savedAt.toISOString() };
};

/**
 * Xoá position override của một clash (reset về vị trí gốc).
 */
const deletePositionOverride = async (projectSlug, clashId) => {
    await PositionOverride.deleteOne({ projectSlug, clashId });
};

module.exports = {
    getPositionOverride,
    savePositionOverride,
    deletePositionOverride,
};
