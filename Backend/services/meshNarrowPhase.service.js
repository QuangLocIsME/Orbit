/**
 * Narrow-phase clash refinement: triangle–triangle overlap (SAT) on simplified meshes.
 * Broad phase (AABB) remains in navisworksClash.service; this module removes many
 * false positives when `clashMesh.positions` (flat: 9 floats per triangle) exists on both objects.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

const triEdgesFrom9 = (t) => {
    const v0 = [t[0], t[1], t[2]];
    const v1 = [t[3], t[4], t[5]];
    const v2 = [t[6], t[7], t[8]];
    return [sub(v1, v0), sub(v2, v1), sub(v0, v2)];
};

const projectTri9 = (tri9, ax, ay, az) => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 9; i += 3) {
        const d = tri9[i] * ax + tri9[i + 1] * ay + tri9[i + 2] * az;
        min = Math.min(min, d);
        max = Math.max(max, d);
    }
    return [min, max];
};

const intervalsOverlap = (a, b) => a[1] >= b[0] && b[1] >= a[0];

const tri9AabbOverlap = (a9, b9) => {
    let minAx = Infinity;
    let minAy = Infinity;
    let minAz = Infinity;
    let maxAx = -Infinity;
    let maxAy = -Infinity;
    let maxAz = -Infinity;
    for (let i = 0; i < 9; i += 3) {
        minAx = Math.min(minAx, a9[i]);
        minAy = Math.min(minAy, a9[i + 1]);
        minAz = Math.min(minAz, a9[i + 2]);
        maxAx = Math.max(maxAx, a9[i]);
        maxAy = Math.max(maxAy, a9[i + 1]);
        maxAz = Math.max(maxAz, a9[i + 2]);
    }
    let minBx = Infinity;
    let minBy = Infinity;
    let minBz = Infinity;
    let maxBx = -Infinity;
    let maxBy = -Infinity;
    let maxBz = -Infinity;
    for (let i = 0; i < 9; i += 3) {
        minBx = Math.min(minBx, b9[i]);
        minBy = Math.min(minBy, b9[i + 1]);
        minBz = Math.min(minBz, b9[i + 2]);
        maxBx = Math.max(maxBx, b9[i]);
        maxBy = Math.max(maxBy, b9[i + 1]);
        maxBz = Math.max(maxBz, b9[i + 2]);
    }
    return maxAx >= minBx && maxBx >= minAx
        && maxAy >= minBy && maxBy >= minAy
        && maxAz >= minBz && maxBz >= minAz;
};

/** SAT for two triangles (11 axes). Coplanar edge cases are rare in practice for BIM clashes. */
const triangle9Intersect = (a9, b9) => {
    const v0a = [a9[0], a9[1], a9[2]];
    const v1a = [a9[3], a9[4], a9[5]];
    const v2a = [a9[6], a9[7], a9[8]];
    const v0b = [b9[0], b9[1], b9[2]];
    const v1b = [b9[3], b9[4], b9[5]];
    const v2b = [b9[6], b9[7], b9[8]];

    const n1 = cross(sub(v1a, v0a), sub(v2a, v0a));
    const n2 = cross(sub(v1b, v0b), sub(v2b, v0b));
    const axes = [n1, n2];
    const ea = triEdgesFrom9(a9);
    const eb = triEdgesFrom9(b9);
    for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
            axes.push(cross(ea[i], eb[j]));
        }
    }

    for (const axis of axes) {
        const len = Math.hypot(axis[0], axis[1], axis[2]);
        if (len < 1e-12) continue;
        const ax = axis[0] / len;
        const ay = axis[1] / len;
        const az = axis[2] / len;
        const pa = projectTri9(a9, ax, ay, az);
        const pb = projectTri9(b9, ax, ay, az);
        if (!intervalsOverlap(pa, pb)) return false;
    }
    return true;
};

const meshesIntersect = (positionsA, positionsB) => {
    if (!positionsA?.length || !positionsB?.length) return false;
    if (positionsA.length % 9 !== 0 || positionsB.length % 9 !== 0) return false;
    const na = positionsA.length / 9;
    const nb = positionsB.length / 9;
    for (let ia = 0; ia < na; ia += 1) {
        const oa = ia * 9;
        const ta = positionsA.subarray ? positionsA.subarray(oa, oa + 9) : positionsA.slice(oa, oa + 9);
        for (let ib = 0; ib < nb; ib += 1) {
            const ob = ib * 9;
            const tb = positionsB.subarray ? positionsB.subarray(ob, ob + 9) : positionsB.slice(ob, ob + 9);
            if (!tri9AabbOverlap(ta, tb)) continue;
            if (triangle9Intersect(ta, tb)) return true;
        }
    }
    return false;
};

const toFloat64Flat = (mesh) => {
    if (!mesh?.positions?.length) return null;
    const p = mesh.positions;
    if (p instanceof Float64Array) return p;
    if (p instanceof Float32Array) return Float64Array.from(p);
    return Float64Array.from(p);
};

/**
 * @param {string|null} aabbType - 'HARD' | 'SOFT' | 'DUPLICATE' from AABB phase
 * @param {object|null} meshA - { positions: number[]|TypedArray } length % 9 === 0
 * @param {object|null} meshB
 * @returns {{ type: string|null }} null type = drop clash (AABB false positive on HARD)
 */
const refineClashTypeFromMeshes = (aabbType, meshA, meshB) => {
    if (!aabbType) return { type: null };

    const pa = toFloat64Flat(meshA);
    const pb = toFloat64Flat(meshB);
    if (!pa || !pb || pa.length < 9 || pb.length < 9) {
        return { type: aabbType };
    }

    const hit = meshesIntersect(pa, pb);

    if (aabbType === 'HARD') {
        if (!hit) return { type: null };
        return { type: 'HARD' };
    }

    if (aabbType === 'SOFT') {
        if (hit) return { type: 'HARD' };
        return { type: 'SOFT' };
    }

    if (aabbType === 'DUPLICATE') {
        return { type: 'DUPLICATE' };
    }

    return { type: aabbType };
};

module.exports = {
    refineClashTypeFromMeshes,
    triangle9Intersect,
    meshesIntersect,
};
