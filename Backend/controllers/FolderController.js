const Folder = require('../models/Folder');
const { getJson, setJson, delKeys } = require('../services/cacheService');
const { normalizeString } = require('../utils/sanitize');
const { errorResponse } = require('../utils/response');

const badRequest = (res, message) => errorResponse(res, 400, message);
const unauthorized = (res) => errorResponse(res, 401, 'Unauthorized');
const notFound = (res, message) => errorResponse(res, 404, message);
const conflict = (res, message) => errorResponse(res, 409, message);

const requireUserId = (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        unauthorized(res);
        return null;
    }
    return userId;
};

const getFoldersCacheKey = (userId) => `folders:me:${userId}`;
const getProjectsCacheKey = (userId) => `projects:me:${userId}`;
const invalidateUserCaches = async (userId) => {
    await delKeys([getFoldersCacheKey(userId), getProjectsCacheKey(userId)]);
};

class FolderController {
    async createFolder(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const name = normalizeString(req.body?.name);
            const description = normalizeString(req.body?.description);
            const color = normalizeString(req.body?.color) || 'blue';

            if (!name) {
                return badRequest(res, 'Folder name is required');
            }

            const existed = await Folder.findOne({ ownerId: userId, name });
            if (existed) {
                return conflict(res, 'Folder name already exists');
            }

            const folder = await Folder.create({
                ownerId: userId,
                name,
                description,
                color,
                updatedAt: new Date(),
            });

            await invalidateUserCaches(userId);

            return res.status(201).json({
                success: true,
                message: 'Folder created',
                data: {
                    publicId: folder.publicId,
                    name: folder.name,
                    description: folder.description,
                    color: folder.color,
                    sortOrder: folder.sortOrder,
                    createdAt: folder.createdAt,
                },
            });
        } catch (error) {
            return badRequest(res, 'Create folder failed');
        }
    }

    async getMyFolders(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const cacheKey = getFoldersCacheKey(userId);
            const cachedData = await getJson(cacheKey);
            if (cachedData) {
                return res.status(200).json({
                    success: true,
                    data: cachedData,
                    cached: true,
                });
            }

            const folders = await Folder.find({ ownerId: userId })
                .sort({ sortOrder: 1, createdAt: 1 })
                .select('-_id publicId name description color sortOrder createdAt updatedAt');

            await setJson(cacheKey, folders, 60);

            return res.status(200).json({
                success: true,
                data: folders,
            });
        } catch (error) {
            return badRequest(res, 'Load folders failed');
        }
    }

    async updateFolder(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const folderId = normalizeString(req.body?.folderId);
            if (!folderId) {
                return badRequest(res, 'Missing folderId');
            }

            const updates = { updatedAt: new Date() };
            if (req.body?.name !== undefined) {
                const name = normalizeString(req.body?.name);
                if (!name) return badRequest(res, 'Folder name is required');

                const duplicate = await Folder.findOne({ ownerId: userId, name, publicId: { $ne: folderId } });
                if (duplicate) {
                    return conflict(res, 'Folder name already exists');
                }
                updates.name = name;
            }

            if (req.body?.description !== undefined) {
                updates.description = normalizeString(req.body?.description);
            }

            if (req.body?.color !== undefined) {
                updates.color = normalizeString(req.body?.color) || 'blue';
            }

            if (req.body?.sortOrder !== undefined) {
                updates.sortOrder = Number(req.body.sortOrder) || 0;
            }

            const folder = await Folder.findOneAndUpdate(
                { publicId: folderId, ownerId: userId },
                updates,
                { returnDocument: 'after' }
            );

            if (!folder) {
                return notFound(res, 'Folder not found');
            }

            await invalidateUserCaches(userId);

            return res.status(200).json({
                success: true,
                message: 'Folder updated',
                data: {
                    publicId: folder.publicId,
                    name: folder.name,
                    description: folder.description,
                    color: folder.color,
                    sortOrder: folder.sortOrder,
                    createdAt: folder.createdAt,
                },
            });
        } catch (error) {
            return badRequest(res, 'Update folder failed');
        }
    }

    async deleteFolder(req, res) {
        try {
            const userId = requireUserId(req, res);
            if (!userId) return;

            const folderId = normalizeString(req.params?.id || req.body?.folderId);
            if (!folderId) {
                return badRequest(res, 'Missing folderId');
            }

            const folder = await Folder.findOneAndDelete({ publicId: folderId, ownerId: userId });
            if (!folder) {
                return notFound(res, 'Folder not found');
            }

            await invalidateUserCaches(userId);

            return res.status(200).json({
                success: true,
                message: 'Folder deleted',
            });
        } catch (error) {
            return badRequest(res, 'Delete folder failed');
        }
    }
}

module.exports = new FolderController();
