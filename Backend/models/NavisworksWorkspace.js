const mongoose = require('mongoose');

/**
 * One document per project (key: project.publicId).
 * `document` holds the full Navisworks workspace JSON (Mixed).
 * Large federated models may approach MongoDB's 16MB BSON limit — split objects if needed later.
 */
const NavisworksWorkspaceSchema = new mongoose.Schema(
    {
        projectPublicId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        document: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('NavisworksWorkspace', NavisworksWorkspaceSchema);
