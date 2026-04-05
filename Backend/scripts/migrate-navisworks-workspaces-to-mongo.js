/**
 * One-off: import legacy disk workspaces into MongoDB.
 * Usage (from Backend/): node scripts/migrate-navisworks-workspaces-to-mongo.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const NavisworksWorkspace = require('../models/NavisworksWorkspace');
const { LEGACY_PROJECTS_DIR, mergeStoredWorkspace } = require('../services/navisworksStorage.service');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('Missing MONGODB_URI');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    if (!fs.existsSync(LEGACY_PROJECTS_DIR)) {
        console.log('No legacy dir:', LEGACY_PROJECTS_DIR);
        await mongoose.disconnect();
        return;
    }

    const entries = fs.readdirSync(LEGACY_PROJECTS_DIR, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const projectPublicId = entry.name;
        const filePath = path.join(LEGACY_PROJECTS_DIR, projectPublicId, 'workspace.json');
        if (!fs.existsSync(filePath)) continue;

        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const document = mergeStoredWorkspace(projectPublicId, raw);

        await NavisworksWorkspace.findOneAndUpdate(
            { projectPublicId },
            { $set: { projectPublicId, document } },
            { upsert: true }
        );
        count += 1;
        console.log('Upserted workspace for', projectPublicId);
    }

    console.log('Done. Migrated', count, 'workspace(s).');
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
