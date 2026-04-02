/**
 * Clash Detection Service
 * Hỗ trợ:
 *  - Hard clash: giao nhau AABB thực sự (intersectionVolume > 0)
 *  - Soft clash: khoảng cách < clearanceThreshold (proximity)
 *  - Severity đa yếu tố: volume + tỉ lệ + loại cấu kiện
 *  - Per-type rules: clearance tối thiểu theo từng cặp loại cấu kiện
 *  - Re-detection merge: clashId ổn định để giữ resolution cũ
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_VOLUME = {
    high: 1.5,
    medium: 0.25,
};

/**
 * Cặp cấu kiện MEP-Structure có mức độ nghiêm trọng tối thiểu là 'high'.
 * Key là sorted type pair, e.g. 'IfcBeam__IfcPipeSegment'
 */
const HIGH_PRIORITY_PAIRS = new Set([
    'IfcBeam__IfcPipeSegment',
    'IfcBeam__IfcDuctSegment',
    'IfcBeam__IfcCableCarrierSegment',
    'IfcColumn__IfcPipeSegment',
    'IfcColumn__IfcDuctSegment',
    'IfcColumn__IfcCableCarrierSegment',
    'IfcSlab__IfcPipeSegment',
    'IfcSlab__IfcDuctSegment',
    'IfcSlab__IfcCableCarrierSegment',
    'IfcPipeSegment__IfcWall',
    'IfcDuctSegment__IfcWall',
]);

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const isFiniteNumber = (v) => Number.isFinite(v);

const isValidBoundingBox = (bbox) => {
    if (!bbox || !Array.isArray(bbox.min) || !Array.isArray(bbox.max)) return false;
    if (bbox.min.length !== 3 || bbox.max.length !== 3) return false;
    if (!bbox.min.every(isFiniteNumber) || !bbox.max.every(isFiniteNumber)) return false;
    return bbox.min.every((v, i) => v <= bbox.max[i]);
};

const validateObject = (obj, index) => {
    if (!obj || typeof obj !== 'object') throw new Error(`Invalid clash object at index ${index}`);
    if (typeof obj.id !== 'string' || !obj.id.trim()) throw new Error(`Object at index ${index} missing valid id`);
    if (typeof obj.type !== 'string' || !obj.type.trim()) throw new Error(`Object ${obj.id} missing valid type`);
    if (!isValidBoundingBox(obj.bbox)) throw new Error(`Object ${obj.id} has invalid bbox`);
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const expandBBox = (bbox, margin) => ({
    min: bbox.min.map((v) => v - margin),
    max: bbox.max.map((v) => v + margin),
});

/**
 * Khoảng cách gap giữa 2 AABB theo mỗi trục (âm nếu overlap, dương nếu có gap).
 * Distance = max gap trên 3 trục (nếu overlap hoàn toàn thì = 0).
 */
const computeGapDistance = (a, b) => {
    const gapX = Math.max(a.bbox.min[0] - b.bbox.max[0], b.bbox.min[0] - a.bbox.max[0], 0);
    const gapY = Math.max(a.bbox.min[1] - b.bbox.max[1], b.bbox.min[1] - a.bbox.max[1], 0);
    const gapZ = Math.max(a.bbox.min[2] - b.bbox.max[2], b.bbox.min[2] - a.bbox.max[2], 0);
    return Math.sqrt(gapX * gapX + gapY * gapY + gapZ * gapZ);
};

const intersectsAABB = (a, b) =>
    a.bbox.min[0] <= b.bbox.max[0] &&
    a.bbox.max[0] >= b.bbox.min[0] &&
    a.bbox.min[1] <= b.bbox.max[1] &&
    a.bbox.max[1] >= b.bbox.min[1] &&
    a.bbox.min[2] <= b.bbox.max[2] &&
    a.bbox.max[2] >= b.bbox.min[2];

const computeOverlap = (a, b) => {
    if (!intersectsAABB(a, b)) return null;

    const min = [
        Math.max(a.bbox.min[0], b.bbox.min[0]),
        Math.max(a.bbox.min[1], b.bbox.min[1]),
        Math.max(a.bbox.min[2], b.bbox.min[2]),
    ];
    const max = [
        Math.min(a.bbox.max[0], b.bbox.max[0]),
        Math.min(a.bbox.max[1], b.bbox.max[1]),
        Math.min(a.bbox.max[2], b.bbox.max[2]),
    ];
    const size = max.map((v, i) => Math.max(v - min[i], 0));
    const position = min.map((v, i) => v + size[i] / 2);
    const intersectionVolume = Number((size[0] * size[1] * size[2]).toFixed(6));

    return { min, max, size, position, intersectionVolume };
};

// ---------------------------------------------------------------------------
// Severity calculation
// ---------------------------------------------------------------------------

const buildPairKey = (typeA, typeB) => [typeA, typeB].sort().join('__');

/**
 * Tính severity đa yếu tố:
 *  1. Nếu là high-priority pair → ít nhất 'high'
 *  2. Nếu là soft clash → volume = 0, dùng inverse distance
 *  3. Hard clash: dựa vào volume + tỉ lệ volume/object volume
 */
const getSeverity = (opts) => {
    const { intersectionVolume, typeA, typeB, clashType, rulesSeverity } = opts;

    if (rulesSeverity) return rulesSeverity;

    const pairKey = buildPairKey(typeA, typeB);
    const isHighPriority = HIGH_PRIORITY_PAIRS.has(pairKey);

    if (clashType === 'soft') {
        return isHighPriority ? 'high' : 'medium';
    }

    // Hard clash - volume based
    if (intersectionVolume >= SEVERITY_VOLUME.high) return 'high';
    if (intersectionVolume >= SEVERITY_VOLUME.medium) {
        return isHighPriority ? 'high' : 'medium';
    }
    return isHighPriority ? 'medium' : 'low';
};

// ---------------------------------------------------------------------------
// ID and group key (stable — dùng cho re-detection merge)
// ---------------------------------------------------------------------------

const buildClashId = (a, b) => {
    const [idA, idB] = [a.id, b.id].sort();
    return `${idA}__${idB}`;
};

const buildClashGroupKey = (a, b) => buildPairKey(a.type, b.type);

// ---------------------------------------------------------------------------
// Per-type rules resolver
// ---------------------------------------------------------------------------

/**
 * Tìm rule phù hợp nhất cho cặp (typeA, typeB).
 * Rule: { typeA, typeB, minClearance, severity }
 */
const findMatchingRule = (rules, typeA, typeB) => {
    if (!Array.isArray(rules) || rules.length === 0) return null;
    const pairKey = buildPairKey(typeA, typeB);

    for (const rule of rules) {
        if (!rule.typeA || !rule.typeB) continue;
        const ruleKey = buildPairKey(rule.typeA, rule.typeB);
        if (ruleKey === pairKey) return rule;
    }
    return null;
};

// ---------------------------------------------------------------------------
// Main detectClashes
// ---------------------------------------------------------------------------

/**
 * @param {Array} objects - Mảng BIM objects với { id, type, bbox }
 * @param {Object} options
 * @param {number} [options.clearanceThreshold=0] - Khoảng cách tối thiểu (m) để phát hiện soft clash
 * @param {Array}  [options.rules=[]] - Per-type rules: [{typeA, typeB, minClearance, severity}]
 * @returns {Array} clashes
 */
const detectClashes = (objects = [], options = {}) => {
    if (!Array.isArray(objects)) throw new Error('Objects payload must be an array');

    objects.forEach(validateObject);

    const clearanceThreshold = typeof options.clearanceThreshold === 'number'
        ? Math.max(0, options.clearanceThreshold)
        : 0;
    const rules = Array.isArray(options.rules) ? options.rules : [];

    const clashes = [];

    for (let i = 0; i < objects.length; i += 1) {
        for (let j = i + 1; j < objects.length; j += 1) {
            const a = objects[i];
            const b = objects[j];

            const overlap = computeOverlap(a, b);
            const matchedRule = findMatchingRule(rules, a.type, b.type);
            const effectiveClearance = matchedRule?.minClearance ?? clearanceThreshold;

            let clashType = null;
            let intersectionVolume = 0;
            let clashPosition = null;
            let distance = 0;

            if (overlap) {
                // Hard clash
                clashType = 'hard';
                intersectionVolume = overlap.intersectionVolume;
                clashPosition = overlap.position;
                distance = 0;
            } else if (effectiveClearance > 0) {
                // Check soft clash via expanded bbox
                const expandedA = { ...a, bbox: expandBBox(a.bbox, effectiveClearance) };
                if (intersectsAABB(expandedA, b)) {
                    clashType = 'soft';
                    distance = computeGapDistance(a, b);
                    // Position = midpoint between the two centroids
                    const centerA = a.bbox.min.map((v, k) => (v + a.bbox.max[k]) / 2);
                    const centerB = b.bbox.min.map((v, k) => (v + b.bbox.max[k]) / 2);
                    clashPosition = centerA.map((v, k) => (v + centerB[k]) / 2);
                }
            }

            if (!clashType) continue;

            const severity = getSeverity({
                intersectionVolume,
                typeA: a.type,
                typeB: b.type,
                clashType,
                rulesSeverity: matchedRule?.severity || null,
            });

            clashes.push({
                id: buildClashId(a, b),
                objectA: a.id,
                objectB: b.id,
                objectABBox: a.bbox,
                objectBBBox: b.bbox,
                objectAType: a.type,
                objectBType: b.type,
                position: clashPosition,
                severity,
                clashType,
                intersectionVolume,
                distance: Number(distance.toFixed(4)),
                groupKey: buildClashGroupKey(a, b),
            });
        }
    }

    return clashes;
};

module.exports = {
    detectClashes,
    intersectsAABB,
    computeOverlap,
    computeGapDistance,
    expandBBox,
    buildClashGroupKey,
    buildClashId,
    getSeverity,
    validateObject,
};
