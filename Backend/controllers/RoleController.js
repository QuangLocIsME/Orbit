const ProjectRoleRepository = require('../repositories/ProjectRoleRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const { normalizeString } = require('../utils/sanitize');
const { errorResponse } = require('../utils/response');

const badRequest = (res, msg) => errorResponse(res, 400, msg);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const forbidden = (res) => errorResponse(res, 403, 'Forbidden');
const notFound = (res, msg) => errorResponse(res, 404, msg || 'Not found');
const conflict = (res, msg) => errorResponse(res, 409, msg);
const serverError = (res, msg) => errorResponse(res, 500, msg || 'Internal server error');

const requireUserId = (req, res) => {
    const userId = req.user?.id;
    if (!userId) { unauthorized(res); return null; }
    return userId;
};

// Permission mapping for access levels
const accessLevelPermissions = {
    full: ['All Permissions'],
    high: ['View All', 'Edit All', 'Delete Content', 'Manage Team', 'Approve Changes'],
    medium: ['View All', 'Edit Own', 'Create Content', 'Submit Changes'],
    minimal: ['View All'],
};

// System roles template - roleKey match với ProjectMember.role enum
const systemRoles = [
    {
        name: 'Project Owner',
        accessLevel: 'full',
        isSystem: true,
        roleKey: 'owner',
        description: 'Full control over the project and all settings',
        color: '#8B5CF6',
        permissions: ['All Permissions'],
    },
    {
        name: 'Admin',
        accessLevel: 'high',
        isSystem: true,
        roleKey: 'admin',
        description: 'Can manage project, members, and approve changes',
        color: '#EF4444',
        permissions: ['View All', 'Edit All', 'Delete Content', 'Manage Team', 'Approve Changes'],
    },
    {
        name: 'Manager',
        accessLevel: 'high',
        isSystem: true,
        roleKey: 'manager',
        description: 'Can manage tasks, approve changes, and assign work',
        color: '#F59E0B',
        permissions: ['View All', 'Edit All', 'Approve Changes', 'Assign Tasks', 'Manage Workflow'],
    },
    {
        name: 'Member',
        accessLevel: 'medium',
        isSystem: true,
        roleKey: 'member',
        description: 'Can create and edit content, submit changes',
        color: '#10B981',
        permissions: ['View All', 'Edit Own', 'Create Content', 'Submit Changes'],
    },
    {
        name: 'Viewer',
        accessLevel: 'minimal',
        isSystem: true,
        roleKey: 'viewer',
        description: 'View-only access to project content',
        color: '#6B7280',
        permissions: ['View All'],
    },
];

class RoleController {
    /**
     * Initialize system roles for a project if they don't exist
     */
    async initializeSystemRoles(projectId) {
        const existingRoles = await ProjectRoleRepository.getRolesByProject(projectId);
        const existingSystemRoles = existingRoles.filter(r => r.isSystem);
        
        if (existingSystemRoles.length === 0) {
            for (const role of systemRoles) {
                await ProjectRoleRepository.createRole({
                    projectId,
                    ...role,
                });
            }
        }
    }

    /**
     * GET /api/roles - Get all roles for a project
     */
    async getRoles(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            if (!projectId) return badRequest(res, 'projectId is required');

            // Check if user is a member of the project
            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            // Initialize system roles if project has no roles
            await this.initializeSystemRoles(projectId);

            // Get all roles with member counts
            const roles = await ProjectRoleRepository.getRolesByProject(projectId);
            
            console.log('[RoleController.getRoles] projectId:', projectId, 'roles:', JSON.stringify(roles));

            return res.json({
                success: true,
                data: roles,
            });
        } catch (error) {
            console.error('[RoleController.getRoles]', error);
            return serverError(res, 'Failed to get roles');
        }
    }

    /**
     * POST /api/roles - Create a new role
     */
    async createRole(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            const name = normalizeString(req.body?.name);
            const description = normalizeString(req.body?.description) || '';
            const color = normalizeString(req.body?.color) || '#6366F1';
            const accessLevel = normalizeString(req.body?.accessLevel) || 'medium';
            const permissions = req.body?.permissions || [];

            if (!projectId) return badRequest(res, 'projectId is required');
            if (!name) return badRequest(res, 'Role name is required');

            // Check if user is admin
            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.role !== 'admin') {
                return forbidden(res, 'Only admins can create roles');
            }

            // Check if role name already exists in this project
            const exists = await ProjectRoleRepository.roleNameExists(projectId, name);
            if (exists) {
                return conflict(res, 'A role with this name already exists in this project');
            }

            const role = await ProjectRoleRepository.createRole({
                projectId,
                name,
                description,
                color,
                accessLevel,
                isSystem: false,
                permissions,
            });

            return res.status(201).json({
                success: true,
                message: 'Role created',
                data: role,
            });
        } catch (error) {
            console.error('[RoleController.createRole]', error);
            return serverError(res, 'Failed to create role');
        }
    }

    /**
     * PUT /api/roles/:roleId - Update a role
     */
    async updateRole(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const roleId = normalizeString(req.params?.roleId);
            if (!roleId) return badRequest(res, 'roleId is required');

            const { name, description, color, accessLevel, permissions } = req.body || {};

            if (!name) return badRequest(res, 'Role name is required');

            // Find the role
            const existingRole = await ProjectRoleRepository.findByPublicId(roleId);
            if (!existingRole) return notFound(res, 'Role not found');

            // Only admins can update roles
            const member = await ProjectMemberRepository.findMember(existingRole.projectId, userId);
            if (!member || member.role !== 'admin') {
                return forbidden(res, 'Only admins can update roles');
            }

            // Cannot update system roles
            if (existingRole.isSystem) {
                return conflict(res, 'System roles cannot be modified');
            }

            // Check if new name conflicts with existing role
            if (name !== existingRole.name) {
                const exists = await ProjectRoleRepository.roleNameExists(existingRole.projectId, name, roleId);
                if (exists) {
                    return conflict(res, 'A role with this name already exists in this project');
                }
            }

            const updates = { name, description, color, accessLevel, permissions };
            const updatedRole = await ProjectRoleRepository.updateRole(roleId, updates);

            return res.json({
                success: true,
                message: 'Role updated',
                data: updatedRole,
            });
        } catch (error) {
            console.error('[RoleController.updateRole]', error);
            return serverError(res, 'Failed to update role');
        }
    }

    /**
     * DELETE /api/roles/:roleId - Delete a role
     */
    async deleteRole(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const roleId = normalizeString(req.params?.roleId);
            if (!roleId) return badRequest(res, 'roleId is required');

            // Find the role
            const existingRole = await ProjectRoleRepository.findByPublicId(roleId);
            if (!existingRole) return notFound(res, 'Role not found');

            // Only admins can delete roles
            const member = await ProjectMemberRepository.findMember(existingRole.projectId, userId);
            if (!member || member.role !== 'admin') {
                return forbidden(res, 'Only admins can delete roles');
            }

            // Cannot delete system roles
            if (existingRole.isSystem) {
                return conflict(res, 'System roles cannot be deleted');
            }

            await ProjectRoleRepository.deleteRole(roleId);

            return res.json({
                success: true,
                message: 'Role deleted',
            });
        } catch (error) {
            console.error('[RoleController.deleteRole]', error);
            return serverError(res, 'Failed to delete role');
        }
    }
}

module.exports = new RoleController();
