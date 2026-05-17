const request = require('supertest');

jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => {
        return {
            on: jest.fn(),
            call: jest.fn(),
            set: jest.fn(),
            get: jest.fn(),
            quit: jest.fn(),
        };
    });
});

jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn(),
        getJob: jest.fn(),
        on: jest.fn(),
    })),
    Worker: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
    })),
}));

jest.mock('../src/infrastructure/models/user.model', () => {
    const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn(),
    };
    return {
        findOne: jest.fn(() => mockQuery),
        create: jest.fn(),
        findById: jest.fn(() => mockQuery),
    };
});

const app = require('../src/app');
const userModel = require('../src/infrastructure/models/user.model');

describe('Auth Endpoints', () => {
    it('should fail login with wrong credentials', async () => {
        // Mock findOne to return a user object
        userModel.findOne.mockReturnValue({
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(null)
        });
        
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'wrong@test.com', password: 'password' });
        // The service layer throws 400 when user is not found.
        expect(res.statusCode).toEqual(400);
    }, 10000);
});
