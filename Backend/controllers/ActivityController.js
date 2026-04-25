const ChangeRequest = require('../models/ChangeRequest');
const Document = require('../models/Document');
const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const User = require('../models/User');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');
const { errorResponse } = require('../utils/response');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const buildScopeFilter = (projectId, packageId = null) => {
    if (packageId) {
        return { projectId, packageId };
    }

    return {
        projectId,
        $or: [
            { packageId: null },
            { packageId: '' },
            { packageId: { $exists: false } },
        ],
    };
};

const loadUserMap = async (ids) => {
    const mongoose = require('mongoose');
    const validIds = [...new Set((ids || []).filter(Boolean))]
        .filter((id) => {
            try {
                return mongoose.Types.ObjectId.isValid(id);
            } catch {
                return false;
            }
        });

    if (validIds.length === 0) return {};

    const users = await User.find({ _id: { $in: validIds } }, { _id: 1, fullName: 1 }).lean();
    return Object.fromEntries(users.map((u) => [u._id.toString(), u.fullName]));
};

class ActivityController {
    async listByProject(req, res) {
        return this.listByScope(req, res, { packageId: null });
    }

    async listByPackage(req, res) {
        const packageId = req.params?.packageId;
        return this.listByScope(req, res, { packageId });
    }

    async listByScope(req, res, { packageId = null } = {}) {
        try {
            const projectId = req.params?.projectSlug;
            if (!projectId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return errorResponse(res, 403, 'Forbidden');

            if (packageId) {
                const pkg = await PackageRepository.findByPublicIdInProject(packageId, projectId);
                const canViewPackage = member.role === 'admin'
                    || pkg?.creatorId === userId
                    || (pkg?.teamMemberIds || []).includes(userId);

                if (!pkg || pkg.status === 'Archived' || !canViewPackage) {
                    return errorResponse(res, 404, 'Package not found');
                }
            }

            const LIMIT = 8;
            const since = new Date(Date.now() - THIRTY_DAYS_MS);
            const taskScope = buildScopeFilter(projectId, packageId);

            const queries = [
                Document.find({ ...buildScopeFilter(projectId, packageId), createdAt: { $gte: since } })
                    .sort({ createdAt: -1 })
                    .limit(LIMIT)
                    .lean(),
                Task.find({ ...taskScope, createdAt: { $gte: since } })
                    .sort({ createdAt: -1 })
                    .limit(LIMIT)
                    .lean(),
                TaskComment.find({ ...taskScope, createdAt: { $gte: since } })
                    .sort({ createdAt: -1 })
                    .limit(LIMIT)
                    .lean(),
            ];

            if (!packageId) {
                queries.push(
                    ChangeRequest.find({ projectId, createdAt: { $gte: since } })
                        .sort({ createdAt: -1 })
                        .limit(LIMIT)
                        .lean()
                );
            }

            const [documents, tasks, taskComments, changeRequests = []] = await Promise.all(queries);

            const userMap = await loadUserMap([
                ...documents.map((d) => d.uploadedBy),
                ...tasks.map((t) => t.createdBy),
                ...taskComments.map((c) => c.authorId),
                ...changeRequests.map((cr) => cr.createdBy),
            ]);

            const activities = [
                ...changeRequests.map((cr) => ({
                    id: `cr-${cr.publicId}`,
                    type: 'change_request',
                    icon: 'edit',
                    color: 'bg-purple-100 text-purple-600',
                    action: `Change request "${cr.title}" submitted`,
                    user: userMap[cr.createdBy] || 'Unknown',
                    createdAt: cr.createdAt,
                })),
                ...documents.map((doc) => ({
                    id: `doc-${doc.publicId}`,
                    type: 'document',
                    icon: 'upload',
                    color: 'bg-blue-100 text-blue-600',
                    action: `"${doc.originalName}" uploaded`,
                    user: userMap[doc.uploadedBy] || 'Unknown',
                    createdAt: doc.createdAt,
                })),
                ...tasks.map((task) => ({
                    id: `task-${task.publicId}`,
                    type: 'task',
                    icon: 'check',
                    color: 'bg-emerald-100 text-emerald-600',
                    action: `Task "${task.title}" created`,
                    user: userMap[task.createdBy] || 'Unknown',
                    createdAt: task.createdAt,
                })),
                ...taskComments.map((comment) => ({
                    id: `task-comment-${comment.publicId}`,
                    type: 'task_comment',
                    icon: 'edit',
                    color: 'bg-amber-100 text-amber-600',
                    action: 'Comment added to a task',
                    user: userMap[comment.authorId] || 'Unknown',
                    createdAt: comment.createdAt,
                })),
            ];

            activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const topActivities = activities.slice(0, LIMIT);

            if (!packageId) {
                const Project = require('../models/Project');
                const project = await Project.findOne({ publicId: projectId }, { updatedAt: 1 }).lean();
                const projectUpdateTime = project?.updatedAt ? new Date(project.updatedAt).getTime() : 0;
                const latestActivityTime = topActivities[0]?.createdAt ? new Date(topActivities[0].createdAt).getTime() : 0;

                if (projectUpdateTime > latestActivityTime) {
                    topActivities.unshift({
                        id: 'project-update',
                        type: 'project_update',
                        icon: 'settings',
                        color: 'bg-green-100 text-green-600',
                        action: 'Project settings updated',
                        user: userMap[userId] || 'System',
                        createdAt: project.updatedAt,
                    });
                }
            }

            return res.status(200).json({
                success: true,
                data: topActivities.slice(0, LIMIT),
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to fetch activities');
        }
    }
}

module.exports = new ActivityController();
