const TeamMember = require('../models/TeamMember');

class TeamMemberRepository {
    async add({ teamId, projectId, userId, addedBy }) {
        return await TeamMember.create({ teamId, projectId, userId, addedBy });
    }

    async findByTeam(teamId) {
        return await TeamMember.find({ teamId }).lean();
    }

    async findByTeams(teamIds) {
        return await TeamMember.find({ teamId: { $in: teamIds } }).lean();
    }

    async findByProject(projectId) {
        return await TeamMember.find({ projectId }).lean();
    }

    async remove(teamId, userId) {
        return await TeamMember.deleteOne({ teamId, userId });
    }

    async removeByTeam(teamId) {
        return await TeamMember.deleteMany({ teamId });
    }

    async removeByProject(projectId) {
        return await TeamMember.deleteMany({ projectId });
    }

    async isMember(teamId, userId) {
        return !!(await TeamMember.findOne({ teamId, userId }));
    }
}

module.exports = new TeamMemberRepository();
