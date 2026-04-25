const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const User = require('../models/User');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const socketService = require('../services/socketService');
const { normalizeString } = require('../utils/sanitize');
const { errorResponse } = require('../utils/response');

const badRequest = (res, message) => errorResponse(res, 400, message);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const forbidden = (res) => errorResponse(res, 403, 'Forbidden');
const notFound = (res, message) => errorResponse(res, 404, message);
const serverError = (res, message) => errorResponse(res, 500, message);

const requireUserId = (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        unauthorized(res);
        return null;
    }
    return userId;
};

const normalizeStatus = (value) => {
    const normalized = normalizeString(value).toLowerCase().replace(/\s+/g, '-');
    return normalized || 'backlog';
};

const normalizePriority = (value) => {
    const normalized = normalizeString(value).toLowerCase();
    return ['low', 'medium', 'high', 'urgent'].includes(normalized) ? normalized : 'medium';
};

const normalizePackageId = (value) => {
    const normalized = normalizeString(value);
    return normalized || null;
};

/** Project roles that may create tasks and change task status (not viewers). */
const canMutateProjectTasks = (member) => {
    if (!member || member.status !== 'accepted') return false;
    return ['owner', 'admin', 'manager', 'member'].includes(member.role);
};

const canChangeTaskStatus = ({ member, userId, task }) => {
    if (!member || member.status !== 'accepted' || !task) return false;
    if (['owner', 'admin', 'manager'].includes(member.role)) return true;
    if (member.role !== 'member') return false;
    return Boolean(task.assigneeId) && String(task.assigneeId) === String(userId);
};

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

const getTaskLink = (projectId, packageId, taskId) => {
    if (packageId) {
        return `/${projectId}/${packageId}?tab=tasks&taskId=${taskId}`;
    }

    return `/projects/${projectId}/tasks/${taskId}`;
};

const validatePackageAccess = async ({ projectId, packageId, userId, member, requireManageAccess = false }) => {
    if (!packageId) return { ok: true, pkg: null };

    const pkg = await PackageRepository.findByPublicIdInProject(packageId, projectId);
    if (!pkg || pkg.status === 'Archived') {
        return { ok: false, status: 404, message: 'Package not found' };
    }

    const canViewPackage = member?.role === 'admin'
        || pkg.creatorId === userId
        || (pkg.teamMemberIds || []).includes(userId);

    if (!canViewPackage) {
        return { ok: false, status: 403, message: 'Forbidden' };
    }

    if (requireManageAccess && member?.role === 'viewer') {
        return { ok: false, status: 403, message: 'Forbidden' };
    }

    return { ok: true, pkg };
};

class TaskController {
    async createTask(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            const packageId = normalizePackageId(req.body?.packageId);
            const title = normalizeString(req.body?.title);
            if (!projectId || !title) return badRequest(res, 'Missing projectId or title');

            const actor = await ProjectMemberRepository.findMember(projectId, userId);
            if (!canMutateProjectTasks(actor)) return forbidden(res);

            const packageAccess = await validatePackageAccess({
                projectId,
                packageId,
                userId,
                member: actor,
                requireManageAccess: true,
            });
            if (!packageAccess.ok) {
                if (packageAccess.status === 404) return notFound(res, packageAccess.message);
                return forbidden(res);
            }

            const assigneeId = normalizeString(req.body?.assigneeId);
            if (assigneeId) {
                const assigneeMember = await ProjectMemberRepository.findMember(projectId, assigneeId);
                if (!assigneeMember) return badRequest(res, 'Assignee is not a project member');
            }

            const task = await Task.create({
                projectId,
                packageId,
                title,
                description: normalizeString(req.body?.description),
                status: normalizeStatus(req.body?.status),
                priority: normalizePriority(req.body?.priority),
                assigneeId: assigneeId || '',
                dueDate: req.body?.dueDate ? new Date(req.body.dueDate) : null,
                linkedUrl: normalizeString(req.body?.linkedUrl),
                tags: Array.isArray(req.body?.tags) ? req.body.tags.map((t) => normalizeString(t)).filter(Boolean) : [],
                createdBy: userId,
                updatedAt: new Date(),
            });

            if (packageId) {
                await PackageRepository.addTaskIdToPackage(packageId, projectId, task.publicId);
            }

            if (assigneeId) {
                const taskLink = getTaskLink(projectId, packageId, task.publicId);

                // Always save to DB first (so it's available when user comes online)
                const notification = await NotificationRepository.create({
                    userId: assigneeId,
                    type: 'info',
                    title: 'New task assigned',
                    message: title,
                    link: taskLink,
                    read: false,
                    refType: 'task',
                    refId: task.publicId,
                });

                // Also push via WebSocket for online users — use the same _id as the DB record
                socketService.notifyUser(assigneeId, 'notification:new', {
                    id: String(notification._id),
                    type: 'info',
                    title: 'New task assigned',
                    message: title,
                    link: taskLink,
                    read: false,
                    createdAt: notification.createdAt.toISOString(),
                });
            }

            return res.status(201).json({ success: true, data: task });
        } catch {
            return serverError(res, 'Create task failed');
        }
    }

    async listTasks(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId || req.query?.projectId);
            const packageId = normalizePackageId(req.body?.packageId || req.query?.packageId);
            if (!projectId) return badRequest(res, 'Missing projectId');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            const packageAccess = await validatePackageAccess({
                projectId,
                packageId,
                userId,
                member,
            });
            if (!packageAccess.ok) {
                if (packageAccess.status === 404) return notFound(res, packageAccess.message);
                return forbidden(res);
            }

            const tasks = await Task.find(buildScopeFilter(projectId, packageId)).sort({ createdAt: -1 }).lean();
            return res.status(200).json({ success: true, data: tasks });
        } catch {
            return serverError(res, 'Load tasks failed');
        }
    }

    async detailTask(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            const taskId = normalizeString(req.body?.taskId);
            const packageId = normalizePackageId(req.body?.packageId);
            if (!projectId || !taskId) return badRequest(res, 'Missing projectId or taskId');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            const packageAccess = await validatePackageAccess({
                projectId,
                packageId,
                userId,
                member,
            });
            if (!packageAccess.ok) {
                if (packageAccess.status === 404) return notFound(res, packageAccess.message);
                return forbidden(res);
            }

            const task = await Task.findOne({ publicId: taskId, ...buildScopeFilter(projectId, packageId) }).lean();
            if (!task) return notFound(res, 'Task not found');

            let assignee = null;
            if (task.assigneeId) {
                assignee = await User.findById(task.assigneeId).select('_id fullName email').lean();
            }

            return res.status(200).json({
                success: true,
                data: {
                    ...task,
                    assigneeName: assignee?.fullName || assignee?.email || '',
                },
            });
        } catch {
            return serverError(res, 'Load task detail failed');
        }
    }

    async changeStatus(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            const taskId = normalizeString(req.body?.taskId);
            const status = normalizeStatus(req.body?.status);
            const packageId = normalizePackageId(req.body?.packageId);
            if (!projectId || !taskId || !status) return badRequest(res, 'Missing projectId, taskId or status');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!canMutateProjectTasks(member)) return forbidden(res);

            const packageAccess = await validatePackageAccess({
                projectId,
                packageId,
                userId,
                member,
                requireManageAccess: true,
            });
            if (!packageAccess.ok) {
                if (packageAccess.status === 404) return notFound(res, packageAccess.message);
                return forbidden(res);
            }

            const currentTask = await Task.findOne({ publicId: taskId, ...buildScopeFilter(projectId, packageId) }).lean();
            if (!currentTask) return notFound(res, 'Task not found');
            if (!canChangeTaskStatus({ member, userId, task: currentTask })) {
                return forbidden(res, 'Only owner/admin/manager or the assigned member can update task status');
            }

            const updated = await Task.findOneAndUpdate(
                { _id: currentTask._id },
                { status, updatedAt: new Date() },
                { returnDocument: 'after' }
            ).lean();
            if (!updated) return notFound(res, 'Task not found');

            socketService.broadcastProject(projectId, 'task:status-changed', {
                projectId,
                packageId,
                taskId,
                status,
            });

            return res.status(200).json({ success: true, data: updated });
        } catch {
            return serverError(res, 'Update task status failed');
        }
    }

    async listComments(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            const taskId = normalizeString(req.body?.taskId);
            const packageId = normalizePackageId(req.body?.packageId);
            if (!projectId || !taskId) return badRequest(res, 'Missing projectId or taskId');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            const packageAccess = await validatePackageAccess({
                projectId,
                packageId,
                userId,
                member,
            });
            if (!packageAccess.ok) {
                if (packageAccess.status === 404) return notFound(res, packageAccess.message);
                return forbidden(res);
            }

            const comments = await TaskComment.find({ taskId, ...buildScopeFilter(projectId, packageId) }).sort({ createdAt: -1 }).lean();

            const authorIds = [...new Set(comments.map((c) => c.authorId).filter(Boolean))];
            const users = authorIds.length
                ? await User.find({ _id: { $in: authorIds } }).select('_id fullName email').lean()
                : [];
            const map = new Map(users.map((u) => [String(u._id), u]));

            const data = comments.map((c) => ({
                ...c,
                authorName: map.get(String(c.authorId))?.fullName || map.get(String(c.authorId))?.email || 'Unknown',
            }));

            return res.status(200).json({ success: true, data });
        } catch {
            return serverError(res, 'Load comments failed');
        }
    }

    async createComment(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            const taskId = normalizeString(req.body?.taskId);
            const content = normalizeString(req.body?.content);
            const packageId = normalizePackageId(req.body?.packageId);
            if (!projectId || !taskId || !content) return badRequest(res, 'Missing projectId, taskId or content');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            const packageAccess = await validatePackageAccess({
                projectId,
                packageId,
                userId,
                member,
            });
            if (!packageAccess.ok) {
                if (packageAccess.status === 404) return notFound(res, packageAccess.message);
                return forbidden(res);
            }

            const task = await Task.findOne({ publicId: taskId, ...buildScopeFilter(projectId, packageId) });
            if (!task) return notFound(res, 'Task not found');

            const comment = await TaskComment.create({
                taskId,
                projectId,
                packageId: task.packageId || null,
                authorId: userId,
                content,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await Task.updateOne(
                { publicId: taskId, ...buildScopeFilter(projectId, task.packageId || null) },
                { $inc: { commentsCount: 1 }, $set: { updatedAt: new Date() } }
            );

            socketService.broadcastProject(projectId, 'task:commented', {
                projectId,
                packageId: task.packageId || null,
                taskId,
                commentId: comment.publicId,
            });

            const author = await User.findById(userId).select('_id fullName email').lean();

            return res.status(201).json({
                success: true,
                data: {
                    ...comment.toObject(),
                    authorName: author?.fullName || author?.email || 'You',
                },
            });
        } catch {
            return serverError(res, 'Create comment failed');
        }
    }

    async updateComment(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const commentId = normalizeString(req.body?.commentId);
            const content = normalizeString(req.body?.content);
            if (!commentId || !content) return badRequest(res, 'Missing commentId or content');

            const comment = await TaskComment.findOne({ publicId: commentId });
            if (!comment) return notFound(res, 'Comment not found');

            const member = await ProjectMemberRepository.findMember(comment.projectId, userId);
            if (!member) return forbidden(res);

            // Only author can edit their own comment
            if (comment.authorId !== userId) return forbidden(res);

            comment.content = content;
            comment.isEdited = true;
            comment.updatedAt = new Date();
            await comment.save();

            const author = await User.findById(userId).select('_id fullName email').lean();

            return res.status(200).json({
                success: true,
                data: {
                    ...comment.toObject(),
                    authorName: author?.fullName || author?.email || 'You',
                },
            });
        } catch {
            return serverError(res, 'Update comment failed');
        }
    }

    async deleteComment(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const commentId = normalizeString(req.body?.commentId);
            if (!commentId) return badRequest(res, 'Missing commentId');

            const comment = await TaskComment.findOne({ publicId: commentId });
            if (!comment) return notFound(res, 'Comment not found');

            const member = await ProjectMemberRepository.findMember(comment.projectId, userId);
            if (!member) return forbidden(res);
            const isAuthor = comment.authorId === userId;

            // Only author can delete their own comment
            if (!isAuthor) return forbidden(res);

            await TaskComment.deleteOne({ publicId: commentId });

            await Task.updateOne(
                { publicId: comment.taskId, ...buildScopeFilter(comment.projectId, comment.packageId || null) },
                { $inc: { commentsCount: -1 }, $set: { updatedAt: new Date() } }
            );

            return res.status(200).json({
                success: true,
                message: 'Comment deleted',
            });
        } catch {
            return serverError(res, 'Delete comment failed');
        }
    }

    async updateTask(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const taskId = normalizeString(req.body?.taskId);
            if (!taskId) return badRequest(res, 'Missing taskId');

            const task = await Task.findOne({ publicId: taskId });
            if (!task) return notFound(res, 'Task not found');

            const member = await ProjectMemberRepository.findMember(task.projectId, userId);
            if (!member || member.status !== 'accepted') return forbidden(res);
            if (!['owner', 'admin', 'manager'].includes(member.role)) return forbidden(res);

            const { title, description, priority, assigneeId, dueDate, tags } = req.body || {};

            if (title !== undefined) task.title = title.trim();
            if (description !== undefined) task.description = description.trim();
            if (priority !== undefined) task.priority = normalizePriority(priority);
            if (assigneeId !== undefined) task.assigneeId = assigneeId || null;
            if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
            if (tags !== undefined) task.tags = Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [];
            task.updatedAt = new Date();

            await task.save();

            return res.status(200).json({ success: true, message: 'Task updated', data: { publicId: task.publicId } });
        } catch {
            return serverError(res, 'Update task failed');
        }
    }

    async deleteTask(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const taskId = normalizeString(req.body?.taskId);
            if (!taskId) return badRequest(res, 'Missing taskId');

            const task = await Task.findOne({ publicId: taskId });
            if (!task) return notFound(res, 'Task not found');

            const member = await ProjectMemberRepository.findMember(task.projectId, userId);
            if (!member || member.status !== 'accepted') return forbidden(res);
            if (!['owner', 'admin', 'manager'].includes(member.role)) return forbidden(res);

            await Task.deleteOne({ publicId: taskId });

            return res.status(200).json({ success: true, message: 'Task deleted' });
        } catch {
            return serverError(res, 'Delete task failed');
        }
    }
}

module.exports = new TaskController();
