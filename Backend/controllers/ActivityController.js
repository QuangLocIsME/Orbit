const ChangeRequest = require('../models/ChangeRequest');
const Document = require('../models/Document');
const User = require('../models/User');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const { errorResponse } = require('../utils/response');

class ActivityController {
    /**
     * GET /projects/:projectSlug/activities
     * Returns merged recent activity from ChangeRequests + Documents, newest first.
     */
    async listByProject(req, res) {
        try {
            const projectId = req.params?.projectSlug;
            if (!projectId) return errorResponse(res, 400, 'Missing projectId');

            const userId = req.user?.id;
            if (!userId) return errorResponse(res, 401, 'Unauthorized');

            const member = await ProjectMemberRepository.findMember(projectId, userId);
            if (!member) return errorResponse(res, 403, 'Forbidden');

            const LIMIT = 5;
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days

            // Fetch recent change requests and documents in parallel
            const [changeRequests, documents] = await Promise.all([
                ChangeRequest.find({ projectId, createdAt: { $gte: since } })
                    .sort({ createdAt: -1 })
                    .limit(LIMIT)
                    .lean(),
                Document.find({ projectId, createdAt: { $gte: since } })
                    .sort({ createdAt: -1 })
                    .limit(LIMIT)
                    .lean(),
            ]);

            // Collect unique user publicIds to resolve names
            const userIds = new Set([
                ...changeRequests.map(cr => cr.createdBy),
                ...documents.map(d => d.uploadedBy),
            ].filter(Boolean));

            let userMap = {};
            if (userIds.size > 0) {
                const mongoose = require('mongoose');
                // createdBy / uploadedBy stores MongoDB _id string
                const validIds = [...userIds].filter(id => {
                    try { return mongoose.Types.ObjectId.isValid(id); } catch { return false; }
                });
                if (validIds.length > 0) {
                    const users = await User.find(
                        { _id: { $in: validIds } },
                        { _id: 1, fullName: 1 }
                    ).lean();
                    userMap = Object.fromEntries(users.map(u => [u._id.toString(), u.fullName]));
                }
            }

            const activities = [];

            for (const cr of changeRequests) {
                const userName = userMap[cr.createdBy] || 'Unknown';
                activities.push({
                    id: `cr-${cr.publicId}`,
                    type: 'change_request',
                    icon: 'edit',
                    color: 'bg-purple-100 text-purple-600',
                    action: `Change request "${cr.title}" submitted`,
                    user: userName,
                    createdAt: cr.createdAt,
                });
            }

            for (const doc of documents) {
                const userName = userMap[doc.uploadedBy] || 'Unknown';
                activities.push({
                    id: `doc-${doc.publicId}`,
                    type: 'document',
                    icon: 'upload',
                    color: 'bg-blue-100 text-blue-600',
                    action: `"${doc.originalName}" uploaded`,
                    user: userName,
                    createdAt: doc.createdAt,
                });
            }

            // Sort merged list newest first, take top 8
            activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const top = activities.slice(0, 8);

            return res.status(200).json({
                success: true,
                data: top,
                lastActivity: top[0]?.createdAt || null,
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to fetch activities');
        }
    }
}

module.exports = new ActivityController();
