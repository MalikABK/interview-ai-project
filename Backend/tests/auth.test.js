const request = require('supertest');

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

jest.mock('../src/models/user.model', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
}));

const app = require('../src/app');
const userModel = require('../src/models/user.model');

describe('Auth Endpoints', () => {
    it('should fail login with wrong credentials', async () => {
        userModel.findOne.mockResolvedValue(null);
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'wrong@test.com', password: 'password' });
        expect(res.statusCode).toEqual(400);
    }, 10000);
});
