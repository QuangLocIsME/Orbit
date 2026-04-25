const Activity = require('../models/Activity');
const User = require('../models/User');

const ActivityService = {
    async log({ projectId, packageId = null, userId, type, targetId = null, targetName = '', metadata = {} }) {
        const user = userId
            ? await User.findById(userId).select('_id fullName email').lean()
            : null;

        const activity = await Activity.create({
            projectId,
            packageId,
            userId: userId || '',
            userName: user?.fullName || user?.email || 'System',
            type,
            targetId,
            targetName,
            metadata,
            createdAt: new Date(),
        });

        return activity;
    },
};

module.exports = ActivityService;
