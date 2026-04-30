const multer = require('multer');

const MAX_UPLOAD_SIZE_MB = Number(process.env.TASK_ATTACHMENT_MAX_SIZE_MB || 50);

const ALLOWED_EXTENSIONS = [
    'ifc', 'rvt', 'dwg', 'dxf', 'nwd', 'nwf', 'nwc',
    'skp', 'fbx', 'obj', '3ds', 'step', 'stp',
    'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
    'txt', 'doc', 'docx', 'xls', 'xlsx',
];

const ALLOWED_MIME_TYPES = [
    'application/x-ifc', 'model/ifc',
    'application/x-autodesk-revit', 'application/x-rvt',
    'application/x-dwg', 'image/vnd.dwg', 'image/x-dwg',
    'application/dxf', 'application/x-dxf', 'image/vnd.dxf',
    'model/nwd', 'application/octet-stream',
    'application/x-sketch', 'application/x-sketchup', 'application/x-skp',
    'application/x-fbx', 'model/fbx',
    'application/x-obj', 'model/obj',
    'application/x-3ds',
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
    const ext = (file.originalname || '').replace(/^.*\./, '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`File type ".${ext}" is not allowed`), false);
    }
    cb(null, true);
}

const taskAttachmentUpload = multer({
    storage,
    limits: {
        fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
        files: 20,
    },
    fileFilter,
});

module.exports = {
    taskAttachmentUpload,
    MAX_UPLOAD_SIZE_MB,
    ALLOWED_EXTENSIONS,
};
