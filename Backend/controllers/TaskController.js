const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const Project = require('../models/Project');
const User = require('../models/User');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');
const NotificationRepository = require('../repositories/NotificationRepository');
const ChangeRequestRepository = require('../repositories/ChangeRequestRepository');
const ActivityService = require('../services/activityService');
const DiscordService = require('../services/discordService');
const socketService = require('../services/socketService');
const { publishProjectBlockRefresh, publishProjectBlockUpdate, publishScopedProjectBlockUpdate } = require('../services/blockRealtimePublisher.service');
const { normalizeString } = require('../utils/sanitize');
const { resolveUserDisplayName } = require('../utils/userDisplayName');
const { errorResponse } = require('../utils/response');

const sendDiscordNotification = async (projectId, userId, type, targetName, metadata = {}) => {
    try {
        const projectDoc = await Project.findOne({ publicId: projectId }).select('name integrations').lean();
        if (!projectDoc || !projectDoc.integrations?.discordEnabled || !projectDoc.integrations?.discordWebhook) return;

        const actor = userId ? await User.findById(userId).select('fullName email').lean() : null;
        const userName = actor?.fullName || actor?.email || 'System';

        await DiscordService.sendWebhook(projectDoc.integrations.discordWebhook, {
            projectName: projectDoc.name,
            userName,
            type,
            targetName,
            metadata,
        });
    } catch { /* silent */ }
};

const getPackageTaskCacheKey = (projectId, packageId) => `${projectId}:package:${packageId}`;

const publishTaskListUpdate = async ({ projectId, packageId = null, userId = '' }) => {
    await publishProjectBlockUpdate({ projectId, scope: 'tasks', blockId: 'list', userId });
    if (!packageId) return;
    await publishScopedProjectBlockUpdate({
        projectId,
        cacheKey: getPackageTaskCacheKey(projectId, packageId),
        scope: 'tasks',
        blockId: 'list',
        userId,
        packageId,
    });
};

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

const getProjectWorkflowStages = async (projectId) => {
    const project = await Project.findOne({ publicId: projectId }).select('workflowTemplateId workflow.stages').lean();
    const stages = Array.isArray(project?.workflow?.stages) ? project.workflow.stages : [];
    return {
        project,
        stages,
        hasWorkflow: Boolean(project?.workflowTemplateId && stages.length > 0),
    };
};

const workflowRequiredMessage = 'Install and apply a workflow template before creating tasks';

/** Project roles that may create tasks and change task status (not viewers). */
const canMutateProjectTasks = (member) => {
    if (!member || member.status !== 'accepted') return false;
    return ['owner', 'admin', 'manager', 'member'].includes(member.role);
};

const canChangeTaskStatus = ({ member, userId, task }) => {
    if (!member || member.status !== 'accepted' || !task) return false;
    if (['owner', 'admin', 'manager'].includes(member.role)) return true;
    const assigneeIds = task.assigneeIds || [];
    const reviewerIds = task.reviewerIds || [];
    const assigneeId = task.assigneeId;
    const allUserIds = [...assigneeIds, ...reviewerIds, assigneeId].filter(Boolean);
    return allUserIds.includes(userId);
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

            const workflowState = await getProjectWorkflowStages(projectId);
            if (!workflowState.project) return notFound(res, 'Project not found');
            if (!workflowState.hasWorkflow) return badRequest(res, workflowRequiredMessage);

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
            const assigneeIdsRaw = req.body?.assigneeIds;
            const reviewerIdsRaw = req.body?.reviewerIds;

            const assigneeIds = Array.isArray(assigneeIdsRaw)
                ? assigneeIdsRaw.map((id) => normalizeString(id)).filter(Boolean)
                : (assigneeId ? [assigneeId] : []);

            const reviewerIds = Array.isArray(reviewerIdsRaw)
                ? reviewerIdsRaw.map((id) => normalizeString(id)).filter(Boolean)
                : [];

            for (const id of assigneeIds) {
                const m = await ProjectMemberRepository.findMember(projectId, id);
                if (!m) return badRequest(res, `Assignee ${id} is not a project member`);
            }
            for (const id of reviewerIds) {
                const m = await ProjectMemberRepository.findMember(projectId, id);
                if (!m) return badRequest(res, `Reviewer ${id} is not a project member`);
            }

            const task = await Task.create({
                projectId,
                packageId,
                title,
                description: normalizeString(req.body?.description),
                status: workflowState.stages.some((stage) => stage.id === normalizeStatus(req.body?.status))
                    ? normalizeStatus(req.body?.status)
                    : workflowState.stages[0].id,
                priority: normalizePriority(req.body?.priority),
                assigneeId: assigneeIds[0] || '',
                assigneeIds,
                reviewerIds,
                dueDate: req.body?.dueDate ? new Date(req.body.dueDate) : null,
                linkedUrl: normalizeString(req.body?.linkedUrl),
                tags: Array.isArray(req.body?.tags) ? req.body.tags.map((t) => normalizeString(t)).filter(Boolean) : [],
                affectedModels: Array.isArray(req.body?.affectedModels) ? req.body.affectedModels : [],
                createdBy: userId,
                updatedAt: new Date(),
            });

            // If task is linked to a CR, update the CR's linkedTaskIds
            if (task.linkedUrl && task.linkedUrl.startsWith('cr:')) {
                const crPublicId = task.linkedUrl.replace('cr:', '');
                try {
                    const cr = await ChangeRequestRepository.findByPublicId(crPublicId);
                    if (cr) {
                        const currentLinked = cr.linkedTaskIds || [];
                        if (!currentLinked.includes(task.publicId)) {
                            await ChangeRequestRepository.update(crPublicId, {
                                linkedTaskIds: [...currentLinked, task.publicId],
                            });
                        }
                    }
                } catch (crErr) {
                    console.warn('[createTask] Failed to link task to CR:', crErr.message);
                }
            }

            if (packageId) {
                await PackageRepository.addTaskIdToPackage(packageId, projectId, task.publicId);
            }

            // Broadcast task:created to all project members for real-time board refresh
            socketService.broadcastProject(projectId, 'task:created', {
                projectId,
                packageId: packageId || null,
                taskId: task.publicId,
            });
            await publishTaskListUpdate({ projectId, packageId, userId });

            const taskLink = getTaskLink(projectId, packageId, task.publicId);

            // Notify all assignees
            for (const assignee of assigneeIds) {
                if (assignee === userId) continue;
                const notification = await NotificationRepository.create({
                    userId: assignee,
                    type: 'info',
                    title: 'New task assigned',
                    message: title,
                    link: taskLink,
                    read: false,
                    refType: 'task',
                    refId: task.publicId,
                });

                socketService.notifyUser(assignee, 'notification:new', {
                    id: String(notification._id),
                    type: 'info',
                    title: 'New task assigned',
                    message: title,
                    link: taskLink,
                    read: false,
                    createdAt: notification.createdAt.toISOString(),
                });
            }

            // Notify all reviewers
            for (const reviewer of reviewerIds) {
                if (reviewer === userId) continue;
                if (assigneeIds.includes(reviewer)) continue; // already notified as assignee
                const notification = await NotificationRepository.create({
                    userId: reviewer,
                    type: 'info',
                    title: 'You are a reviewer',
                    message: title,
                    link: taskLink,
                    read: false,
                    refType: 'task',
                    refId: task.publicId,
                });

                socketService.notifyUser(reviewer, 'notification:new', {
                    id: String(notification._id),
                    type: 'info',
                    title: 'You are a reviewer',
                    message: title,
                    link: taskLink,
                    read: false,
                    createdAt: notification.createdAt.toISOString(),
                });
            }

            // Log activity
            await ActivityService.log({
                projectId,
                packageId,
                userId,
                type: 'task_created',
                targetId: task.publicId,
                targetName: title,
                metadata: { status: task.status, priority: task.priority },
            });

            // Send Discord notification
            const assigneeNames = assigneeIds.length
                ? (await User.find({ _id: { $in: assigneeIds } }).select('fullName').lean()).map((u) => u.fullName).join(', ')
                : '';
            await sendDiscordNotification(projectId, userId, 'task_created', title, {
                status: task.status,
                priority: task.priority,
                assignees: assigneeNames,
            });

            // Broadcast to package room for real-time stat updates
            if (packageId) {
                socketService.broadcastPackage(packageId, 'package:task-count-changed', {
                    projectId,
                    packageId,
                    action: 'created',
                    taskId: task.publicId,
                    status: task.status,
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

    async listMyTasks(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const limit = Math.min(Math.max(parseInt(req.body?.limit) || 5, 1), 50);
            const { Types } = require('mongoose');
            const Project = require('../models/Project');

            const tasks = await Task.find({
                $or: [
                    { assigneeId: userId },
                    { assigneeId: new Types.ObjectId(userId) },
                    { assigneeIds: userId },
                    { assigneeIds: new Types.ObjectId(userId) },
                ],
            })
            .sort({ dueDate: 1, createdAt: -1 })
            .lean();

            const projectIds = [...new Set(tasks.map(t => t.projectId).filter(Boolean))];
            const accessibleProjectIds = [];
            const projectMemberRepo = require('../repositories/ProjectMemberRepository');
            const projectNameMap = {};

            if (projectIds.length > 0) {
                const projects = await Project.find({
                    publicId: { $in: projectIds },
                    trashedAt: null,
                }).select('publicId name').lean();
                for (const p of projects) {
                    projectNameMap[p.publicId] = p.name;
                }
                const nonTrashedIds = new Set(projects.map(p => p.publicId));

                for (const pid of projectIds) {
                    if (nonTrashedIds.has(pid)) {
                        const member = await projectMemberRepo.findMember(pid, userId);
                        if (member) accessibleProjectIds.push(pid);
                    }
                }
            }

            const accessibleTasks = tasks
                .filter(t => accessibleProjectIds.includes(t.projectId))
                .map(t => ({
                    ...t,
                    projectPublicId: t.projectId,
                    projectName: projectNameMap[t.projectId] || 'Unknown Project',
                }))
                .sort((a, b) => {
                    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                    if (a.dueDate) return -1;
                    if (b.dueDate) return 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                })
                .slice(0, limit);

            return res.status(200).json({ success: true, data: accessibleTasks });
        } catch {
            return serverError(res, 'Load my tasks failed');
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

            const allUserIds = [
                ...(task.assigneeIds || []),
                task.assigneeId,
                ...(task.reviewerIds || []),
            ].filter(Boolean);
            const uniqueUserIds = [...new Set(allUserIds)];
            const users = uniqueUserIds.length
                ? await User.find({ _id: { $in: uniqueUserIds } }).select('_id fullName email').lean()
                : [];
            const userMap = new Map(users.map((u) => [String(u._id), u]));

            const assigneeIds = task.assigneeIds || [];
            const reviewerIds = task.reviewerIds || [];
            const assigneeName = userMap.get(String(task.assigneeId || ''))?.fullName
                || userMap.get(String(task.assigneeId || ''))?.email
                || '';
            const assigneeNames = assigneeIds
                .map((id) => userMap.get(String(id))?.fullName || userMap.get(String(id))?.email || '')
                .filter(Boolean);
            const reviewerNames = reviewerIds
                .map((id) => userMap.get(String(id))?.fullName || userMap.get(String(id))?.email || '')
                .filter(Boolean);

            return res.status(200).json({
                success: true,
                data: {
                    ...task,
                    assigneeName,
                    assigneeNames,
                    reviewerNames,
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
                return forbidden(res, 'Only owner/admin/manager, assignee, or reviewer can update task status');
            }

            // ── Workflow: CR-linked task moving to last column ─────────────────────────
            // When a task is linked to a ChangeRequest and is moved to the last workflow
            // stage, we park it in 'pending-review' so owner/admin can approve/reject it.
            // Fetch project workflow and settings (also needed for notifications below)
            const project = await Project.findOne({ publicId: projectId }).select('workflow.stages workflow.settings name integrations').lean();
            const workflowStages = project?.workflow?.stages || [];
            const requireApproval = project?.workflow?.settings?.requireApprovalForCompletion;
            const isLinkedToCR = !!(currentTask.linkedUrl && currentTask.linkedUrl.startsWith('cr:'));

            if (isLinkedToCR && requireApproval && workflowStages.length > 0) {
                const lastStageId = workflowStages[workflowStages.length - 1].id;
                if (status === lastStageId && currentTask.status !== 'pending-review') {
                    // Park task in pending-review instead of the last column.
                    // The task will only move to the real last stage after owner/admin approves.
                    const updated = await Task.findOneAndUpdate(
                        { _id: currentTask._id },
                        { status: 'pending-review', updatedAt: new Date() },
                        { returnDocument: 'after' }
                    ).lean();
                    if (!updated) return notFound(res, 'Task not found');

                    // Extract CR publicId from linkedUrl
                    const crPublicId = currentTask.linkedUrl.replace('cr:', '');
                    const changeRequest = await ChangeRequestRepository.findByPublicId(crPublicId);

                    // Notify owner/admin via socket and notification
                    const notifiableRoles = ['owner', 'admin'];
                    const admins = await require('../models/ProjectMember').find({
                        projectId,
                        role: { $in: notifiableRoles },
                        status: 'accepted',
                    }).select('userId').lean();

                    const taskLink = `/projects/${projectId}/tasks/${taskId}`;
                    const actorName = await resolveUserDisplayName(userId);
                    const notificationMsg = `${actorName} requested review for task "${currentTask.title}" in CR "${changeRequest?.title || crPublicId}"`;

                    for (const admin of admins) {
                        if (admin.userId === userId) continue; // don't notify self
                        const notification = await NotificationRepository.create({
                            userId: admin.userId,
                            type: 'info',
                            title: 'Task review requested',
                            message: notificationMsg,
                            link: taskLink,
                            read: false,
                            refType: 'task',
                            refId: taskId,
                        });
                        socketService.notifyUser(admin.userId, 'notification:new', {
                            id: String(notification._id),
                            type: 'info',
                            title: 'Task review requested',
                            message: notificationMsg,
                            link: taskLink,
                            read: false,
                            createdAt: notification.createdAt.toISOString(),
                        });
                    }

                    socketService.broadcastProject(projectId, 'task:status-changed', {
                        projectId,
                        packageId,
                        taskId,
                        status: 'pending-review',
                    });
                    await publishTaskListUpdate({ projectId, packageId, userId });

                    return res.status(200).json({
                        success: true,
                        data: updated,
                        pendingReview: true,
                        message: 'Task submitted for review. An owner/admin will approve it.',
                    });
                }
            }
            // ── End workflow ──────────────────────────────────────────────────────────

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
            await publishTaskListUpdate({ projectId, packageId, userId });
            console.debug('[WS] Emitted task:status-changed', { projectId, packageId, taskId, status });

            // Also broadcast to package room for real-time stat updates
            if (packageId) {
                socketService.broadcastPackage(packageId, 'package:task-count-changed', {
                    projectId,
                    packageId,
                    action: 'status-changed',
                    taskId,
                    status,
                });
            }

            // Notify all assignees and reviewers when task stage changes
            const assigneeIds = currentTask.assigneeIds || [];
            const reviewerIds = currentTask.reviewerIds || [];
            const assigneeId = currentTask.assigneeId;
            const allRecipients = [...new Set([...assigneeIds, assigneeId, ...reviewerIds].filter(Boolean))];
            const recipientsToNotify = allRecipients.filter((r) => r !== userId);

            if (recipientsToNotify.length > 0) {
                const notifyEnabled = !project || project.workflow?.settings?.notifyOnStatusChange !== false;
                if (notifyEnabled) {
                    const taskLink = getTaskLink(projectId, packageId, taskId);
                    const changerName = await resolveUserDisplayName(userId);
                    const stageLabel = project?.workflow?.stages?.find((s) => s.id === status)?.label || status;
                    const message = `${changerName} moved "${currentTask.title}" to ${stageLabel}`;

                    for (const recipient of recipientsToNotify) {
                        const notification = await NotificationRepository.create({
                            userId: recipient,
                            type: 'info',
                            title: 'Task moved',
                            message,
                            link: taskLink,
                            read: false,
                            refType: 'task',
                            refId: taskId,
                        });

                        socketService.notifyUser(recipient, 'notification:new', {
                            id: String(notification._id),
                            type: 'info',
                            title: 'Task moved',
                            message,
                            link: taskLink,
                            read: false,
                            createdAt: notification.createdAt.toISOString(),
                        });
                    }
                }
            }

            // Log activity + Discord notification for stage move
            const stageLabel = project?.workflow?.stages?.find((s) => s.id === status)?.label || status;
            const oldStageLabel = project?.workflow?.stages?.find((s) => s.id === currentTask.status)?.label || currentTask.status;

            await ActivityService.log({
                projectId,
                packageId,
                userId,
                type: 'task_moved',
                targetId: taskId,
                targetName: updated.title || currentTask.title,
                metadata: { stageFrom: oldStageLabel, stageTo: stageLabel, status },
            });

            await sendDiscordNotification(projectId, userId, 'task_moved', updated.title || currentTask.title, {
                stageFrom: oldStageLabel,
                stageTo: stageLabel,
                taskStatus: stageLabel,
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
                ? await User.find({ _id: { $in: authorIds } }).select('_id fullName email avatar').lean()
                : [];
            const map = new Map(users.map((u) => [String(u._id), u]));

            const data = comments.map((c) => ({
                ...c,
                authorName: map.get(String(c.authorId))?.fullName || map.get(String(c.authorId))?.email || 'Unknown',
                avatar: map.get(String(c.authorId))?.avatar || '',
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
            await publishProjectBlockRefresh({
                projectId,
                scope: 'tasks',
                blockId: `comments:task:${taskId}`,
            });
            await publishTaskListUpdate({ projectId, packageId: task.packageId || null, userId });

            // Notify all assignees and reviewers when someone comments on their task
            const author = await User.findById(userId).select('_id fullName email avatar').lean();
            const authorName = await resolveUserDisplayName(userId);
            const authorAvatar = author?.avatar || '';
            const taskLink = getTaskLink(projectId, task.packageId, taskId);
            const message = `${authorName} commented: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`;

            const assigneeIds = task.assigneeIds || [];
            const reviewerIds = task.reviewerIds || [];
            const assigneeId = task.assigneeId;
            const allRecipients = [...new Set([...assigneeIds, assigneeId, ...reviewerIds].filter(Boolean))];
            const recipientsToNotify = allRecipients.filter((r) => r !== userId);

            for (const recipient of recipientsToNotify) {
                const notification = await NotificationRepository.create({
                    userId: recipient,
                    type: 'info',
                    title: 'New comment on your task',
                    message,
                    link: taskLink,
                    read: false,
                    refType: 'task',
                    refId: task.publicId,
                });

                socketService.notifyUser(recipient, 'notification:new', {
                    id: String(notification._id),
                    type: 'info',
                    title: 'New comment on your task',
                    message,
                    link: taskLink,
                    read: false,
                    createdAt: notification.createdAt.toISOString(),
                });
            }

            return res.status(201).json({
                success: true,
                data: {
                    ...comment.toObject(),
                    authorName: author?.fullName || author?.email || 'You',
                    avatar: author?.avatar || '',
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

            socketService.broadcastProject(comment.projectId, 'task:comment_updated', {
                projectId: comment.projectId,
                packageId: comment.packageId || null,
                taskId: comment.taskId,
                commentId,
                comment: {
                    publicId: comment.publicId,
                    authorId: comment.authorId,
                    content: comment.content,
                    createdAt: comment.createdAt,
                    updatedAt: comment.updatedAt,
                    isEdited: comment.isEdited,
                    authorName: author?.fullName || author?.email || 'Unknown',
                },
            });
            await publishProjectBlockRefresh({
                projectId: comment.projectId,
                scope: 'tasks',
                blockId: `comments:task:${comment.taskId}`,
            });
            await publishTaskListUpdate({ projectId: comment.projectId, packageId: comment.packageId || null, userId });

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

            socketService.broadcastProject(comment.projectId, 'task:comment_deleted', {
                projectId: comment.projectId,
                packageId: comment.packageId || null,
                taskId: comment.taskId,
                commentId,
            });
            await publishProjectBlockRefresh({
                projectId: comment.projectId,
                scope: 'tasks',
                blockId: `comments:task:${comment.taskId}`,
            });
            await publishTaskListUpdate({ projectId: comment.projectId, packageId: comment.packageId || null, userId });

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

            const { title, description, priority, assigneeId, assigneeIds, reviewerIds, dueDate, tags, affectedModels } = req.body || {};

            const oldAssigneeIds = [...(task.assigneeIds || [])];
            const oldReviewerIds = [...(task.reviewerIds || [])];

            if (title !== undefined) task.title = title.trim();
            if (description !== undefined) task.description = description.trim();
            if (priority !== undefined) task.priority = normalizePriority(priority);
            if (assigneeIds !== undefined) {
                task.assigneeIds = Array.isArray(assigneeIds) ? assigneeIds.map(id => normalizeString(id)).filter(Boolean) : [];
                task.assigneeId = task.assigneeIds[0] || assigneeId || '';
            } else if (assigneeId !== undefined) {
                task.assigneeId = assigneeId || null;
            }
            if (reviewerIds !== undefined) {
                task.reviewerIds = Array.isArray(reviewerIds) ? reviewerIds.map(id => normalizeString(id)).filter(Boolean) : [];
            }
            if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
            if (tags !== undefined) task.tags = Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [];
            if (affectedModels !== undefined) task.affectedModels = Array.isArray(affectedModels) ? affectedModels : [];
            task.updatedAt = new Date();

            await task.save();

            const updatedChanges = {
                title: task.title,
                description: task.description,
                priority: task.priority,
                assigneeId: task.assigneeId,
                assigneeIds: task.assigneeIds,
                reviewerIds: task.reviewerIds,
                dueDate: task.dueDate,
                tags: task.tags,
                affectedModels: task.affectedModels,
                updatedAt: task.updatedAt,
            };

            socketService.broadcastProject(task.projectId, 'task:updated', {
                projectId: task.projectId,
                packageId: task.packageId || null,
                taskId: task.publicId,
                changes: updatedChanges,
            });
            await publishTaskListUpdate({ projectId: task.projectId, packageId: task.packageId || null, userId });

            const newAssigneeIds = task.assigneeIds || [];
            const newReviewerIds = task.reviewerIds || [];
            const taskLink = getTaskLink(task.projectId, task.packageId, task.publicId);

            // Notify newly added assignees
            const addedAssignees = newAssigneeIds.filter(id => !oldAssigneeIds.includes(id) && id !== userId);
            for (const assignee of addedAssignees) {
                const notification = await NotificationRepository.create({
                    userId: assignee,
                    type: 'info',
                    title: 'New task assigned',
                    message: task.title,
                    link: taskLink,
                    read: false,
                    refType: 'task',
                    refId: task.publicId,
                });

                socketService.notifyUser(assignee, 'notification:new', {
                    id: String(notification._id),
                    type: 'info',
                    title: 'New task assigned',
                    message: task.title,
                    link: taskLink,
                    read: false,
                    createdAt: notification.createdAt.toISOString(),
                });
            }

            // Notify newly added reviewers
            const addedReviewers = newReviewerIds.filter(id => !oldReviewerIds.includes(id) && id !== userId && !newAssigneeIds.includes(id));
            for (const reviewer of addedReviewers) {
                const notification = await NotificationRepository.create({
                    userId: reviewer,
                    type: 'info',
                    title: 'You are a reviewer',
                    message: task.title,
                    link: taskLink,
                    read: false,
                    refType: 'task',
                    refId: task.publicId,
                });

                socketService.notifyUser(reviewer, 'notification:new', {
                    id: String(notification._id),
                    type: 'info',
                    title: 'You are a reviewer',
                    message: task.title,
                    link: taskLink,
                    read: false,
                    createdAt: notification.createdAt.toISOString(),
                });
            }

            // Log activity for field updates
            if (title !== undefined || priority !== undefined || assigneeIds !== undefined) {
                await ActivityService.log({
                    projectId: task.projectId,
                    packageId: task.packageId,
                    userId,
                    type: 'task_updated',
                    targetId: task.publicId,
                    targetName: task.title,
                    metadata: {
                        priority: task.priority,
                        status: task.status,
                    },
                });

                await sendDiscordNotification(task.projectId, userId, 'task_updated', task.title, {
                    priority: task.priority,
                    taskStatus: task.status,
                });
            }

            // Broadcast to package room for real-time stat updates
            if (task.packageId) {
                socketService.broadcastPackage(task.packageId, 'package:task-count-changed', {
                    projectId: task.projectId,
                    packageId: task.packageId,
                    action: 'updated',
                    taskId: task.publicId,
                    status: task.status,
                });
                socketService.broadcastPackage(task.packageId, 'task:updated', {
                    projectId: task.projectId,
                    packageId: task.packageId,
                    taskId: task.publicId,
                    changes: updatedChanges,
                });
            }

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

            const deletedTitle = task.title;
            const deletedProjectId = task.projectId;
            const deletedPackageId = task.packageId;

            await Task.deleteOne({ publicId: taskId });

            await ActivityService.log({
                projectId: deletedProjectId,
                packageId: deletedPackageId,
                userId,
                type: 'task_deleted',
                targetId: taskId,
                targetName: deletedTitle,
                metadata: {},
            });

            await sendDiscordNotification(deletedProjectId, userId, 'task_deleted', deletedTitle, {});

            // Broadcast to package room for real-time stat updates
            if (deletedPackageId) {
                socketService.broadcastPackage(deletedPackageId, 'package:task-count-changed', {
                    projectId: deletedProjectId,
                    packageId: deletedPackageId,
                    action: 'deleted',
                    taskId,
                });
            }

            // Broadcast task:deleted to all project members for real-time board refresh
            socketService.broadcastProject(deletedProjectId, 'task:deleted', {
                projectId: deletedProjectId,
                packageId: deletedPackageId || null,
                taskId,
            });
            await publishTaskListUpdate({ projectId: deletedProjectId, packageId: deletedPackageId || null, userId });

            return res.status(200).json({ success: true, message: 'Task deleted' });
        } catch {
            return serverError(res, 'Delete task failed');
        }
    }

    async requestReview(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const taskId = normalizeString(req.body?.taskId);
            const projectId = normalizeString(req.body?.projectId);
            const action = normalizeString(req.body?.action); // 'approve' or 'reject'

            if (!taskId || !projectId || !action) {
                return badRequest(res, 'Missing taskId, projectId or action');
            }
            if (!['approve', 'reject'].includes(action)) {
                return badRequest(res, 'Action must be "approve" or "reject"');
            }

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member || member.status !== 'accepted') {
                return forbidden(res, 'Only project members can review tasks');
            }
            if (member.role !== 'owner' && member.role !== 'admin') {
                return forbidden(res, 'Only owner or admin can review tasks');
            }

            const task = await Task.findOne({ publicId: taskId }).lean();
            if (!task) return notFound(res, 'Task not found');

            if (task.status !== 'pending-review') {
                return badRequest(res, 'Task is not pending review');
            }

            // Get the last workflow stage for this project
            const project = await Project.findOne({ publicId: projectId }).select('workflow.stages').lean();
            const stages = project?.workflow?.stages || [];
            if (stages.length === 0) {
                return serverError(res, 'No workflow stages defined for this project');
            }
            const lastStageId = stages[stages.length - 1].id;

            let newStatus;
            if (action === 'approve') {
                newStatus = lastStageId;
            } else {
                // Reject: move back one stage (or to previous stage if available)
                const lastStageIndex = stages.findIndex((s) => s.id === lastStageId);
                const previousStage = lastStageIndex > 0 ? stages[lastStageIndex - 1] : stages[0];
                newStatus = previousStage.id;
            }

            const updated = await Task.findOneAndUpdate(
                { _id: task._id },
                { status: newStatus, updatedAt: new Date() },
                { returnDocument: 'after' }
            ).lean();
            if (!updated) return notFound(res, 'Task not found');

            // Notify assignees
            const assigneeIds = task.assigneeIds || [];
            const assigneeId = task.assigneeId;
            const allRecipients = [assigneeId, ...assigneeIds].filter(Boolean);
            const actorUser = await User.findById(userId).select('fullName').lean();
            const actorName = actorUser?.fullName || 'An admin';
            const taskLink = `/projects/${projectId}/tasks/${taskId}`;
            const stageLabel = stages.find((s) => s.id === newStatus)?.label || newStatus;

            for (const recipient of allRecipients) {
                if (recipient === userId) continue;
                const notification = await NotificationRepository.create({
                    userId: recipient,
                    type: 'info',
                    title: action === 'approve' ? 'Task approved' : 'Task returned',
                    message: action === 'approve'
                        ? `${actorName} approved your task "${task.title}" — moved to ${stageLabel}`
                        : `${actorName} returned your task "${task.title}" — moved back to ${stageLabel}`,
                    link: taskLink,
                    read: false,
                    refType: 'task',
                    refId: taskId,
                });
                socketService.notifyUser(recipient, 'notification:new', {
                    id: String(notification._id),
                    type: 'info',
                    title: action === 'approve' ? 'Task approved' : 'Task returned',
                    message: notification.message,
                    link: taskLink,
                    read: false,
                    createdAt: notification.createdAt.toISOString(),
                });
            }

            // Log activity
            await ActivityService.log({
                projectId,
                packageId: task.packageId,
                userId,
                type: action === 'approve' ? 'task_approved' : 'task_rejected',
                targetId: taskId,
                targetName: task.title,
                metadata: { fromStatus: 'pending-review', toStatus: newStatus },
            });

            // Broadcast status change
            socketService.broadcastProject(projectId, 'task:status-changed', {
                projectId,
                packageId: task.packageId,
                taskId,
                status: newStatus,
            });
            await publishTaskListUpdate({ projectId, packageId: task.packageId || null, userId });

            if (task.packageId) {
                socketService.broadcastPackage(task.packageId, 'package:task-count-changed', {
                    projectId,
                    packageId: task.packageId,
                    action: 'status-changed',
                    taskId,
                    status: newStatus,
                });
            }

            return res.status(200).json({
                success: true,
                data: updated,
                message: action === 'approve'
                    ? 'Task approved and moved to completion'
                    : 'Task returned to previous stage',
            });
        } catch {
            return serverError(res, 'Review task failed');
        }
    }

    async uploadAttachments(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const taskId = normalizeString(req.body?.taskId);
            if (!taskId) return badRequest(res, 'Missing taskId');
            if (!req.files || req.files.length === 0) return badRequest(res, 'No files provided');

            const task = await Task.findOne({ publicId: taskId });
            if (!task) return notFound(res, 'Task not found');

            const member = await ProjectMemberRepository.findMember(task.projectId, userId);
            if (!member || member.status !== 'accepted') return forbidden(res);
            if (!['owner', 'admin', 'manager', 'member'].includes(member.role)) return forbidden(res);

            const supabaseStorage = require('../services/supabaseStorageService');
            const uploaded = [];

            for (const file of req.files) {
                const storagePath = supabaseStorage.buildSupabaseAttachmentPath({
                    projectId: task.projectId,
                    crId: taskId,
                    fileName: file.originalname,
                });

                let url;
                try {
                    const result = await supabaseStorage.uploadAttachmentBuffer(file.buffer, storagePath);
                    url = result.publicUrl;
                } catch (uploadErr) {
                    console.error('[TaskAttachment] Upload failed:', uploadErr.message);
                    continue;
                }

                task.attachments.push({
                    name: file.originalname,
                    size: file.size,
                    url,
                    mimeType: file.mimetype || '',
                    uploadedAt: new Date(),
                });
                uploaded.push({ name: file.originalname, size: file.size, url, mimeType: file.mimetype });
            }

            task.attachmentsCount = task.attachments.length;
            task.updatedAt = new Date();
            await task.save();

            // Broadcast update
            socketService.broadcastProject(task.projectId, 'task:updated', {
                projectId: task.projectId,
                packageId: task.packageId || null,
                taskId: task.publicId,
                changes: {
                    attachmentsCount: task.attachmentsCount,
                    attachments: task.attachments,
                },
            });
            await publishTaskListUpdate({ projectId: task.projectId, packageId: task.packageId || null, userId });

            if (task.packageId) {
                socketService.broadcastPackage(task.packageId, 'task:updated', {
                    projectId: task.projectId,
                    packageId: task.packageId,
                    taskId: task.publicId,
                    changes: {
                        attachmentsCount: task.attachmentsCount,
                        attachments: task.attachments,
                    },
                });
            }

            return res.status(200).json({ success: true, data: { attachments: uploaded } });
        } catch {
            return serverError(res, 'Upload attachments failed');
        }
    }

    async deleteAttachment(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const taskId = normalizeString(req.body?.taskId);
            const attachmentIndex = parseInt(req.body?.attachmentIndex, 10);
            if (!taskId || isNaN(attachmentIndex)) return badRequest(res, 'Missing taskId or attachmentIndex');

            const task = await Task.findOne({ publicId: taskId });
            if (!task) return notFound(res, 'Task not found');

            const member = await ProjectMemberRepository.findMember(task.projectId, userId);
            if (!member || member.status !== 'accepted') return forbidden(res);
            if (!['owner', 'admin', 'manager', 'member'].includes(member.role)) return forbidden(res);

            if (attachmentIndex < 0 || attachmentIndex >= task.attachments.length) {
                return badRequest(res, 'Invalid attachment index');
            }

            task.attachments.splice(attachmentIndex, 1);
            task.attachmentsCount = task.attachments.length;
            task.updatedAt = new Date();
            await task.save();

            socketService.broadcastProject(task.projectId, 'task:updated', {
                projectId: task.projectId,
                packageId: task.packageId || null,
                taskId: task.publicId,
                changes: {
                    attachmentsCount: task.attachmentsCount,
                    attachments: task.attachments,
                },
            });
            await publishTaskListUpdate({ projectId: task.projectId, packageId: task.packageId || null, userId });

            if (task.packageId) {
                socketService.broadcastPackage(task.packageId, 'task:updated', {
                    projectId: task.projectId,
                    packageId: task.packageId,
                    taskId: task.publicId,
                    changes: {
                        attachmentsCount: task.attachmentsCount,
                        attachments: task.attachments,
                    },
                });
            }

            return res.status(200).json({ success: true, message: 'Attachment deleted' });
        } catch {
            return serverError(res, 'Delete attachment failed');
        }
    }
}

module.exports = new TaskController();
