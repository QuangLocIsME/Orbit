const WorkflowTemplate = require('../models/WorkflowTemplate');

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

    // Find user's templates (including private)
    async findUserTemplates(authorId, { page = 1, limit = 20 } = {}) {
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
            { new: true, runValidators: true }
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
            { new: true }
        );
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
            { new: true }
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
