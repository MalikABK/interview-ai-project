const mongoose = require("mongoose")
const crypto = require("crypto")

const refreshTokenSchema = new mongoose.Schema({
    // Token Information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        index: true
    },

    tokenHash: {
        type: String,
        required: true,
        unique: true,
        // Store hash, not the actual token
        select: false
    },

    token: {
        type: String,
        required: true,
        select: false
        // Note: This is just the plain token, never returned in responses
    },

    // Token Family for Rotation Detection
    // If a token from a previous generation is replayed, we revoke the entire family
    tokenFamily: {
        type: String,
        required: true,
        index: true
    },

    parentTokenHash: {
        type: String,
        default: null,
        select: false
        // Reference to the parent token that generated this token
    },

    childTokenHash: {
        type: String,
        default: null,
        select: false
        // Reference to child token generated from this token
    },

    // Token Lifecycle
    issuedAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },

    expiresAt: {
        type: Date,
        required: true,
        index: true
    },

    // Token Usage Tracking
    usedAt: Date,

    lastRotatedAt: {
        type: Date,
        default: Date.now
    },

    rotationCount: {
        type: Number,
        default: 0,
        min: 0
    },

    // Session Information
    sessionId: {
        type: String,
        required: true,
        index: true
    },

    ipAddress: String,

    userAgent: String,

    deviceFingerprint: String,

    // Token Status
    status: {
        type: String,
        enum: ['active', 'used', 'rotated', 'revoked', 'expired'],
        default: 'active',
        index: true
    },

    revokedAt: Date,

    revocationReason: {
        type: String,
        enum: [
            'user_logout',
            'password_changed',
            'account_locked',
            'suspicious_activity',
            'token_reuse_detected',
            'device_compromised',
            'admin_revocation',
            'session_timeout',
            'all_sessions_revoked'
        ]
    },

    // Security & Audit
    accessTokenIssued: {
        type: Boolean,
        default: false
    },

    accessTokenIssuedAt: Date,

    rotationAttempts: [
        {
            attemptedAt: {
                type: Date,
                default: Date.now
            },
            ipAddress: String,
            userAgent: String,
            success: Boolean,
            reason: String
        }
    ],

    // Anomaly Detection
    suspiciousActivity: {
        type: Boolean,
        default: false
    },

    anomalyFlags: [
        {
            flag: String,
            detectedAt: {
                type: Date,
                default: Date.now
            },
            details: String
        }
    ],

    // Metadata
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true })

// ==================== INDEXES ====================

refreshTokenSchema.index({ userId: 1, status: 1 })
refreshTokenSchema.index({ userId: 1, sessionId: 1 })
refreshTokenSchema.index({ tokenFamily: 1, status: 1 })
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index
refreshTokenSchema.index({ issuedAt: -1 })
refreshTokenSchema.index({ createdAt: -1 })
refreshTokenSchema.index({ suspiciousActivity: 1, status: 1 })

// ==================== METHODS ====================

/**
 * Hash token for storage
 * @static
 * @param {String} token - Plain token to hash
 * @returns {String} - Hashed token
 */
refreshTokenSchema.statics.hashToken = function(token) {
    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')
}

/**
 * Verify token matches its hash
 * @param {String} token - Plain token
 * @returns {Boolean}
 */
refreshTokenSchema.methods.verifyToken = function(token) {
    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')
    
    return tokenHash === this.tokenHash
}

/**
 * Check if token is valid and not expired
 * @returns {Boolean}
 */
refreshTokenSchema.methods.isValid = function() {
    return (
        this.status === 'active' &&
        this.expiresAt > new Date() &&
        !this.suspiciousActivity
    )
}

/**
 * Check if token is expired
 * @returns {Boolean}
 */
refreshTokenSchema.methods.isExpired = function() {
    return this.expiresAt <= new Date()
}

/**
 * Mark token as used (after generating new access token)
 */
refreshTokenSchema.methods.markAsUsed = async function() {
    this.usedAt = new Date()
    this.accessTokenIssued = true
    this.accessTokenIssuedAt = new Date()
    await this.save()
}

/**
 * Rotate token (generate new token for same session)
 * @param {Object} rotationData - { newTokenHash, newToken, newChildTokenHash, ipAddress, userAgent, deviceFingerprint }
 * @returns {Object} - New token document
 */
refreshTokenSchema.methods.rotate = async function(rotationData) {
    const crypto = require('crypto')
    
    // Mark current token as rotated
    this.status = 'rotated'
    this.childTokenHash = rotationData.newChildTokenHash
    this.rotationCount += 1
    this.lastRotatedAt = new Date()
    this.rotationAttempts.push({
        attemptedAt: new Date(),
        ipAddress: rotationData.ipAddress,
        userAgent: rotationData.userAgent,
        success: true
    })
    await this.save()

    // Create new token document
    const newTokenDoc = new this.constructor({
        userId: this.userId,
        tokenHash: rotationData.newTokenHash,
        token: rotationData.newToken,
        tokenFamily: this.tokenFamily,
        parentTokenHash: this.tokenHash,
        sessionId: this.sessionId,
        ipAddress: rotationData.ipAddress,
        userAgent: rotationData.userAgent,
        deviceFingerprint: rotationData.deviceFingerprint,
        expiresAt: rotationData.expiresAt,
        status: 'active'
    })

    await newTokenDoc.save()
    return newTokenDoc
}

/**
 * Revoke token
 * @param {String} reason - Reason for revocation
 */
refreshTokenSchema.methods.revoke = async function(reason = 'user_logout') {
    this.status = 'revoked'
    this.revokedAt = new Date()
    this.revocationReason = reason
    await this.save()
}

/**
 * Record rotation attempt
 * @param {Object} attemptData - { ipAddress, userAgent, success, reason }
 */
refreshTokenSchema.methods.recordRotationAttempt = async function(attemptData) {
    this.rotationAttempts.push({
        attemptedAt: new Date(),
        ipAddress: attemptData.ipAddress,
        userAgent: attemptData.userAgent,
        success: attemptData.success,
        reason: attemptData.reason
    })

    // Keep only last 20 attempts
    if (this.rotationAttempts.length > 20) {
        this.rotationAttempts = this.rotationAttempts.slice(-20)
    }

    await this.save()
}

/**
 * Add anomaly flag
 * @param {String} flag - Anomaly flag (e.g., 'unusual_ip', 'high_rotation_rate')
 * @param {String} details - Details about the anomaly
 */
refreshTokenSchema.methods.flagAnomaly = async function(flag, details = '') {
    this.suspiciousActivity = true
    this.anomalyFlags.push({
        flag,
        detectedAt: new Date(),
        details
    })

    // Keep only last 10 flags
    if (this.anomalyFlags.length > 10) {
        this.anomalyFlags = this.anomalyFlags.slice(-10)
    }

    await this.save()
}

/**
 * Update activity timestamp (on access token validation)
 */
refreshTokenSchema.methods.updateActivity = async function() {
    this.lastRotatedAt = new Date()
    await this.save()
}

// ==================== STATICS ====================

/**
 * Create new token with family
 * @static
 * @param {Object} tokenData - { userId, token, sessionId, ipAddress, userAgent, deviceFingerprint, expiresAt }
 * @returns {Object} - Created token document
 */
refreshTokenSchema.statics.createToken = async function(tokenData) {
    const tokenHash = this.hashToken(tokenData.token)
    const tokenFamily = crypto.randomBytes(16).toString('hex')

    const newToken = new this({
        userId: tokenData.userId,
        tokenHash,
        token: tokenData.token,
        tokenFamily,
        sessionId: tokenData.sessionId,
        ipAddress: tokenData.ipAddress,
        userAgent: tokenData.userAgent,
        deviceFingerprint: tokenData.deviceFingerprint,
        expiresAt: tokenData.expiresAt,
        status: 'active'
    })

    await newToken.save()
    return newToken
}

/**
 * Find token by hash
 * @static
 * @param {String} tokenHash
 * @returns {Object} - Token document
 */
refreshTokenSchema.statics.findByHash = function(tokenHash) {
    return this.findOne({ tokenHash }).select('+tokenHash +token')
}

/**
 * Find active token for user and session
 * @static
 * @param {String} userId
 * @param {String} sessionId
 * @returns {Object} - Token document
 */
refreshTokenSchema.statics.findActiveTokenForSession = function(userId, sessionId) {
    return this.findOne({
        userId,
        sessionId,
        status: 'active',
        expiresAt: { $gt: new Date() }
    }).select('+tokenHash')
}

/**
 * Get all active tokens for user
 * @static
 * @param {String} userId
 * @returns {Array} - Array of token documents
 */
refreshTokenSchema.statics.findActiveTokensForUser = function(userId) {
    return this.find({
        userId,
        status: 'active',
        expiresAt: { $gt: new Date() }
    }).sort({ issuedAt: -1 })
}

/**
 * Revoke entire token family (if replay attack detected)
 * @static
 * @param {String} tokenFamily
 * @param {String} reason
 */
refreshTokenSchema.statics.revokeTokenFamily = async function(tokenFamily, reason = 'token_reuse_detected') {
    return this.updateMany(
        { tokenFamily, status: { $in: ['active', 'rotated', 'used'] } },
        {
            status: 'revoked',
            revokedAt: new Date(),
            revocationReason: reason
        }
    )
}

/**
 * Revoke all tokens for user (password change, account compromise)
 * @static
 * @param {String} userId
 * @param {String} reason
 */
refreshTokenSchema.statics.revokeAllForUser = async function(userId, reason = 'all_sessions_revoked') {
    return this.updateMany(
        { userId, status: { $in: ['active', 'rotated', 'used'] } },
        {
            status: 'revoked',
            revokedAt: new Date(),
            revocationReason: reason
        }
    )
}

/**
 * Revoke all tokens for specific session
 * @static
 * @param {String} userId
 * @param {String} sessionId
 * @param {String} reason
 */
refreshTokenSchema.statics.revokeSession = async function(userId, sessionId, reason = 'session_timeout') {
    return this.updateMany(
        { userId, sessionId, status: { $in: ['active', 'rotated', 'used'] } },
        {
            status: 'revoked',
            revokedAt: new Date(),
            revocationReason: reason
        }
    )
}

/**
 * Clean up expired tokens
 * @static
 * @returns {Object} - Result of deleteMany operation
 */
refreshTokenSchema.statics.cleanupExpired = async function() {
    return this.deleteMany({
        expiresAt: { $lt: new Date() }
    })
}

/**
 * Find suspicious tokens
 * @static
 * @param {Number} thresholdMinutes - Look back period in minutes
 * @returns {Array} - Array of suspicious token documents
 */
refreshTokenSchema.statics.findSuspiciousTokens = function(thresholdMinutes = 30) {
    const since = new Date(Date.now() - thresholdMinutes * 60000)
    return this.find({
        suspiciousActivity: true,
        anomalyFlags: {
            $elemMatch: {
                detectedAt: { $gte: since }
            }
        }
    }).sort({ createdAt: -1 })
}

/**
 * Detect token reuse (replay attack)
 * @static
 * @param {String} tokenFamily
 * @param {String} tokenHash
 * @param {String} userId
 * @returns {Boolean} - True if replay detected
 */
refreshTokenSchema.statics.detectReplay = async function(tokenFamily, tokenHash, userId) {
    // Check if a newer token exists in the same family
    const replayedToken = await this.findOne({
        tokenFamily,
        userId,
        status: { $ne: 'revoked' }
    }).sort({ issuedAt: -1 }).select('+tokenHash')

    if (!replayedToken) return false

    // If the token being used is older than the newest in the family, it's likely a replay
    const usedToken = await this.findOne({ tokenHash }).select('+token')
    if (!usedToken) return false

    return usedToken.issuedAt < replayedToken.issuedAt
}

/**
 * Get token statistics for user
 * @static
 * @param {String} userId
 * @returns {Object} - Statistics object
 */
refreshTokenSchema.statics.getTokenStats = async function(userId) {
    const stats = await this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ])

    return {
        active: stats.find(s => s._id === 'active')?.count || 0,
        revoked: stats.find(s => s._id === 'revoked')?.count || 0,
        rotated: stats.find(s => s._id === 'rotated')?.count || 0,
        expired: stats.find(s => s._id === 'expired')?.count || 0
    }
}

const refreshTokenModel = mongoose.model("refreshTokens", refreshTokenSchema)

module.exports = refreshTokenModel
