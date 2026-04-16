const multer = require('multer');

const MAX_UPLOAD_SIZE_MB = Number(process.env.CR_ATTACHMENT_MAX_SIZE_MB || 100);

const ALLOWED_MIME_TYPES = [
    // IFC / CAD
    'application/x-ifc',
    'model/ifc',
    'application/x-autodesk-revit',
    'application/x-rvt',
    'application/x-dwg',
    'image/vnd.dwg',
    'image/x-dwg',
    'application/dxf',
    'application/x-dxf',
    'image/vnd.dxf',
    'model/nwd',
    'application/octet-stream',
    // BIM
    'application/x-sketch',
    'application/skp',
    'application/x-fbx',
    'model/fbx',
    'application/x-obj',
    'model/obj',
    'application/x-3ds',
    // Docs / Images
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
    const ext = (file.originalname || '').replace(/^.*\./, '').toLowerCase();
    const allowedExts = [
        'ifc', 'rvt', 'dwg', 'dxf', 'nwd', 'nwf', 'nwc',
        'skp', 'fbx', 'obj', '3ds', 'step', 'stp',
        'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
        'txt', 'doc', 'docx', 'xls', 'xlsx',
    ];
    if (!allowedExts.includes(ext)) {
        return cb(new Error(`File type ".${ext}" is not allowed`), false);
    }
    cb(null, true);
}

const crAttachmentUpload = multer({
    storage,
    limits: {
        fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
        files: 20,
    },
    fileFilter,
});

module.exports = {
    crAttachmentUpload,
    MAX_UPLOAD_SIZE_MB,
};
