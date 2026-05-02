/**
 * Report Service
 * Aggregates project data for reporting: documents, tasks, progress, activities.
 */
const Document = require('../models/Document');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const Project = require('../models/Project');
const Package = require('../models/Package');

const ReportService = {
    /**
     * Get the full report data for a project at this moment.
     * @param {string} projectId - Project publicId
     * @returns {Promise<object>} Aggregated report data
     */
    async getProjectReportData(projectId) {
        const now = new Date();

        const [
            documents,
            tasks,
            activities,
            project,
            packages,
        ] = await Promise.all([
            Document.find({ projectId }).select(
                'originalName mimeType size createdAt folderPath approvalStatus conversionStatus'
            ).lean(),
            Task.find({ projectId }).select(
                'title status priority assigneeId assigneeIds dueDate createdAt updatedAt tags createdBy'
            ).lean(),
            Activity.find({ projectId })
                .sort({ createdAt: -1 })
                .limit(100)
                .select('type userName targetName metadata createdAt')
                .lean(),
            Project.findOne({ publicId: projectId })
                .select('name description ownerId createdAt')
                .lean(),
            Package.find({ projectId })
                .select('name status documentIds taskIds')
                .lean(),
        ]);

        // Total documents & drawings
        const totalDocuments = documents.length;
        const totalSizeBytes = documents.reduce((sum, d) => sum + (d.size || 0), 0);

        // Task count by status
        const taskCountByStatus = {};
        for (const task of tasks) {
            const status = task.status || 'backlog';
            taskCountByStatus[status] = (taskCountByStatus[status] || 0) + 1;
        }

        // Project progress over time (tasks completed per month, last 12 months)
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        const recentActivities = activities.filter(a => new Date(a.createdAt) >= twelveMonthsAgo);

        const progressByMonth = {};
        for (let i = 0; i < 12; i++) {
            const d = new Date(now);
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            progressByMonth[key] = { month: key, created: 0, completed: 0 };
        }

        for (const activity of recentActivities) {
            const aDate = new Date(activity.createdAt);
            const key = `${aDate.getFullYear()}-${String(aDate.getMonth() + 1).padStart(2, '0')}`;
            if (progressByMonth[key]) {
                if (activity.type === 'task_created') progressByMonth[key].created++;
                if (activity.type === 'task_updated' && activity.metadata?.toStatus === 'done') {
                    progressByMonth[key].completed++;
                }
            }
        }

        // Overall progress percentage
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Recent activities (formatted)
        const recentActivitiesFormatted = activities.slice(0, 20).map(a => ({
            type: a.type,
            user: a.userName,
            target: a.targetName,
            description: buildActivityDescription(a),
            timestamp: a.createdAt,
        }));

        return {
            generatedAt: now,
            project: project ? {
                name: project.name,
                description: project.description,
                createdAt: project.createdAt,
                ownerId: project.ownerId,
            } : null,
            summary: {
                totalDocuments,
                totalSizeBytes,
                totalSizeMB: Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100,
                totalTasks,
                completedTasks,
                pendingTasks: totalTasks - completedTasks,
                progressPercent,
                totalPackages: packages.length,
            },
            taskCountByStatus,
            progressOverTime: Object.values(progressByMonth).reverse(),
            recentActivities: recentActivitiesFormatted,
            reportType: 'project_full_report',
        };
    },
};

/**
 * Build a human-readable description for an activity.
 */
function buildActivityDescription(activity) {
    const typeLabels = {
        task_created: 'created a task',
        task_updated: 'updated a task',
        task_deleted: 'deleted a task',
        task_moved: 'moved a task',
        task_commented: 'commented on a task',
        folder_created: 'created a folder',
        folder_renamed: 'renamed a folder',
        folder_deleted: 'deleted a folder',
        file_uploaded: 'uploaded a file',
        file_version_uploaded: 'uploaded a new version',
        file_renamed: 'renamed a file',
        file_deleted: 'deleted a file',
        upload_approved: 'approved an upload',
        upload_rejected: 'rejected an upload',
    };
    const label = typeLabels[activity.type] || activity.type;
    const target = activity.targetName ? ` "${activity.targetName}"` : '';
    return `${activity.userName} ${label}${target}`;
}

module.exports = ReportService;
