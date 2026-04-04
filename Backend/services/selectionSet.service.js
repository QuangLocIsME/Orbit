const { createId, readWorkspace, updateWorkspace } = require('./navisworksStorage.service');
const modelService = require('./model.service');

const sanitizeArray = (value) => Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)))
    : [];

const normalizeSelectionSet = (payload = {}) => ({
    id: payload.id || createId('selection-set'),
    name: String(payload.name || 'Untitled Selection Set').trim(),
    description: String(payload.description || '').trim(),
    filters: {
        modelIds: sanitizeArray(payload.filters?.modelIds || payload.modelIds),
        types: sanitizeArray(payload.filters?.types || payload.types),
        categories: sanitizeArray(payload.filters?.categories || payload.categories),
    },
    manualIncludeIds: sanitizeArray(payload.manualIncludeIds),
    manualExcludeIds: sanitizeArray(payload.manualExcludeIds),
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});

class SelectionSetService {
    async list(projectSlug) {
        const workspace = await readWorkspace(projectSlug);
        return workspace.selectionSets;
    }

    async save(projectSlug, payload) {
        const nextSelectionSet = normalizeSelectionSet(payload);
        const workspace = await updateWorkspace(projectSlug, (current) => {
            const existing = current.selectionSets.filter((item) => item.id !== nextSelectionSet.id);
            return {
                ...current,
                selectionSets: [...existing, nextSelectionSet].sort((a, b) => a.name.localeCompare(b.name)),
            };
        });

        return workspace.selectionSets.find((item) => item.id === nextSelectionSet.id);
    }

    async remove(projectSlug, selectionSetId) {
        const workspace = await updateWorkspace(projectSlug, (current) => ({
            ...current,
            selectionSets: current.selectionSets.filter((item) => item.id !== selectionSetId),
            clashTests: current.clashTests.filter(
                (test) => test.setAId !== selectionSetId && test.setBId !== selectionSetId
            ),
        }));

        return workspace.selectionSets;
    }

    async resolveObjectIds(projectSlug, selectionSetId, federatedModelOverride = null) {
        const workspace = await readWorkspace(projectSlug);
        const selectionSet = workspace.selectionSets.find((item) => item.id === selectionSetId);
        if (!selectionSet) {
            throw new Error(`Selection set not found: ${selectionSetId}`);
        }

        const federatedModel =
            federatedModelOverride || (await modelService.getFederatedModel(projectSlug, workspace));
        const objectIds = federatedModel.objects
            .filter((object) => !object.hidden)
            .filter((object) => {
                const { modelIds, types, categories } = selectionSet.filters;
                if (modelIds.length > 0 && !modelIds.includes(object.sourceModelId)) return false;
                if (types.length > 0 && !types.includes(object.type)) return false;
                if (categories.length > 0 && !categories.includes(object.category)) return false;
                return true;
            })
            .map((object) => object.id);

        const included = new Set([...objectIds, ...selectionSet.manualIncludeIds]);
        selectionSet.manualExcludeIds.forEach((id) => included.delete(id));
        return Array.from(included);
    }
}

module.exports = new SelectionSetService();
