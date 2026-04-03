const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TMP_DIR = path.join(__dirname, '..', 'tmp', 'package-uploads');

function ensureDir() {
    if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, { recursive: true });
    }
}

const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 500);

ensureDir();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            ensureDir();
            cb(null, TMP_DIR);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const random = crypto.randomBytes(16).toString('hex');
        cb(null, `${Date.now()}-${random}${ext}`);
    },
});

const packageUpload = multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
}).single('file');

module.exports = {
    packageUpload,
    TMP_DIR,
};

