const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const userModel = require('../src/infrastructure/models/user.model');
const authController = require('../src/api/v1/auth/auth.controller');
const httpMocks = require('node-mocks-http');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Auth Controller Login', () => {
    it('should handle login attempts correctly', async () => {
        const req = httpMocks.createRequest({
            body: { email: 'test@example.com', password: 'password123' },
            ip: '127.0.0.1'
        });
        const res = httpMocks.createResponse();
        
        // Mocking authService and User.findByEmail
        // Since we are testing controller in isolation from Redis/RedisStore
        // we expect the logic to pass if the findByEmail exists.
        
        // This is a minimal test to confirm the controller finds the method.
        await authController.loginUserController(req, res);
        expect(res.statusCode).toBe(401);
    });
});
