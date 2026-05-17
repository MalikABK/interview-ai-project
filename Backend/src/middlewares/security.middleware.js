const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = require('express-rate-limit')
const helmet = require('helmet')
const csrf = require('csurf')
const cookieParser = require('cookie-parser')
const { validationResult } = require('express-validator')

// ============================================================
// 1. RATE LIMITING MIDDLEWARE (OWASP A4 - Insecure Design)
// ============================================================

/**
 * General API rate limiter - applies to all routes
 * Window: 15 minutes, Max: 100 requests
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health'
    },
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise use IP
        return req.user?.id || ipKeyGenerator(req)
    }
})

/**
 * Strict rate limiter for authentication endpoints
 * Window: 15 minutes, Max: 5 attempts
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    message: {
        message: 'Too many authentication attempts, please try again after 15 minutes',
        retryAfter: 15 * 60
    },
    handler: (req, res) => {
        res.status(429).json({
            message: 'Too many authentication attempts. Account temporarily locked.',
            retryAfter: '15 minutes'
        })
    },
    keyGenerator: (req) => {
        // Rate limit by email + IP combination
        return `${req.body?.email || 'unknown'}:${ipKeyGenerator(req)}`
    }
})

/**
 * Refresh token limiter
 * Window: 1 minute, Max: 3 requests
 */
const refreshTokenLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 3,
    message: 'Too many token refresh attempts',
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
        return req.user?.id || ipKeyGenerator(req)
    }
})

/**
 * File upload limiter
 * Window: 1 hour, Max: 10 uploads
 */
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many file uploads',
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        return req.user?.id || ipKeyGenerator(req)
    }
})

/**
 * Password reset limiter
 * Window: 1 hour, Max: 3 attempts
 */
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many password reset attempts',
    keyGenerator: (req) => {
        return `${req.body?.email || 'unknown'}:${ipKeyGenerator(req)}`
    }
})

// ============================================================
// 2. HTTPS ENFORCEMENT MIDDLEWARE
// ============================================================

/**
 * Enforce HTTPS in production
 * Redirect HTTP to HTTPS and set HSTS header
 */
const httpsEnforcer = (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        if (req.header('x-forwarded-proto') !== 'https' && !req.secure) {
            return res.redirect(301, `https://${req.get('host')}${req.url}`)
        }
    }
    next()
}

/**
 * Helmet.js configuration - Security headers
 * Includes: CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc.
 */
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    strictTransportSecurity: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    xFrameOptions: { action: 'deny' },
    xXssProtection: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hidePoweredBy: true,
    noSniff: true
})

// ============================================================
// 3. CSRF PROTECTION MIDDLEWARE
// ============================================================

const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
})

/**
 * CSRF error handler
 */
const csrfErrorHandler = (err, req, res, next) => {
    if (err.code !== 'EBADCSRFTOKEN') return next(err)
    
    res.status(403).json({
        message: 'Invalid CSRF token',
        code: 'CSRF_VALIDATION_FAILED'
    })
}

/**
 * Middleware to attach CSRF token to response
 */
const csrfTokenMiddleware = (req, res, next) => {
    res.locals.csrfToken = req.csrfToken()
    next()
}

// ============================================================
// 4. INPUT SANITIZATION & VALIDATION MIDDLEWARE
// ============================================================

/**
 * Validate and sanitize request body
 */
const sanitizeRequestBody = (req, res, next) => {
    if (!req.body) return next()

    // Remove null bytes
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj.replace(/\0/g, '')
        }
        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                obj[key] = sanitize(obj[key])
            }
        }
        return obj
    }

    req.body = sanitize(req.body)
    next()
}

/**
 * Limit request size
 */
const requestSizeLimit = require('express').json({ limit: '10mb' })

/**
 * Validate request content type
 */
const validateContentType = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type')
        
        if (!contentType || !['application/json', 'multipart/form-data'].some(type => contentType.includes(type))) {
            return res.status(415).json({
                message: 'Unsupported Media Type. Only application/json or multipart/form-data allowed.'
            })
        }
    }
    next()
}

// ============================================================
// 5. REQUEST/RESPONSE LOGGING MIDDLEWARE
// ============================================================

/**
 * Log security-relevant events
 */
const securityLogging = (req, res, next) => {
    const originalJson = res.json

    res.json = function(data) {
        // Log failed authentication attempts
        if (res.statusCode >= 400 && req.path.includes('/auth')) {
            console.log(`[SECURITY] Auth failure - ${req.method} ${req.path} from ${req.ip}`)
        }

        // Log high-status error codes
        if (res.statusCode >= 500) {
            console.log(`[SECURITY] Server error - ${req.method} ${req.path} - ${res.statusCode}`)
        }

        return originalJson.call(this, data)
    }

    next()
}

// ============================================================
// 6. PROXY TRUST CONFIGURATION
// ============================================================

/**
 * Trust proxy settings for rate limiting and IP detection
 * Call this in your Express app: app.use(trustProxyConfig)
 */
const trustProxyConfig = (req, res, next) => {
    // Trust X-Forwarded-For header behind reverse proxy
    // Adjust based on your infrastructure
    if (process.env.TRUST_PROXY) {
        req.app.set('trust proxy', parseInt(process.env.TRUST_PROXY) || 1)
    }
    next()
}

// ============================================================
// 7. SECURITY HEADERS UTILITY FUNCTIONS
// ============================================================

/**
 * Generate secure cookie options
 */
const getSecureCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
})

/**
 * Generate security response headers
 */
const addSecurityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY')
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff')
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block')
    
    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    
    // Prevent caching of sensitive data
    if (req.path.includes('/api/auth') || req.path.includes('/api/user')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
    }
    
    next()
}

// ============================================================
// 8. VALIDATION ERROR HANDLER
// ============================================================

/**
 * Handle validation errors from express-validator
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        })
    }
    next()
}

// ============================================================
// 9. COMBINED MIDDLEWARE SUITE
// ============================================================

/**
 * Apply all security middleware to Express app
 */
const applySecurityMiddleware = (app) => {
    // Trust proxy (must be early)
    app.use(trustProxyConfig)

    // HTTPS enforcement
    app.use(httpsEnforcer)

    // Security headers
    app.use(helmetConfig)
    app.use(addSecurityHeaders)

    // Request validation
    app.use(validateContentType)
    app.use(requestSizeLimit)
    app.use(sanitizeRequestBody)

    // Rate limiting
    app.use(generalLimiter)

    // CSRF protection setup
    app.use(cookieParser())
    if (process.env.NODE_ENV !== 'test') {
        app.use(csrfProtection)
        app.use(csrfTokenMiddleware)
    }

    // Logging
    app.use(securityLogging)
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    // Rate limiters
    generalLimiter,
    authLimiter,
    refreshTokenLimiter,
    uploadLimiter,
    passwordResetLimiter,

    // HTTPS
    httpsEnforcer,
    helmetConfig,

    // CSRF
    csrfProtection,
    csrfErrorHandler,
    csrfTokenMiddleware,

    // Sanitization & Validation
    sanitizeRequestBody,
    requestSizeLimit,
    validateContentType,
    handleValidationErrors,

    // Logging
    securityLogging,

    // Headers
    addSecurityHeaders,
    getSecureCookieOptions,

    // Utilities
    trustProxyConfig,

    // Combined
    applySecurityMiddleware
}
