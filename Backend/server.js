require("dotenv").config()
const { validateConfig, PORT } = require("./src/config/env");
validateConfig();

const app = require("./src/app")
const connectToDB = require("./src/config/database")
const mongoose = require("mongoose")
const logger = require("./src/config/logger")

let server;

connectToDB().then(() => {
    const worker = require("./src/queues/pdfWorker")
    
    server = app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`)
    })

    const gracefulShutdown = async (signal) => {
        logger.info(`\u26a0 Received ${signal}. Starting graceful shutdown...`);

        // 1. Close HTTP server
        if (server) {
            server.close(() => {
                logger.info('HTTP server closed.');
            });
        }

        // 2. Close BullMQ Worker
        try {
            await worker.close();
            logger.info('BullMQ Worker closed.');
        } catch (err) {
            logger.error('Error closing BullMQ worker:', err);
        }

        // 3. Close Database connection
        try {
            await mongoose.connection.close();
            logger.info('Database connection closed.');
            process.exit(0);
        } catch (err) {
            logger.error('Error closing Database connection:', err);
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})