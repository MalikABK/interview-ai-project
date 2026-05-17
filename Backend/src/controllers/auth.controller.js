const userModel = require("../infrastructure/models/user.model")
const auditLog = require("../services/auditLog.service")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const refreshTokenModel = require("../infrastructure/models/refreshToken.model")
const AppError = require("../utils/AppError")
const { HTTP_STATUS } = require("../shared/constants")

// ============================================================
// ACCOUNT LOCKOUT SERVICE
// ============================================================

class AccountLockoutService {
    /**
     * Get lockout configuration
     */
    static getConfig() {
        return {
            maxAttempts: parseInt(process.env.LOCKOUT_ATTEMPTS) || 5,
            lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 30, // minutes
            resetTime: parseInt(process.env.LOCKOUT_RESET_TIME) || 24 * 60, // minutes
        }
    }

    /**
     * Record failed login attempt
     * @param {String} email
     * @param {Object} context - { ipAddress, userAgent }
     */
    static async recordFailedAttempt(email, context = {}) {
        try {
            const user = await userModel.findByEmail(email)
            if (!user) return

            // Increment attempts
            const attempts = await user.incFailedLoginAttempts({
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                reason: 'invalid_password'
            })

            const config = this.getConfig()

            // Lock account if max attempts exceeded
            if (attempts >= config.maxAttempts) {
                const lockUntil = await user.lockAccount(config.lockoutDuration)
                
                // Log security event
                await auditLog.logEvent({
                    userId: user._id,
                    username: user.username,
                    email: user.email,
                    action: 'account_locked',
                    resource: 'authentication',
                    details: {
                        reason: 'max_failed_attempts',
                        attempts,
                        lockDuration: config.lockoutDuration
                    },
                    ipAddress: context.ipAddress,
                    userAgent: context.userAgent,
                    riskLevel: 'high',
                    status: 'warning'
                })

                return {
                    locked: true,
                    lockUntil,
                    message: `Account locked due to ${config.maxAttempts} failed attempts. Try again after ${config.lockoutDuration} minutes.`
                }
            }

            return {
                locked: false,
                attemptsRemaining: config.maxAttempts - attempts,
                message: `Invalid credentials. ${config.maxAttempts - attempts} attempts remaining.`
            }
        } catch (error) {
            console.error('[LOCKOUT ERROR]', error.message)
        }
    }

    /**
     * Check if account is locked
     * @param {String} email
     * @returns {Object}
     */
    static async checkAccountStatus(email) {
        try {
            const user = await userModel.findByEmail(email)
            if (!user) {
                return { exists: false }
            }

            if (user.isAccountLocked()) {
                const minutesRemaining = Math.ceil((user.lockUntil - new Date()) / 60000)
                return {
                    locked: true,
                    lockUntil: user.lockUntil,
                    minutesRemaining,
                    message: `Account is locked. Try again in ${minutesRemaining} minutes.`
                }
            }

            return {
                locked: false,
                accountStatus: user.accountStatus
            }
        } catch (error) {
            console.error('[STATUS CHECK ERROR]', error.message)
            return { error: 'Unable to check account status' }
        }
    }

    /**
     * Unlock account manually
     * @param {String} userId
     * @param {String} adminId - ID of admin performing unlock
     */
    static async unlockAccount(userId, adminId = null) {
        try {
            const user = await userModel.findById(userId)
            if (!user) throw new Error('User not found')

            await user.resetFailedLoginAttempts()

            // Log admin action
            if (adminId) {
                await auditLog.logEvent({
                    userId: adminId,
                    action: 'admin_action',
                    resource: 'authentication',
                    details: {
                        targetUserId: userId,
                        action: 'account_unlocked'
                    },
                    riskLevel: 'medium'
                })
            }

            return { success: true, message: 'Account unlocked' }
        } catch (error) {
            console.error('[UNLOCK ERROR]', error.message)
            return { success: false, error: error.message }
        }
    }

    /**
     * Reset failed attempts for successful login
     * @param {String} email
     */
    static async resetOnSuccessfulLogin(email) {
        try {
            const user = await userModel.findByEmail(email)
            if (user && user.loginAttempts > 0) {
                await user.resetFailedLoginAttempts()
            }
        } catch (error) {
            console.error('[RESET ERROR]', error.message)
        }
    }
}

// ============================================================
// ENHANCED AUTH CONTROLLER
// OWASP A07:2021 - Identification and Authentication Failures
// ============================================================

const emailService = require("../services/email.service")

/**
 * Register user with enhanced security
 */
async function registerUserController(req, res) {
    try {
        const { username, email, password, confirmPassword } = req.body

        // Validation
        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).json({
                message: "Please provide all required fields",
                code: 'MISSING_FIELDS'
            })
        }

        // Password validation
        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "Passwords do not match",
                code: 'PASSWORD_MISMATCH'
            })
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters",
                code: 'WEAK_PASSWORD'
            })
        }

        // Check for common weak passwords
        const commonPasswords = ['password', '12345678', 'qwerty', '123456']
        if (commonPasswords.some(p => password.toLowerCase() === p)) {
            return res.status(400).json({
                message: "Password is too common. Choose a stronger password",
                code: 'COMMON_PASSWORD'
            })
        }

        // Check if user already exists
        const existingUser = await userModel.findOne({
            $or: [{ username }, { email }]
        })

        if (existingUser) {
            return res.status(400).json({
                message: "Account already exists with this email address or username",
                code: 'USER_EXISTS'
            })
        }

        // Hash password with higher rounds
        const salt = await bcrypt.genSalt(12)
        const hashedPassword = await bcrypt.hash(password, salt)

        // Email verification setup
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

        // Create user
        const user = await userModel.create({
            username,
            email,
            password: hashedPassword,
            isEmailVerified: false,
            accountStatus: 'active',
            emailVerificationToken: verificationHash,
            emailVerificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        // Log registration
        await auditLog.logEvent({
            userId: user._id,
            username: user.username,
            email: user.email,
            action: 'user_registered',
            resource: 'authentication',
            details: {
                registrationMethod: 'email'
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            riskLevel: 'low'
        })

        await emailService.sendVerificationEmail(email, verificationToken);

        res.status(201).json({
            message: "User registered successfully. Please verify your email.",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        })
    } catch (error) {
        console.error('[REGISTRATION ERROR]', error)
        res.status(500).json({
            message: "Registration failed",
            code: 'REGISTRATION_ERROR'
        })
    }
}

/**
 * Enhanced login with token rotation and account lockout
 */
async function loginUserController(req, res) {
    try {
        const { email, password, deviceName = 'Web Browser' } = req.body

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                message: "Please provide email and password",
                code: 'MISSING_CREDENTIALS'
            })
        }

        const context = {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        }

        // Check account status
        const statusCheck = await AccountLockoutService.checkAccountStatus(email)
        if (statusCheck.locked) {
            await auditLog.logAuthEvent({
                email,
                action: 'login_failed',
                ...context,
                success: false,
                reason: 'account_locked'
            })

            return res.status(429).json({
                message: statusCheck.message,
                code: 'ACCOUNT_LOCKED',
                lockUntil: statusCheck.lockUntil
            })
        }

        // Find user
        const user = await userModel.findByEmail(email).select('+password')

        if (!user || !(await bcrypt.compare(password, user.password))) {
            // Record failed attempt
            const lockout = await AccountLockoutService.recordFailedAttempt(email, context)

            await auditLog.logAuthEvent({
                email,
                action: 'login_failed',
                ...context,
                success: false,
                reason: 'invalid_credentials',
                riskLevel: lockout?.locked ? 'high' : 'medium'
            })

            return res.status(401).json({
                message: lockout?.message || "Invalid email or password",
                code: 'INVALID_CREDENTIALS',
                attemptsRemaining: lockout?.attemptsRemaining
            })
        }

        // Check email verification
        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in",
                code: 'EMAIL_NOT_VERIFIED'
            })
        }

        // Reset lockout on successful login
        await AccountLockoutService.resetOnSuccessfulLogin(email)

        // Generate tokens
        const sessionId = crypto.randomBytes(16).toString('hex')
        const accessToken = jwt.sign(
            { id: user._id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || '15m' }
        )

        const refreshTokenValue = crypto.randomBytes(32).toString('hex')
        const refreshTokenHash = crypto
            .createHash('sha256')
            .update(refreshTokenValue)
            .digest('hex')

        // Create refresh token record
        const refreshToken = await refreshTokenModel.createToken({
            userId: user._id,
            token: refreshTokenValue,
            sessionId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            deviceFingerprint: req.get('User-Agent'), // Simple fingerprint
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        })

        // Create session record
        await user.createSession({
            sessionId,
            refreshTokenHash,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            deviceFingerprint: deviceName,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })

        // Record successful login
        await user.recordSuccessfulLogin({
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            deviceFingerprint: deviceName
        })

        // Log successful login
        await auditLog.logAuthEvent({
            userId: user._id,
            username: user.username,
            email: user.email,
            action: 'login_success',
            ...context,
            sessionId,
            success: true,
            riskLevel: 'low'
        })

        // Set secure cookie for refresh token
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        }

        res.cookie('refreshToken', refreshTokenValue, cookieOptions)

        res.status(200).json({
            message: "User logged in successfully",
            accessToken,
            refreshToken: refreshTokenValue, // Can be removed if using httpOnly cookie only
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            },
            expiresIn: process.env.JWT_EXPIRY || '15m'
        })
    } catch (error) {
        console.error('[LOGIN ERROR]', error)
        res.status(500).json({
            message: "Login failed",
            code: 'LOGIN_ERROR'
        })
    }
}

/**
 * Refresh access token with rotation
 */
async function refreshTokenController(req, res) {
    try {
        const refreshTokenValue = req.cookies.refreshToken || req.body.refreshToken

        if (!refreshTokenValue) {
            return res.status(401).json({
                message: "Refresh token not provided",
                code: 'MISSING_REFRESH_TOKEN'
            })
        }

        // Find refresh token record
        const tokenHash = crypto
            .createHash('sha256')
            .update(refreshTokenValue)
            .digest('hex')

        const refreshToken = await refreshTokenModel.findByHash(tokenHash)

        if (!refreshToken || !refreshToken.isValid()) {
            return res.status(401).json({
                message: "Invalid or expired refresh token",
                code: 'INVALID_REFRESH_TOKEN'
            })
        }

        // Check for replay attack
        if (refreshToken.status !== 'active') {
            await refreshTokenModel.revokeTokenFamily(
                refreshToken.tokenFamily,
                'token_reuse_detected'
            )

            return res.status(401).json({
                message: "Token reuse detected. All sessions revoked.",
                code: 'TOKEN_REUSE_DETECTED'
            })
        }

        // Get user
        const user = await userModel.findById(refreshToken.userId)

        if (!user || user.accountStatus !== 'active') {
            return res.status(403).json({
                message: "Account is not active",
                code: 'ACCOUNT_INACTIVE'
            })
        }

        // Generate new access token
        const newAccessToken = jwt.sign(
            { id: user._id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || '15m' }
        )

        // Generate new refresh token (rotation)
        const newRefreshTokenValue = crypto.randomBytes(32).toString('hex')
        const newRefreshTokenHash = crypto
            .createHash('sha256')
            .update(newRefreshTokenValue)
            .digest('hex')

        // Rotate token
        const newToken = await refreshToken.rotate({
            newTokenHash: newRefreshTokenHash,
            newToken: newRefreshTokenValue,
            newChildTokenHash: null,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })

        // Update session activity
        await user.updateSessionActivity(refreshToken.sessionId)

        // Mark old token as used
        await refreshToken.markAsUsed()

        // Set secure cookie
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        }

        res.cookie('refreshToken', newRefreshTokenValue, cookieOptions)

        res.status(200).json({
            message: "Token refreshed successfully",
            accessToken: newAccessToken,
            refreshToken: newRefreshTokenValue,
            expiresIn: process.env.JWT_EXPIRY || '15m'
        })
    } catch (error) {
        console.error('[REFRESH TOKEN ERROR]', error)
        res.status(500).json({
            message: "Token refresh failed",
            code: 'REFRESH_ERROR'
        })
    }
}

/**
 * Logout user
 */
async function logoutUserController(req, res) {
    try {
        const user = req.user
        const sessionId = req.body.sessionId
        const refreshToken = req.cookies.refreshToken

        if (!user) {
            return res.status(401).json({
                message: "Not authenticated"
            })
        }

        const userDoc = await userModel.findById(user.id)

        // Revoke session
        if (sessionId) {
            await userDoc.revokeSession(sessionId)
            await refreshTokenModel.revokeSession(user.id, sessionId, 'user_logout')
        }

        // Log logout
        await auditLog.logEvent({
            userId: user.id,
            username: user.username,
            action: 'logout',
            resource: 'authentication',
            details: {
                sessionId
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            riskLevel: 'low'
        })

        // Clear cookies
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        })

        res.status(200).json({
            message: "User logged out successfully"
        })
    } catch (error) {
        console.error('[LOGOUT ERROR]', error)
        res.status(500).json({
            message: "Logout failed"
        })
    }
}

/**
 * Get current user
 */
async function getMeController(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Not authenticated"
            })
        }

        const user = await userModel.findById(req.user.id)

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        res.status(200).json({
            message: "User details fetched successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                accountStatus: user.accountStatus,
                isEmailVerified: user.isEmailVerified,
                lastLogin: user.lastLogin,
                activeSessions: user.activeSessions.length
            }
        })
    } catch (error) {
        console.error('[GET ME ERROR]', error)
        res.status(500).json({
            message: "Failed to fetch user details"
        })
    }
}

module.exports = {
    registerUserController,
    loginUserController,
    refreshTokenController,
    logoutUserController,
    getMeController,
    AccountLockoutService
}
