const DONE_TASK_STATUSES = new Set(['done', 'completed', 'approved']);

function computeDoneStatuses(stages = []) {
    if (!stages || stages.length === 0) return DONE_TASK_STATUSES;
    const last = stages[stages.length - 1];
    const lastId = typeof last === 'string' ? last : (last?.id || '');
    if (!lastId) return DONE_TASK_STATUSES;
    const normalized = lastId.toLowerCase().trim();
    return new Set([...DONE_TASK_STATUSES, normalized]);
}

function normalizeTaskStatus(status) {
    return String(status || '').trim().toLowerCase();
}

function getCompletionCriteria({ taskTotal = 0, doneTaskTotal = 0, documentTotal = 0, memberTotal = 0 } = {}) {
    const hasTasks = taskTotal > 0;
    const allTasksDone = hasTasks && doneTaskTotal >= taskTotal;
    const hasDocuments = documentTotal > 0;
    const hasMembers = memberTotal > 0;
    const completed = hasTasks && allTasksDone && hasDocuments && hasMembers;

    return {
        completed,
        hasTasks,
        allTasksDone,
        hasDocuments,
        hasMembers,
        taskTotal,
        doneTaskTotal,
        documentTotal,
        memberTotal,
    };
}

function getLifecycleStatus(dbStatus, completionCriteria) {
    const normalized = String(dbStatus || '').trim();
    if (normalized === 'Archived') return 'Archived';
    if (normalized === 'Draft') return 'Draft';
    if (normalized === 'Active') {
        return completionCriteria?.completed ? 'Completed' : 'Active';
    }
    return completionCriteria?.completed ? 'Completed' : 'Active';
}

function getProgressPercent(dbStatus, { taskTotal = 0, doneTaskTotal = 0 } = {}) {
    if (dbStatus === 'Archived') return 100;
    if (dbStatus === 'Draft') return 0;
    if (taskTotal <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((doneTaskTotal / taskTotal) * 100)));
}

function evaluatePackageLifecycle({
    dbStatus,
    taskTotal = 0,
    doneTaskTotal = 0,
    documentTotal = 0,
    memberTotal = 0,
} = {}) {
    const completionCriteria = getCompletionCriteria({
        taskTotal,
        doneTaskTotal,
        documentTotal,
        memberTotal,
    });

    return {
        lifecycleStatus: getLifecycleStatus(dbStatus, completionCriteria),
        progress: getProgressPercent(dbStatus, { taskTotal, doneTaskTotal }),
        completionCriteria,
    };
}

function countDoneTasks(tasks = []) {
    return tasks.reduce((total, task) => {
        const status = normalizeTaskStatus(task?.status);
        return DONE_TASK_STATUSES.has(status) ? total + 1 : total;
    }, 0);
}

module.exports = {
    DONE_TASK_STATUSES,
    computeDoneStatuses,
    normalizeTaskStatus,
    getCompletionCriteria,
    getLifecycleStatus,
    getProgressPercent,
    evaluatePackageLifecycle,
    countDoneTasks,
};
