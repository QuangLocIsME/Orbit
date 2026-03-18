const Package = require('../models/Package');

class PackageRepository {
    async findByProjectIdAndName(projectId, name) {
        return await Package.findOne({ projectId, name });
    }

    async create(data) {
        return await Package.create(data);
    }

    /**
     * scope: 'active' | 'archived' | 'all'
     * active = Draft + Active (trang package chính)
     * archived = Archived (trang archive)
     */
    async findByProjectIdSorted(projectId, scope = 'active') {
        const filter = { projectId };
        if (scope === 'active') {
            filter.status = { $ne: 'Archived' };
        } else if (scope === 'archived') {
            filter.status = 'Archived';
        }
        return await Package.find(filter)
            .select('-_id -__v')
            .sort({ updatedAt: -1 });
    }

    async findByPublicIdInProject(packagePublicId, projectId) {
        return await Package.findOne({ publicId: packagePublicId, projectId });
    }

    async updateByPublicIdInProject(packagePublicId, projectId, update) {
        return await Package.findOneAndUpdate(
            { publicId: packagePublicId, projectId },
            { ...update, updatedAt: new Date() },
            { new: true }
        );
    }

    async deleteByPublicIdInProject(packagePublicId, projectId) {
        return await Package.deleteOne({ publicId: packagePublicId, projectId });
    }
}

module.exports = new PackageRepository();
