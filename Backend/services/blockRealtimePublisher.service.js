const { publishRealtime } = require('./socketService');
const { getProjectBlockSnapshot } = require('./blockSnapshot.service');

async function publishProjectBlockUpdate({ projectId, scope, blockId, userId = '' }) {
    if (!projectId || !scope || !blockId) return;

    const snapshot = await getProjectBlockSnapshot({
        projectId,
        scope,
        blockId,
        userId,
    });

    if (!snapshot) return;

    await publishRealtime({
        target: 'project',
        id: projectId,
        event: 'cache:block:update',
        data: {
            ...snapshot,
            cacheKey: projectId,
        },
    });
}

async function publishScopedProjectBlockUpdate({ projectId, cacheKey, scope, blockId, userId = '', packageId = null }) {
    if (!projectId || !cacheKey || !scope || !blockId) return;

    const snapshot = await getProjectBlockSnapshot({
        projectId,
        scope,
        blockId,
        userId,
        packageId,
    });

    if (!snapshot) return;

    await publishRealtime({
        target: 'project',
        id: projectId,
        event: 'cache:block:update',
        data: {
            ...snapshot,
            cacheKey,
            packageId,
        },
    });
}

async function publishProjectBlockRefresh({ projectId, cacheKey, scope, blockId, packageId = null }) {
    if (!projectId || !scope || !blockId) return;

    await publishRealtime({
        target: 'project',
        id: projectId,
        event: 'cache:block:refresh',
        data: {
            projectId,
            cacheKey: cacheKey || projectId,
            scope,
            blockId,
            packageId,
            updatedAt: Date.now(),
        },
    });
}

module.exports = {
    publishProjectBlockUpdate,
    publishScopedProjectBlockUpdate,
    publishProjectBlockRefresh,
};
