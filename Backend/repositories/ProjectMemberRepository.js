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
            'projectId role status'
        );
    }

    async getMembersByProject(projectId) {
        return await ProjectMember.find({ projectId }).select(
            '-_id projectId userId role status invitedBy createdAt'
        );
    }
}

module.exports = new ProjectMemberRepository();
