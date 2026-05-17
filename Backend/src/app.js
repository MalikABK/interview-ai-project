const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const requestId = require('./shared/requestId.middleware')
const errorHandler = require("./middlewares/error.middleware")
const logger = require("./config/logger")
const { CORS_ORIGIN } = require("./config/env")
const v1Router = require('./api/v1')

// Import new security middleware suite
const {
    applySecurityMiddleware,
    csrfErrorHandler
} = require("./middlewares/security.middleware")

const app = express()

// 1. Apply Security Middleware Suite
applySecurityMiddleware(app)

// 2. Request ID & Logging
app.use(requestId)
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} [${req.requestId}]`);
    next();
});

// 3. CORS Configuration
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}))

// 4. Versioned API
app.use('/api/v1', v1Router)

// 5. CSRF Error Handler
app.use(csrfErrorHandler)

// 6. Global Error Handler
app.use(errorHandler)

module.exports = app
