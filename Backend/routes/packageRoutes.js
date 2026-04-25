const express = require('express');
const PackageController = require('../controllers/PackageController');
const { authenticate } = require('../middlewares/authMiddleware');
const { packageUpload } = require('../middlewares/packageUploadMiddleware');

const router = express.Router();

router.post('/create', authenticate, (req, res) =>
    PackageController.createPackage(req, res)
);

router.post('/list', authenticate, (req, res) =>
    PackageController.listPackages(req, res)
);

router.post('/update', authenticate, (req, res) =>
    PackageController.updatePackage(req, res)
);

router.post('/archive', authenticate, (req, res) =>
    PackageController.archivePackage(req, res)
);

router.post('/delete', authenticate, (req, res) =>
    PackageController.deletePackage(req, res)
);

router.post('/documents/list', authenticate, (req, res) =>
    PackageController.listProjectDocuments(req, res)
);

router.post('/documents/package/list', authenticate, (req, res) =>
    PackageController.listPackageDocuments(req, res)
);

router.post('/documents/folders/create', authenticate, (req, res) =>
    PackageController.createDocumentFolder(req, res)
);

router.post('/documents/file/rename', authenticate, (req, res) =>
    PackageController.renameDocumentFile(req, res)
);

router.post('/documents/folder/rename', authenticate, (req, res) =>
    PackageController.renameDocumentFolder(req, res)
);

router.post('/documents/file/delete', authenticate, (req, res) =>
    PackageController.deleteDocumentFile(req, res)
);

router.post('/documents/view-status', authenticate, (req, res) =>
    PackageController.getIfcViewStatus(req, res)
);

router.post('/documents/retry-conversion', authenticate, (req, res) =>
    PackageController.retryIfcConversion(req, res)
);

router.get('/viewer/projects/:projectId/files/:fileId/versions/:versionId/model', authenticate, (req, res) =>
    PackageController.getViewerModel(req, res)
);

router.post('/documents/folder/delete', authenticate, (req, res) =>
    PackageController.deleteDocumentFolder(req, res)
);

router.post(
    '/upload',
    authenticate,
    packageUpload,
    (req, res) => PackageController.uploadPackageDocument(req, res)
);

router.get('/upload-jobs/:jobId', authenticate, (req, res) =>
    PackageController.getUploadJobStatus(req, res)
);

module.exports = router;