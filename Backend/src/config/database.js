const mongoose = require("mongoose")
const logger = require("./logger")

async function connectToDB() {
    const maxRetries = 5;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            await mongoose.connect(process.env.MONGO_URI);
            logger.info("Connected to Database");
            return;
        } catch (err) {
            retries++;
            logger.error(`Database connection attempt ${retries} failed: ${err.message}`);
            
            if (retries === maxRetries) {
                logger.error("Max retries reached. Exiting process...");
                process.exit(1);
            }

            // Wait for 5 seconds before retrying
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}

module.exports = connectToDB