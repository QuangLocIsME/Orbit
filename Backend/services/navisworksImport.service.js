const parseImportMeta = (raw) => {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const toFileImportEntries = (files, importsMeta) =>
    files.map((file, index) => ({
        buffer: file.buffer,
        originalName: file.originalname,
        sourceFormat: file.originalname.split('.').pop(),
        ...(importsMeta[index] || {}),
    }));

const toInlineImportEntries = (inlineModels) =>
    inlineModels.map((model, index) => ({
        buffer: Buffer.from(JSON.stringify(model.objects || model), 'utf8'),
        originalName: model.name || `inline-model-${index + 1}.json`,
        sourceFormat: model.sourceFormat || 'json',
        sourceModel: model.name || `Inline Model ${index + 1}`,
        discipline: model.discipline,
        unit: model.unit,
        transform: model.transform,
    }));

const buildImports = ({ files = [], body = {} } = {}) => {
    const normalizedFiles = Array.isArray(files) ? files : [];
    const importsMeta = parseImportMeta(body?.importsMeta);
    const inlineModels = Array.isArray(body?.models) ? body.models : [];

    return [
        ...toFileImportEntries(normalizedFiles, importsMeta),
        ...toInlineImportEntries(inlineModels),
    ];
};

module.exports = {
    buildImports,
};

