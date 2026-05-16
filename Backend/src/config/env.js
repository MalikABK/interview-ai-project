const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().transform(Number).default('3000'),
    MONGO_URI: z.string().url(),
    JWT_SECRET: z.string().min(8),
    GOOGLE_GENAI_API_KEY: z.string().min(1),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().transform(Number).default('6379'),
});

const validateEnv = (config) => {
    const parsedEnv = envSchema.safeParse(config);

    if (!parsedEnv.success) {
        if (process.env.NODE_ENV === 'test') {
            const missingFields = parsedEnv.error.issues
                .filter(issue => issue.code === 'invalid_type' && issue.received === 'undefined')
                .map(issue => issue.path[0]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required environment variables: ${missingFields.join(', ')}`);
            }
            throw new Error(`Invalid environment variables: ${JSON.stringify(parsedEnv.error.format())}`);
        }
        
        console.error('\u274c Invalid environment variables:', parsedEnv.error.format());
        process.exit(1);
    }

    return parsedEnv.data;
};

const config = validateEnv({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
});

module.exports = {
    validateConfig: () => validateEnv(process.env), // Kept for tests
    ...config
};
