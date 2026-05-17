const multer = require("multer")
const AppError = require("../utils/AppError")
const fileValidationService = require("../services/fileValidation.service")
const asyncHandler = require("../shared/asyncHandler")

const ALLOWED_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB (aligned with fileValidationService)
    },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new AppError("Unsupported file type. Please upload a PDF or DOCX file.", 400, "INVALID_FILE_TYPE"), false);
        }
    }
})

/**
 * Deep validation middleware to check magic bytes and content integrity
 */
const validateFileUpload = asyncHandler(async (req, res, next) => {
    if (!req.file) {
        return next()
    }

    const validation = await fileValidationService.validateFile({
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        buffer: req.file.buffer,
        size: req.file.size
    })

    if (!validation.valid) {
        throw new AppError(
            `File validation failed: ${validation.errors.join(', ')}`,
            400,
            'FILE_VALIDATION_FAILED'
        )
    }

    next()
})


module.exports = {
    upload,
    validateFileUpload
}