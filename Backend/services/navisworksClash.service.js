const { Types } = require('mongoose');
const { buildBCFDocument } = require('./bcfExport.service');
const { createId, readWorkspace, updateWorkspace, defaultWorkspace } = require('./navisworksStorage.service');
const modelService = require('./model.service');
const selectionSetService = require('./selectionSet.service');
const meshNarrowPhase = require('./meshNarrowPhase.service');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const User = require('../models/User');
const Project = require('../models/Project');
const socketService = require('./socketService');
const { resolveUserDisplayName } = require('../utils/userDisplayName');

const DEFAULT_CELL_SIZE = 4;
const DEFAULT_DUPLICATE_TOLERANCE = 0.001;

const asNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const centerOfBBox = (bbox) => ([
    (bbox.min[0] + bbox.max[0]) / 2,
    (bbox.min[1] + bbox.max[1]) / 2,
    (bbox.min[2] + bbox.max[2]) / 2,
]);

const translateBBox = (bbox, translation) => ({
    min: [bbox.min[0] + translation[0], bbox.min[1] + translation[1], bbox.min[2] + translation[2]],
    max: [bbox.max[0] + translation[0], bbox.max[1] + translation[1], bbox.max[2] + translation[2]],
});

const intersectionVolume = (a, b) => {
    const dx = Math.min(a.boundingBox.max[0], b.boundingBox.max[0]) - Math.max(a.boundingBox.min[0], b.boundingBox.min[0]);
    const dy = Math.min(a.boundingBox.max[1], b.boundingBox.max[1]) - Math.max(a.boundingBox.min[1], b.boundingBox.min[1]);
    const dz = Math.min(a.boundingBox.max[2], b.boundingBox.max[2]) - Math.max(a.boundingBox.min[2], b.boundingBox.min[2]);
    if (dx <= 0 || dy <= 0 || dz <= 0) return 0;
    return dx * dy * dz;
};

const overlapsAabb = (a, b) => intersectionVolume(a, b) > 0;

const distanceBetweenAabbs = (a, b) => {
    const dx = Math.max(0, a.boundingBox.min[0] - b.boundingBox.max[0], b.boundingBox.min[0] - a.boundingBox.max[0]);
    const dy = Math.max(0, a.boundingBox.min[1] - b.boundingBox.max[1], b.boundingBox.min[1] - a.boundingBox.max[1]);
    const dz = Math.max(0, a.boundingBox.min[2] - b.boundingBox.max[2], b.boundingBox.min[2] - a.boundingBox.max[2]);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const nearlyEqual = (a, b, tolerance = DEFAULT_DUPLICATE_TOLERANCE) => Math.abs(a - b) <= tolerance;

/** Align with Frontend `memberLabel`: fullName, else email, else "Unknown member". */
function assigneeLabelFromUserDoc(user) {
    if (!user) return 'Unknown member';
    const name = user.fullName && String(user.fullName).trim();
    if (name) return name;
    const email = user.email && String(user.email).trim();
    if (email) return email;
    return 'Unknown member';
}

async function resolveMemberMongoIdByAssigneeLabel(projectId, assigneeLabel) {
    const label = String(assigneeLabel || '').trim();
    if (!label || /^unassigned$/i.test(label)) return null;

    const rawMembers = await ProjectMemberRepository.getMembersWithUsers(projectId);
    const userIds = [...new Set(rawMembers.map((m) => m.userId).filter(Boolean))];
    const validObjectIds = userIds.filter((id) => /^[a-f\d]{24}$/i.test(String(id)));
    const publicIds = userIds.filter((id) => !/^[a-f\d]{24}$/i.test(String(id)));

    const userDocsById = validObjectIds.length
        ? await User.find({ _id: { $in: validObjectIds.map((id) => new Types.ObjectId(id)) } })
            .select('_id publicId fullName email')
            .lean()
        : [];
    const userDocsByPublicId = publicIds.length
        ? await User.find({ publicId: { $in: publicIds } }).select('_id publicId fullName email').lean()
        : [];

    const userMap = new Map();
    [...userDocsById, ...userDocsByPublicId].forEach((u) => {
        userMap.set(String(u._id), u);
        userMap.set(u.publicId, u);
    });

    for (const m of rawMembers) {
        const u = userMap.get(m.userId);
        if (!u) continue;
        if (assigneeLabelFromUserDoc(u) === label) {
            return String(u._id);
        }
    }
    return null;
}

async function resolveActorMongoId(actorUserId) {
    if (!actorUserId) return null;
    const id = String(actorUserId);
    let u = await User.findById(id).select('_id').lean();
    if (!u) u = await User.findOne({ publicId: id }).select('_id').lean();
    return u ? String(u._id) : null;
}

const CLASH_RESOLVE_FORBIDDEN_MSG =
    'Only project owners, admins, managers, or the assignee can mark this clash as resolved.';

const CLASH_NOTE_ASSIGNEE_FORBIDDEN_MSG =
    'Only project owners, admins, or managers can update the coordination note or assignee.';

async function assertActorMayMarkClashResolved(projectSlug, actorUserId, assigneeRaw) {
    if (!actorUserId) {
        const e = new Error(CLASH_RESOLVE_FORBIDDEN_MSG);
        e.code = 'CLASH_RESOLVE_FORBIDDEN';
        throw e;
    }
    const member = await ProjectMemberRepository.findMember(projectSlug, actorUserId);
    if (!member || member.status !== 'accepted') {
        const e = new Error(CLASH_RESOLVE_FORBIDDEN_MSG);
        e.code = 'CLASH_RESOLVE_FORBIDDEN';
        throw e;
    }
    const role = String(member.role || '').toLowerCase();
    if (role === 'owner' || role === 'admin' || role === 'manager') return;

    const label = String(assigneeRaw || '').trim();
    if (!label || /^unassigned$/i.test(label)) {
        const e = new Error(CLASH_RESOLVE_FORBIDDEN_MSG);
        e.code = 'CLASH_RESOLVE_FORBIDDEN';
        throw e;
    }

    const assigneeMongoId = await resolveMemberMongoIdByAssigneeLabel(projectSlug, label);
    const actorMongoId = await resolveActorMongoId(actorUserId);
    if (!assigneeMongoId || !actorMongoId || assigneeMongoId !== actorMongoId) {
        const e = new Error(CLASH_RESOLVE_FORBIDDEN_MSG);
        e.code = 'CLASH_RESOLVE_FORBIDDEN';
        throw e;
    }
}

async function resolveActorDisplayName(actorUserId) {
    return resolveUserDisplayName(actorUserId, 'Someone');
}

/**
 * In-app + realtime notification when a clash is assigned to a project member (by dropdown label).
 */
async function notifyClashAssigneeAssigned({
    projectSlug,
    sourceTestId,
    clashId,
    clashTitle,
    targetUserMongoId,
    actorUserId,
}) {
    const project = await Project.findOne({ publicId: projectSlug }).select('name').lean();
    const projectName = project?.name || 'Project';
    const assignerName = await resolveActorDisplayName(actorUserId);

    const linkPath = `/projects/${encodeURIComponent(projectSlug)}?tab=clashes&clashView=workspace&clashTestId=${encodeURIComponent(
        sourceTestId || ''
    )}&clashId=${encodeURIComponent(clashId || '')}`;
    const title = 'Clash assigned to you';
    const safeTitle = clashTitle && String(clashTitle).trim() ? String(clashTitle).trim() : 'Clash';
    const message = `${assignerName} assigned you to "${safeTitle}" in ${projectName}.`;

    const notification = await NotificationRepository.create({
        userId: targetUserMongoId,
        type: 'info',
        title,
        message,
        link: linkPath,
        read: false,
        refType: 'clash',
        refId: clashId,
    });

    socketService.notifyUser(targetUserMongoId, 'notification:new', {
        id: String(notification._id),
        type: 'info',
        title,
        message,
        link: linkPath,
        read: false,
        createdAt: notification.createdAt.toISOString(),
    });
}

const isDuplicate = (a, b, tolerance = DEFAULT_DUPLICATE_TOLERANCE) => {
    const values = [
        ...a.boundingBox.min,
        ...a.boundingBox.max,
        ...b.boundingBox.min,
        ...b.boundingBox.max,
    ];
    if (!values.every((value) => Number.isFinite(value))) return false;
    return (
        nearlyEqual(a.boundingBox.min[0], b.boundingBox.min[0], tolerance)
        && nearlyEqual(a.boundingBox.min[1], b.boundingBox.min[1], tolerance)
        && nearlyEqual(a.boundingBox.min[2], b.boundingBox.min[2], tolerance)
        && nearlyEqual(a.boundingBox.max[0], b.boundingBox.max[0], tolerance)
        && nearlyEqual(a.boundingBox.max[1], b.boundingBox.max[1], tolerance)
        && nearlyEqual(a.boundingBox.max[2], b.boundingBox.max[2], tolerance)
    );
};

const aabbToCellRange = (bbox, cellSize) => ({
    minX: Math.floor(bbox.min[0] / cellSize),
    minY: Math.floor(bbox.min[1] / cellSize),
    minZ: Math.floor(bbox.min[2] / cellSize),
    maxX: Math.floor(bbox.max[0] / cellSize),
    maxY: Math.floor(bbox.max[1] / cellSize),
    maxZ: Math.floor(bbox.max[2] / cellSize),
});

const toCellKey = (x, y, z) => `${x}:${y}:${z}`;

const buildSpatialGrid = (objects, threshold = 0) => {
    const size = Math.max(DEFAULT_CELL_SIZE, threshold * 2 || 0);
    const cells = new Map();

    for (const object of objects) {
        const expandedBBox = {
            min: [object.boundingBox.min[0] - threshold, object.boundingBox.min[1] - threshold, object.boundingBox.min[2] - threshold],
            max: [object.boundingBox.max[0] + threshold, object.boundingBox.max[1] + threshold, object.boundingBox.max[2] + threshold],
        };
        const range = aabbToCellRange(expandedBBox, size);
        for (let x = range.minX; x <= range.maxX; x += 1) {
            for (let y = range.minY; y <= range.maxY; y += 1) {
                for (let z = range.minZ; z <= range.maxZ; z += 1) {
                    const key = toCellKey(x, y, z);
                    const bucket = cells.get(key) || [];
                    bucket.push(object);
                    cells.set(key, bucket);
                }
            }
        }
    }

    return { size, cells };
};

const findCandidatePairs = (setA, setB, threshold = 0) => {
    const grid = buildSpatialGrid(setB, threshold);
    const candidates = new Map();

    for (const objectA of setA) {
        const expandedBBox = {
            min: [objectA.boundingBox.min[0] - threshold, objectA.boundingBox.min[1] - threshold, objectA.boundingBox.min[2] - threshold],
            max: [objectA.boundingBox.max[0] + threshold, objectA.boundingBox.max[1] + threshold, objectA.boundingBox.max[2] + threshold],
        };
        const range = aabbToCellRange(expandedBBox, grid.size);

        for (let x = range.minX; x <= range.maxX; x += 1) {
            for (let y = range.minY; y <= range.maxY; y += 1) {
                for (let z = range.minZ; z <= range.maxZ; z += 1) {
                    const bucket = grid.cells.get(toCellKey(x, y, z)) || [];
                    for (const objectB of bucket) {
                        if (objectA.id === objectB.id) continue;
                        const key = [objectA.id, objectB.id].sort().join('__');
                        if (!candidates.has(key)) {
                            candidates.set(key, [objectA, objectB]);
                        }
                    }
                }
            }
        }
    }

    return Array.from(candidates.values());
};

const toPairKey = (objectA, objectB) => [objectA.id, objectB.id].sort().join('__');

const normalizeStatus = (value) => ['new', 'reviewed', 'resolved'].includes(value) ? value : 'new';

const normalizeTest = (payload = {}) => ({
    id: payload.id || createId('clash-test'),
    name: String(payload.name || 'Untitled Clash Test').trim(),
    description: String(payload.description || '').trim(),
    setAId: payload.setAId || null,
    setBId: payload.setBId || null,
    softThreshold: Math.max(0, asNumber(payload.softThreshold, 0)),
    duplicateTolerance: Math.max(0, asNumber(payload.duplicateTolerance, DEFAULT_DUPLICATE_TOLERANCE)),
    enabled: payload.enabled !== false,
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunId: payload.lastRunId || null,
});

const toFrontendResult = (result, test, lookup) => {
    const objectA = lookup.get(result.objectA);
    const objectB = lookup.get(result.objectB);
    return {
        clashId: result.clashId,
        objectA: result.objectA,
        objectB: result.objectB,
        type: result.type,
        status: result.status,
        position: result.position,
        distance: result.distance,
        sourceTestId: result.sourceTestId,
        runId: result.runId,
        objectABBox: objectA?.boundingBox || null,
        objectBBBox: objectB?.boundingBox || null,
        objectAType: objectA?.type || 'IfcBuildingElementProxy',
        objectBType: objectB?.type || 'IfcBuildingElementProxy',
        objectAModel: objectA?.sourceModel || 'Unknown Model',
        objectBModel: objectB?.sourceModel || 'Unknown Model',
        title: `${objectA?.category || objectA?.type || result.objectA} vs ${objectB?.category || objectB?.type || result.objectB}`,
        testName: test?.name || 'Unnamed Test',
        assignee: result.assignee || 'Unassigned',
        note: result.note || '',
        hiddenObjectIds: result.hiddenObjectIds || [],
    };
};

class NavisworksClashService {
    async listAllClashes(projectSlug) {
        const workspace = await readWorkspace(projectSlug);
        const federatedModel = await modelService.getFederatedModel(projectSlug, workspace);
        const objectLookup = new Map(federatedModel.objects.map((o) => [o.id, o]));

        const allResults = [];
        for (const test of workspace.clashTests) {
            if (!test.lastRunId) continue;
            const run = workspace.clashRuns.find((r) => r.id === test.lastRunId);
            if (!run) continue;
            for (const result of run.results) {
                allResults.push({ ...toFrontendResult(result, test, objectLookup), testId: test.id });
            }
        }

        const summary = {
            total: allResults.length,
            hard: allResults.filter((r) => r.type === 'HARD').length,
            soft: allResults.filter((r) => r.type === 'SOFT').length,
            duplicate: allResults.filter((r) => r.type === 'DUPLICATE').length,
            resolved: allResults.filter((r) => r.status === 'resolved').length,
            reviewed: allResults.filter((r) => r.status === 'reviewed').length,
            new: allResults.filter((r) => r.status === 'new').length,
        };

        return { clashes: allResults, summary };
    }

    async getClashCount(projectSlug) {
        const workspace = await readWorkspace(projectSlug);
        const federatedModel = await modelService.getFederatedModel(projectSlug, workspace);
        const objectLookup = new Map(federatedModel.objects.map((o) => [o.id, o]));

        const allResults = [];
        for (const test of workspace.clashTests) {
            if (!test.lastRunId) continue;
            const run = workspace.clashRuns.find((r) => r.id === test.lastRunId);
            if (!run) continue;
            for (const result of run.results) {
                allResults.push({ ...toFrontendResult(result, test, objectLookup), testId: test.id });
            }
        }

        return {
            total: allResults.length,
            hard: allResults.filter((r) => r.type === 'HARD').length,
            soft: allResults.filter((r) => r.type === 'SOFT').length,
            duplicate: allResults.filter((r) => r.type === 'DUPLICATE').length,
            resolved: allResults.filter((r) => r.status === 'resolved').length,
            reviewed: allResults.filter((r) => r.status === 'reviewed').length,
            new: allResults.filter((r) => r.status === 'new').length,
        };
    }

    async listWorkspace(projectSlug) {
        const workspace = await readWorkspace(projectSlug);
        const federatedModel = await modelService.getFederatedModel(projectSlug, workspace);
        const viDefault = defaultWorkspace(projectSlug).viewerIntegration;
        return {
            viewerIntegration: workspace.viewerIntegration
                ? { ...viDefault, ...workspace.viewerIntegration }
                : viDefault,
            federatedModel: {
                ...federatedModel,
                categories: Array.from(new Set(federatedModel.objects.map((object) => object.category))).sort(),
            },
            selectionSets: workspace.selectionSets,
            clashTests: workspace.clashTests.map((test) => {
                const latestRun = workspace.clashRuns.find((run) => run.id === test.lastRunId) || null;
                return {
                    ...test,
                    latestRun,
                };
            }),
        };
    }

    async saveTest(projectSlug, payload) {
        const nextTest = normalizeTest(payload);
        const workspace = await updateWorkspace(projectSlug, (current) => {
            const filtered = current.clashTests.filter((item) => item.id !== nextTest.id);
            return {
                ...current,
                clashTests: [...filtered, nextTest].sort((a, b) => a.name.localeCompare(b.name)),
            };
        });
        return workspace.clashTests.find((item) => item.id === nextTest.id);
    }

    async removeTest(projectSlug, testId) {
        const workspace = await updateWorkspace(projectSlug, (current) => ({
            ...current,
            clashTests: current.clashTests.filter((item) => item.id !== testId),
            clashRuns: current.clashRuns.filter((run) => run.testId !== testId),
        }));
        return workspace.clashTests;
    }

    buildResultFromPair(test, runId, objectA, objectB, previousResult) {
        const pairKey = toPairKey(objectA, objectB);
        const hardVolume = intersectionVolume(objectA, objectB);
        const gapDistance = hardVolume > 0 ? 0 : distanceBetweenAabbs(objectA, objectB);

        let type = null;
        if (isDuplicate(objectA, objectB, test.duplicateTolerance)) {
            type = 'DUPLICATE';
        } else if (hardVolume > 0) {
            type = 'HARD';
        } else if (gapDistance < test.softThreshold) {
            type = 'SOFT';
        }

        if (!type) return null;

        const refined = meshNarrowPhase.refineClashTypeFromMeshes(type, objectA.clashMesh, objectB.clashMesh);
        if (refined.type === null) return null;
        type = refined.type;

        const centerA = centerOfBBox(objectA.boundingBox);
        const centerB = centerOfBBox(objectB.boundingBox);
        const position = [
            (centerA[0] + centerB[0]) / 2,
            (centerA[1] + centerB[1]) / 2,
            (centerA[2] + centerB[2]) / 2,
        ];

        let distance = Number(gapDistance.toFixed(4));
        if (type === 'HARD' && hardVolume <= 0) {
            distance = 0;
        }

        return {
            clashId: `${test.id}:${pairKey}`,
            pairKey,
            sourceTestId: test.id,
            runId,
            objectA: objectA.id,
            objectB: objectB.id,
            type,
            position,
            distance,
            status: normalizeStatus(previousResult?.status),
            note: previousResult?.note || '',
            assignee: previousResult?.assignee || 'Unassigned',
            updatedAt: new Date().toISOString(),
            hiddenObjectIds: previousResult?.hiddenObjectIds || [],
        };
    }

    async runTest(projectSlug, testId, options = {}) {
        const workspace = await readWorkspace(projectSlug);
        const test = workspace.clashTests.find((item) => item.id === testId);
        if (!test) throw new Error(`Clash test not found: ${testId}`);
        if (!test.setAId || !test.setBId) {
            throw new Error('Clash test must define both Set A and Set B');
        }

        const federatedModel = await modelService.getFederatedModel(projectSlug, workspace);
        const objectsById = new Map(federatedModel.objects.filter((object) => !object.hidden).map((object) => [object.id, object]));
        const setAIds = await selectionSetService.resolveObjectIds(projectSlug, test.setAId, federatedModel);
        const setBIds = await selectionSetService.resolveObjectIds(projectSlug, test.setBId, federatedModel);

        const fullSetA = setAIds.map((id) => objectsById.get(id)).filter(Boolean);
        const fullSetB = setBIds.map((id) => objectsById.get(id)).filter(Boolean);

        const affectedIds = Array.isArray(options.affectedObjectIds) && options.affectedObjectIds.length > 0
            ? new Set(options.affectedObjectIds)
            : null;

        const candidateSetA = affectedIds ? fullSetA.filter((object) => affectedIds.has(object.id)) : fullSetA;
        const candidateSetB = affectedIds ? fullSetB.filter((object) => affectedIds.has(object.id)) : fullSetB;

        const candidatePairs = [
            ...findCandidatePairs(candidateSetA, fullSetB, test.softThreshold),
            ...findCandidatePairs(fullSetA, candidateSetB, test.softThreshold),
        ];

        const previousRun = workspace.clashRuns.find((run) => run.id === test.lastRunId);
        const previousResults = new Map((previousRun?.results || []).map((result) => [result.pairKey, result]));

        let nextResults;
        if (affectedIds) {
            const affectedPairKeys = new Set(candidatePairs.map(([objectA, objectB]) => toPairKey(objectA, objectB)));
            nextResults = (previousRun?.results || []).filter((result) => !affectedPairKeys.has(result.pairKey));
        } else {
            nextResults = [];
        }

        const seenPairKeys = new Set(nextResults.map((result) => result.pairKey));
        const runId = createId('clash-run');

        for (const [objectA, objectB] of candidatePairs) {
            const pairKey = toPairKey(objectA, objectB);
            if (seenPairKeys.has(pairKey)) continue;
            const nextResult = this.buildResultFromPair(test, runId, objectA, objectB, previousResults.get(pairKey));
            if (!nextResult) continue;
            nextResults.push(nextResult);
            seenPairKeys.add(pairKey);
        }

        const summary = this.summarizeRunResults(nextResults);

        const runRecord = {
            id: runId,
            testId: test.id,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            scope: affectedIds ? 'incremental' : 'full',
            affectedObjectIds: affectedIds ? Array.from(affectedIds) : [],
            summary,
            results: nextResults.sort((a, b) => a.clashId.localeCompare(b.clashId)),
        };

        const nextWorkspace = await updateWorkspace(projectSlug, (current) => ({
            ...current,
            clashTests: current.clashTests.map((item) =>
                item.id === test.id
                    ? { ...item, lastRunId: runId, updatedAt: new Date().toISOString() }
                    : item
            ),
            clashRuns: [
                current.clashRuns.filter((run) => run.testId !== test.id && run.id !== runId),
                runRecord,
            ].flat(),
        }));

        return this.getRun(projectSlug, test.id, runId);
    }

    async getRun(projectSlug, testId, runId = null) {
        const workspace = await readWorkspace(projectSlug);
        const test = workspace.clashTests.find((item) => item.id === testId);
        if (!test) throw new Error(`Clash test not found: ${testId}`);

        const selectedRunId = runId || test.lastRunId;
        const run = workspace.clashRuns.find((item) => item.id === selectedRunId);
        if (!run) {
            return {
                test,
                run: null,
                results: [],
            };
        }

        const federatedModel = await modelService.getFederatedModel(projectSlug, workspace);
        const objectLookup = new Map(federatedModel.objects.map((object) => [object.id, object]));
        return {
            test,
            run: {
                ...run,
                results: undefined,
            },
            results: run.results.map((result) => toFrontendResult(result, test, objectLookup)),
        };
    }

    summarizeRunResults(results) {
        return {
            total: results.length,
            hard: results.filter((result) => result.type === 'HARD').length,
            soft: results.filter((result) => result.type === 'SOFT').length,
            duplicate: results.filter((result) => result.type === 'DUPLICATE').length,
            resolved: results.filter((result) => result.status === 'resolved').length,
            reviewed: results.filter((result) => result.status === 'reviewed').length,
            new: results.filter((result) => result.status === 'new').length,
        };
    }

    async updateClashStatus(projectSlug, clashId, patch = {}, options = {}) {
        const actorUserId = options.actorUserId ?? null;

        const workspaceSnapshot = await readWorkspace(projectSlug);
        let priorResult = null;
        for (const run of workspaceSnapshot.clashRuns || []) {
            const found = (run.results || []).find((r) => r.clashId === clashId);
            if (found) {
                priorResult = found;
                break;
            }
        }
        if (!priorResult) {
            throw new Error(`Clash result not found: ${clashId}`);
        }

        const prevResolved = normalizeStatus(priorResult.status) === 'resolved';
        const patchRequestsResolved =
            patch.status !== undefined && normalizeStatus(patch.status) === 'resolved';

        const normalizeAssigneeStr = (s) => {
            const t = String(s ?? '').trim();
            return /^unassigned$/i.test(t) ? 'Unassigned' : t;
        };
        const priorNote = typeof priorResult.note === 'string' ? priorResult.note : '';
        const patchHasNote = typeof patch.note === 'string';
        const noteChanged = patchHasNote && patch.note !== priorNote;

        const priorAssigneeNorm = normalizeAssigneeStr(priorResult.assignee);
        const patchHasAssignee = typeof patch.assignee === 'string';
        const patchAssigneeNorm = patchHasAssignee ? normalizeAssigneeStr(patch.assignee) : priorAssigneeNorm;
        const assigneeChanged = patchHasAssignee && patchAssigneeNorm !== priorAssigneeNorm;
        const noteOrAssignChanged = noteChanged || assigneeChanged;

        const actorMember = actorUserId
            ? await ProjectMemberRepository.findMember(projectSlug, actorUserId)
            : null;
        const actorRole = String(actorMember?.role || '').toLowerCase();
        const isNoteAssignPrivileged = ['owner', 'admin', 'manager'].includes(actorRole);

        if (noteOrAssignChanged && !isNoteAssignPrivileged) {
            if (!prevResolved && patchRequestsResolved) {
                const assigneeForResolve =
                    typeof patch.assignee === 'string' ? patch.assignee : priorResult.assignee;
                await assertActorMayMarkClashResolved(projectSlug, actorUserId, assigneeForResolve);
            } else {
                const e = new Error(CLASH_NOTE_ASSIGNEE_FORBIDDEN_MSG);
                e.code = 'CLASH_NOTE_ASSIGNEE_FORBIDDEN';
                throw e;
            }
        } else if (!prevResolved && patchRequestsResolved) {
            const assigneeForResolve =
                typeof patch.assignee === 'string' ? patch.assignee : priorResult.assignee;
            await assertActorMayMarkClashResolved(projectSlug, actorUserId, assigneeForResolve);
        }

        let previousAssignee = 'Unassigned';
        let updatedRun = null;
        await updateWorkspace(projectSlug, (current) => {
            const nextRuns = current.clashRuns.map((run) => {
                const nextResults = run.results.map((result) => {
                    if (result.clashId !== clashId) return result;
                    previousAssignee =
                        result.assignee != null && String(result.assignee).trim() !== ''
                            ? String(result.assignee).trim()
                            : 'Unassigned';
                    const next = {
                        ...result,
                        status: normalizeStatus(patch.status || result.status),
                        note: typeof patch.note === 'string' ? patch.note : result.note,
                        assignee: typeof patch.assignee === 'string' ? patch.assignee : result.assignee,
                        updatedAt: new Date().toISOString(),
                    };
                    return next;
                });

                if (nextResults.some((result) => result.clashId === clashId)) {
                    updatedRun = {
                        ...run,
                        results: nextResults,
                        summary: this.summarizeRunResults(nextResults),
                    };
                    return updatedRun;
                }
                return run;
            });
            return {
                ...current,
                clashRuns: nextRuns,
            };
        });

        if (!updatedRun) {
            throw new Error(`Clash result not found: ${clashId}`);
        }

        const hit = updatedRun.results.find((result) => result.clashId === clashId);
        if (!hit) {
            throw new Error(`Clash result not found after update: ${clashId}`);
        }

        const newAssigneeRaw = hit.assignee != null && String(hit.assignee).trim() !== '' ? String(hit.assignee).trim() : 'Unassigned';
        const normalizeAssignee = (s) => {
            const t = String(s || '').trim();
            return /^unassigned$/i.test(t) ? 'Unassigned' : t;
        };
        const prevN = normalizeAssignee(previousAssignee);
        const newN = normalizeAssignee(newAssigneeRaw);
        const assigneeChangedToMember =
            prevN !== newN && newN !== 'Unassigned' && !/^unassigned$/i.test(newAssigneeRaw);

        if (assigneeChangedToMember) {
            setImmediate(() => {
                void (async () => {
                    try {
                        const targetId = await resolveMemberMongoIdByAssigneeLabel(projectSlug, newAssigneeRaw);
                        if (!targetId) return;
                        if (actorUserId && String(targetId) === String(actorUserId)) return;
                        await notifyClashAssigneeAssigned({
                            projectSlug,
                            sourceTestId: hit.sourceTestId,
                            clashId,
                            clashTitle: hit.title || '',
                            targetUserMongoId: targetId,
                            actorUserId,
                        });
                    } catch (err) {
                        console.warn('[navisworksClash] assignee notification failed:', err?.message || err);
                    }
                })();
            });
        }

        /** Avoid getRun() → getFederatedModel() on every PATCH (very slow on large federated models). Client merges this + invalidates queries. */
        return {
            clashPatch: {
                clashId,
                sourceTestId: hit.sourceTestId,
                note: hit.note || '',
                assignee: hit.assignee || 'Unassigned',
                status: hit.status,
                updatedAt: hit.updatedAt,
            },
            runSummary: updatedRun.summary,
        };
    }

    async applyObjectActions(projectSlug, payload = {}) {
        const affectedObjectIds = Array.isArray(payload.objectIds) ? payload.objectIds : [];
        const objectPositions = Array.isArray(payload.objects) ? payload.objects : [];
        const shouldHide = payload.action === 'hide';
        const shouldShow = payload.action === 'show';

        if (affectedObjectIds.length === 0 && objectPositions.length === 0) {
            throw new Error('No objects were provided for the action');
        }

        const workspace = await readWorkspace(projectSlug);
        const federatedModel = await modelService.getFederatedModel(projectSlug, workspace);
        const objectsById = new Map(federatedModel.objects.map((object) => [object.id, object]));

        const touchedIds = new Set(affectedObjectIds);
        objectPositions.forEach((entry) => touchedIds.add(entry.id));

        await updateWorkspace(projectSlug, (current) => {
            const nextOverrides = { ...current.objectOverrides };

            for (const objectId of touchedIds) {
                const existing = nextOverrides[objectId] || { translation: [0, 0, 0], hidden: false };
                nextOverrides[objectId] = {
                    translation: Array.isArray(existing.translation) ? existing.translation : [0, 0, 0],
                    hidden: Boolean(existing.hidden),
                };
            }

            if (shouldHide || shouldShow) {
                for (const objectId of touchedIds) {
                    nextOverrides[objectId] = {
                        ...nextOverrides[objectId],
                        hidden: shouldHide,
                    };
                }
            }

            for (const entry of objectPositions) {
                const object = objectsById.get(entry.id);
                if (!object) continue;
                const desiredCenter = Array.isArray(entry.position) ? entry.position : null;
                if (!desiredCenter || desiredCenter.length !== 3) continue;
                const currentCenter = centerOfBBox(object.boundingBox);
                const translation = [
                    desiredCenter[0] - currentCenter[0],
                    desiredCenter[1] - currentCenter[1],
                    desiredCenter[2] - currentCenter[2],
                ];
                nextOverrides[entry.id] = {
                    ...nextOverrides[entry.id],
                    translation,
                };
            }

            return {
                ...current,
                objectOverrides: nextOverrides,
            };
        });

        const rerunPayload = [];
        const latestWorkspace = await readWorkspace(projectSlug);
        for (const test of latestWorkspace.clashTests.filter((item) => item.enabled)) {
            const setAIds = new Set(await selectionSetService.resolveObjectIds(projectSlug, test.setAId));
            const setBIds = new Set(await selectionSetService.resolveObjectIds(projectSlug, test.setBId));
            const intersectsTest = Array.from(touchedIds).some((id) => setAIds.has(id) || setBIds.has(id));
            if (!intersectsTest) continue;
            rerunPayload.push(await this.runTest(projectSlug, test.id, { affectedObjectIds: Array.from(touchedIds) }));
        }

        return {
            affectedObjectIds: Array.from(touchedIds),
            reruns: rerunPayload,
        };
    }

    async exportReport(projectSlug, testId, runId, format = 'json') {
        const { test, run, results } = await this.getRun(projectSlug, testId, runId);
        if (!run) {
            throw new Error('No run available to export');
        }

        if (format === 'csv') {
            const header = 'clashId,testName,type,status,objectA,objectB,distance,positionX,positionY,positionZ\n';
            const rows = results.map((result) => [
                result.clashId,
                test.name,
                result.type,
                result.status,
                result.objectA,
                result.objectB,
                result.distance,
                result.position[0],
                result.position[1],
                result.position[2],
            ].join(','));
            return {
                contentType: 'text/csv',
                filename: `${projectSlug}-${test.id}-${run.id}.csv`,
                body: `${header}${rows.join('\n')}`,
            };
        }

        return {
            contentType: 'application/json',
            filename: `${projectSlug}-${test.id}-${run.id}.json`,
            body: JSON.stringify({ test, run, results }, null, 2),
        };
    }

    async exportFederatedSnapshot(projectSlug) {
        const workspace = await readWorkspace(projectSlug);
        const federatedModel = await modelService.getFederatedModel(projectSlug, workspace);
        return {
            contentType: 'application/json',
            filename: `${projectSlug}-federated-model.json`,
            body: JSON.stringify({ federatedModel, selectionSets: workspace.selectionSets, clashTests: workspace.clashTests }, null, 2),
        };
    }

    async exportBCF(projectSlug, testId, runId) {
        const { test, run, results } = await this.getRun(projectSlug, testId, runId);
        if (!run) {
            throw new Error('No run available to export');
        }

        const clashes = results.map((result) => ({
            id: result.clashId,
            objectA: result.objectA,
            objectB: result.objectB,
            position: result.position,
            severity: result.type === 'HARD' ? 'high' : result.type === 'DUPLICATE' ? 'medium' : 'low',
            clashType: result.type === 'HARD' ? 'hard' : 'soft',
            status: result.status,
            resolved: result.status === 'resolved',
            note: result.note,
        }));

        return {
            contentType: 'application/json',
            filename: `${projectSlug}-${test.id}-${run.id}.bcf.json`,
            body: JSON.stringify(buildBCFDocument(clashes, `${projectSlug} - ${test.name}`), null, 2),
        };
    }
}

module.exports = new NavisworksClashService();
