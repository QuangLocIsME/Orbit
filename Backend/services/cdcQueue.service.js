const pendingJobs = new Map();

function makeKey(job) {
    return [
        job.target || 'project',
        job.projectId || '',
        job.userId || '',
        job.scope || '',
        job.blockId || '',
    ].join(':');
}

function enqueueCdcJob(job, worker, options = {}) {
    const debounceMs = Number(options.debounceMs) || 150;
    const key = makeKey(job);

    const existing = pendingJobs.get(key);
    if (existing?.timer) {
        clearTimeout(existing.timer);
    }

    const timer = setTimeout(async () => {
        pendingJobs.delete(key);
        try {
            await worker(job);
        } catch (error) {
            console.error('[CDCQueue] job failed:', error?.message || error);
        }
    }, debounceMs);

    pendingJobs.set(key, { job, timer });
}

module.exports = {
    enqueueCdcJob,
};
