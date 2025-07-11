const request = require('supertest');
const app = require('../../src/index');
const User = require('../../src/models/User');
const Tunnel = require('../../src/models/Tunnel');
const stripe = require('../../src/config/stripe');
const StripeService = require('../../src/services/StripeService');

// Mock external services
jest.mock('../../src/config/stripe');
jest.mock('../../src/services/StripeService');

describe('Admin API', () => {
    let adminToken;
    let userToken;
    let adminUser;
    let regularUser;

    beforeEach(async () => {
        // Clear database
        await User.deleteMany({});
        await Tunnel.deleteMany({});

        // Mock Stripe
        stripe.customers.create.mockResolvedValue({ id: 'cus_mock_admin' });
        StripeService.createCustomer.mockResolvedValue({ id: 'cus_mock_admin' });

        // Create admin user
        const adminRes = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'admin@example.com',
                password: 'adminPassword123',
            });
        
        adminToken = adminRes.body.token;
        adminUser = await User.findOne({ email: 'admin@example.com' });
        
        // Update admin user role
        await User.findByIdAndUpdate(adminUser._id, { role: 'admin' });

        // Create regular user
        stripe.customers.create.mockResolvedValue({ id: 'cus_mock_user' });
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'user@example.com',
                password: 'userPassword123',
            });
        
        userToken = userRes.body.token;
        regularUser = await User.findOne({ email: 'user@example.com' });
    });

    describe('GET /api/admin/users', () => {
        it('should return all users for admin', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('x-auth-token', adminToken);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0]).toHaveProperty('email');
            expect(res.body[0]).not.toHaveProperty('password');
        });

        it('should deny access for non-admin users', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('x-auth-token', userToken);

            expect(res.statusCode).toBe(403);
        });

        it('should deny access without token', async () => {
            const res = await request(app)
                .get('/api/admin/users');

            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /api/admin/users/:id', () => {
        it('should return specific user for admin', async () => {
            const res = await request(app)
                .get(`/api/admin/users/${regularUser._id}`)
                .set('x-auth-token', adminToken);

            expect(res.statusCode).toBe(200);
            expect(res.body.email).toBe('user@example.com');
            expect(res.body).not.toHaveProperty('password');
        });

        it('should return 404 for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .get(`/api/admin/users/${fakeId}`)
                .set('x-auth-token', adminToken);

            expect(res.statusCode).toBe(404);
        });

        it('should deny access for non-admin users', async () => {
            const res = await request(app)
                .get(`/api/admin/users/${regularUser._id}`)
                .set('x-auth-token', userToken);

            expect(res.statusCode).toBe(403);
        });
    });

    describe('PUT /api/admin/users/:id', () => {
        it('should update user for admin', async () => {
            const updateData = {
                plan: 'pro',
                isActive: false
            };

            const res = await request(app)
                .put(`/api/admin/users/${regularUser._id}`)
                .set('x-auth-token', adminToken)
                .send(updateData);

            expect(res.statusCode).toBe(200);
            expect(res.body.plan).toBe('pro');
            expect(res.body.isActive).toBe(false);
        });

        it('should not allow password updates through admin API', async () => {
            const updateData = {
                password: 'newPassword123'
            };

            const res = await request(app)
                .put(`/api/admin/users/${regularUser._id}`)
                .set('x-auth-token', adminToken)
                .send(updateData);

            expect(res.statusCode).toBe(200);
            
            // Verify password wasn't changed
            const user = await User.findById(regularUser._id);
            expect(user.password).toBe(regularUser.password);
        });

        it('should validate plan values', async () => {
            const updateData = {
                plan: 'invalid-plan'
            };

            const res = await request(app)
                .put(`/api/admin/users/${regularUser._id}`)
                .set('x-auth-token', adminToken)
                .send(updateData);

            expect(res.statusCode).toBe(400);
        });

        it('should deny access for non-admin users', async () => {
            const res = await request(app)
                .put(`/api/admin/users/${regularUser._id}`)
                .set('x-auth-token', userToken)
                .send({ plan: 'pro' });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /api/admin/tunnels', () => {
        beforeEach(async () => {
            // Create some test tunnels
            await Tunnel.create([
                {
                    userId: regularUser._id,
                    subdomain: 'test-tunnel-1',
                    localPort: 3000,
                    connectionId: 'conn-1',
                    isActive: true,
                    expiresAt: new Date(Date.now() + 3600000)
                },
                {
                    userId: regularUser._id,
                    subdomain: 'test-tunnel-2',
                    localPort: 3001,
                    connectionId: 'conn-2',
                    isActive: false,
                    expiresAt: new Date(Date.now() + 3600000)
                }
            ]);
        });

        it('should return all active tunnels for admin', async () => {
            const res = await request(app)
                .get('/api/admin/tunnels')
                .set('x-auth-token', adminToken);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1); // Only active tunnels
            expect(res.body[0].subdomain).toBe('test-tunnel-1');
            expect(res.body[0].userId).toHaveProperty('email');
        });

        it('should deny access for non-admin users', async () => {
            const res = await request(app)
                .get('/api/admin/tunnels')
                .set('x-auth-token', userToken);

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /api/admin/analytics', () => {
        beforeEach(async () => {
            // Create additional test data
            await User.create([
                {
                    email: 'test1@example.com',
                    password: 'hashedpassword',
                    apiKey: 'test-key-1-12345678901234567890',
                    stripeCustomerId: 'cus_test1',
                    plan: 'basic'
                },
                {
                    email: 'test2@example.com',
                    password: 'hashedpassword',
                    apiKey: 'test-key-2-12345678901234567890',
                    stripeCustomerId: 'cus_test2',
                    plan: 'pro'
                }
            ]);

            await Tunnel.create([
                {
                    userId: regularUser._id,
                    subdomain: 'analytics-tunnel-1',
                    localPort: 3000,
                    connectionId: 'analytics-conn-1',
                    isActive: true,
                    expiresAt: new Date(Date.now() + 3600000)
                },
                {
                    userId: regularUser._id,
                    subdomain: 'analytics-tunnel-2',
                    localPort: 3001,
                    connectionId: 'analytics-conn-2',
                    isActive: true,
                    expiresAt: new Date(Date.now() + 3600000)
                }
            ]);
        });

        it('should return analytics data for admin', async () => {
            const res = await request(app)
                .get('/api/admin/analytics')
                .set('x-auth-token', adminToken);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('users');
            expect(res.body).toHaveProperty('tunnels');
            expect(res.body).toHaveProperty('subscriptions');
            expect(res.body).toHaveProperty('plans');

            expect(res.body.users).toBe(4); // admin + regular + 2 test users
            expect(res.body.tunnels.active).toBe(2);
            expect(res.body.tunnels.total).toBe(2);
            
            // Check plan distribution
            expect(res.body.plans.free).toBe(2); // admin + regular user
            expect(res.body.plans.basic).toBe(1);
            expect(res.body.plans.pro).toBe(1);
        });

        it('should deny access for non-admin users', async () => {
            const res = await request(app)
                .get('/api/admin/analytics')
                .set('x-auth-token', userToken);

            expect(res.statusCode).toBe(403);
        });
    });

    describe('Error handling', () => {
        it('should handle invalid ObjectId in user routes', async () => {
            const res = await request(app)
                .get('/api/admin/users/invalid-id')
                .set('x-auth-token', adminToken);

            expect(res.statusCode).toBe(500);
        });

        it('should handle database errors gracefully', async () => {
            // Mock database error
            const mockFind = jest.spyOn(User, 'find').mockImplementation(() => {
                throw new Error('Database error');
            });

            const res = await request(app)
                .get('/api/admin/users')
                .set('x-auth-token', adminToken);

            expect(res.statusCode).toBe(500);
            expect(res.text).toBe('Server Error');

            // Restore original method
            mockFind.mockRestore();
        });
    });

    describe('Security', () => {
        it('should not expose sensitive data in user list', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('x-auth-token', adminToken);

            expect(res.statusCode).toBe(200);
            
            res.body.forEach(user => {
                expect(user).not.toHaveProperty('password');
                expect(user).toHaveProperty('email');
                expect(user).toHaveProperty('apiKey');
                expect(user).toHaveProperty('plan');
            });
        });

        it('should not allow regular users to access admin endpoints', async () => {
            const endpoints = [
                '/api/admin/users',
                '/api/admin/tunnels',
                '/api/admin/analytics'
            ];

            for (const endpoint of endpoints) {
                const res = await request(app)
                    .get(endpoint)
                    .set('x-auth-token', userToken);

                expect(res.statusCode).toBe(403);
                expect(res.body.msg).toBe('Access denied. Admin role required.');
            }
        });
    });
});
