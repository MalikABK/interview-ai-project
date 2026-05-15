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

  test('should throw error when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => validateConfig()).toThrow('Missing required environment variables: DATABASE_URL');
  });

  test('should not throw error when DATABASE_URL is present', () => {
    process.env.DATABASE_URL = 'mongodb://localhost:27017/test';
    expect(() => validateConfig()).not.toThrow();
  });
});
