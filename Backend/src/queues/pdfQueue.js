const { Queue } = require('bullmq');
const connection = require('../config/redis');

const pdfQueue = new Queue('pdf-generation', { connection });

module.exports = { pdfQueue, connection };
