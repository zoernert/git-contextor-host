const request = require('supertest');
const app = require('../../src/index');
const User = require('../../src/models/User');
const Tunnel = require('../../src/models/Tunnel');
const Usage = require('../../src/models/Usage');
const stripe = require('../../src/config/stripe');
const NginxManager = require('../../src/services/NginxManager');

jest.mock('../../src/services/NginxManager');
jest.mock('../../src/config/stripe');

describe('Tunnels API', () => {
    let token;
    let userId;

    // Use beforeEach for full isolation
    beforeEach(async () => {
        // Clear all mocks and database before each test
        jest.clearAllMocks();
        await User.deleteMany({});
        await Tunnel.deleteMany({});
        await Usage.deleteMany({});

        // Mock external services
        stripe.customers.create.mockResolvedValue({ id: 'cus_mock_tunnel_user' });
        NginxManager.mock.instances[0].createProxyHost.mockResolvedValue({ id: 123, scheme: 'https' });
        NginxManager.mock.instances[0].deleteProxyHost.mockResolvedValue({ message: 'Proxy host deleted' });

        // Create a fresh user and token for each test
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'tunneluser@example.com',
                password: 'password123',
            });
        token = userRes.body.token;
        const user = await User.findOne({ email: 'tunneluser@example.com' });
        userId = user.id;
    });


    it('should create a new tunnel for an authenticated user', async () => {
        const res = await request(app)
            .post('/api/tunnels')
            .set('x-auth-token', token)
            .send({ localPort: 3000 });
        
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('subdomain');
        expect(res.body.userId).toBe(userId);
        expect(NginxManager.mock.instances[0].createProxyHost).toHaveBeenCalledTimes(1);
    });

    it('should not create a tunnel if port is not provided', async () => {
        const res = await request(app)
            .post('/api/tunnels')
            .set('x-auth-token', token)
            .send({});
        expect(res.statusCode).toEqual(400);
    });

    it('should delete an existing tunnel', async () => {
        const createRes = await request(app).post('/api/tunnels').set('x-auth-token', token).send({ localPort: 3000 });
        const tunnelId = createRes.body._id;

        const deleteRes = await request(app).delete(`/api/tunnels/${tunnelId}`).set('x-auth-token', token);
        expect(deleteRes.statusCode).toEqual(200);
        expect(NginxManager.mock.instances[0].deleteProxyHost).toHaveBeenCalledWith(123);
        const tunnelInDb = await Tunnel.findById(tunnelId);
        expect(tunnelInDb.isActive).toBe(false);
    });

    it("should not allow a user to delete another user's tunnel", async () => {
        const createRes = await request(app).post('/api/tunnels').set('x-auth-token', token).send({ localPort: 3000 });
        const tunnelId = createRes.body._id;

        // Create another user and token
        stripe.customers.create.mockResolvedValue({ id: 'cus_mock_other_user' });
        const otherUserRes = await request(app).post('/api/auth/register').send({ email: 'other@example.com', password: 'password123' });
        const otherToken = otherUserRes.body.token;

        // Attempt to delete with other user's token
        const deleteRes = await request(app).delete(`/api/tunnels/${tunnelId}`).set('x-auth-token', otherToken);
        expect(deleteRes.statusCode).toEqual(500);
        expect(deleteRes.body.msg).toContain('permission denied');
    });

    it('should get stats for a tunnel', async () => {
        const createRes = await request(app).post('/api/tunnels').set('x-auth-token', token).send({ localPort: 3000 });
        const tunnelId = createRes.body._id;

        await Usage.create({ tunnelId, userId, dataTransferred: 1024 });
        await Usage.create({ tunnelId, userId, dataTransferred: 2048 });

        const statsRes = await request(app).get(`/api/tunnels/${tunnelId}/stats`).set('x-auth-token', token);
        expect(statsRes.statusCode).toEqual(200);
        expect(statsRes.body.tunnelId).toBe(tunnelId);
        expect(statsRes.body.totalDataTransferred).toBe(3072);
    });
});
