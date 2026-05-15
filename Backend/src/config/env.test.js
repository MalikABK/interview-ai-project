const { validateConfig } = require('./env');

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should throw error when MONGO_URI is missing', () => {
    delete process.env.MONGO_URI;
    expect(() => validateConfig()).toThrow('Missing required environment variables: MONGO_URI');
  });

  test('should not throw error when all required envs are present', () => {
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';
    process.env.JWT_SECRET = 'secret';
    process.env.GOOGLE_GENAI_API_KEY = 'key';
    expect(() => validateConfig()).not.toThrow();
  });
});
