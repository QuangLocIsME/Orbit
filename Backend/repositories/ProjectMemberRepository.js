const ProjectMember = require('../models/ProjectMember');

class ProjectMemberRepository {
    async addMember(member) {
        const newMember = new ProjectMember(member);
        return await newMember.save();
    }

    async findMember(projectId, userId) {
        return await ProjectMember.findOne({ projectId, userId });
    }

    async getProjectsByUser(userId) {
        return await ProjectMember.find({ userId, status: 'accepted' }).select(
            'projectId role status lastVisitedAt isFavorite'
        );
    }

    async updateLastVisited(projectId, userId) {
        return await ProjectMember.findOneAndUpdate(
            { projectId, userId },
            { lastVisitedAt: new Date() },
            { returnDocument: 'after' }
        );
    }

    async getMembersByProject(projectId) {
        return await ProjectMember.find({ projectId }).select(
            '-_id projectId userId role status invitedBy createdAt'
        );
    }

    async updateMemberRole(projectId, userId, role) {
        return await ProjectMember.findOneAndUpdate(
            { projectId, userId },
            { role },
            { returnDocument: 'after' }
        );
    }

    async removeMember(projectId, userId) {
        return await ProjectMember.deleteOne({ projectId, userId });
    }

    async countAdmins(projectId) {
        return await ProjectMember.countDocuments({ projectId, role: 'admin' });
    }

    async removeMembersByProject(projectId) {
        return await ProjectMember.deleteMany({ projectId });
    }

    async getMemberWithUser(projectId, userId) {
        return await ProjectMember.findOne({ projectId, userId });
    }

    async getMembersWithUsers(projectId) {
        return await ProjectMember.find({ projectId }).select(
            '-_id projectId userId role status invitedBy createdAt isFavorite'
        ).lean();
    }

    async toggleFavorite(projectId, userId) {
        const member = await ProjectMember.findOne({ projectId, userId });
        if (!member) return null;
        member.isFavorite = !member.isFavorite;
        await member.save();
        return member;
    }

    async getFavoriteProjects(userId) {
        return await ProjectMember.find({ userId, isFavorite: true }).select(
            'projectId role status lastVisitedAt isFavorite'
        );
    }
}

module.exports = new ProjectMemberRepository();
