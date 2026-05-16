const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const helmet = require("helmet")
const requestId = require('./shared/requestId.middleware')
const errorHandler = require("./middlewares/error.middleware")
const logger = require("./config/logger")
const { CORS_ORIGIN } = require("./config/env")
const v1Router = require('./api/v1')
const rateLimit = require("express-rate-limit")
const { RedisStore } = require("rate-limit-redis")
const redisClient = require("./config/redis")
const { RATE_LIMIT } = require("./config/constants")

const app = express()

// 0. Trust Proxy & Request ID
app.set('trust proxy', 1)
app.use(requestId)

// 1. Set Security HTTP Headers (Helmet)
app.use(helmet())

// 2. Global Rate Limiting (Redis-backed)
const limiter = rateLimit({
    windowMs: RATE_LIMIT.WINDOW_MS,
    max: RATE_LIMIT.MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again in 15 minutes!',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
})
app.use("/api", limiter)

// 3. Stricter Rate Limiting for Auth
const authLimiter = rateLimit({
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
    max: RATE_LIMIT.AUTH_MAX_REQUESTS,
    message: 'Too many login attempts, please try again in an hour!',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: 'rl-auth:',
    }),
})
app.use("/api/v1/auth/login", authLimiter)
app.use("/api/v1/auth/register", authLimiter)

// 4. Logging with Request ID
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} [${req.requestId}]`);
    next();
});

// 3. Body Parsers
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())

// 4. CORS Configuration
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}))

// 5. Versioned API
app.use('/api/v1', v1Router)

// 6. Backward-compatibility aliases
app.use('/api/auth', (req, res) => {
    res.redirect(301, req.originalUrl.replace('/api/auth', '/api/v1/auth'))
})
app.use('/api/interview', (req, res) => {
    res.redirect(301, req.originalUrl.replace('/api/interview', '/api/v1/interview'))
})

// 7. Global Error Handler
app.use(errorHandler)

module.exports = app
