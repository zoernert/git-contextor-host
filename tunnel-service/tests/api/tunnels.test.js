const request = require('supertest');
const app = require('../../src/index');
const User = require('../../src/models/User');
const Tunnel = require('../../src/models/Tunnel');
const stripe = require('../../src/config/stripe');

// Mock NginxManager before it's imported by any other module
const mockCreateProxyHost = jest.fn();
const mockDeleteProxyHost = jest.fn();
jest.mock('../../src/services/NginxManager', () => {
  return jest.fn().mockImplementation(() => {
    return {
      createProxyHost: mockCreateProxyHost,
      deleteProxyHost: mockDeleteProxyHost,
    };
  });
});

jest.mock('../../src/config/stripe');

describe('Tunnels API', () => {
    let token;
    let userId;

    beforeAll(async () => {
        // Mock stripe before registering a user
        stripe.customers.create.mockResolvedValue({ id: 'cus_mock_tunnel_user' });

        // Create a user and get a token once for all tests in this suite
        await User.deleteMany({});
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

    beforeEach(async () => {
        await Tunnel.deleteMany({});
        // Reset mock functions before each test
        mockCreateProxyHost.mockClear();
        mockDeleteProxyHost.mockClear();
        // Reset mock implementations to defaults
        mockCreateProxyHost.mockResolvedValue({ id: 123, scheme: 'https' });
        mockDeleteProxyHost.mockResolvedValue({ message: 'Proxy host deleted' });
    });

    it('should create a new tunnel for an authenticated user', async () => {
        const res = await request(app)
            .post('/api/tunnels')
            .set('x-auth-token', token)
            .send({ localPort: 3000 });
        
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('subdomain');
        expect(res.body).toHaveProperty('localPort', 3000);
        expect(res.body.userId).toBe(userId);

        expect(mockCreateProxyHost).toHaveBeenCalledTimes(1);

        const tunnelInDb = await Tunnel.findById(res.body._id);
        expect(tunnelInDb).not.toBeNull();
        expect(tunnelInDb.isActive).toBe(true);
    });

    it('should not create a tunnel if port is not provided', async () => {
        const res = await request(app)
            .post('/api/tunnels')
            .set('x-auth-token', token)
            .send({}); // No localPort
        
        expect(res.statusCode).toEqual(400);
        expect(res.body.errors[0].msg).toContain('Local port is required');
    });

    it('should delete an existing tunnel', async () => {
        const createRes = await request(app)
            .post('/api/tunnels')
            .set('x-auth-token', token)
            .send({ localPort: 3000 });
        
        const tunnelId = createRes.body._id;

        const deleteRes = await request(app)
            .delete(`/api/tunnels/${tunnelId}`)
            .set('x-auth-token', token);

        expect(deleteRes.statusCode).toEqual(200);
        expect(deleteRes.body).toHaveProperty('msg', 'Tunnel destroyed');
        
        expect(mockDeleteProxyHost).toHaveBeenCalledTimes(1);
        expect(mockDeleteProxyHost).toHaveBeenCalledWith(123);

        const tunnelInDb = await Tunnel.findById(tunnelId);
        expect(tunnelInDb.isActive).toBe(false);
    });

     it("should not allow a user to delete another user's tunnel", async () => {
        // Create tunnel with user 1
        const createRes = await request(app)
            .post('/api/tunnels')
            .set('x-auth-token', token)
            .send({ localPort: 3000 });
        const tunnelId = createRes.body._id;

        // Create another user and token
        stripe.customers.create.mockResolvedValue({ id: 'cus_mock_other_user' });
        const otherUserRes = await request(app)
            .post('/api/auth/register')
            .send({ email: 'other@example.com', password: 'password123' });
        const otherToken = otherUserRes.body.token;

        // Attempt to delete with other user's token
        const deleteRes = await request(app)
            .delete(`/api/tunnels/${tunnelId}`)
            .set('x-auth-token', otherToken);
        
        expect(deleteRes.statusCode).toEqual(500);
        expect(deleteRes.body.msg).toContain('permission denied');

        const tunnelInDb = await Tunnel.findById(tunnelId);
        expect(tunnelInDb.isActive).toBe(true);
    });
});
