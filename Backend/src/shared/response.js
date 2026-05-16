const sendSuccess = (res, data, status = 200) => {
    return res.status(status).json({
        success: true,
        ...data
    });
};

const sendError = (res, message, status = 500, errorCode = 'INTERNAL_ERROR', errors = []) => {
    return res.status(status).json({
        success: false,
        message,
        errorCode,
        errors
    });
};

module.exports = { sendSuccess, sendError };
