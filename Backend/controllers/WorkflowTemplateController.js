const repository = require('../repositories/WorkflowTemplateRepository');

const success = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data,
        message,
    });
};

const error = (res, message = 'Error', statusCode = 500) => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};

class WorkflowTemplateController {
    // Get all public templates (library)
    async getAll(req, res) {
        try {
            const { page = 1, limit = 20, search, tags, category, sort } = req.query;
            const userId = req.user?.id;

            const result = await repository.findAll({
                page: parseInt(page),
                limit: parseInt(limit),
                search,
                tags: tags ? tags.split(',') : [],
                category,
                sortBy: sort || 'popular',
            });

            // Nếu user đã đăng nhập, lấy danh sách template đã tải
            if (userId) {
                const downloadedIds = await repository.getDownloadedTemplateIds(userId);
                // Thêm field isDownloaded vào mỗi template
                result.templates = result.templates.map(template => ({
                    ...template,
                    isDownloaded: downloadedIds.includes(template.publicId),
                }));
            } else {
                // Guest user - tất cả đều chưa tải
                result.templates = result.templates.map(template => ({
                    ...template,
                    isDownloaded: false,
                }));
            }

            return success(res, result, 'Templates retrieved successfully');
        } catch (err) {
            console.error('Error getting templates:', err);
            return error(res, 'Failed to retrieve templates', 500);
        }
    }

    // Get user's own templates
    async getMyTemplates(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const authorId = req.user?.id;

            if (!authorId) {
                return error(res, 'User not authenticated', 401);
            }

            const result = await repository.findUserTemplates(authorId, {
                page: parseInt(page),
                limit: parseInt(limit),
            });

            return success(res, result, 'My templates retrieved successfully');
        } catch (err) {
            console.error('Error getting my templates:', err);
            return error(res, 'Failed to retrieve templates', 500);
        }
    }

    // Get templates that user has downloaded (copied from others)
    async getDownloadedTemplates(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const userId = req.user?.id;

            if (!userId) {
                return error(res, 'User not authenticated', 401);
            }

            const result = await repository.findDownloadedTemplates(userId, {
                page: parseInt(page),
                limit: parseInt(limit),
            });

            return success(res, result, 'Downloaded templates retrieved successfully');
        } catch (err) {
            console.error('Error getting downloaded templates:', err);
            return error(res, 'Failed to retrieve templates', 500);
        }
    }

    // Get single template by ID
    async getById(req, res) {
        try {
            const { publicId } = req.params;

            const template = await repository.findByPublicId(publicId);

            if (!template) {
                return error(res, 'Template not found', 404);
            }

            // Check access: public templates or own templates
            if (template.isPrivate && template.authorId !== req.user?.id) {
                return error(res, 'Template not found', 404);
            }

            return success(res, template, 'Template retrieved successfully');
        } catch (err) {
            console.error('Error getting template:', err);
            return error(res, 'Failed to retrieve template', 500);
        }
    }

    // Create new template
    async create(req, res) {
        try {
            const { name, description, category, tags, stages, isPrivate } = req.body;

            // Validation
            if (!name || !name.trim()) {
                return error(res, 'Template name is required', 400);
            }
            if (!stages || !Array.isArray(stages) || stages.length === 0) {
                return error(res, 'At least one stage is required', 400);
            }

            // Validate stages
            for (const stage of stages) {
                if (!stage.name || !stage.name.trim()) {
                    return error(res, 'Stage name is required', 400);
                }
            }

            const authorId = req.user?.id;
            if (!authorId) {
                return error(res, 'User not authenticated', 401);
            }

            const template = await repository.create({
                name: name.trim(),
                description: description?.trim() || '',
                category,
                tags: tags || [],
                stages: stages.map((s, i) => ({
                    id: s.id || `stage-${i + 1}`,
                    name: s.name.trim(),
                    description: s.description?.trim() || '',
                    color: s.color || 'gray',
                })),
                authorId,
                authorName: req.user?.email || 'Anonymous',
                isPrivate: isPrivate || false,
            });

            return success(res, template, 'Template created successfully', 201);
        } catch (err) {
            console.error('Error creating template:', err);
            return error(res, 'Failed to create template', 500);
        }
    }

    // Copy template to user's templates
    async copyTemplate(req, res) {
        try {
            const { publicId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return error(res, 'User not authenticated', 401);
            }

            // Find the source template
            const sourceTemplate = await repository.findByPublicId(publicId);

            if (!sourceTemplate) {
                return error(res, 'Template not found', 404);
            }

            // Check access: public templates or own templates
            if (sourceTemplate.isPrivate && sourceTemplate.authorId !== userId) {
                return error(res, 'Template not found', 404);
            }

            // Check if user already has this template (by checking name + same stages pattern)
            const existingTemplates = await repository.findUserTemplates(userId);
            const isAlreadyCopied = existingTemplates.templates.some(t => 
                t.name === sourceTemplate.name && 
                JSON.stringify(t.stages) === JSON.stringify(sourceTemplate.stages)
            );

            if (isAlreadyCopied) {
                return error(res, 'Template already exists in your templates', 400);
            }

            // Increment download count on source template
            await repository.incrementDownloads(publicId);

            // Get the updated downloads count from source template
            const updatedSource = await repository.findByPublicId(publicId);
            const originalDownloads = updatedSource.downloads;

            // Create a copy for the user
            // Giữ nguyên author của người tạo gốc để hiển thị
            // Lưu sourcePublicId để track đây là bản copy
            const copiedTemplate = await repository.create({
                name: sourceTemplate.name,
                description: sourceTemplate.description,
                category: sourceTemplate.category,
                tags: sourceTemplate.tags,
                stages: sourceTemplate.stages.map((s, i) => ({
                    id: `stage-${i + 1}`,
                    name: s.name,
                    description: s.description || '',
                    color: s.color || 'gray',
                })),
                authorId: userId,
                authorName: sourceTemplate.authorName, // Giữ nguyên author gốc để hiển thị
                isPrivate: true, // Copied templates are private by default - only in My Templates
                sourcePublicId: publicId, // Track nguồn gốc để identify là bản copy
            });

            // Thêm originalDownloads vào template trả về
            copiedTemplate.originalDownloads = originalDownloads;

            // Mark as downloaded
            await repository.markAsDownloaded(userId, publicId, updatedSource._id);

            return success(res, copiedTemplate, 'Template copied successfully', 201);
        } catch (err) {
            console.error('Error copying template:', err);
            return error(res, 'Failed to copy template', 500);
        }
    }

    // Update template
    async update(req, res) {
        try {
            const { publicId } = req.params;
            const { name, description, category, tags, stages, isPrivate } = req.body;

            const authorId = req.user?.id;
            if (!authorId) {
                return error(res, 'User not authenticated', 401);
            }

            // Check if template exists and belongs to user
            const existing = await repository.findByPublicId(publicId);
            if (!existing) {
                return error(res, 'Template not found', 404);
            }
            if (existing.authorId !== authorId) {
                return error(res, 'Unauthorized', 403);
            }

            // Validate stages if provided
            if (stages) {
                if (!Array.isArray(stages) || stages.length === 0) {
                    return error(res, 'At least one stage is required', 400);
                }
                for (const stage of stages) {
                    if (!stage.name || !stage.name.trim()) {
                        return error(res, 'Stage name is required', 400);
                    }
                }
            }

            const updated = await repository.update(publicId, {
                name: name?.trim(),
                description: description?.trim(),
                category,
                tags,
                stages: stages?.map((s, i) => ({
                    id: s.id || `stage-${i + 1}`,
                    name: s.name.trim(),
                    description: s.description?.trim() || '',
                    color: s.color || 'gray',
                })),
                isPrivate,
            });

            return success(res, updated, 'Template updated successfully');
        } catch (err) {
            console.error('Error updating template:', err);
            return error(res, 'Failed to update template', 500);
        }
    }

    // Delete template
    async delete(req, res) {
        try {
            const { publicId } = req.params;

            const authorId = req.user?.id;
            if (!authorId) {
                return error(res, 'User not authenticated', 401);
            }

            // Check if template exists and belongs to user
            const existing = await repository.findByPublicId(publicId);
            if (!existing) {
                return error(res, 'Template not found', 404);
            }
            if (existing.authorId !== authorId) {
                return error(res, 'Unauthorized', 403);
            }

            await repository.delete(publicId, authorId);

            return success(res, null, 'Template deleted successfully');
        } catch (err) {
            console.error('Error deleting template:', err);
            return error(res, 'Failed to delete template', 500);
        }
    }

    // Use template (increment downloads)
    async useTemplate(req, res) {
        try {
            const { publicId } = req.params;
            const { rating } = req.body;
            const userId = req.user?.id;

            const template = await repository.findByPublicId(publicId);

            if (!template) {
                return error(res, 'Template not found', 404);
            }

            // Check access
            if (template.isPrivate && template.authorId !== req.user?.id) {
                return error(res, 'Template not found', 404);
            }

            let updated;
            if (rating && rating >= 1 && rating <= 5) {
                updated = await repository.updateRating(publicId, rating);
            } else {
                updated = await repository.incrementDownloads(publicId);
            }

            // Nếu có user đăng nhập, đánh dấu đã tải
            if (userId) {
                await repository.markAsDownloaded(userId, publicId, template._id);
            }

            return success(res, updated, 'Template used successfully');
        } catch (err) {
            console.error('Error using template:', err);
            return error(res, 'Failed to use template', 500);
        }
    }

    // Get all tags
    async getTags(req, res) {
        try {
            const tags = await repository.getAllTags();
            return success(res, tags, 'Tags retrieved successfully');
        } catch (err) {
            console.error('Error getting tags:', err);
            return error(res, 'Failed to retrieve tags', 500);
        }
    }

    // Get all categories
    async getCategories(req, res) {
        try {
            const categories = await repository.getAllCategories();
            return success(res, categories, 'Categories retrieved successfully');
        } catch (err) {
            console.error('Error getting categories:', err);
            return error(res, 'Failed to retrieve categories', 500);
        }
    }
}

module.exports = new WorkflowTemplateController();
