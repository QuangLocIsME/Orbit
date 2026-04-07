const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, S3_BUCKET } = require('../config/s3');

/**
 * Bucket used for mesh blobs. Defaults to the shared S3_BUCKET.
 * Override with ORBIT_MESH_BUCKET (preferred) or S3_MESH_BUCKET.
 */
const meshBucket = () => process.env.ORBIT_MESH_BUCKET || process.env.S3_MESH_BUCKET || S3_BUCKET;

const meshKey = (projectSlug, modelId) =>
    `navisworks-mesh/${projectSlug}/${modelId}.json`;

const normalizeObjectId = (raw) => {
    if (raw === undefined || raw === null) return '';
    let next = String(raw).trim();
    try {
        next = decodeURIComponent(next);
    } catch {
        // keep original string when malformed URI component
    }
    return next.replace(/[{}]/g, '').toLowerCase();
};

/**
 * Keep only finite XYZ triples and trim to full triangles (9-float groups).
 */
const sanitizePositions = (positions = []) => {
    if (!Array.isArray(positions) || positions.length === 0) return [];
    const clean = [];
    for (let i = 0; i + 2 < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
            clean.push(x, y, z);
        }
    }
    const completeLen = Math.floor(clean.length / 9) * 9;
    return completeLen > 0 ? clean.slice(0, completeLen) : [];
};

/**
 * Upload triangle mesh data for all objects of one model to MinIO/S3.
 *
 * @param {string} projectSlug
 * @param {string} modelId
 * @param {Record<string, number[]>} objectMeshMap  objectId → flat positions array
 * @returns {Promise<string>} the S3 key that was written
 */
async function uploadModelMeshes(projectSlug, modelId, objectMeshMap) {
    const bucket = meshBucket();
    if (!bucket) {
        throw new Error('Mesh storage bucket not configured (S3_BUCKET / ORBIT_MESH_BUCKET / S3_MESH_BUCKET required)');
    }

    const nonEmpty = {};
    for (const [objectId, rawPositions] of Object.entries(objectMeshMap || {})) {
        if (!Array.isArray(rawPositions) || rawPositions.length < 9) continue;
        const positions = sanitizePositions(rawPositions);
        if (positions.length === 0) continue;
        const nonFinite = positions.filter((v) => !Number.isFinite(v)).length;
        if (nonFinite > 0) {
            throw new Error('Mesh still contains invalid values');
        }
        nonEmpty[objectId] = positions;
    }

    if (Object.keys(nonEmpty).length === 0) {
        return null;
    }

    const payload = JSON.stringify({ version: 1, modelId, objects: nonEmpty });
    const key = meshKey(projectSlug, modelId);

    await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: payload,
        ContentType: 'application/json',
    }));

    return key;
}

/**
 * Stream the body of a single GetObjectCommand response to a string.
 */
async function streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

/**
 * Fetch mesh positions from MinIO for the requested object IDs.
 *
 * Strategy:
 *  1. Look up each objectId in workspace.federatedModel.objects to find its meshRef.key.
 *  2. Group IDs by key (one key = one model file).
 *  3. Download each unique key once and filter to the requested IDs.
 *
 * Objects that have no meshRef (older workspaces, or bbox-only models) are silently skipped.
 *
 * @param {string} projectSlug  (unused at this layer but kept for future per-project bucket routing)
 * @param {object} workspace    full workspace doc from readWorkspace()
 * @param {string[]} objectIds  IDs to fetch
 * @returns {Promise<Record<string, number[]>>}  objectId → positions
 */
async function downloadMeshesForObjects(projectSlug, workspace, objectIds) {
    if (!objectIds || objectIds.length === 0) return {};

    const bucket = meshBucket();
    if (!bucket) return {};

    const wantedByNormalized = new Map();
    for (const objectId of objectIds) {
        const norm = normalizeObjectId(objectId);
        if (!norm) continue;
        if (!wantedByNormalized.has(norm)) wantedByNormalized.set(norm, objectId);
    }
    const objects = workspace?.federatedModel?.objects ?? [];

    // Build key → Set<objectId>
    const keyToIds = new Map();
    for (const obj of objects) {
        const normObjId = normalizeObjectId(obj.id);
        if (!normObjId || !wantedByNormalized.has(normObjId)) continue;
        const key = obj.meshRef?.key;
        if (!key) continue;
        const wantedId = wantedByNormalized.get(normObjId);
        if (!keyToIds.has(key)) keyToIds.set(key, new Set());
        keyToIds.get(key).add(wantedId);
    }

    if (keyToIds.size === 0) return {};

    const result = {};

    await Promise.all(
        Array.from(keyToIds.entries()).map(async ([key, idsForKey]) => {
            try {
                const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
                const text = await streamToString(res.Body);
                const parsed = JSON.parse(text);
                const allObjects = parsed?.objects ?? {};
                const blobByNormalized = new Map();
                for (const [blobObjectId, positions] of Object.entries(allObjects)) {
                    blobByNormalized.set(normalizeObjectId(blobObjectId), positions);
                }
                for (const id of idsForKey) {
                    const direct = allObjects[id];
                    const normalized = blobByNormalized.get(normalizeObjectId(id));
                    const raw = Array.isArray(direct) ? direct : normalized;
                    if (Array.isArray(raw) && raw.length >= 9) {
                        const positions = sanitizePositions(raw);
                        if (positions.length >= 9) {
                            result[id] = positions;
                        }
                    }
                }
            } catch (err) {
                console.warn(`[meshStorage] Failed to fetch key "${key}":`, err?.message || err);
            }
        })
    );

    return result;
}

/**
 * Resolve real meshes directly from a clashId in workspace runs.
 * This avoids frontend-side ID/key mismatches by anchoring lookup to persisted clash results.
 *
 * @returns {Promise<{
 *   clashId: string,
 *   objectIds: string[],
 *   meshes: Record<string, number[]>,
 *   diagnostics: Record<string, {
 *     hasMeshRef: boolean,
 *     meshKey: string | null,
 *     meshKeyExistsInMinio: boolean,
 *     positionsLengthBeforeSanitize: number,
 *     positionsLengthAfterSanitize: number,
 *     fallbackReason: string,
 *     objectHidden: boolean
 *   }>
 * }>}
 */
async function downloadMeshesForClash(projectSlug, workspace, clashId) {
    const id = String(clashId || '').trim();
    if (!id) {
        return { clashId: id, objectIds: [], meshes: {}, diagnostics: {} };
    }

    const runs = Array.isArray(workspace?.clashRuns) ? [...workspace.clashRuns] : [];
    runs.sort((a, b) => String(b?.completedAt || '').localeCompare(String(a?.completedAt || '')));

    let matchedResult = null;
    for (const run of runs) {
        const hit = (run?.results || []).find((r) => r?.clashId === id);
        if (hit) {
            matchedResult = hit;
            break;
        }
    }
    if (!matchedResult) {
        return { clashId: id, objectIds: [], meshes: {}, diagnostics: {} };
    }

    const objectIds = [matchedResult.objectA, matchedResult.objectB].filter(Boolean);
    const meshes = await downloadMeshesForObjects(projectSlug, workspace, objectIds);
    const diagnostics = await diagnoseMeshesForObjects(projectSlug, workspace, objectIds);
    return { clashId: id, objectIds, meshes, diagnostics };
}

/**
 * Diagnostic helper for clash-detail mesh issues (per-object).
 * Returns metadata to explain why an object falls back to bbox in viewer.
 *
 * @returns {Promise<Record<string, {
 *   hasMeshRef: boolean,
 *   meshKey: string | null,
 *   meshKeyExistsInMinio: boolean,
 *   positionsLengthBeforeSanitize: number,
 *   positionsLengthAfterSanitize: number,
 *   fallbackReason: string,
 *   objectHidden: boolean
 * }>>}
 */
async function diagnoseMeshesForObjects(projectSlug, workspace, objectIds) {
    if (!objectIds || objectIds.length === 0) return {};

    const bucket = meshBucket();
    const objects = workspace?.federatedModel?.objects ?? [];
    const objectMap = new Map(objects.map((obj) => [obj.id, obj]));
    const objectMapByNormalized = new Map(objects.map((obj) => [normalizeObjectId(obj.id), obj]));

    const diagnostics = {};
    const keyToIds = new Map();

    for (const objectId of objectIds) {
        const obj = objectMap.get(objectId) || objectMapByNormalized.get(normalizeObjectId(objectId));
        const key = obj?.meshRef?.key || null;
        diagnostics[objectId] = {
            hasMeshRef: Boolean(key),
            meshKey: key,
            meshKeyExistsInMinio: false,
            positionsLengthBeforeSanitize: 0,
            positionsLengthAfterSanitize: 0,
            fallbackReason: key ? 'mesh-not-fetched-yet' : 'no-meshRef',
            objectHidden: Boolean(obj?.hidden),
        };
        if (key) {
            if (!keyToIds.has(key)) keyToIds.set(key, new Set());
            keyToIds.get(key).add(objectId);
        }
    }

    if (!bucket) {
        for (const objectId of objectIds) {
            if (diagnostics[objectId]?.hasMeshRef) diagnostics[objectId].fallbackReason = 'mesh-bucket-not-configured';
        }
        return diagnostics;
    }

    await Promise.all(
        Array.from(keyToIds.entries()).map(async ([key, idsForKey]) => {
            try {
                const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
                const text = await streamToString(res.Body);
                const parsed = JSON.parse(text);
                const allObjects = parsed?.objects ?? {};
                const blobByNormalized = new Map();
                for (const [blobObjectId, positions] of Object.entries(allObjects)) {
                    blobByNormalized.set(normalizeObjectId(blobObjectId), positions);
                }
                for (const id of idsForKey) {
                    const diag = diagnostics[id];
                    if (!diag) continue;
                    diag.meshKeyExistsInMinio = true;
                    const raw = Array.isArray(allObjects[id])
                        ? allObjects[id]
                        : blobByNormalized.get(normalizeObjectId(id));
                    if (!Array.isArray(raw)) {
                        diag.fallbackReason = 'object-id-not-found-in-mesh-blob';
                        continue;
                    }
                    diag.positionsLengthBeforeSanitize = raw.length;
                    const sanitized = sanitizePositions(raw);
                    diag.positionsLengthAfterSanitize = sanitized.length;
                    if (raw.length < 9) {
                        diag.fallbackReason = 'positions-lt-9-before-sanitize';
                    } else if (sanitized.length < 9) {
                        diag.fallbackReason = 'positions-lt-9-after-sanitize';
                    } else {
                        diag.fallbackReason = '';
                    }
                }
            } catch (err) {
                for (const id of idsForKey) {
                    const diag = diagnostics[id];
                    if (!diag) continue;
                    diag.meshKeyExistsInMinio = false;
                    diag.fallbackReason = `minio-read-failed:${err?.name || 'error'}`;
                }
            }
        })
    );

    // If caller asked objectIds not present in workspace at all.
    for (const objectId of objectIds) {
        if (!objectMap.has(objectId) && !objectMapByNormalized.has(normalizeObjectId(objectId)) && diagnostics[objectId]) {
            diagnostics[objectId].fallbackReason = 'object-id-not-found-in-workspace';
        }
    }

    return diagnostics;
}

/**
 * Fetch mesh positions by raw MinIO keys (1 key per model file).
 * More efficient than downloadMeshesForObjects when the caller already knows the keys.
 *
 * @param {string[]} keys  MinIO object keys, e.g. ["navisworks-mesh/slug/modelId.json"]
 * @returns {Promise<Record<string, number[]>>}  objectId → positions (all objects in those files)
 */
async function downloadMeshesByKeys(keys) {
    if (!keys || keys.length === 0) return {};

    const bucket = meshBucket();
    if (!bucket) return {};

    const result = {};

    await Promise.all(
        keys.map(async (key) => {
            try {
                const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
                const text = await streamToString(res.Body);
                const parsed = JSON.parse(text);
                const allObjects = parsed?.objects ?? {};
                for (const [id, positions] of Object.entries(allObjects)) {
                    if (Array.isArray(positions) && positions.length >= 9) {
                        const sanitized = sanitizePositions(positions);
                        if (sanitized.length >= 9) {
                            result[id] = sanitized;
                        }
                    }
                }
            } catch (err) {
                console.warn(`[meshStorage] Failed to fetch key "${key}":`, err?.message || err);
            }
        })
    );

    return result;
}

/**
 * Delete the mesh blob for a model (called when a model is removed from the workspace).
 */
async function deleteModelMeshes(projectSlug, modelId) {
    const bucket = meshBucket();
    if (!bucket) return;
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const key = meshKey(projectSlug, modelId);
    try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
        // best-effort; blob may not exist for older models
    }
}

module.exports = {
    uploadModelMeshes,
    downloadMeshesForObjects,
    downloadMeshesForClash,
    diagnoseMeshesForObjects,
    downloadMeshesByKeys,
    deleteModelMeshes,
    meshKey,
};
