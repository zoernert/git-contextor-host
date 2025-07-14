const mongoose = require('mongoose');
const connectDB = require('../../src/config/database');

// Mock dependencies before importing TunnelManager
jest.mock('../../src/services/NginxManager', () => {
    return jest.fn().mockImplementation(() => ({
        createProxyHost: jest.fn().mockResolvedValue({ id: 123, scheme: 'https' }),
        deleteProxyHost: jest.fn().mockResolvedValue({ message: 'Deleted' })
    }));
});

jest.mock('../../src/services/UsageTracker', () => ({
    canTransfer: jest.fn().mockResolvedValue(true),
    trackData: jest.fn().mockResolvedValue()
}));

const TunnelManager = require('../../src/services/TunnelManager');
const User = require('../../src/models/User');
const Tunnel = require('../../src/models/Tunnel');
const NginxManager = require('../../src/services/NginxManager');
const UsageTracker = require('../../src/services/UsageTracker');

describe('TunnelManager', () => {
    let user;

    beforeAll(async () => {
        await connectDB();
    });

    beforeEach(async () => {
        // Clear database
        await User.deleteMany({});
        await Tunnel.deleteMany({});

        // Create test user
        user = await User.create({
            email: 'test@example.com',
            password: 'hashedpassword',
            apiKey: 'test-api-key-12345678901234567890',
            stripeCustomerId: 'cus_test123',
            plan: 'basic'
        });

        // Reset mocks
        jest.clearAllMocks();
        UsageTracker.canTransfer.mockResolvedValue(true);
        UsageTracker.trackData.mockResolvedValue();
    });

    describe('createTunnel', () => {
        it('should create a tunnel successfully', async () => {
            const tunnel = await TunnelManager.createTunnel(user.id, 3000);

            expect(tunnel).toBeDefined();
            expect(tunnel.userId.toString()).toBe(user.id);
            expect(tunnel.localPort).toBe(3000);
            expect(tunnel.subdomain).toBeDefined();
            expect(tunnel.tunnelPath).toBeDefined();
            expect(tunnel.connectionId).toBeDefined();
            expect(tunnel.isActive).toBe(true);
            expect(tunnel.proxyHostId).toBeNull(); // Current implementation skips Nginx proxy
        });

        it('should create a tunnel with custom subdomain', async () => {
            const options = {
                requestedSubdomain: 'custom-test',
                metadata: { gitContextorShare: true }
            };

            const tunnel = await TunnelManager.createTunnel(user.id, 3000, options);

            expect(tunnel.subdomain).toBe('custom-test');
            expect(tunnel.metadata.gitContextorShare).toBe(true);
            expect(tunnel.proxyHostId).toBeNull(); // Current implementation skips Nginx proxy
        });

        it('should throw error for non-existent user', async () => {
            const fakeUserId = '507f1f77bcf86cd799439011';
            
            await expect(TunnelManager.createTunnel(fakeUserId, 3000))
                .rejects
                .toThrow('User not found');
        });

        it('should handle database errors gracefully', async () => {
            // Mock database error by using invalid ObjectId format
            await expect(TunnelManager.createTunnel('invalid-user-id', 3000))
                .rejects
                .toThrow('Cast to ObjectId failed');
        });
    });

    describe('destroyTunnel', () => {
        let tunnel;

        beforeEach(async () => {
            tunnel = await TunnelManager.createTunnel(user.id, 3000);
        });

        it('should destroy tunnel successfully', async () => {
            const result = await TunnelManager.destroyTunnel(tunnel._id, user.id);

            expect(result.msg).toBe('Tunnel destroyed');
            
            // Check that tunnel is marked as inactive
            const updatedTunnel = await Tunnel.findById(tunnel._id);
            expect(updatedTunnel.isActive).toBe(false);
        });

        it('should throw error for non-existent tunnel', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            
            await expect(TunnelManager.destroyTunnel(fakeId, user.id))
                .rejects
                .toThrow('Tunnel not found or permission denied');
        });

        it('should throw error when user tries to destroy another user\'s tunnel', async () => {
            const otherUser = await User.create({
                email: 'other@example.com',
                password: 'hashedpassword',
                apiKey: 'other-api-key-12345678901234567890',
                stripeCustomerId: 'cus_other123',
                plan: 'basic'
            });

            await expect(TunnelManager.destroyTunnel(tunnel._id, otherUser.id))
                .rejects
                .toThrow('Tunnel not found or permission denied');
        });
    });

    describe('proxyRequest', () => {
        let tunnel;
        let mockReq;
        let mockRes;
        let mockWs;

        beforeEach(async () => {
            tunnel = await TunnelManager.createTunnel(user.id, 3000);
            
            mockReq = {
                method: 'GET',
                originalUrl: '/test',
                headers: { 'host': 'example.com' },
                body: Buffer.from('test body'),
                on: jest.fn()
            };

            mockRes = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
                set: jest.fn()
            };

            mockWs = {
                readyState: 1, // WebSocket.OPEN
                OPEN: 1,
                send: jest.fn(),
                terminate: jest.fn(),
                userId: user.id,
                tunnelId: tunnel._id
            };

            // Mock the connection
            TunnelManager.connections.set(tunnel.connectionId, mockWs);
        });

        it('should proxy request successfully', async () => {
            await TunnelManager.proxyRequest(tunnel.connectionId, mockReq, mockRes);

            expect(mockWs.send).toHaveBeenCalled();
            expect(UsageTracker.canTransfer).toHaveBeenCalledWith(user.id, mockReq.body.length);
            expect(UsageTracker.trackData).toHaveBeenCalledWith(
                { _id: tunnel._id, userId: user.id }, 
                mockReq.body.length
            );
        });

        it('should handle closed connection', async () => {
            TunnelManager.connections.delete(tunnel.connectionId);

            await TunnelManager.proxyRequest(tunnel.connectionId, mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(502);
            expect(mockRes.send).toHaveBeenCalledWith('Bad Gateway: Tunnel client not connected.');
        });

        it('should handle data transfer limit exceeded', async () => {
            UsageTracker.canTransfer.mockResolvedValue(false);

            await TunnelManager.proxyRequest(tunnel.connectionId, mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.send).toHaveBeenCalledWith('Data transfer limit reached.');
            expect(mockWs.terminate).toHaveBeenCalled();
        });
    });

    describe('handleTunnelResponse', () => {
        let tunnel;
        let mockWs;
        let mockRes;

        beforeEach(async () => {
            tunnel = await TunnelManager.createTunnel(user.id, 3000);
            
            mockWs = {
                userId: user.id,
                tunnelId: tunnel._id,
                terminate: jest.fn()
            };

            mockRes = {
                status: jest.fn().mockReturnThis(),
                set: jest.fn(),
                send: jest.fn()
            };

            TunnelManager.httpRequests.set('test-request-id', mockRes);
        });

        it('should handle http response successfully', async () => {
            const responseMessage = JSON.stringify({
                type: 'http-response',
                data: {
                    id: 'test-request-id',
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: Buffer.from('{"result": "success"}').toString('base64')
                }
            });

            await TunnelManager.handleTunnelResponse(responseMessage, mockWs);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.set).toHaveBeenCalledWith({ 'content-type': 'application/json' });
            expect(mockRes.send).toHaveBeenCalled();
            expect(UsageTracker.canTransfer).toHaveBeenCalled();
        });

        it('should handle data transfer limit exceeded in response', async () => {
            UsageTracker.canTransfer.mockResolvedValue(false);

            const responseMessage = JSON.stringify({
                type: 'http-response',
                data: {
                    id: 'test-request-id',
                    status: 200,
                    headers: {},
                    body: Buffer.from('large response').toString('base64')
                }
            });

            await TunnelManager.handleTunnelResponse(responseMessage, mockWs);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.send).toHaveBeenCalledWith('Data transfer limit reached during response.');
            expect(mockWs.terminate).toHaveBeenCalled();
        });

        it('should handle invalid JSON gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await TunnelManager.handleTunnelResponse('invalid json', mockWs);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('handleConnection', () => {
        let tunnel;
        let mockWs;

        beforeEach(async () => {
            tunnel = await TunnelManager.createTunnel(user.id, 3000);
            
            mockWs = {
                once: jest.fn(),
                on: jest.fn(),
                terminate: jest.fn(),
                send: jest.fn(),
                readyState: 1,
                OPEN: 1
            };
        });

        it('should handle valid connection', async () => {
            await TunnelManager.handleConnection(mockWs, tunnel.connectionId);

            expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
        });

        it('should authenticate connection with valid connectionId', async () => {
            await TunnelManager.handleConnection(mockWs, tunnel.connectionId);

            expect(mockWs.tunnelId).toBe(tunnel.id);
            expect(mockWs.userId.toString()).toBe(tunnel.userId.toString());
            expect(TunnelManager.connections.get(tunnel.connectionId)).toBe(mockWs);
        });

        it('should reject invalid connectionId', async () => {
            await TunnelManager.handleConnection(mockWs, 'invalid-id');

            expect(mockWs.terminate).toHaveBeenCalled();
        });
    });

    afterEach(async () => {
        // Clear TunnelManager state
        TunnelManager.connections.clear();
        TunnelManager.httpRequests.clear();
    });

    afterAll(async () => {
        // Clean up database
        await User.deleteMany({});
        await Tunnel.deleteMany({});
        
        // Close database connection
        await mongoose.connection.close();
    });
});
