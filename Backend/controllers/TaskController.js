const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const User = require('../models/User');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
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

class TaskController {
    async createTask(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const projectId = normalizeString(req.body?.projectId);
            const title = normalizeString(req.body?.title);
            if (!projectId || !title) return badRequest(res, 'Missing projectId or title');

            const actor = await ProjectMemberRepository.findMember(projectId, userId);
            if (!actor || !['admin'].includes(actor.role)) return forbidden(res);

            const assigneeId = normalizeString(req.body?.assigneeId);
            if (assigneeId) {
                const assigneeMember = await ProjectMemberRepository.findMember(projectId, assigneeId);
                if (!assigneeMember) return badRequest(res, 'Assignee is not a project member');
            }

            const task = await Task.create({
                projectId,
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

            if (assigneeId) {
                socketService.notifyUser(assigneeId, 'notification:new', {
                    id: `task-assigned:${task.publicId}`,
                    type: 'info',
                    title: 'New task assigned',
                    message: `${title}`,
                    link: `/projects/${projectId}/tasks/${task.publicId}`,
                    read: false,
                    createdAt: new Date().toISOString(),
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
            if (!projectId) return badRequest(res, 'Missing projectId');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            const tasks = await Task.find({ projectId }).sort({ createdAt: -1 }).lean();
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
            if (!projectId || !taskId) return badRequest(res, 'Missing projectId or taskId');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            const task = await Task.findOne({ publicId: taskId, projectId }).lean();
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
            if (!projectId || !taskId || !status) return badRequest(res, 'Missing projectId, taskId or status');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || !['admin'].includes(member.role)) return forbidden(res);

            const updated = await Task.findOneAndUpdate(
                { publicId: taskId, projectId },
                { status, updatedAt: new Date() },
                { returnDocument: 'after' }
            ).lean();

            if (!updated) return notFound(res, 'Task not found');

            socketService.broadcastProject(projectId, 'task:status-changed', {
                projectId,
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
            if (!projectId || !taskId) return badRequest(res, 'Missing projectId or taskId');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            const comments = await TaskComment.find({ projectId, taskId }).sort({ createdAt: -1 }).lean();

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
            if (!projectId || !taskId || !content) return badRequest(res, 'Missing projectId, taskId or content');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return forbidden(res);

            const task = await Task.findOne({ publicId: taskId, projectId });
            if (!task) return notFound(res, 'Task not found');

            const comment = await TaskComment.create({
                taskId,
                projectId,
                authorId: userId,
                content,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await Task.updateOne({ publicId: taskId, projectId }, { $inc: { commentsCount: 1 }, $set: { updatedAt: new Date() } });

            socketService.broadcastProject(projectId, 'task:commented', {
                projectId,
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
            const isAdmin = member && member.role === 'admin';
            const isAuthor = comment.authorId === userId;

            // Only author or admin can delete
            if (!isAuthor && !isAdmin) return forbidden(res);

            await TaskComment.deleteOne({ publicId: commentId });

            await Task.updateOne(
                { publicId: comment.taskId, projectId: comment.projectId },
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
}

module.exports = new TaskController();
