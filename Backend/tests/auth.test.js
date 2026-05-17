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
        select: jest.fn().mockReturnThis(),
    };
    // Make mockQuery thenable
    mockQuery.then = function(resolve, reject) {
        return this.exec().then(resolve, reject);
    };

    return {
        findOne: jest.fn(() => mockQuery),
        create: jest.fn(),
        findById: jest.fn(() => mockQuery),
        findByEmail: jest.fn(() => mockQuery),
    };
});

jest.mock('../src/services/auditLog.service', () => ({
    logEvent: jest.fn().mockResolvedValue({ success: true }),
    logAuthEvent: jest.fn().mockResolvedValue({ success: true })
}));

const app = require('../src/app');
const userModel = require('../src/infrastructure/models/user.model');

describe('Auth Endpoints', () => {
    it('should fail login with wrong credentials', async () => {
        const mockUser = {
            id: 'user123',
            username: 'testuser',
            email: 'wrong@test.com',
            password: 'hashed_password', // Mock hashed password
            isAccountLocked: jest.fn().mockReturnValue(false),
            incFailedLoginAttempts: jest.fn().mockResolvedValue(1)
        };

        const mockQuery = {
            select: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(mockUser),
        };
        mockQuery.then = function(resolve, reject) {
            return this.exec().then(resolve, reject);
        };

        // Mock findByEmail to return the thenable mock query
        userModel.findByEmail.mockReturnValue(mockQuery);
        
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'wrong@test.com', password: 'password' });
            
        expect(res.statusCode).toEqual(401); // Controller returns 401 for invalid credentials
    }, 15000);
});
