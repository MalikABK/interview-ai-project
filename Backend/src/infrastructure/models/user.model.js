const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    // Basic Information
    username: {
        type: String,
        unique: [true, "username already taken"],
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 50,
        match: [/^[a-zA-Z0-9_-]+$/, "Username can only contain alphanumeric characters, underscores, and hyphens"]
    },

    email: {
        type: String,
        unique: [true, "Account already exists with this email address"],
        required: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email address"]
    },

    password: {
        type: String,
        required: true,
        minlength: 8,
        // Note: Never return password in queries
        select: false
    },

    // Account Status & Security
    accountStatus: {
        type: String,
        enum: ['active', 'locked', 'suspended', 'deleted'],
        default: 'active'
    },

    isEmailVerified: {
        type: Boolean,
        default: false
    },

    emailVerificationToken: {
        type: String,
        select: false
    },

    emailVerificationTokenExpiry: Date,

    // Account Lockout Fields (OWASP A7 - Authentication)
    loginAttempts: {
        type: Number,
        default: 0,
        min: 0
    },

    lockUntil: {
        type: Date,
        default: null
    },

    lastFailedLogin: {
        type: Date,
        default: null
    },

    failedLoginAttempts: [
        {
            timestamp: {
                type: Date,
                default: Date.now
            },
            ipAddress: String,
            userAgent: String,
            reason: {
                type: String,
                enum: ['invalid_password', 'invalid_email', 'account_locked'],
                default: 'invalid_password'
            }
        }
    ],

    // Login & Session Tracking
    lastLogin: {
        type: Date,
        default: null
    },

    lastLoginIp: String,

    lastLoginUserAgent: String,

    loginHistory: [
        {
            timestamp: {
                type: Date,
                default: Date.now
            },
            ipAddress: String,
            userAgent: String,
            deviceFingerprint: String,
            success: Boolean,
            location: String // Optional: from geolocation API
        }
    ],

    // Password Security
    passwordChangedAt: Date,

    passwordResetToken: {
        type: String,
        select: false
    },

    passwordResetTokenExpiry: Date,

    previousPasswords: [
        {
            password: {
                type: String,
                select: false
            },
            changedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],

    // Session Management
    activeSessions: [
        {
            sessionId: String,
            refreshTokenHash: String, // Hash of the refresh token
            ipAddress: String,
            userAgent: String,
            deviceFingerprint: String,
            createdAt: {
                type: Date,
                default: Date.now
            },
            lastActivityAt: {
                type: Date,
                default: Date.now
            },
            expiresAt: Date,
            isActive: {
                type: Boolean,
                default: true
            }
        }
    ],

    // MFA Fields (for future implementation)
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },

    twoFactorSecret: {
        type: String,
        select: false
    },

    twoFactorBackupCodes: [
        {
            code: {
                type: String,
                select: false
            },
            used: {
                type: Boolean,
                default: false
            },
            usedAt: Date
        }
    ],

    // Trust Settings
    trustedDevices: [
        {
            deviceFingerprint: String,
            deviceName: String,
            addedAt: {
                type: Date,
                default: Date.now
            },
            lastUsedAt: Date,
            isRevoked: {
                type: Boolean,
                default: false
            }
        }
    ],

    // Security Settings
    loginNotifications: {
        type: Boolean,
        default: true
    },

    anomalousActivityAlert: {
        type: Boolean,
        default: true
    },

    // Audit & Compliance
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },

    updatedAt: {
        type: Date,
        default: Date.now
    },

    deletedAt: Date,

    // Account Recovery
    recoveryEmail: String,

    recoveryPhone: String,

    securityQuestions: [
        {
            questionId: String,
            answerHash: {
                type: String,
                select: false
            }
        }
    ]

}, { timestamps: true })

// ==================== INDEXES ====================

// Performance indexes
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ username: 1 }, { unique: true })
userSchema.index({ createdAt: -1 })
userSchema.index({ accountStatus: 1 })
userSchema.index({ lockUntil: 1 })
userSchema.index({ 'loginHistory.timestamp': -1 })
userSchema.index({ 'failedLoginAttempts.timestamp': -1 })
userSchema.index({ isEmailVerified: 1 })

// TTL indexes for automatic cleanup
userSchema.index({ emailVerificationTokenExpiry: 1 }, { expireAfterSeconds: 0 })
userSchema.index({ passwordResetTokenExpiry: 1 }, { expireAfterSeconds: 0 })
userSchema.index({ 'activeSessions.expiresAt': 1 }, { expireAfterSeconds: 0 })

// ==================== METHODS ====================

/**
 * Check if account is currently locked
 * @returns {Boolean}
 */
userSchema.methods.isAccountLocked = function() {
    return this.lockUntil && this.lockUntil > new Date()
}

/**
 * Check if account is in locked state
 * @returns {Boolean}
 */
userSchema.methods.hasExceededMaxAttempts = function(maxAttempts = 5) {
    return this.loginAttempts >= maxAttempts
}

/**
 * Increment failed login attempts
 * @param {Object} options - { ipAddress, userAgent, reason }
 */
userSchema.methods.incFailedLoginAttempts = async function(options = {}) {
    this.loginAttempts = (this.loginAttempts || 0) + 1
    this.lastFailedLogin = new Date()

    // Add to failed attempts history
    this.failedLoginAttempts.push({
        timestamp: new Date(),
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        reason: options.reason || 'invalid_password'
    })

    // Keep only last 10 attempts
    if (this.failedLoginAttempts.length > 10) {
        this.failedLoginAttempts = this.failedLoginAttempts.slice(-10)
    }

    await this.save()
    return this.loginAttempts
}

/**
 * Lock account for specified duration
 * @param {Number} durationMinutes - Duration in minutes
 */
userSchema.methods.lockAccount = async function(durationMinutes = 30) {
    const lockUntilTime = new Date(Date.now() + durationMinutes * 60000)
    this.lockUntil = lockUntilTime
    this.accountStatus = 'locked'
    await this.save()
    return lockUntilTime
}

/**
 * Reset failed login attempts
 */
userSchema.methods.resetFailedLoginAttempts = async function() {
    this.loginAttempts = 0
    this.lockUntil = null
    this.lastFailedLogin = null
    this.accountStatus = 'active'
    await this.save()
}

/**
 * Record successful login
 * @param {Object} options - { ipAddress, userAgent, deviceFingerprint, location }
 */
userSchema.methods.recordSuccessfulLogin = async function(options = {}) {
    // Reset failed attempts
    await this.resetFailedLoginAttempts()

    // Update last login info
    this.lastLogin = new Date()
    this.lastLoginIp = options.ipAddress
    this.lastLoginUserAgent = options.userAgent

    // Add to login history
    this.loginHistory.push({
        timestamp: new Date(),
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        deviceFingerprint: options.deviceFingerprint,
        success: true,
        location: options.location
    })

    // Keep only last 50 logins
    if (this.loginHistory.length > 50) {
        this.loginHistory = this.loginHistory.slice(-50)
    }

    await this.save()
}

/**
 * Create active session
 * @param {Object} sessionData - { sessionId, refreshTokenHash, ipAddress, userAgent, deviceFingerprint, expiresAt }
 */
userSchema.methods.createSession = async function(sessionData) {
    this.activeSessions.push({
        sessionId: sessionData.sessionId,
        refreshTokenHash: sessionData.refreshTokenHash,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        deviceFingerprint: sessionData.deviceFingerprint,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: sessionData.expiresAt,
        isActive: true
    })

    await this.save()
    return this.activeSessions[this.activeSessions.length - 1]
}

/**
 * Update session activity
 * @param {String} sessionId
 */
userSchema.methods.updateSessionActivity = async function(sessionId) {
    const session = this.activeSessions.find(s => s.sessionId === sessionId)
    if (session) {
        session.lastActivityAt = new Date()
        await this.save()
    }
}

/**
 * Revoke session
 * @param {String} sessionId
 */
userSchema.methods.revokeSession = async function(sessionId) {
    const session = this.activeSessions.find(s => s.sessionId === sessionId)
    if (session) {
        session.isActive = false
        await this.save()
    }
}

/**
 * Revoke all sessions (e.g., password changed)
 */
userSchema.methods.revokeAllSessions = async function() {
    this.activeSessions.forEach(session => {
        session.isActive = false
    })
    await this.save()
}

/**
 * Check if password was recently used
 * @param {String} newPassword - Plain text password to check
 * @returns {Boolean}
 */
userSchema.methods.wasPasswordRecentlyUsed = async function(newPassword) {
    const bcrypt = require('bcryptjs')
    
    // Check last 5 passwords
    for (const prevPassword of this.previousPasswords.slice(-5)) {
        const isMatch = await bcrypt.compare(newPassword, prevPassword.password)
        if (isMatch) {
            return true
        }
    }
    return false
}

/**
 * Update password and store previous one
 * @param {String} newPasswordHash
 */
userSchema.methods.updatePassword = async function(newPasswordHash) {
    // Store current password as previous
    if (this.password) {
        this.previousPasswords.push({
            password: this.password,
            changedAt: new Date()
        })

        // Keep only last 5 passwords
        if (this.previousPasswords.length > 5) {
            this.previousPasswords = this.previousPasswords.slice(-5)
        }
    }

    this.password = newPasswordHash
    this.passwordChangedAt = new Date()
    
    // Revoke all sessions on password change for security
    await this.revokeAllSessions()
    
    await this.save()
}

/**
 * Mark email as verified
 */
userSchema.methods.verifyEmail = async function() {
    this.isEmailVerified = true
    this.emailVerificationToken = undefined
    this.emailVerificationTokenExpiry = undefined
    await this.save()
}

/**
 * Add trusted device
 * @param {Object} deviceData - { deviceFingerprint, deviceName }
 */
userSchema.methods.trustDevice = async function(deviceData) {
    this.trustedDevices.push({
        deviceFingerprint: deviceData.deviceFingerprint,
        deviceName: deviceData.deviceName,
        addedAt: new Date(),
        lastUsedAt: new Date(),
        isRevoked: false
    })
    await this.save()
}

/**
 * Check if device is trusted
 * @param {String} deviceFingerprint
 * @returns {Boolean}
 */
userSchema.methods.isDeviceTrusted = function(deviceFingerprint) {
    return this.trustedDevices.some(
        d => d.deviceFingerprint === deviceFingerprint && !d.isRevoked
    )
}

/**
 * Revoke trusted device
 * @param {String} deviceFingerprint
 */
userSchema.methods.revokeTrustedDevice = async function(deviceFingerprint) {
    const device = this.trustedDevices.find(d => d.deviceFingerprint === deviceFingerprint)
    if (device) {
        device.isRevoked = true
        await this.save()
    }
}

// ==================== MIDDLEWARE ====================

/**
 * Prevent returning sensitive fields
 */
userSchema.methods.toJSON = function() {
    const user = this.toObject()
    delete user.password
    delete user.passwordResetToken
    delete user.emailVerificationToken
    delete user.twoFactorSecret
    delete user.securityQuestions
    delete user.previousPasswords
    return user
}

/**
 * Auto-unlock account if lockout duration has expired
 */
userSchema.pre('save', async function(next) {
    if (this.lockUntil && this.lockUntil <= new Date()) {
        this.lockUntil = null
        if (this.accountStatus === 'locked') {
            this.accountStatus = 'active'
        }
    }
    next()
})

/**
 * Clean up expired sessions before saving
 */
userSchema.pre('save', async function(next) {
    this.activeSessions = this.activeSessions.filter(session => {
        return session.expiresAt > new Date()
    })
    next()
})

// ==================== STATICS ====================

/**
 * Find by email (case-insensitive)
 */
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() })
}

/**
 * Find by username (case-insensitive)
 */
userSchema.statics.findByUsername = function(username) {
    return this.findOne({ username: new RegExp(`^${username}$`, 'i') })
}

/**
 * Get users with suspicious activity
 */
userSchema.statics.findSuspiciousAccounts = function(thresholdMinutes = 30) {
    const since = new Date(Date.now() - thresholdMinutes * 60000)
    return this.find({
        'failedLoginAttempts.timestamp': { $gte: since },
        accountStatus: { $ne: 'deleted' }
    })
}

/**
 * Get locked accounts
 */
userSchema.statics.findLockedAccounts = function() {
    return this.find({
        accountStatus: 'locked',
        lockUntil: { $gt: new Date() }
    })
}

/**
 * Cleanup old login history (keep only last 50)
 */
userSchema.statics.cleanupOldData = async function() {
    const result = await this.updateMany(
        {},
        [
            {
                $set: {
                    loginHistory: {
                        $slice: ['$loginHistory', -50]
                    },
                    failedLoginAttempts: {
                        $slice: ['$failedLoginAttempts', -10]
                    }
                }
            }
        ]
    )
    return result
}

const userModel = mongoose.model("users", userSchema)

module.exports = userModel
