const mimeTypes = require('mime-types')
const magicBytes = require('magic-bytes.js')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// ============================================================
// FILE VALIDATION SERVICE
// OWASP A04:2021 - Insecure Design / File Upload Security
// ============================================================

/**
 * Allowed file types with their configurations
 */
const ALLOWED_FILE_TYPES = {
    pdf: {
        mimeType: 'application/pdf',
        extensions: ['pdf'],
        magicBytes: [0x25, 0x50, 0x44, 0x46], // %PDF
        maxSize: 10 * 1024 * 1024, // 10MB
        description: 'PDF Document'
    },
    doc: {
        mimeType: 'application/msword',
        extensions: ['doc'],
        magicBytes: [0xD0, 0xCF, 0x11, 0xE0], // OLE header
        maxSize: 5 * 1024 * 1024, // 5MB
        description: 'Microsoft Word (.doc)'
    },
    docx: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extensions: ['docx'],
        magicBytes: [0x50, 0x4B, 0x03, 0x04], // ZIP header (DOCX is ZIP)
        maxSize: 5 * 1024 * 1024, // 5MB
        description: 'Microsoft Word (.docx)'
    },
    txt: {
        mimeType: 'text/plain',
        extensions: ['txt'],
        magicBytes: null, // Text files don't have specific magic bytes
        maxSize: 1 * 1024 * 1024, // 1MB
        description: 'Plain Text'
    },
    rtf: {
        mimeType: 'text/rtf',
        extensions: ['rtf'],
        magicBytes: [0x7B, 0x5C, 0x72, 0x74], // {\rtf
        maxSize: 5 * 1024 * 1024, // 5MB
        description: 'Rich Text Format'
    },
    csv: {
        mimeType: 'text/csv',
        extensions: ['csv'],
        magicBytes: null, // CSV files don't have specific magic bytes
        maxSize: 10 * 1024 * 1024, // 10MB
        description: 'CSV File'
    }
}

/**
 * Dangerous file extensions that should never be allowed
 */
const DANGEROUS_EXTENSIONS = [
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr',
    'vbs', 'js', 'jar', 'zip', 'rar', '7z',
    'sh', 'bash', 'ksh', 'csh', 'zsh',
    'app', 'deb', 'rpm', 'dmg', 'pkg',
    'msi', 'dll', 'so', 'dylib',
    'html', 'htm', 'svg', 'php', 'asp', 'jsp',
    'py', 'rb', 'pl', 'go', 'rs', 'ts'
]

/**
 * Dangerous MIME types
 */
const DANGEROUS_MIME_TYPES = [
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-elf',
    'application/x-sharedlib',
    'application/x-shellscript',
    'text/x-shellscript',
    'application/x-perl',
    'application/x-python',
    'application/x-ruby'
]

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

/**
 * Validate file extension
 * @param {String} filename
 * @returns {Object} - { valid: Boolean, extension: String, reason: String }
 */
function validateExtension(filename) {
    if (!filename) {
        return { valid: false, reason: 'No filename provided' }
    }

    const ext = path.extname(filename).toLowerCase().slice(1)

    if (!ext) {
        return { valid: false, reason: 'File has no extension' }
    }

    if (DANGEROUS_EXTENSIONS.includes(ext)) {
        return { valid: false, reason: `Dangerous file extension: ${ext}` }
    }

    // Check if extension is in allowed list
    const isAllowed = Object.values(ALLOWED_FILE_TYPES).some(
        type => type.extensions.includes(ext)
    )

    if (!isAllowed) {
        return { 
            valid: false, 
            reason: `File extension ${ext} not allowed`,
            extension: ext
        }
    }

    return { valid: true, extension: ext }
}

/**
 * Validate MIME type
 * @param {String} mimetype
 * @returns {Object} - { valid: Boolean, reason: String }
 */
function validateMimeType(mimetype) {
    if (!mimetype) {
        return { valid: false, reason: 'No MIME type provided' }
    }

    if (DANGEROUS_MIME_TYPES.includes(mimetype)) {
        return { valid: false, reason: `Dangerous MIME type: ${mimetype}` }
    }

    // Check if MIME type is in allowed list
    const isAllowed = Object.values(ALLOWED_FILE_TYPES).some(
        type => type.mimeType === mimetype
    )

    if (!isAllowed) {
        return { 
            valid: false, 
            reason: `MIME type ${mimetype} not allowed`
        }
    }

    return { valid: true }
}

/**
 * Validate file size
 * @param {Number} fileSize - Size in bytes
 * @param {String} extension - File extension
 * @returns {Object} - { valid: Boolean, reason: String, maxSize: Number }
 */
function validateFileSize(fileSize, extension) {
    if (fileSize <= 0) {
        return { valid: false, reason: 'File is empty' }
    }

    // Find max size for this file type
    let maxSize = 10 * 1024 * 1024 // Default 10MB

    for (const type of Object.values(ALLOWED_FILE_TYPES)) {
        if (type.extensions.includes(extension)) {
            maxSize = type.maxSize
            break
        }
    }

    if (fileSize > maxSize) {
        return { 
            valid: false, 
            reason: `File size (${formatBytes(fileSize)}) exceeds limit (${formatBytes(maxSize)})`,
            maxSize,
            size: fileSize
        }
    }

    return { valid: true, maxSize }
}

/**
 * Validate magic bytes (file signature)
 * @param {Buffer} buffer - File buffer
 * @param {String} extension - File extension
 * @returns {Object} - { valid: Boolean, reason: String, detectedType: String }
 */
function validateMagicBytes(buffer, extension) {
    if (!buffer || buffer.length === 0) {
        return { valid: false, reason: 'Empty file buffer' }
    }

    const typeConfig = Object.values(ALLOWED_FILE_TYPES).find(
        type => type.extensions.includes(extension)
    )

    if (!typeConfig) {
        return { valid: false, reason: `Unknown file type: ${extension}` }
    }

    // If no specific magic bytes required, allow it
    if (!typeConfig.magicBytes) {
        return { valid: true }
    }

    // Check magic bytes
    const bufferStart = buffer.slice(0, typeConfig.magicBytes.length)
    const hasValidMagic = typeConfig.magicBytes.every(
        (byte, index) => bufferStart[index] === byte
    )

    if (!hasValidMagic) {
        // Try to detect actual file type
        const detectedType = detectFileType(buffer)
        return {
            valid: false,
            reason: 'File signature does not match declared type',
            detectedType
        }
    }

    return { valid: true }
}

/**
 * Detect actual file type from magic bytes
 * @param {Buffer} buffer
 * @returns {String} - Detected file type
 */
function detectFileType(buffer) {
    if (!buffer || buffer.length === 0) return 'unknown'

    // Check against known magic bytes
    for (const [type, config] of Object.entries(ALLOWED_FILE_TYPES)) {
        if (config.magicBytes) {
            const bufferStart = buffer.slice(0, config.magicBytes.length)
            if (config.magicBytes.every((byte, index) => bufferStart[index] === byte)) {
                return type
            }
        }
    }

    return 'unknown'
}

/**
 * Calculate file hash (for integrity verification)
 * @param {Buffer} buffer
 * @returns {String} - SHA256 hash
 */
function calculateFileHash(buffer) {
    return crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex')
}

/**
 * Format bytes to human-readable size
 * @param {Number} bytes
 * @returns {String}
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// ============================================================
// COMPREHENSIVE VALIDATION
// ============================================================

/**
 * Perform complete file validation
 * @param {Object} fileData - { originalname, mimetype, buffer, size }
 * @returns {Object} - Validation result
 */
async function validateFile(fileData) {
    const {
        originalname = '',
        mimetype = '',
        buffer = null,
        size = 0
    } = fileData

    const result = {
        valid: true,
        errors: [],
        warnings: [],
        details: {
            filename: originalname,
            declaredMimeType: mimetype,
            size: size,
            formattedSize: formatBytes(size),
            hash: null,
            detectedType: null
        }
    }

    // 1. Extension validation
    const extValidation = validateExtension(originalname)
    if (!extValidation.valid) {
        result.valid = false
        result.errors.push(extValidation.reason)
    } else {
        result.details.extension = extValidation.extension
    }

    // 2. MIME type validation
    const mimeValidation = validateMimeType(mimetype)
    if (!mimeValidation.valid) {
        result.valid = false
        result.errors.push(mimeValidation.reason)
    }

    // 3. File size validation
    const sizeValidation = validateFileSize(size, result.details.extension)
    if (!sizeValidation.valid) {
        result.valid = false
        result.errors.push(sizeValidation.reason)
    }

    // 4. Magic bytes validation
    if (buffer && buffer.length > 0) {
        const magicValidation = validateMagicBytes(buffer, result.details.extension)
        if (!magicValidation.valid) {
            result.valid = false
            result.errors.push(magicValidation.reason)
            if (magicValidation.detectedType) {
                result.details.detectedType = magicValidation.detectedType
                result.warnings.push(`File appears to be ${magicValidation.detectedType}, not ${result.details.extension}`)
            }
        }

        // Calculate hash
        result.details.hash = calculateFileHash(buffer)
    }

    return result
}

/**
 * Quarantine suspicious file
 * @param {Object} fileData - File data
 * @param {String} userId - User ID
 * @param {String} reason - Quarantine reason
 * @returns {Promise<Object>} - Quarantine record
 */
async function quarantineFile(fileData, userId, reason) {
    // In a real implementation, this would:
    // 1. Store file in isolated quarantine directory
    // 2. Create audit log entry
    // 3. Potentially scan with antivirus
    // 4. Notify admins

    const quarantineRecord = {
        fileHash: fileData.hash,
        originalName: fileData.filename,
        mimetype: fileData.declaredMimeType,
        size: fileData.size,
        userId,
        reason,
        quarantinedAt: new Date(),
        scanResults: null,
        adminReview: false
    }

    // TODO: Implement actual quarantine storage and scanning
    console.log('[QUARANTINE]', quarantineRecord)

    return quarantineRecord
}

/**
 * Scan file for malware (wrapper for actual scanning service)
 * @param {Buffer} buffer
 * @returns {Promise<Object>} - Scan results
 */
async function scanFileForMalware(buffer) {
    // In production, integrate with:
    // - ClamAV antivirus
    // - VirusTotal API
    // - Other security scanning services

    return {
        scanned: true,
        clean: true,
        engine: 'mock_scanner',
        timestamp: new Date(),
        // In production: threats detected, detailed results
    }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    // Validation functions
    validateExtension,
    validateMimeType,
    validateFileSize,
    validateMagicBytes,
    validateFile,
    
    // Utilities
    detectFileType,
    calculateFileHash,
    formatBytes,
    
    // Security functions
    quarantineFile,
    scanFileForMalware,
    
    // Constants
    ALLOWED_FILE_TYPES,
    DANGEROUS_EXTENSIONS,
    DANGEROUS_MIME_TYPES
}
