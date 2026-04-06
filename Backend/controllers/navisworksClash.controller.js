const { errorResponse } = require('../utils/response');
const modelService = require('../services/model.service');
const selectionSetService = require('../services/selectionSet.service');
const navisworksClashService = require('../services/navisworksClash.service');
const navisworksImportService = require('../services/navisworksImport.service');
const DocumentRepository = require('../repositories/DocumentRepository');
const { s3Client } = require('../config/s3');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const ProjectMemberRepository = require('../repositories/ProjectMemberRepository');

const getProjectSlug = (req) => req.params?.projectSlug || req.body?.projectSlug || req.query?.projectSlug;

class NavisworksClashController {
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
            const payload = await navisworksClashService.updateClashStatus(
                projectSlug,
                req.params?.clashId,
                req.body || {}
            );
            return res.status(200).json({ success: true, ...payload });
        } catch (error) {
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

    /** POST /projects/:projectSlug/navisworks/models/import-from-documents */
    async importFromDocuments(req, res) {
        try {
            const projectSlug = getProjectSlug(req);
            if (!projectSlug) return errorResponse(res, 400, 'Missing project slug');

            const documentIds = Array.isArray(req.body?.documentIds) ? req.body.documentIds : [];
            if (documentIds.length === 0) return errorResponse(res, 400, 'documentIds is required');

            const imports = [];
            for (const docId of documentIds) {
                const doc = await DocumentRepository.findByPublicId(docId);
                if (!doc || !/\.ifc$/i.test(doc.originalName)) continue;

                const s3Res = await s3Client.send(new GetObjectCommand({
                    Bucket: doc.s3Bucket,
                    Key: doc.s3Key,
                }));
                const chunks = [];
                for await (const chunk of s3Res.Body) chunks.push(chunk);
                const buffer = Buffer.concat(chunks);

                imports.push({
                    buffer,
                    originalName: doc.originalName,
                    sourceFormat: 'ifc',
                    sourceModel: doc.originalName.replace(/\.ifc$/i, ''),
                });
            }

            if (imports.length === 0) return errorResponse(res, 400, 'No valid IFC documents found');

            const { federatedModel, skippedFiles } = await modelService.importModels(projectSlug, imports);
            return res.status(200).json({ success: true, federatedModel, skippedFiles });
        } catch (error) {
            return errorResponse(res, 400, error.message || 'Failed to import from documents');
        }
    }
}

module.exports = new NavisworksClashController();
