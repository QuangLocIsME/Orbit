const fs = require('fs');
const path = require('path');
const { errorResponse } = require('../utils/response');
const modelService = require('../services/model.service');
const { readWorkspace, LEGACY_PROJECTS_DIR } = require('../services/navisworksStorage.service');
const selectionSetService = require('../services/selectionSet.service');
const navisworksClashService = require('../services/navisworksClash.service');
const navisworksImportService = require('../services/navisworksImport.service');
const DocumentRepository = require('../repositories/DocumentRepository');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');
const { downloadXktBuffer } = require('../services/supabaseStorageService');
const { broadcastProject } = require('../services/socketService');

const getProjectSlug = (req) => req.params?.projectSlug || req.body?.projectSlug || req.query?.projectSlug;

class NavisworksClashController {
    async listAllClashes(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const payload = await navisworksClashService.listAllClashes(projectSlug);
            return res.status(200).json({ success: true, ...payload });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list clashes');
        }
    }

    async getClashCount(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const payload = await navisworksClashService.getClashCount(projectSlug);
            return res.status(200).json({ success: true, ...payload });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to get clash count');
        }
    }

    async getWorkspace(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) {
                return errorResponse(res, 400, 'Missing project slug');
            }
            const payload = await navisworksClashService.listWorkspace(projectSlug);
            return res.status(200).json(payload);
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to load Navisworks workspace');
        }
    }

    async importModels(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) {
                return errorResponse(res, 400, 'Missing project slug');
            }
            const imports = navisworksImportService.buildImports({
                files: req.files,
                body: req.body,
            });

            const { federatedModel, skippedFiles } = await modelService.importModels(projectSlug, imports);
            return res.status(200).json({ success: true, federatedModel, skippedFiles });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to import models');
        }
    }

    async getModelXkt(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            const modelId = req.params?.modelId;
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            if (!modelId) return errorResponse(res, 400, 'Missing model id');

            const workspace = await readWorkspace(projectSlug);
            const model = (workspace.federatedModel?.models || []).find((m) => m.id === modelId);
            if (!model || model.sourceFormat !== 'xkt' || !model.xktFile) {
                return errorResponse(res, 404, 'XKT model not found');
            }
            const safeName = path.basename(String(model.xktFile));
            const filePath = path.join(LEGACY_PROJECTS_DIR, projectSlug, 'xkt', safeName);
            if (!fs.existsSync(filePath)) {
                return errorResponse(res, 404, 'XKT file missing on server');
            }
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'inline');
            return fs.createReadStream(filePath).pipe(res);
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to load XKT');
        }
    }

    async saveSelectionSet(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const selectionSet = await selectionSetService.save(projectSlug, req.body || {});
            return res.status(200).json({ success: true, selectionSet });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to save selection set');
        }
    }

    async deleteSelectionSet(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const selectionSets = await selectionSetService.remove(projectSlug, req.params?.selectionSetId);
            return res.status(200).json({ success: true, selectionSets });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to delete selection set');
        }
    }

    async saveClashTest(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const clashTest = await navisworksClashService.saveTest(projectSlug, req.body || {});
            return res.status(200).json({ success: true, clashTest });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to save clash test');
        }
    }

    async deleteClashTest(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const clashTests = await navisworksClashService.removeTest(projectSlug, req.params?.testId);
            broadcastProject(projectSlug, 'clash:updated', { projectId: projectSlug });
            return res.status(200).json({ success: true, clashTests });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to delete clash test');
        }
    }

    async runClashTest(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const payload = await navisworksClashService.runTest(
                projectSlug,
                req.params?.testId,
                req.body || {}
            );
            broadcastProject(projectSlug, 'clash:updated', { projectId: projectSlug });
            return res.status(200).json({ success: true, ...payload });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to run clash test');
        }
    }

    async getClashRun(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const payload = await navisworksClashService.getRun(
                projectSlug,
                req.params?.testId,
                req.query?.runId || null
            );
            return res.status(200).json({ success: true, ...payload });
        } catch (error) {
            return errorResponse(res, 404, error.message || 'Clash run not found');
        }
    }

    async updateClashStatus(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const actorUserId = req.user?.id || null;
            const payload = await navisworksClashService.updateClashStatus(
                projectSlug,
                req.params?.clashId,
                req.body || {},
                { actorUserId }
            );
            broadcastProject(projectSlug, 'clash:updated', { projectId: projectSlug });
            return res.status(200).json({ success: true, ...payload });
        } catch (error) {
            if (error && error.code === 'CLASH_RESOLVE_FORBIDDEN') {
                return errorResponse(res, 403, error.message || 'Forbidden');
            }
            if (error && error.code === 'CLASH_NOTE_ASSIGNEE_FORBIDDEN') {
                return errorResponse(res, 403, error.message || 'Forbidden');
            }
            return errorResponse(res, 400, error.message || 'Failed to update clash status');
        }
    }

    async applyObjectActions(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const payload = await navisworksClashService.applyObjectActions(projectSlug, req.body || {});
            return res.status(200).json({ success: true, ...payload });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to apply clash action');
        }
    }

    async exportReport(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const exported = await navisworksClashService.exportReport(
                projectSlug,
                req.params?.testId,
                req.query?.runId || null,
                req.query?.format || 'json'
            );
            res.setHeader('Content-Type', exported.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
            return res.status(200).send(exported.body);
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to export clash report');
        }
    }

    async exportBCF(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const exported = await navisworksClashService.exportBCF(
                projectSlug,
                req.params?.testId,
                req.query?.runId || null
            );
            res.setHeader('Content-Type', exported.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
            return res.status(200).send(exported.body);
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to export BCF');
        }
    }

    async exportFederatedModel(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const exported = await navisworksClashService.exportFederatedSnapshot(projectSlug);
            res.setHeader('Content-Type', exported.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
            return res.status(200).send(exported.body);
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to export federated model');
        }
    }

    /** GET /projects/:projectSlug/navisworks/documents — list IFC files in the project */
    async listIfcDocuments(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');

            const docs = await DocumentRepository.listIfcByProject(projectSlug);
            return res.status(200).json({
                success: true,
                documents: docs.map((d) => ({
                    publicId: d.publicId,
                    originalName: d.originalName,
                    folderPath: d.folderPath || '',
                    size: d.size,
                    createdAt: d.createdAt,
                })),
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list IFC documents');
        }
    }

    async listModels(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            const models = await modelService.listModels(projectSlug);
            return res.status(200).json({
                success: true,
                models: models.map((m) => ({
                    id: m.id,
                    name: m.name,
                    sourceFormat: m.sourceFormat,
                    sourceFile: m.sourceFile,
                })),
            });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to list models');
        }
    }

    /** POST /projects/:projectSlug/navisworks/models/import-from-documents */
    async importFromDocuments(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');

            const documentIds = Array.isArray(req.body?.documentIds) ? req.body.documentIds : [];
            if (documentIds.length === 0) return errorResponse(res, 400, 'documentIds is required');

            const imports = [];
            const skippedFiles = [];

            for (const docId of documentIds) {
                const doc = await DocumentRepository.findByPublicId(docId);
                if (!doc || !/\.ifc$/i.test(doc.originalName)) continue;

                // Prefer XKT already in Supabase storage — skip the IFC→XKT conversion entirely.
                if (doc.xktKey && doc.conversionStatus === 'READY') {
                    try {
                        const xktBuffer = await downloadXktBuffer(doc.xktKey);
                        imports.push({
                            buffer: xktBuffer,
                            originalName: doc.originalName.replace(/\.ifc$/i, '.xkt'),
                            sourceFormat: 'xkt',
                            sourceModel: doc.originalName.replace(/\.ifc$/i, ''),
                            fallbackIfcUrl: doc.s3Url || null,
                            fallbackOriginalName: doc.originalName,
                        });
                        console.info(`[importFromDocuments] Using existing XKT for "${doc.originalName}"`);
                        continue;
                    } catch (xktErr) {
                        console.warn(`[importFromDocuments] Failed to download existing XKT for "${doc.originalName}", falling back to IFC: ${xktErr.message}`);
                        // Fall through to IFC download below.
                    }
                }

                // No XKT available — fall back to IFC and let importModels convert it.
                if (!doc.s3Url) {
                    skippedFiles.push(doc.originalName);
                    console.warn(`[importFromDocuments] Skipping "${doc.originalName}": no download URL.`);
                    continue;
                }

                const response = await fetch(doc.s3Url);
                if (!response.ok) {
                    skippedFiles.push(doc.originalName);
                    console.warn(`[importFromDocuments] Failed to download IFC "${doc.originalName}": ${response.status}`);
                    continue;
                }
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                imports.push({
                    buffer,
                    originalName: doc.originalName,
                    sourceFormat: 'ifc',
                    sourceModel: doc.originalName.replace(/\.ifc$/i, ''),
                });
            }

            if (imports.length === 0) {
                return errorResponse(res, 400, `No valid documents found (${skippedFiles.length > 0 ? skippedFiles.join(', ') : 'no matching IFC files'})`);
            }

            const { federatedModel, skippedFiles: convertedSkipped } = await modelService.importModels(projectSlug, imports);
            return res.status(200).json({ success: true, federatedModel, skippedFiles: [...skippedFiles, ...convertedSkipped] });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to import from documents');
        }
    }

    /** DELETE /projects/:projectSlug/navisworks/models */
    async clearModels(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');
            await modelService.clearModels(projectSlug);
            return res.status(200).json({ success: true });
        } catch (error) {
            return errorResponse(res, 500, error.message || 'Failed to clear models');
        }
    }
}

module.exports = new NavisworksClashController();
