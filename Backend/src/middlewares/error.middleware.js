const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    err.errorCode = err.errorCode || 'INTERNAL_ERROR';

    // Log the error
    if (err.statusCode >= 500) {
        logger.error(`[${err.errorCode}] ${err.message}\n${err.stack}`);
    } else {
        logger.warn(`[${err.errorCode}] ${err.message}`);
    }

    // Specific Mongoose/DB Error handling
    if (err.name === 'CastError') {
        err.message = `Invalid ${err.path}: ${err.value}`;
        err.statusCode = 400;
        err.errorCode = 'INVALID_ID';
    }
    
    if (err.code === 11000) {
        const match = err.errmsg.match(/(["'])(\\?.)*?\1/);
        const value = match ? match[0] : 'unknown';
        err.message = `Duplicate field value: ${value}. Please use another value!`;
        err.statusCode = 409;
        err.errorCode = 'DUPLICATE_FIELD';
    }

    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(el => el.message);
        err.message = `Invalid input data. ${messages.join('. ')}`;
        err.statusCode = 400;
        err.errorCode = 'VALIDATION_ERROR';
    }

    // JWT Errors
    if (err.name === 'JsonWebTokenError') {
        err.message = 'Invalid token. Please log in again!';
        err.statusCode = 401;
        err.errorCode = 'INVALID_TOKEN';
    }

    if (err.name === 'TokenExpiredError') {
        err.message = 'Your token has expired! Please log in again.';
        err.statusCode = 401;
        err.errorCode = 'TOKEN_EXPIRED';
    }

    // Response shape
    const response = {
        success: false,
        status: err.status,
        errorCode: err.errorCode,
        message: err.message,
        ...(err.errors && err.errors.length > 0 && { errors: err.errors }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    };

    res.status(err.statusCode).json(response);
};

module.exports = errorHandler;
