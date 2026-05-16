const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL: 500
}

const ERROR_MESSAGES = {
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'Forbidden',
    NOT_FOUND: (resource) => `${resource} not found`,
    VALIDATION: 'Validation error',
    INTERNAL: 'Internal server error',
    UNSUPPORTED_FILE: 'Unsupported file type. Upload PDF or DOCX.',
    EMPTY_RESUME: 'Could not extract text from document.',
    USER_EXISTS: 'Account already exists with this email or username.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
}

const FILE_LIMITS = {
    MAX_BYTES: 3 * 1024 * 1024,
    ALLOWED_MIMETYPES: new Set([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ])
}

const AI = {
    MODEL: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    MAX_RESUME_CHARS: 8000,
    MAX_JOB_DESC_CHARS: 3000,
    MAX_SELF_DESC_CHARS: 2000,
}

module.exports = { HTTP_STATUS, ERROR_MESSAGES, FILE_LIMITS, AI }
