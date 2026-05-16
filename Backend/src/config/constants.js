const constants = {
    RATE_LIMIT: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 100,
        AUTH_WINDOW_MS: 60 * 60 * 1000, // 1 hour
        AUTH_MAX_REQUESTS: 20,
    },
    SERVER: {
        BODY_LIMIT: '10kb',
    },
    QUEUE: {
        PDF_CONCURRENCY: 2,
    }
};

module.exports = constants;
