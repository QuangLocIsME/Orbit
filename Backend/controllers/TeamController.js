const TeamRepository = require('../repositories/TeamRepository');
const TeamMemberRepository = require('../repositories/TeamMemberRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const { normalizeString } = require('../utils/sanitize');
const { errorResponse } = require('../utils/response');

const badRequest = (res, msg) => errorResponse(res, 400, msg);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const forbidden = (res) => errorResponse(res, 403, 'Forbidden');
const notFound = (res, msg) => errorResponse(res, 404, msg || 'Not found');
const serverError = (res, msg) => errorResponse(res, 500, msg || 'Internal server error');

const requireUserId = (req, res) => {
    const userId = req.user?.id;
    if (!userId) { unauthorized(res); return null; }
    return userId;
};

const requireAdmin = async (res, projectId, userId) => {
    const member = await ProjectMemberRepository.findMember(projectId, userId);
    if (!member || !['admin', 'owner'].includes(member.role)) {
        forbidden(res);
        return false;
    }
    return true;
};

class TeamController {
    // GET teams + members for a project
    async getTeams(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            if (!projectId) return badRequest(res, 'projectId is required');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            const teams = await TeamRepository.findByProject(projectId);
            const teamIds = teams.map((t) => t.publicId);
            const teamMembers = teamIds.length
                ? await TeamMemberRepository.findByTeams(teamIds)
                : [];

            // Group memberIds by teamId
            const membersByTeam = {};
            for (const tm of teamMembers) {
                if (!membersByTeam[tm.teamId]) membersByTeam[tm.teamId] = [];
                membersByTeam[tm.teamId].push(tm.userId);
            }

            const data = teams.map((t) => ({
                id: t.publicId,
                name: t.name,
                description: t.description,
                color: t.color,
                createdBy: t.createdBy,
                createdAt: t.createdAt,
                memberIds: membersByTeam[t.publicId] || [],
            }));

            return res.json({ success: true, data });
        } catch (err) {
            console.error('[TeamController.getTeams]', err);
            return serverError(res);
        }
    }

    // Create a team
    async createTeam(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            const name = normalizeString(req.body?.name);
            const description = normalizeString(req.body?.description) || '';
            const color = normalizeString(req.body?.color) || 'bg-blue-500';

            if (!projectId) return badRequest(res, 'projectId is required');
            if (!name) return badRequest(res, 'Team name is required');

            if (!(await requireAdmin(res, projectId, userId))) return;

            const team = await TeamRepository.create({ projectId, name, description, color, createdBy: userId });

            return res.status(201).json({
                success: true,
                message: 'Team created',
                data: {
                    id: team.publicId,
                    name: team.name,
                    description: team.description,
                    color: team.color,
                    createdBy: team.createdBy,
                    createdAt: team.createdAt,
                    memberIds: [],
                },
            });
        } catch (err) {
            console.error('[TeamController.createTeam]', err);
            return serverError(res);
        }
    }

    // Delete a team
    async deleteTeam(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const teamId = normalizeString(req.body?.teamId);
            if (!teamId) return badRequest(res, 'teamId is required');

            const team = await TeamRepository.findByPublicId(teamId);
            if (!team) return notFound(res, 'Team not found');

            if (!(await requireAdmin(res, team.projectId, userId))) return;

            await TeamMemberRepository.removeByTeam(teamId);
            await TeamRepository.deleteByPublicId(teamId);

            return res.json({ success: true, message: 'Team deleted' });
        } catch (err) {
            console.error('[TeamController.deleteTeam]', err);
            return serverError(res);
        }
    }

    // Add a project member to a team
    async addMember(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const teamId = normalizeString(req.body?.teamId);
            const targetUserId = normalizeString(req.body?.userId);

            if (!teamId) return badRequest(res, 'teamId is required');
            if (!targetUserId) return badRequest(res, 'userId is required');

            const team = await TeamRepository.findByPublicId(teamId);
            if (!team) return notFound(res, 'Team not found');

            if (!(await requireAdmin(res, team.projectId, userId))) return;

            // Target must be a project member
            const targetMember = await ProjectMemberRepository.findMember(team.projectId, targetUserId);
            if (!targetMember) return badRequest(res, 'User is not a member of this project');

            // Prevent duplicates (isMember checks the unique index)
            const already = await TeamMemberRepository.isMember(teamId, targetUserId);
            if (already) return badRequest(res, 'User is already in this team');

            await TeamMemberRepository.add({ teamId, projectId: team.projectId, userId: targetUserId, addedBy: userId });

            return res.status(201).json({ success: true, message: 'Member added to team' });
        } catch (err) {
            console.error('[TeamController.addMember]', err);
            return serverError(res);
        }
    }

    // Remove a project member from a team
    async removeMember(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const teamId = normalizeString(req.body?.teamId);
            const targetUserId = normalizeString(req.body?.userId);

            if (!teamId) return badRequest(res, 'teamId is required');
            if (!targetUserId) return badRequest(res, 'userId is required');

            const team = await TeamRepository.findByPublicId(teamId);
            if (!team) return notFound(res, 'Team not found');

            if (!(await requireAdmin(res, team.projectId, userId))) return;

            await TeamMemberRepository.remove(teamId, targetUserId);

            return res.json({ success: true, message: 'Member removed from team' });
        } catch (err) {
            console.error('[TeamController.removeMember]', err);
            return serverError(res);
        }
    }
}

module.exports = new TeamController();
