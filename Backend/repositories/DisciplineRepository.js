const Discipline = require('../models/Discipline');

class DisciplineRepository {
    async create(data) {
        const discipline = new Discipline(data);
        return await discipline.save();
    }

    async findById(id) {
        return await Discipline.findById(id);
    }

    async findByPublicId(projectId, publicId) {
        const query = { publicId };
        if (projectId) query.projectId = projectId;
        return await Discipline.findOne(query);
    }

    async listByProject(projectId) {
        return await Discipline.find({ projectId })
            .sort({ createdAt: 1 })
            .lean();
    }

    async update(publicId, updates) {
        return await Discipline.findOneAndUpdate(
            { publicId },
            { ...updates, updatedAt: new Date() },
            { returnDocument: 'after' }
        );
    }

    async delete(publicId) {
        return await Discipline.deleteOne({ publicId });
    }

    async countByProject(projectId) {
        return await Discipline.countDocuments({ projectId });
    }

    async existsByName(projectId, name, excludePublicId = null) {
        const query = { projectId, name: { $regex: `^${name}$`, $options: 'i' } };
        if (excludePublicId) {
            query.publicId = { $ne: excludePublicId };
        }
        return await Discipline.findOne(query);
    }
}

module.exports = new DisciplineRepository();
