require('dotenv').config();

const requiredEnvs = ['MONGO_URI', 'JWT_SECRET', 'GOOGLE_GENAI_API_KEY'];

const validateEnv = () => {
    const missing = requiredEnvs.filter(env => !process.env[env]);
    if (missing.length > 0) {
        console.error(`FATAL: Missing environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
};

module.exports = {
    validateEnv,
    PORT: process.env.PORT || 3000,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'development'
};
