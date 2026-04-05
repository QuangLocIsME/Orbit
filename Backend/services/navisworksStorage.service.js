const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const NavisworksWorkspace = require('../models/NavisworksWorkspace');

/** Legacy disk path — migration script + read fallback when Mongo trống. */
const LEGACY_PROJECTS_DIR = path.resolve(__dirname, '..', 'data', 'navisworks', 'projects');
const SYNC_DISK = process.env.ORBIT_NAVISWORKS_SYNC_DISK === '1';

function readWorkspaceFromDisk(projectKey) {
    try {
        const fp = path.join(LEGACY_PROJECTS_DIR, projectKey, 'workspace.json');
        if (!fs.existsSync(fp)) return null;
        const raw = fs.readFileSync(fp, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function writeWorkspaceToDisk(projectKey, workspaceObj) {
    if (!SYNC_DISK) return;
    try {
        const dir = path.join(LEGACY_PROJECTS_DIR, projectKey);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify(workspaceObj, null, 2), 'utf8');
    } catch {
        /* ignore */
    }
}

function workspaceLooksEmpty(w) {
    if (!w || typeof w !== 'object') return true;
    const objs = w.federatedModel?.objects;
    const models = w.federatedModel?.models;
    const tests = w.clashTests;
    const sets = w.selectionSets;
    return (
        (!Array.isArray(objs) || objs.length === 0) &&
        (!Array.isArray(models) || models.length === 0) &&
        (!Array.isArray(tests) || tests.length === 0) &&
        (!Array.isArray(sets) || sets.length === 0)
    );
}

const defaultWorkspace = (projectSlug) => ({
    version: 1,
    projectSlug,
    viewerIntegration: {
        provider: 'none',
        sceneId: null,
        baseUrl: null,
    },
    federatedModel: {
        coordinateSystem: 'project-global',
        unit: 'm',
        models: [],
        objects: [],
    },
    selectionSets: [],
    clashTests: [],
    clashRuns: [],
    objectOverrides: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});

const mergeStoredWorkspace = (projectSlug, parsed) => {
    const base = defaultWorkspace(projectSlug);
    if (!parsed || typeof parsed !== 'object') return base;

    const viewerIntegration =
        parsed.viewerIntegration && typeof parsed.viewerIntegration === 'object'
            ? { ...base.viewerIntegration, ...parsed.viewerIntegration }
            : base.viewerIntegration;

    return {
        ...base,
        ...parsed,
        projectSlug,
        viewerIntegration,
        federatedModel: {
            ...base.federatedModel,
            ...(parsed.federatedModel || {}),
            models: Array.isArray(parsed?.federatedModel?.models) ? parsed.federatedModel.models : [],
            objects: Array.isArray(parsed?.federatedModel?.objects) ? parsed.federatedModel.objects : [],
        },
        selectionSets: Array.isArray(parsed.selectionSets) ? parsed.selectionSets : [],
        clashTests: Array.isArray(parsed.clashTests) ? parsed.clashTests : [],
        clashRuns: Array.isArray(parsed.clashRuns) ? parsed.clashRuns : [],
        objectOverrides:
            parsed.objectOverrides && typeof parsed.objectOverrides === 'object'
                ? parsed.objectOverrides
                : {},
    };
};

const readWorkspace = async (projectSlug) => {
    const key = projectSlug || 'default-project';
    const doc = await NavisworksWorkspace.findOne({ projectPublicId: key }).lean();
    const fromMongo = doc?.document ? mergeStoredWorkspace(key, doc.document) : null;
    if (fromMongo && !workspaceLooksEmpty(fromMongo)) {
        return fromMongo;
    }
    const fromDisk = readWorkspaceFromDisk(key);
    if (fromDisk) {
        return mergeStoredWorkspace(key, fromDisk);
    }
    return fromMongo || defaultWorkspace(key);
};

const writeWorkspace = async (projectSlug, workspace) => {
    const key = projectSlug || 'default-project';
    const nextWorkspace = {
        ...workspace,
        projectSlug: key,
        updatedAt: new Date().toISOString(),
    };
    await NavisworksWorkspace.findOneAndUpdate(
        { projectPublicId: key },
        { $set: { projectPublicId: key, document: nextWorkspace } },
        { upsert: true, new: true }
    );
    writeWorkspaceToDisk(key, nextWorkspace);
    return nextWorkspace;
};

const updateWorkspace = async (projectSlug, updater) => {
    const current = await readWorkspace(projectSlug);
    const next = updater(current) || current;
    return writeWorkspace(projectSlug, next);
};

const createId = (prefix) => `${prefix}-${uuidv4()}`;

module.exports = {
    LEGACY_PROJECTS_DIR,
    createId,
    defaultWorkspace,
    mergeStoredWorkspace,
    readWorkspace,
    writeWorkspace,
    updateWorkspace,
};
