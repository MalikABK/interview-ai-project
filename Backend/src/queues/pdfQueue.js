const { Queue } = require('bullmq');

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
};

const pdfQueue = new Queue('pdf-generation', { connection });

module.exports = { pdfQueue, connection };
