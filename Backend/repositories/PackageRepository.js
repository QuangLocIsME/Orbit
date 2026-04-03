const Package = require('../models/Package');

class PackageRepository {
    async findByProjectIdAndName(projectId, name) {
        return await Package.findOne({ projectId, name });
    }

    async listByProjectAndMember(projectId, userId, scope = 'active') {
        const filter = { projectId };
        if (scope === 'active') {
            filter.status = { $ne: 'Archived' };
        } else if (scope === 'archived') {
            filter.status = 'Archived';
        }

        if (userId) {
            filter.$or = [
                { creatorId: userId },
                { teamMemberIds: userId },
            ];
        }

        const query = Package.find(filter).select('-_id -__v');
        if (scope === 'archived') return await query.sort({ archivedAt: -1 });
        return await query.sort({ updatedAt: -1 });
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

    async updateByPublicIdInProject(packagePublicId, projectId, updateFields) {
        return await Package.findOneAndUpdate(
            { publicId: packagePublicId, projectId },
            { ...updateFields, updatedAt: new Date() },
            { new: true }
        );
    }

    async addDocumentIdToPackage(packagePublicId, projectId, documentPublicId) {
        await Package.updateOne(
            { publicId: packagePublicId, projectId },
            {
                $addToSet: { documentIds: documentPublicId },
                $set: { updatedAt: new Date() },
            }
        );
    }

    /** Trùng tên với package khác trong cùng project (dùng khi đổi tên) */
    async findAnotherByProjectIdAndName(projectId, name, excludePublicId) {
        return await Package.findOne({
            projectId,
            name,
            publicId: { $ne: excludePublicId },
        });
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