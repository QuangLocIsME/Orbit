const ProjectInvite = require('../models/ProjectInvite');

class ProjectInviteRepository {
    async createInvite(invite) {
        const newInvite = new ProjectInvite(invite);
        return await newInvite.save();
    }

    async findByTokenHash(tokenHash) {
        return await ProjectInvite.findOne({ tokenHash });
    }

    async revokeInvite(inviteId) {
        return await ProjectInvite.findByIdAndUpdate(
            inviteId,
            { status: 'revoked' },
            { returnDocument: 'after' }
        );
    }

    async markAccepted(inviteId) {
        return await ProjectInvite.findByIdAndUpdate(
            inviteId,
            { status: 'accepted', acceptedAt: new Date() },
            { returnDocument: 'after' }
        );
    }

    async listByProject(projectId) {
        return await ProjectInvite.find({ projectId }).select(
            '-_id projectId email role status invitedBy createdAt expiresAt acceptedAt'
        );
    }
}

module.exports = new ProjectInviteRepository();
