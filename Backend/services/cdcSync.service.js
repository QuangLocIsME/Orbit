const mongoose = require('mongoose');
const { publishRealtime } = require('./socketService');
const { enqueueCdcJob } = require('./cdcQueue.service');

const WATCHED_MODELS = {
    Project: { scope: 'overview', blockId: 'summary', target: 'project' },
    ProjectInvite: { scope: 'teams', blockId: 'roster', target: 'project' },
    ProjectMember: { scope: 'teams', blockId: 'roster', target: 'project' },
    ProjectRole: { scope: 'teams', blockId: 'roster', target: 'project' },
    Team: { scope: 'teams', blockId: 'roster', target: 'project' },
    TeamMember: { scope: 'teams', blockId: 'roster', target: 'project' },
    Activity: { scope: 'activity', blockId: 'feed', target: 'project' },
    Package: { scope: 'packages', blockId: 'summary', target: 'project' },
    UploadApproval: { scope: 'versions', blockId: 'summary', target: 'project' },
};

let started = false;
const streams = [];

function inferProjectId(modelName, change) {
    if (modelName === 'Project') {
        return (
            change?.fullDocument?.publicId ||
            change?.documentKey?.publicId ||
            change?.updateDescription?.updatedFields?.publicId ||
            null
        );
    }

    return (
        change?.fullDocument?.projectId ||
        change?.documentKey?.projectId ||
        change?.updateDescription?.updatedFields?.projectId ||
        null
    );
}

function inferUserId(change) {
    return (
        change?.fullDocument?.userId ||
        change?.documentKey?.userId ||
        change?.updateDescription?.updatedFields?.userId ||
        null
    );
}

async function publishBlockUpdate(job) {
    if (!job.projectId || !job.scope || !job.blockId) return;

    await publishRealtime({
        target: job.target === 'user' ? 'user' : 'project',
        id: job.target === 'user' ? job.userId : job.projectId,
        event: 'cache:block:refresh',
        data: {
            projectId: job.projectId,
            cacheKey: job.cacheKey || job.projectId,
            scope: job.scope,
            blockId: job.blockId,
            packageId: job.packageId || null,
            updatedAt: Date.now(),
        },
    });
}

async function publishUserCacheInvalidate(job) {
    if (!job.userId) return;

    await publishRealtime({
        target: 'user',
        id: job.userId,
        event: 'cache:invalidate',
        data: {
            type: 'cache:invalidate',
            data: {
                cacheTypes: job.cacheTypes || ['projects', 'folders'],
                userId: job.userId,
            },
        },
    });
}

function handleUserListChange(modelName, change) {
    if (modelName !== 'ProjectMember') return;

    const userId = inferUserId(change);
    if (!userId) return;

    enqueueCdcJob(
        {
            target: 'user',
            userId,
            cacheTypes: ['projects', 'folders'],
        },
        publishUserCacheInvalidate,
        { debounceMs: 150 }
    );
}

function handleChange(modelName, change) {
    const config = WATCHED_MODELS[modelName];
    if (!config) return;

    handleUserListChange(modelName, change);

    const projectId = inferProjectId(modelName, change);
    if (!projectId) return;

    enqueueCdcJob(
        {
            target: config.target,
            projectId,
            scope: config.scope,
            blockId: config.blockId,
        },
        publishBlockUpdate,
        { debounceMs: 150 }
    );
}

function startModelWatcher(modelName) {
    const model = mongoose.models[modelName];
    if (!model || typeof model.watch !== 'function') return;

    const stream = model.watch([], { fullDocument: 'updateLookup' });
    stream.on('change', (change) => handleChange(modelName, change));
    stream.on('error', (error) => {
        console.error(`[CDC] ${modelName} stream error:`, error?.message || error);
    });
    streams.push(stream);
    console.log(`[CDC] watching ${modelName}`);
}

function startCdcSyncService() {
    if (started) return;
    started = true;

    for (const modelName of Object.keys(WATCHED_MODELS)) {
        startModelWatcher(modelName);
    }

    console.log('[CDC] selective Mongo change streams started');
}

module.exports = {
    startCdcSyncService,
};
