const ProjectRole = require('../models/ProjectRole');
const ProjectMember = require('../models/ProjectMember');
const Project = require('../models/Project');

class ProjectRoleRepository {
    /**
     * Get all roles for a project with member counts
     * Owner count = 1 (người tạo project dựa trên ownerId)
     * Other roles = đếm từ ProjectMember theo roleKey
     */
    async getRolesByProject(projectId) {
        const roles = await ProjectRole.find({ projectId })
            .select('-_id publicId projectId name description color accessLevel isSystem roleKey permissions createdAt updatedAt')
            .lean();

        // Get project ownerId (now stored as user's publicId)
        const project = await Project.findOne({ publicId: projectId }, { ownerId: 1 }).lean();
        const ownerPublicId = project?.ownerId;
        
        console.log('[RoleController.getRoles] projectId:', projectId, 'ownerPublicId:', ownerPublicId);

        // Get member counts for each role from ProjectMember
        const memberCounts = await ProjectMember.aggregate([
            { $match: { projectId } },
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        const countMap = {};
        memberCounts.forEach(m => {
            countMap[m._id] = m.count;
        });

        // Add memberCount and convert publicId to id
        return roles.map(role => {
            let memberCount = 0;
            
            if (role.roleKey === 'owner') {
                // Project Owner = người tạo project (ownerPublicId = user's publicId)
                memberCount = ownerPublicId ? 1 : 0;
            } else {
                // Other roles = count từ ProjectMember
                memberCount = countMap[role.roleKey] || 0;
            }

            return {
                id: role.publicId,
                projectId: role.projectId,
                name: role.name,
                description: role.description,
                color: role.color,
                accessLevel: role.accessLevel,
                isSystem: role.isSystem,
                roleKey: role.roleKey,
                permissions: role.permissions,
                memberCount,
                createdAt: role.createdAt,
                updatedAt: role.updatedAt,
            };
        });
    }

    /**
     * Create a new role for a project
     */
    async createRole(roleData) {
        const role = new ProjectRole(roleData);
        await role.save();
        return {
            id: role.publicId,
            projectId: role.projectId,
            name: role.name,
            description: role.description,
            color: role.color,
            accessLevel: role.accessLevel,
            isSystem: role.isSystem,
            roleKey: role.roleKey,
            permissions: role.permissions,
            memberCount: 0,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
        };
    }

    /**
     * Update a role
     */
    async updateRole(rolePublicId, updates) {
        const role = await ProjectRole.findOneAndUpdate(
            { publicId: rolePublicId },
            { ...updates, updatedAt: new Date() },
            { returnDocument: 'after' }
        );
        if (!role) return null;
        return {
            id: role.publicId,
            projectId: role.projectId,
            name: role.name,
            description: role.description,
            color: role.color,
            accessLevel: role.accessLevel,
            isSystem: role.isSystem,
            roleKey: role.roleKey,
            permissions: role.permissions,
        };
    }

    /**
     * Delete a role
     */
    async deleteRole(rolePublicId) {
        return await ProjectRole.deleteOne({ publicId: rolePublicId });
    }

    /**
     * Find role by publicId
     */
    async findByPublicId(publicId) {
        return await ProjectRole.findOne({ publicId });
    }

    /**
     * Check if role name exists in project
     */
    async roleNameExists(projectId, name, excludeRoleId = null) {
        const query = { projectId, name };
        if (excludeRoleId) {
            query.publicId = { $ne: excludeRoleId };
        }
        const existing = await ProjectRole.findOne(query);
        return !!existing;
    }
}

module.exports = new ProjectRoleRepository();
