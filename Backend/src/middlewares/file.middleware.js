const multer = require("multer")
const AppError = require("../utils/AppError")

const ALLOWED_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 3 * 1024 * 1024 // 3MB
    },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new AppError("Unsupported file type. Please upload a PDF or DOCX file.", 400, "INVALID_FILE_TYPE"), false);
        }
    }
})


module.exports = upload