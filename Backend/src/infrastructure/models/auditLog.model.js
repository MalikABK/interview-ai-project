const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
    // User Information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        index: true
    },

    username: String,
    email: String,

    // Action Details
    action: {
        type: String,
        required: true,
        enum: [
            'login_success',
            'login_failed',
            'logout',
            'password_change',
            'password_reset_request',
            'password_reset_completed',
            'mfa_enabled',
            'mfa_disabled',
            'mfa_verified',
            'account_locked',
            'account_unlocked',
            'email_verified',
            'profile_updated',
            'session_created',
            'session_terminated',
            'token_rotated',
            'token_revoked',
            'file_uploaded',
            'file_deleted',
            'prompt_injection_detected',
            'prompt_injection_detection',
            'suspicious_activity_detected',
            'account_compromise_detected',
            'permissions_changed',
            'api_key_created',
            'api_key_deleted',
            'admin_action',
            'security_policy_updated',
            'system_configuration_changed'
        ],
        index: true
    },

    // Resource Information
    resource: {
        type: String,
        enum: [
            'authentication',
            'user_profile',
            'password',
            'session',
            'token',
            'file',
            'prompt',
            'prompt_analysis',
            'permissions',
            'api_key',
            'security_config',
            'system'
        ]
    },

    resourceId: String,

    // Detailed Information
    details: mongoose.Schema.Types.Mixed,

    // Client Information
    ipAddress: {
        type: String,
        index: true
    },

    userAgent: String,

    deviceFingerprint: String,

    location: {
        country: String,
        city: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },

    // Risk Assessment
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low',
        index: true
    },

    // Status & Response
    status: {
        type: String,
        enum: ['success', 'failure', 'warning'],
        default: 'success'
    },

    statusCode: Number,

    errorMessage: String,

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
        // TTL index for automatic cleanup (adjust as needed)
        expires: 365 * 24 * 60 * 60 // 1 year
    },

    // Metadata
    source: {
        type: String,
        enum: ['web', 'mobile', 'api', 'admin_console'],
        default: 'api'
    },

    sessionId: String,

    correlationId: String,

    // Compliance
    dataClassification: {
        type: String,
        enum: ['public', 'internal', 'confidential', 'restricted'],
        default: 'internal'
    }

}, { 
    timestamps: true,
    collection: 'audit_logs'
})

// ==================== INDEXES ====================

auditLogSchema.index({ userId: 1, createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ ipAddress: 1, createdAt: -1 })
auditLogSchema.index({ riskLevel: 1, createdAt: -1 })
auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ sessionId: 1 })

const AuditLog = mongoose.model('AuditLog', auditLogSchema)

module.exports = AuditLog
