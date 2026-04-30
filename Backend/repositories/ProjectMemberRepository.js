const ProjectMember = require('../models/ProjectMember');

class ProjectMemberRepository {
    async addMember(member) {
        const newMember = new ProjectMember(member);
        return await newMember.save();
    }

    async findMember(projectId, userId) {
        // Try both userId formats (ObjectId or publicId)
        const query = { projectId };
        if (/^[a-f\d]{24}$/i.test(userId)) {
            const { Types } = require('mongoose');
            query.userId = new Types.ObjectId(userId);
        } else {
            query.userId = userId;
        }
        return await ProjectMember.findOne(query);
    }

    async getProjectsByUser(userId) {
        const { Types } = require('mongoose');
        let query = {};
        if (/^[a-f\d]{24}$/i.test(userId)) {
            query = { userId: new Types.ObjectId(userId), status: 'accepted' };
        } else {
            query = { userId, status: 'accepted' };
        }
        return await ProjectMember.find(query).select(
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
        const { Types } = require('mongoose');
        let query = { projectId };
        if (/^[a-f\d]{24}$/i.test(userId)) {
            query.userId = new Types.ObjectId(userId);
        } else {
            query.userId = userId;
        }
        return await ProjectMember.findOneAndUpdate(
            query,
            { role },
            { returnDocument: 'after' }
        );
    }

    async removeMember(projectId, userId) {
        const { Types } = require('mongoose');
        let query = { projectId };
        if (/^[a-f\d]{24}$/i.test(userId)) {
            query.userId = new Types.ObjectId(userId);
        } else {
            query.userId = userId;
        }
        return await ProjectMember.deleteOne(query);
    }

    async countAdmins(projectId) {
        return await ProjectMember.countDocuments({ projectId, role: 'admin' });
    }

    async countAcceptedMembers(projectId) {
        return await ProjectMember.countDocuments({ projectId, status: 'accepted' });
    }

    async removeMembersByProject(projectId) {
        return await ProjectMember.deleteMany({ projectId });
    }

    async getMembersWithUsers(projectId) {
        return await ProjectMember.find({ projectId }).select(
            '-_id projectId userId role status invitedBy createdAt isFavorite'
        ).lean();
    }

    async getMemberWithUser(projectId, userId) {
        const { Types } = require('mongoose');
        let query = { projectId };
        if (/^[a-f\d]{24}$/i.test(userId)) {
            query.userId = new Types.ObjectId(userId);
        } else {
            query.userId = userId;
        }
        return await ProjectMember.findOne(query);
    }

    async toggleFavorite(projectId, userId) {
        const member = await this.findMember(projectId, userId);
        if (!member) return null;
        member.isFavorite = !member.isFavorite;
        await member.save();
        return member;
    }

    async getFavoriteProjects(userId) {
        const { Types } = require('mongoose');
        let query = {};
        if (/^[a-f\d]{24}$/i.test(userId)) {
            query = { userId: new Types.ObjectId(userId), isFavorite: true };
        } else {
            query = { userId, isFavorite: true };
        }
        return await ProjectMember.find(query).select(
            'projectId role status lastVisitedAt isFavorite'
        );
    }

    async findMembersByRole(projectId, roles) {
        return await ProjectMember.find({
            projectId,
            role: { $in: roles },
            status: 'accepted',
        }).select('userId role');
    }
}

module.exports = new ProjectMemberRepository();
