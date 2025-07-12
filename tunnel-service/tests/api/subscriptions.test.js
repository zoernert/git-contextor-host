// Set up environment variables before any imports
process.env.STRIPE_BASIC_PLAN_PRICE_ID = 'price_basic123';
process.env.STRIPE_PRO_PLAN_PRICE_ID = 'price_pro123';

const request = require('supertest');
const app = require('../../src/index');
const User = require('../../src/models/User');
const Subscription = require('../../src/models/Subscription');
const stripe = require('../../src/config/stripe');
const StripeService = require('../../src/services/StripeService');

// Mock external services
jest.mock('../../src/config/stripe');
jest.mock('../../src/services/StripeService');

describe('Subscriptions API', () => {
    let user;
    let token;

    beforeEach(async () => {
        // Clear database
        await User.deleteMany({});
        await Subscription.deleteMany({});

        // Mock Stripe
        stripe.customers.create.mockResolvedValue({ id: 'cus_mock_user' });
        StripeService.createCustomer.mockResolvedValue({ id: 'cus_mock_user' });

        // Create test user
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'password123',
            });
        
        token = userRes.body.token;
        user = await User.findOne({ email: 'test@example.com' });
    });

    describe('GET /api/subscriptions/plans', () => {
        it('should return available plans', async () => {
            const res = await request(app)
                .get('/api/subscriptions/plans')
                .set('x-auth-token', token);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(4); // free, basic, pro, enterprise
            
            // Check that all plan IDs exist
            const planIds = res.body.map(plan => plan.id);
            expect(planIds).toContain('free');
            expect(planIds).toContain('basic');
            expect(planIds).toContain('pro');
            expect(planIds).toContain('enterprise');
            
            // Check plan structure
            const basicPlan = res.body.find(plan => plan.id === 'basic');
            expect(basicPlan).toHaveProperty('name');
            expect(basicPlan).toHaveProperty('price');
            expect(basicPlan).toHaveProperty('limits');
            expect(basicPlan).toHaveProperty('features');
        });

        it('should work without authentication', async () => {
            const res = await request(app)
                .get('/api/subscriptions/plans');

            expect(res.statusCode).toBe(200);
        });
    });

    describe('POST /api/subscriptions/create', () => {
        beforeEach(() => {
            StripeService.createSubscription.mockResolvedValue({
                id: 'sub_mock123',
                status: 'active',
                current_period_start: Math.floor(Date.now() / 1000),
                current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
                items: {
                    data: [{
                        price: {
                            id: 'price_basic123'
                        }
                    }]
                }
            });
        });

        it('should create subscription successfully', async () => {
            const res = await request(app)
                .post('/api/subscriptions/create')
                .set('x-auth-token', token)
                .send({
                    priceId: 'price_basic123'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('subscription');
            expect(res.body.subscription.stripeSubscriptionId).toBe('sub_mock123');
            expect(StripeService.createSubscription).toHaveBeenCalledWith('cus_mock_user', 'price_basic123');
        });

        it('should require price ID', async () => {
            const res = await request(app)
                .post('/api/subscriptions/create')
                .set('x-auth-token', token)
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('Price ID is required');
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .post('/api/subscriptions/create')
                .send({
                    priceId: 'price_basic123'
                });

            expect(res.statusCode).toBe(401);
        });

        it('should handle stripe errors', async () => {
            StripeService.createSubscription.mockRejectedValue(new Error('Stripe error'));

            const res = await request(app)
                .post('/api/subscriptions/create')
                .set('x-auth-token', token)
                .send({
                    priceId: 'price_basic123'
                });

            expect(res.statusCode).toBe(500);
        });
    });

    describe('GET /api/subscriptions/current', () => {
        let subscription;

        beforeEach(async () => {
            // Create a subscription
            subscription = await Subscription.create({
                userId: user._id,
                stripeSubscriptionId: 'sub_test123',
                status: 'active',
                plan: 'basic',
                limits: {
                    maxTunnels: 5,
                    maxDataTransfer: 10,
                    maxQdrantCollections: 1
                },
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        });

        it('should return current subscription', async () => {
            const res = await request(app)
                .get('/api/subscriptions/current')
                .set('x-auth-token', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.stripeSubscriptionId).toBe('sub_test123');
            expect(res.body.status).toBe('active');
            expect(res.body.plan).toBe('basic');
        });

        it('should return 404 if no subscription', async () => {
            await Subscription.deleteMany({});

            const res = await request(app)
                .get('/api/subscriptions/current')
                .set('x-auth-token', token);

            expect(res.statusCode).toBe(404);
            expect(res.body.msg).toBe('No subscription found');
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/subscriptions/current');

            expect(res.statusCode).toBe(401);
        });
    });

    describe('POST /api/subscriptions/cancel', () => {
        let subscription;

        beforeEach(async () => {
            subscription = await Subscription.create({
                userId: user._id,
                stripeSubscriptionId: 'sub_test123',
                status: 'active',
                plan: 'basic',
                limits: {
                    maxTunnels: 5,
                    maxDataTransfer: 10,
                    maxQdrantCollections: 1
                },
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });

            StripeService.cancelSubscription.mockResolvedValue({
                id: 'sub_test123',
                status: 'canceled'
            });
        });

        it('should cancel subscription successfully', async () => {
            const res = await request(app)
                .post('/api/subscriptions/cancel')
                .set('x-auth-token', token);

            expect(res.statusCode).toBe(200);
            expect(res.body.msg).toBe('Subscription canceled successfully');
            expect(StripeService.cancelSubscription).toHaveBeenCalledWith('sub_test123');
        });

        it('should return 404 if no subscription', async () => {
            await Subscription.deleteMany({});

            const res = await request(app)
                .post('/api/subscriptions/cancel')
                .set('x-auth-token', token);

            expect(res.statusCode).toBe(404);
            expect(res.body.msg).toBe('No subscription found');
        });

        it('should handle stripe errors', async () => {
            StripeService.cancelSubscription.mockRejectedValue(new Error('Stripe error'));

            const res = await request(app)
                .post('/api/subscriptions/cancel')
                .set('x-auth-token', token);

            expect(res.statusCode).toBe(500);
        });
    });

    describe('POST /api/subscriptions/webhook', () => {
        const webhookSecret = 'whsec_test123';
        const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        beforeEach(() => {
            process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
            stripe.webhooks.constructEvent.mockReturnValue({
                id: 'evt_test123',
                type: 'customer.subscription.updated',
                data: {
                    object: {
                        id: 'sub_test123',
                        status: 'active',
                        customer: 'cus_test123',
                        current_period_start: Math.floor(Date.now() / 1000),
                        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                        items: {
                            data: [{
                                price: {
                                    id: 'price_basic123'
                                }
                            }]
                        }
                    }
                }
            });
            StripeService.handleWebhook.mockResolvedValue();
        });

        afterEach(() => {
            process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
        });

        it('should handle webhook successfully', async () => {
            const payload = JSON.stringify({
                id: 'evt_test123',
                type: 'customer.subscription.updated'
            });

            const res = await request(app)
                .post('/api/subscriptions/webhook')
                .set('stripe-signature', 'test_signature')
                .send(payload);

            expect(res.statusCode).toBe(200);
            expect(res.body.received).toBe(true);
            expect(stripe.webhooks.constructEvent).toHaveBeenCalled();
            expect(StripeService.handleWebhook).toHaveBeenCalled();
        });

        it('should handle invalid signature', async () => {
            stripe.webhooks.constructEvent.mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            const res = await request(app)
                .post('/api/subscriptions/webhook')
                .set('stripe-signature', 'invalid_signature')
                .send('{}');

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toBe('Webhook signature verification failed');
        });

        it('should handle webhook processing errors', async () => {
            StripeService.handleWebhook.mockRejectedValue(new Error('Processing error'));

            const payload = JSON.stringify({
                id: 'evt_test123',
                type: 'customer.subscription.updated'
            });

            const res = await request(app)
                .post('/api/subscriptions/webhook')
                .set('stripe-signature', 'test_signature')
                .send(payload);

            expect(res.statusCode).toBe(500);
        });
    });

    describe('Integration with User model', () => {
        it('should update user plan when subscription is created', async () => {
            StripeService.createSubscription.mockResolvedValue({
                id: 'sub_mock123',
                status: 'active',
                current_period_start: Math.floor(Date.now() / 1000),
                current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                items: {
                    data: [{
                        price: {
                            id: process.env.STRIPE_BASIC_PLAN_PRICE_ID || 'price_basic123'
                        }
                    }]
                }
            });

            const res = await request(app)
                .post('/api/subscriptions/create')
                .set('x-auth-token', token)
                .send({
                    priceId: process.env.STRIPE_BASIC_PLAN_PRICE_ID || 'price_basic123'
                });

            expect(res.statusCode).toBe(200);

            // Check that user plan was updated
            const updatedUser = await User.findById(user._id);
            expect(updatedUser.plan).toBe('basic');
        });
    });
});
