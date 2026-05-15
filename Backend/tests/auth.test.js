const request = require('supertest');
const app = require('../src/app');

describe('Auth Endpoints', () => {
    it('should fail login with wrong credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'wrong@test.com', password: 'password' });
        expect(res.statusCode).toEqual(400);
    }, 10000);
});
