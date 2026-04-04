const path = require('path');
const WebIFC = require('web-ifc');
const {
    createId,
    readWorkspace,
    updateWorkspace,
} = require('./navisworksStorage.service');

const identityMatrix = () => ([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

const unitScaleMap = {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    meter: 1,
    metres: 1,
    metres: 1,
    ft: 0.3048,
};

const asUnitScale = (unit) => unitScaleMap[String(unit || 'm').trim().toLowerCase()] || 1;

const inferDiscipline = (name = '') => {
    const lower = name.toLowerCase();
    if (lower.includes('elect')) return 'electrical';
    if (lower.includes('mep')) return 'mep';
    if (lower.includes('plumb')) return 'plumbing';
    if (lower.includes('water')) return 'plumbing';
    if (lower.includes('arch')) return 'architecture';
    if (lower.includes('struct')) return 'structure';
    return 'unknown';
};

const matrixFromInput = (transform) => {
    if (Array.isArray(transform) && transform.length === 16) {
        return transform.map((value) => Number(value) || 0);
    }
    return identityMatrix();
};

const multiplyPoint = (matrix, point) => {
    const [x, y, z] = point;
    return [
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    ];
};

const mergeMatrices = (a, b) => {
    const out = new Array(16).fill(0);
    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
            for (let k = 0; k < 4; k += 1) {
                out[row + col * 4] += a[row + k * 4] * b[k + col * 4];
            }
        }
    }
    return out;
};

const transformBoundingBox = (bbox, matrix, scale = 1) => {
    const corners = [
        [bbox.min[0], bbox.min[1], bbox.min[2]],
        [bbox.min[0], bbox.min[1], bbox.max[2]],
        [bbox.min[0], bbox.max[1], bbox.min[2]],
        [bbox.min[0], bbox.max[1], bbox.max[2]],
        [bbox.max[0], bbox.min[1], bbox.min[2]],
        [bbox.max[0], bbox.min[1], bbox.max[2]],
        [bbox.max[0], bbox.max[1], bbox.min[2]],
        [bbox.max[0], bbox.max[1], bbox.max[2]],
    ].map(([x, y, z]) => [x * scale, y * scale, z * scale]);

    const transformed = corners.map((corner) => multiplyPoint(matrix, corner));
    const xs = transformed.map((point) => point[0]);
    const ys = transformed.map((point) => point[1]);
    const zs = transformed.map((point) => point[2]);

    return {
        min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
        max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
    };
};

const validateBBox = (bbox) => bbox
    && Array.isArray(bbox.min)
    && Array.isArray(bbox.max)
    && bbox.min.length === 3
    && bbox.max.length === 3;

const normalizeCategory = (type) => String(type || 'Unknown').replace(/^Ifc/i, '') || 'Unknown';

const normalizeRegistryObject = (object, sourceModel, sourceModelId, transform, unitScale) => {
    if (!object || !validateBBox(object.boundingBox || object.bbox)) {
        return null;
    }

    const rawBBox = object.boundingBox || object.bbox;
    const bbox = transformBoundingBox(rawBBox, transform, unitScale);

    let clashMesh = null;
    const cm = object.clashMesh;
    if (cm?.positions?.length >= 9 && cm.positions.length % 9 === 0) {
        clashMesh = { positions: Array.from(cm.positions) };
    }

    return {
        id: String(object.id || `${sourceModelId}-${Math.random().toString(36).slice(2, 8)}`),
        type: String(object.type || object.category || 'IfcBuildingElementProxy'),
        category: normalizeCategory(object.category || object.type),
        geometry: object.geometry || null,
        clashMesh,
        boundingBox: bbox,
        transform,
        sourceModel,
        sourceModelId,
        sourceFile: object.sourceFile || sourceModel,
        globalId: object.globalId || null,
    };
};

const parseJsonRegistry = (buffer, meta) => {
    const parsed = JSON.parse(buffer.toString('utf8'));
    const sourceModelId = meta.sourceModelId || createId('model');
    const sourceModel = meta.sourceModel || meta.originalName || sourceModelId;
    const transform = matrixFromInput(meta.transform);
    const unitScale = asUnitScale(meta.unit);

    const asObjects = (() => {
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.objects)) return parsed.objects;
        if (Array.isArray(parsed.models)) {
            return parsed.models.flatMap((model) =>
                (Array.isArray(model.objects) ? model.objects : []).map((object) => ({
                    ...object,
                    sourceFile: model.name || sourceModel,
                })));
        }
        return [];
    })();

    const objects = asObjects
        .map((object) => normalizeRegistryObject(object, sourceModel, sourceModelId, transform, unitScale))
        .filter(Boolean);

    return {
        model: {
            id: sourceModelId,
            name: sourceModel,
            sourceFormat: 'json',
            discipline: meta.discipline || inferDiscipline(sourceModel),
            unit: meta.unit || 'm',
            transform,
            importedAt: new Date().toISOString(),
            categories: Array.from(new Set(objects.map((object) => object.category))).sort(),
            objectCount: objects.length,
        },
        objects,
    };
};

let ifcApiPromise = null;

const getIfcApi = async () => {
    if (!ifcApiPromise) {
        const api = new WebIFC.IfcAPI();
        ifcApiPromise = api.Init().then(() => api);
    }
    return ifcApiPromise;
};

const MAX_CLASH_TRIANGLES_PER_OBJECT = Number(process.env.ORBIT_CLASH_MESH_MAX_TRIS || '80');
const ORBIT_DISABLE_CLASH_MESH = process.env.ORBIT_DISABLE_CLASH_MESH === '1';
const ORBIT_MAX_OBJECTS_WITH_MESH = Number(process.env.ORBIT_MAX_OBJECTS_WITH_MESH || '1200');

const triCentroid9 = (flat, o) => [
    (flat[o] + flat[o + 3] + flat[o + 6]) / 3,
    (flat[o + 1] + flat[o + 4] + flat[o + 7]) / 3,
    (flat[o + 2] + flat[o + 5] + flat[o + 8]) / 3,
];

/** Squared magnitude of cross product / 4 ≈ proportional to triangle area squared. */
const triAreaSq9 = (flat, o) => {
    const ax = flat[o + 3] - flat[o];
    const ay = flat[o + 4] - flat[o + 1];
    const az = flat[o + 5] - flat[o + 2];
    const bx = flat[o + 6] - flat[o];
    const by = flat[o + 7] - flat[o + 1];
    const bz = flat[o + 8] - flat[o + 2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    return cx * cx + cy * cy + cz * cz;
};

/**
 * Keep at most `maxTris` triangles: bucket by centroid in a 3D grid, keep largest-area tri per cell,
 * then global top-by-area — better coverage than uniform stride for clash fidelity.
 */
const subsampleFlatTrianglesSpatial9 = (flat, maxTris) => {
    const n = Math.floor(flat.length / 9);
    if (n <= maxTris) return flat;

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    const areas = new Array(n);
    for (let i = 0; i < n; i += 1) {
        const o = i * 9;
        const c = triCentroid9(flat, o);
        areas[i] = triAreaSq9(flat, o);
        minX = Math.min(minX, c[0]);
        minY = Math.min(minY, c[1]);
        minZ = Math.min(minZ, c[2]);
        maxX = Math.max(maxX, c[0]);
        maxY = Math.max(maxY, c[1]);
        maxZ = Math.max(maxZ, c[2]);
    }

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const dz = maxZ - minZ || 1;
    const g = Math.max(4, Math.min(16, Math.round(Math.cbrt(maxTris * 2.5))));

    const buckets = new Map();
    for (let i = 0; i < n; i += 1) {
        const o = i * 9;
        const c = triCentroid9(flat, o);
        const ix = Math.min(g - 1, Math.max(0, Math.floor(((c[0] - minX) / dx) * g)));
        const iy = Math.min(g - 1, Math.max(0, Math.floor(((c[1] - minY) / dy) * g)));
        const iz = Math.min(g - 1, Math.max(0, Math.floor(((c[2] - minZ) / dz) * g)));
        const key = `${ix},${iy},${iz}`;
        const a = areas[i];
        const prev = buckets.get(key);
        if (!prev || a > prev.area) {
            buckets.set(key, { o, area: a });
        }
    }

    const picked = new Set();
    const candidates = Array.from(buckets.values()).sort((a, b) => b.area - a.area);
    for (let j = 0; j < candidates.length && picked.size < maxTris; j += 1) {
        picked.add(candidates[j].o);
    }

    if (picked.size < maxTris) {
        const rest = [];
        for (let i = 0; i < n; i += 1) {
            const o = i * 9;
            if (!picked.has(o)) rest.push({ o, area: areas[i] });
        }
        rest.sort((a, b) => b.area - a.area);
        for (let j = 0; j < rest.length && picked.size < maxTris; j += 1) {
            picked.add(rest[j].o);
        }
    }

    const finalOffsets = Array.from(picked)
        .sort((oa, ob) => triAreaSq9(flat, ob) - triAreaSq9(flat, oa))
        .slice(0, maxTris);

    const out = [];
    for (let f = 0; f < finalOffsets.length; f += 1) {
        const o = finalOffsets[f];
        for (let k = 0; k < 9; k += 1) out.push(flat[o + k]);
    }
    return out;
};

/** Append world-space triangles (9 floats each) from one IFC geometry chunk. */
const appendIfcGeometryTriangles = (out, vertices, indices, matrix, unitScale) => {
    const pushTri = (x1, y1, z1, x2, y2, z2, x3, y3, z3) => {
        const p1 = multiplyPoint(matrix, [x1 * unitScale, y1 * unitScale, z1 * unitScale]);
        const p2 = multiplyPoint(matrix, [x2 * unitScale, y2 * unitScale, z2 * unitScale]);
        const p3 = multiplyPoint(matrix, [x3 * unitScale, y3 * unitScale, z3 * unitScale]);
        out.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
    };

    if (indices && indices.length >= 3) {
        for (let i = 0; i + 2 < indices.length; i += 3) {
            const i0 = indices[i] * 6;
            const i1 = indices[i + 1] * 6;
            const i2 = indices[i + 2] * 6;
            pushTri(
                vertices[i0], vertices[i0 + 1], vertices[i0 + 2],
                vertices[i1], vertices[i1 + 1], vertices[i1 + 2],
                vertices[i2], vertices[i2 + 1], vertices[i2 + 2],
            );
        }
        return;
    }

    const nVert = Math.floor(vertices.length / 6);
    for (let t = 0; t + 2 < nVert; t += 3) {
        const b = t * 6;
        const b1 = (t + 1) * 6;
        const b2 = (t + 2) * 6;
        pushTri(
            vertices[b], vertices[b + 1], vertices[b + 2],
            vertices[b1], vertices[b1 + 1], vertices[b1 + 2],
            vertices[b2], vertices[b2 + 1], vertices[b2 + 2],
        );
    }
};

const bboxFromVertices = (vertices, matrix, scale = 1) => {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < vertices.length; index += 6) {
        const point = multiplyPoint(matrix, [
            (vertices[index] || 0) * scale,
            (vertices[index + 1] || 0) * scale,
            (vertices[index + 2] || 0) * scale,
        ]);
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        minZ = Math.min(minZ, point[2]);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
        maxZ = Math.max(maxZ, point[2]);
    }

    if (!Number.isFinite(minX)) {
        return null;
    }

    return {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
    };
};

const parseIfcModel = async (buffer, meta) => {
    const api = await getIfcApi();
    const sourceModelId = meta.sourceModelId || createId('model');
    const sourceModel = meta.sourceModel || meta.originalName || sourceModelId;
    const unitScale = asUnitScale(meta.unit || 'm');
    const importTransform = matrixFromInput(meta.transform);
    const modelId = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: false });
    const objectsByExpressId = new Map();

    try {
        api.StreamAllMeshes(modelId, (flatMesh) => {
            let aggregateBBox = null;
            let primaryGeometryTransform = null;
            const clashTriangleBuffer = [];

            for (let index = 0; index < flatMesh.geometries.size(); index += 1) {
                const placedGeometry = flatMesh.geometries.get(index);
                const geometry = api.GetGeometry(modelId, placedGeometry.geometryExpressID);
                const vertices = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
                const geometryTransform = mergeMatrices(importTransform, placedGeometry.flatTransformation);
                const geometryBBox = bboxFromVertices(vertices, geometryTransform, unitScale);

                if (!ORBIT_DISABLE_CLASH_MESH && geometryBBox) {
                    const idxSize = geometry.GetIndexDataSize();
                    const indices = idxSize > 0
                        ? api.GetIndexArray(geometry.GetIndexData(), idxSize)
                        : null;
                    appendIfcGeometryTriangles(clashTriangleBuffer, vertices, indices, geometryTransform, unitScale);
                }

                geometry.delete();

                if (!geometryBBox) continue;
                primaryGeometryTransform = primaryGeometryTransform || geometryTransform;

                if (!aggregateBBox) {
                    aggregateBBox = geometryBBox;
                    continue;
                }

                aggregateBBox = {
                    min: [
                        Math.min(aggregateBBox.min[0], geometryBBox.min[0]),
                        Math.min(aggregateBBox.min[1], geometryBBox.min[1]),
                        Math.min(aggregateBBox.min[2], geometryBBox.min[2]),
                    ],
                    max: [
                        Math.max(aggregateBBox.max[0], geometryBBox.max[0]),
                        Math.max(aggregateBBox.max[1], geometryBBox.max[1]),
                        Math.max(aggregateBBox.max[2], geometryBBox.max[2]),
                    ],
                };
            }

            if (!aggregateBBox) return;

            const line = api.GetLine(modelId, flatMesh.expressID) || {};
            const lineTypeCode = api.GetLineType(modelId, flatMesh.expressID);
            const type = api.GetNameFromTypeCode(lineTypeCode) || 'IfcBuildingElementProxy';
            const globalId = typeof line.GlobalId === 'object' && line.GlobalId !== null
                ? line.GlobalId.value || line.GlobalId
                : line.GlobalId || null;

            let clashMesh = null;
            if (!ORBIT_DISABLE_CLASH_MESH && clashTriangleBuffer.length >= 9) {
                const sampled = subsampleFlatTrianglesSpatial9(clashTriangleBuffer, MAX_CLASH_TRIANGLES_PER_OBJECT);
                clashMesh = { positions: sampled };
            }

            objectsByExpressId.set(flatMesh.expressID, {
                id: globalId ? String(globalId) : `${sourceModelId}:${flatMesh.expressID}`,
                type,
                category: normalizeCategory(type),
                geometry: {
                    expressId: flatMesh.expressID,
                    source: 'ifc-mesh',
                },
                clashMesh,
                boundingBox: aggregateBBox,
                transform: primaryGeometryTransform || importTransform,
                sourceModel,
                sourceModelId,
                sourceFile: meta.originalName || sourceModel,
                globalId: globalId ? String(globalId) : null,
            });
        });
    } finally {
        api.CloseModel(modelId);
    }

    const objects = Array.from(objectsByExpressId.values());

    if (ORBIT_DISABLE_CLASH_MESH || objects.length > ORBIT_MAX_OBJECTS_WITH_MESH) {
        objects.forEach((object) => {
            delete object.clashMesh;
        });
    }

    return {
        model: {
            id: sourceModelId,
            name: sourceModel,
            sourceFormat: 'ifc',
            discipline: meta.discipline || inferDiscipline(sourceModel),
            unit: meta.unit || 'm',
            transform: importTransform,
            importedAt: new Date().toISOString(),
            categories: Array.from(new Set(objects.map((object) => object.category))).sort(),
            objectCount: objects.length,
        },
        objects,
    };
};

const translateClashMeshPositions = (clashMesh, translation) => {
    if (!clashMesh?.positions?.length) return clashMesh;
    const [tx, ty, tz] = translation;
    if (!tx && !ty && !tz) return clashMesh;
    const p = clashMesh.positions;
    const next = new Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
        next[i] = p[i] + tx;
        next[i + 1] = p[i + 1] + ty;
        next[i + 2] = p[i + 2] + tz;
    }
    return { positions: next };
};

const applyOverridesToObject = (object, override) => {
    if (!override) return { ...object, hidden: false };
    const translation = Array.isArray(override.translation) ? override.translation : [0, 0, 0];
    const tx = Number(translation[0]) || 0;
    const ty = Number(translation[1]) || 0;
    const tz = Number(translation[2]) || 0;
    return {
        ...object,
        hidden: Boolean(override.hidden),
        boundingBox: {
            min: [
                object.boundingBox.min[0] + tx,
                object.boundingBox.min[1] + ty,
                object.boundingBox.min[2] + tz,
            ],
            max: [
                object.boundingBox.max[0] + tx,
                object.boundingBox.max[1] + ty,
                object.boundingBox.max[2] + tz,
            ],
        },
        clashMesh: object.clashMesh
            ? translateClashMeshPositions(object.clashMesh, [tx, ty, tz])
            : object.clashMesh,
    };
};

const mergeImportedModels = (workspace, importedModels) => {
    const existingModels = workspace.federatedModel.models.filter(
        (model) => !importedModels.some((entry) => entry.model.id === model.id)
    );
    const existingObjects = workspace.federatedModel.objects.filter(
        (object) => !importedModels.some((entry) => entry.model.id === object.sourceModelId)
    );

    const nextModels = [...existingModels, ...importedModels.map((entry) => entry.model)];
    const nextObjects = [...existingObjects, ...importedModels.flatMap((entry) => entry.objects)];

    return {
        ...workspace,
        federatedModel: {
            coordinateSystem: 'project-global',
            unit: 'm',
            models: nextModels,
            objects: nextObjects,
        },
    };
};

class ModelService {
    async importModels(projectSlug, imports = []) {
        if (!Array.isArray(imports) || imports.length === 0) {
            throw new Error('At least one model import is required');
        }

        const parsedImports = [];
        for (const entry of imports) {
            const sourceFormat = String(entry.sourceFormat || path.extname(entry.originalName || '').replace('.', '') || 'json')
                .toLowerCase();
            if (sourceFormat === 'json') {
                parsedImports.push(parseJsonRegistry(entry.buffer, entry));
                continue;
            }
            if (sourceFormat === 'ifc') {
                parsedImports.push(await parseIfcModel(entry.buffer, entry));
                continue;
            }
            throw new Error(`Unsupported model format: ${sourceFormat}`);
        }

        const workspace = await updateWorkspace(projectSlug, (current) =>
            mergeImportedModels(current, parsedImports));
        return this.getFederatedModel(projectSlug, workspace);
    }

    async getFederatedModel(projectSlug, workspaceOverride = null) {
        const workspace = workspaceOverride ?? (await readWorkspace(projectSlug));
        const objects = workspace.federatedModel.objects.map((object) =>
            applyOverridesToObject(object, workspace.objectOverrides[object.id]));

        return {
            ...workspace.federatedModel,
            objects,
        };
    }

    async getWorkspace(projectSlug) {
        return readWorkspace(projectSlug);
    }

    async listModels(projectSlug) {
        const federated = await this.getFederatedModel(projectSlug);
        return federated.models;
    }

    async listCategories(projectSlug) {
        const federatedModel = await this.getFederatedModel(projectSlug);
        return Array.from(new Set(federatedModel.objects.map((object) => object.category))).sort();
    }
}

module.exports = new ModelService();
