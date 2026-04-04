const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema({
    teamId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    addedBy: { type: String, default: null },
    addedAt: { type: Date, default: Date.now },
});

TeamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TeamMember', TeamMemberSchema);
