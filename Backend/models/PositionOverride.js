const mongoose = require('mongoose');

const ObjectOverrideSchema = new mongoose.Schema(
    {
        id:       { type: String, required: true },
        position: { type: [Number], required: true, validate: (v) => v.length === 3 },
    },
    { _id: false }
);

const PositionOverrideSchema = new mongoose.Schema({
    projectSlug: { type: String, required: true, index: true },
    clashId:     { type: String, required: true, index: true },
    objects:     { type: [ObjectOverrideSchema], default: [] },
    savedAt:     { type: Date, default: Date.now },
});

PositionOverrideSchema.index({ projectSlug: 1, clashId: 1 }, { unique: true });

module.exports = mongoose.model('PositionOverride', PositionOverrideSchema);
