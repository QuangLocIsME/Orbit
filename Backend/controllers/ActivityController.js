const ChangeRequest = require('../models/ChangeRequest');
const Document = require('../models/Document');
const Activity = require('../models/Activity');
const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const User = require('../models/User');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const PackageRepository = require('../repositories/PackageRepository');
const { errorResponse } = require('../utils/response');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const TYPE_CONFIG = {
    task_created:      { icon: 'check',   color: 'bg-emerald-100 text-emerald-600', label: 'created task' },
    task_updated:      { icon: 'edit',    color: 'bg-blue-100 text-blue-600',       label: 'updated task' },
    task_deleted:      { icon: 'alert',   color: 'bg-red-100 text-red-600',        label: 'deleted task' },
    task_moved:        { icon: 'edit',    color: 'bg-purple-100 text-purple-600',   label: 'moved task' },
    task_commented:    { icon: 'edit',    color: 'bg-amber-100 text-amber-600',     label: 'commented on task' },
    folder_created:    { icon: 'upload',  color: 'bg-orange-100 text-orange-600',    label: 'created folder' },
    folder_renamed:    { icon: 'edit',   color: 'bg-yellow-100 text-yellow-700',   label: 'renamed folder' },
    folder_deleted:    { icon: 'alert',   color: 'bg-red-100 text-red-600',        label: 'deleted folder' },
    file_uploaded:     { icon: 'upload',  color: 'bg-blue-100 text-blue-600',       label: 'uploaded file' },
    file_renamed:      { icon: 'edit',   color: 'bg-yellow-100 text-yellow-700',   label: 'renamed file' },
    file_deleted:      { icon: 'alert',   color: 'bg-red-100 text-red-600',        label: 'deleted file' },
    change_request:    { icon: 'edit',   color: 'bg-purple-100 text-purple-600',   label: 'submitted change request' },
    document:          { icon: 'upload',  color: 'bg-blue-100 text-blue-600',       label: 'uploaded document' },
    task:              { icon: 'check',   color: 'bg-emerald-100 text-emerald-600', label: 'created task' },
    task_comment:      { icon: 'edit',   color: 'bg-amber-100 text-amber-600',     label: 'commented on task' },
    project_update:     { icon: 'settings', color: 'bg-green-100 text-green-600',  label: 'updated project settings' },
};

const buildActivityItem = (item) => {
    const config = TYPE_CONFIG[item.type] || { icon: 'settings', color: 'bg-gray-100 text-gray-600' };
    let action = item.action || '';

    if (!action && item.targetName) {
        const label = config.label || item.type;
        action = `"${item.targetName}" ${label}`;
    }
    if (item.metadata?.stageFrom && item.metadata?.stageTo) {
        action = `moved "${item.targetName}" from ${item.metadata.stageFrom} to ${item.metadata.stageTo}`;
    }

    return {
        id: item.publicId || item.id,
        type: item.type,
        icon: config.icon,
        color: config.color,
        action,
        user: item.userName || item.user || 'System',
        createdAt: item.createdAt,
        metadata: item.metadata || {},
    };
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

            const LIMIT = 20;
            const since = new Date(Date.now() - THIRTY_DAYS_MS);

            const scopeFilter = { projectId };
            if (packageId) {
                scopeFilter.packageId = packageId;
            } else {
                scopeFilter.$or = [
                    { packageId: null },
                    { packageId: '' },
                    { packageId: { $exists: false } },
                ];
            }

            // Fetch new Activity logs + legacy data in parallel
            const [activities, documents, changeRequests] = await Promise.all([
                Activity.find({ ...scopeFilter, createdAt: { $gte: since } })
                    .sort({ createdAt: -1 })
                    .limit(LIMIT)
                    .lean(),
                Document.find({ ...scopeFilter, createdAt: { $gte: since } })
                    .sort({ createdAt: -1 })
                    .limit(LIMIT)
                    .lean(),
                !packageId
                    ? ChangeRequest.find({ projectId, createdAt: { $gte: since } })
                        .sort({ createdAt: -1 })
                        .limit(LIMIT)
                        .lean()
                    : Promise.resolve([]),
            ]);

            // Load user names for legacy entries
            const allUserIds = [
                ...activities.map((a) => a.userId),
                ...documents.map((d) => d.uploadedBy),
                ...changeRequests.map((cr) => cr.createdBy),
            ].filter(Boolean);
            const uniqueIds = [...new Set(allUserIds)];
            const userMap = {};
            if (uniqueIds.length > 0) {
                const mongoose = require('mongoose');
                const validIds = uniqueIds.filter((id) => {
                    try { return mongoose.Types.ObjectId.isValid(id); } catch { return false; }
                });
                if (validIds.length > 0) {
                    const users = await User.find({ _id: { $in: validIds } }, { _id: 1, fullName: 1 }).lean();
                    for (const u of users) userMap[u._id.toString()] = u.fullName;
                }
            }

            // Merge all activities
            const merged = [
                ...activities.map((a) => buildActivityItem(a)),
                ...documents.map((doc) => ({
                    id: `doc-${doc.publicId}`,
                    type: 'document',
                    icon: 'upload',
                    color: 'bg-blue-100 text-blue-600',
                    action: `"${doc.originalName}" uploaded`,
                    user: userMap[doc.uploadedBy] || 'Unknown',
                    createdAt: doc.createdAt,
                    metadata: {},
                })),
                ...changeRequests.map((cr) => ({
                    id: `cr-${cr.publicId}`,
                    type: 'change_request',
                    icon: 'edit',
                    color: 'bg-purple-100 text-purple-600',
                    action: `Change request "${cr.title}" submitted`,
                    user: userMap[cr.createdBy] || 'Unknown',
                    createdAt: cr.createdAt,
                    metadata: {},
                })),
            ];

            merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Add project update if relevant (only for project-level)
            if (!packageId) {
                const Project = require('../models/Project');
                const project = await Project.findOne({ publicId: projectId }, { updatedAt: 1 }).lean();
                if (project?.updatedAt && new Date(project.updatedAt) >= since) {
                    merged.unshift({
                        id: 'project-update',
                        type: 'project_update',
                        icon: 'settings',
                        color: 'bg-green-100 text-green-600',
                        action: 'Project settings updated',
                        user: 'System',
                        createdAt: project.updatedAt,
                        metadata: {},
                    });
                }
            }

            return res.status(200).json({
                success: true,
                data: merged.slice(0, LIMIT),
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to fetch activities');
        }
    }
}

module.exports = new ActivityController();
