const request = require('supertest');
const app = require('../../src/index');
const User = require('../../src/models/User');
const stripe = require('../../src/config/stripe');

jest.mock('../../src/config/stripe');

describe('Auth API', () => {
    beforeEach(async () => {
        // Clear users before each test to ensure isolation
        await User.deleteMany({});
        // Reset and mock stripe customer creation for auth tests
        stripe.customers.create.mockClear();
        stripe.customers.create.mockResolvedValue({ id: 'cus_mock_123' });
    });

    it('should register a new user successfully', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token');

        const user = await User.findOne({ email: 'test@example.com' });
        expect(user).not.toBeNull();
        expect(user.plan).toBe('free');
    });

    it('should fail to register a user with an existing email', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });
        
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password456',
            });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('msg', 'User already exists');
    });

    it('should login an existing user and return a token', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });
        
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token');
    });

    it('should fail to login with invalid credentials', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });
        
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'wrongpassword',
            });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('msg', 'Invalid Credentials');
    });

    it('should get the current user with a valid token', async () => {
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'me@example.com',
                password: 'password123',
            });
        
        const token = registerRes.body.token;

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('x-auth-token', token);
        
        expect(meRes.statusCode).toEqual(200);
        expect(meRes.body).toHaveProperty('email', 'me@example.com');
        expect(meRes.body).not.toHaveProperty('password');
    });
});
