const Redis = require('ioredis');
const { REDIS_HOST, REDIS_PORT } = require('./env');

const sharedRedisConnection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null, // Required for BullMQ
});

sharedRedisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
});

module.exports = sharedRedisConnection;
