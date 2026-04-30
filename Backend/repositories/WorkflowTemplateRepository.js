const WorkflowTemplate = require('../models/WorkflowTemplate');
const UserDownloadedTemplate = require('../models/UserDownloadedTemplate');

class WorkflowTemplateRepository {
    // Create new workflow template
    async create(data) {
        const template = new WorkflowTemplate({
            name: data.name,
            description: data.description,
            category: data.category || 'Other',
            tags: data.tags || [],
            stages: data.stages,
            authorId: data.authorId,
            authorName: data.authorName,
            isPrivate: data.isPrivate || false,
            downloads: 0,
            rating: 0,
        });
        return await template.save();
    }

    // Find by publicId
    async findByPublicId(publicId) {
        return await WorkflowTemplate.findOne({ publicId });
    }

    // Find all templates (with pagination)
    async findAll({ page = 1, limit = 20, search, tags, category, sortBy = 'popular' } = {}) {
        const query = { isPrivate: false };

        // Search by name/description
        if (search) {
            query.$text = { $search: search };
        }

        // Filter by tags
        if (tags && tags.length > 0) {
            query.tags = { $all: tags };
        }

        // Filter by category
        if (category) {
            query.category = category;
        }

        // Sort options
        let sort = {};
        switch (sortBy) {
            case 'popular':
                sort = { downloads: -1 };
                break;
            case 'rating':
                sort = { rating: -1 };
                break;
            case 'recent':
                sort = { createdAt: -1 };
                break;
            default:
                sort = { downloads: -1 };
        }

        const skip = (page - 1) * limit;

        const [templates, total] = await Promise.all([
            WorkflowTemplate.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            WorkflowTemplate.countDocuments(query),
        ]);

        return {
            templates,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // Find templates by author
    async findByAuthor(authorId, { page = 1, limit = 20 } = {}) {
        const skip = (page - 1) * limit;

        const [templates, total] = await Promise.all([
            WorkflowTemplate.find({ authorId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            WorkflowTemplate.countDocuments({ authorId }),
        ]);

        return {
            templates,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // Get original template's downloads (for copied templates)
    async getOriginalDownloads(sourcePublicId) {
        const sourceTemplate = await WorkflowTemplate.findOne({ publicId: sourcePublicId }).lean();
        return sourceTemplate ? sourceTemplate.downloads : 0;
    }

    // Find user's templates (created by user, excluding copies)
    async findUserTemplates(authorId, { page = 1, limit = 20 } = {}) {
        const skip = (page - 1) * limit;

        // Only return templates that user CREATED (sourcePublicId is null means it's original)
    // Templates that user copied have sourcePublicId set to the source template's publicId
    const query = {
        authorId,
        $or: [
            { sourcePublicId: { $exists: false } },
            { sourcePublicId: null }
        ]
    };

        const [templates, total] = await Promise.all([
            WorkflowTemplate.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            WorkflowTemplate.countDocuments(query),
        ]);

        return {
            templates,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // Find templates that user has downloaded (copied from others)
    async findDownloadedTemplates(userId, { page = 1, limit = 20 } = {}) {
        const skip = (page - 1) * limit;

        // Get all downloaded template publicIds
        const downloadedRecords = await UserDownloadedTemplate.find({ userId }).lean();
        const downloadedIds = downloadedRecords.map(r => r.publicId);

        if (downloadedIds.length === 0) {
            return {
                templates: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
            };
        }

        // Include user's private copies that are downloaded from others
        // These are marked as isDownloadedCopy: true
        const [templates, total] = await Promise.all([
            WorkflowTemplate.find({ publicId: { $in: downloadedIds } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            WorkflowTemplate.countDocuments({ publicId: { $in: downloadedIds } }),
        ]);

        // Mark all as downloaded copies
        const templatesWithFlag = templates.map(t => ({
            ...t,
            isOwn: false,
            isDownloadedCopy: true,
        }));

        return {
            templates: templatesWithFlag,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // Update template
    async update(publicId, data) {
        const updateData = {};
        
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.tags !== undefined) updateData.tags = data.tags;
        if (data.stages !== undefined) updateData.stages = data.stages;
        if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;
        if (data.downloads !== undefined) updateData.downloads = data.downloads;
        if (data.rating !== undefined) updateData.rating = data.rating;

        updateData.updatedAt = new Date();

        return await WorkflowTemplate.findOneAndUpdate(
            { publicId },
            updateData,
            { returnDocument: 'after', runValidators: true }
        );
    }

    // Delete template
    async delete(publicId, authorId) {
        const result = await WorkflowTemplate.findOneAndDelete({ publicId, authorId });
        return result;
    }

    // Increment downloads
    async incrementDownloads(publicId) {
        return await WorkflowTemplate.findOneAndUpdate(
            { publicId },
            { $inc: { downloads: 1 } },
            { returnDocument: 'after' }
        );
    }

    // Check if user has downloaded a template
    async hasUserDownloaded(userId, publicId) {
        const record = await UserDownloadedTemplate.findOne({ userId, publicId });
        return !!record;
    }

    // Get all template publicIds that a user has downloaded
    async getDownloadedTemplateIds(userId) {
        const records = await UserDownloadedTemplate.find({ userId }).lean();
        return records.map(r => r.publicId);
    }

    // Mark template as downloaded by user
    async markAsDownloaded(userId, publicId, templateId) {
        try {
            const record = new UserDownloadedTemplate({
                userId,
                publicId,
                templateId,
                downloadedAt: new Date(),
            });
            await record.save();
            return true;
        } catch (err) {
            // Already downloaded - unique constraint violation
            if (err.code === 11000) {
                return false;
            }
            throw err;
        }
    }

    // Update rating
    async updateRating(publicId, newRating) {
        const template = await WorkflowTemplate.findOne({ publicId });
        if (!template) return null;

        // Calculate new average rating
        const currentTotal = template.rating * template.downloads;
        const newDownloads = template.downloads + 1;
        const avgRating = (currentTotal + newRating) / newDownloads;

        return await WorkflowTemplate.findOneAndUpdate(
            { publicId },
            {
                $set: { rating: Math.round(avgRating * 10) / 10 },
                $inc: { downloads: 1 },
            },
            { returnDocument: 'after' }
        );
    }

    // Get all unique tags
    async getAllTags() {
        const tags = await WorkflowTemplate.aggregate([
            { $match: { isPrivate: false } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
        ]);
        return tags.map(t => t._id);
    }

    // Get all unique categories
    async getAllCategories() {
        return await WorkflowTemplate.distinct('category', { isPrivate: false });
    }
}

module.exports = new WorkflowTemplateRepository();
