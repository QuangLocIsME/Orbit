const User = require('../models/User');

function normalizeName(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function resolveUserDisplayName(userId, fallback = 'Someone') {
    const normalizedUserId = normalizeName(userId);
    if (!normalizedUserId) return fallback;

    let user = null;
    if (/^[a-f\d]{24}$/i.test(normalizedUserId)) {
        user = await User.findById(normalizedUserId).select('fullName email publicId').lean();
    }

    if (!user) {
        user = await User.findOne({ publicId: normalizedUserId }).select('fullName email publicId').lean();
    }

    return normalizeName(user?.fullName) || normalizeName(user?.email) || fallback;
}

module.exports = {
    resolveUserDisplayName,
};
