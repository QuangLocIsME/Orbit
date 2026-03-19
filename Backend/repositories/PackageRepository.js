const Package = require('../models/Package');

class PackageRepository {
    async findByProjectIdAndName(projectId, name) {
        return await Package.findOne({ projectId, name });
    }

    async create(data) {
        return await Package.create(data);
    }

    async findByPublicIdInProject(packagePublicId, projectId) {
        return await Package.findOne({ publicId: packagePublicId, projectId });
    }

    async archiveByPublicIdInProject(packagePublicId, projectId) {
        return await Package.findOneAndUpdate(
            { publicId: packagePublicId, projectId },
            { status: 'Archived', archivedAt: new Date(), updatedAt: new Date() },
            { new: true }
        );
    }

    async deleteByPublicIdInProject(packagePublicId, projectId) {
        return await Package.deleteOne({ publicId: packagePublicId, projectId });
    }

    /**
     * scope: 'active' | 'archived' | 'all'
     * - active: Draft + Active (exclude Archived)
     * - archived: only Archived
     */
    async listByProjectIdSorted(projectId, scope = 'active') {
        const filter = { projectId };
        if (scope === 'active') {
            filter.status = { $ne: 'Archived' };
        } else if (scope === 'archived') {
            filter.status = 'Archived';
        }

        const query = Package.find(filter).select('-_id -__v');

        if (scope === 'archived') {
            return await query.sort({ archivedAt: -1 });
        }
        return await query.sort({ updatedAt: -1 });
    }
}

module.exports = new PackageRepository();