const TunnelManager = require('../../src/services/TunnelManager');
const User = require('../../src/models/User');
const Tunnel = require('../../src/models/Tunnel');
const NginxManager = require('../../src/services/NginxManager');
const UsageTracker = require('../../src/services/UsageTracker');

// Mock dependencies
jest.mock('../../src/services/NginxManager');
jest.mock('../../src/services/UsageTracker');

describe('TunnelManager', () => {
    let user;
    let mockNginxManager;
    let mockUsageTracker;

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

        // Setup mocks
        mockNginxManager = NginxManager.mock.instances[0];
        mockNginxManager.createProxyHost.mockResolvedValue({ id: 123, scheme: 'https' });
        mockNginxManager.deleteProxyHost.mockResolvedValue({ message: 'Deleted' });

        mockUsageTracker = UsageTracker;
        mockUsageTracker.canTransfer.mockResolvedValue(true);
        mockUsageTracker.trackData.mockResolvedValue();

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('createTunnel', () => {
        it('should create a tunnel successfully', async () => {
            const tunnel = await TunnelManager.createTunnel(user.id, 3000);

            expect(tunnel).toBeDefined();
            expect(tunnel.userId).toBe(user.id);
            expect(tunnel.localPort).toBe(3000);
            expect(tunnel.subdomain).toBeDefined();
            expect(tunnel.connectionId).toBeDefined();
            expect(tunnel.isActive).toBe(true);
            expect(mockNginxManager.createProxyHost).toHaveBeenCalledWith(tunnel.subdomain);
        });

        it('should create a tunnel with custom subdomain', async () => {
            const options = {
                requestedSubdomain: 'custom-test',
                metadata: { gitContextorShare: true }
            };

            const tunnel = await TunnelManager.createTunnel(user.id, 3000, options);

            expect(tunnel.subdomain).toBe('custom-test');
            expect(tunnel.metadata.gitContextorShare).toBe(true);
        });

        it('should throw error for non-existent user', async () => {
            const fakeUserId = '507f1f77bcf86cd799439011';
            
            await expect(TunnelManager.createTunnel(fakeUserId, 3000))
                .rejects
                .toThrow('User not found');
        });

        it('should throw error when nginx proxy creation fails', async () => {
            mockNginxManager.createProxyHost.mockRejectedValue(new Error('Nginx error'));

            await expect(TunnelManager.createTunnel(user.id, 3000))
                .rejects
                .toThrow('Nginx error');
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
            expect(mockNginxManager.deleteProxyHost).toHaveBeenCalledWith(tunnel.proxyHostId);

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
            expect(mockUsageTracker.canTransfer).toHaveBeenCalledWith(user.id, mockReq.body.length);
            expect(mockUsageTracker.trackData).toHaveBeenCalledWith(
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
            mockUsageTracker.canTransfer.mockResolvedValue(false);

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
                requestId: 'test-request-id',
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: Buffer.from('{"result": "success"}').toString('base64')
            });

            await TunnelManager.handleTunnelResponse(responseMessage, mockWs);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.set).toHaveBeenCalledWith({ 'content-type': 'application/json' });
            expect(mockRes.send).toHaveBeenCalled();
            expect(mockUsageTracker.canTransfer).toHaveBeenCalled();
        });

        it('should handle data transfer limit exceeded in response', async () => {
            mockUsageTracker.canTransfer.mockResolvedValue(false);

            const responseMessage = JSON.stringify({
                type: 'http-response',
                requestId: 'test-request-id',
                status: 200,
                headers: {},
                body: Buffer.from('large response').toString('base64')
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

        it('should handle valid connection', () => {
            TunnelManager.handleConnection(mockWs);

            expect(mockWs.once).toHaveBeenCalledWith('message', expect.any(Function));
        });

        it('should authenticate connection with valid connectionId', async () => {
            let messageHandler;
            mockWs.once.mockImplementation((event, handler) => {
                if (event === 'message') {
                    messageHandler = handler;
                }
            });

            TunnelManager.handleConnection(mockWs);

            const authMessage = JSON.stringify({ connectionId: tunnel.connectionId });
            await messageHandler(authMessage);

            expect(mockWs.tunnelId).toBe(tunnel.id);
            expect(mockWs.userId).toBe(tunnel.userId);
            expect(TunnelManager.connections.get(tunnel.connectionId)).toBe(mockWs);
        });

        it('should reject invalid connectionId', async () => {
            let messageHandler;
            mockWs.once.mockImplementation((event, handler) => {
                if (event === 'message') {
                    messageHandler = handler;
                }
            });

            TunnelManager.handleConnection(mockWs);

            const authMessage = JSON.stringify({ connectionId: 'invalid-id' });
            await messageHandler(authMessage);

            expect(mockWs.terminate).toHaveBeenCalled();
        });
    });
});
