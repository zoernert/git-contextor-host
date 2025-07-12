const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../src/index');
const User = require('../../src/models/User');
const QdrantCollection = require('../../src/models/QdrantCollection');
const Tunnel = require('../../src/models/Tunnel');
const stripe = require('../../src/config/stripe');
const QdrantService = require('../../src/services/QdrantService');

jest.mock('../../src/services/QdrantService');
jest.mock('../../src/config/stripe');

describe('Qdrant API', () => {
    let token;
    let userId;

    beforeAll(async () => {
        stripe.customers.create.mockResolvedValue({ id: 'cus_mock_qdrant_user' });
        await User.deleteMany({});
        await QdrantCollection.deleteMany({});
        await Tunnel.deleteMany({});
        
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'qdrantuser@example.com',
                password: 'password123',
            });
        token = userRes.body.token;
        const user = await User.findOne({ email: 'qdrantuser@example.com' });
        userId = user.id;
    });

    beforeEach(async () => {
        // Clear only test data, not the user
        await QdrantCollection.deleteMany({});
        await Tunnel.deleteMany({});
        QdrantService.createCollection.mockClear();
        QdrantService.deleteCollection.mockClear();
        QdrantService.createCollection.mockResolvedValue(true);
        QdrantService.deleteCollection.mockResolvedValue(true);
        
        // Recreate user if it was deleted by global afterEach
        let user = await User.findById(userId);
        if (!user) {
            user = await User.create({
                email: 'qdrantuser@example.com',
                password: 'password123',
                apiKey: 'test-api-key-' + Date.now(),
                stripeCustomerId: 'cus_mock_qdrant_user',
                plan: 'basic',
                isActive: true
            });
            userId = user.id;
            // Generate new JWT token for the recreated user
            const payload = { user: { id: user.id } };
            token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' });
        } else {
            // Ensure user is on basic plan for most tests
            await User.findByIdAndUpdate(userId, { 
                plan: 'basic', 
                isActive: true 
            }, { new: true });
        }
    });

    it('should create a new collection for a user on a valid plan', async () => {
        const collectionData = {
            name: 'my-first-collection',
            description: 'Test collection',
            vectorSize: 1536,
            distance: 'Cosine'
        };

        const res = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send(collectionData);

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('name', 'my-first-collection');
        expect(res.body).toHaveProperty('config');
        expect(res.body.config.vectorSize).toBe(1536);
        expect(res.body.config.distance).toBe('Cosine');
        expect(res.body.config.description).toBe('Test collection');
        expect(res.body.userId).toBe(userId);
        expect(QdrantService.createCollection).toHaveBeenCalledTimes(1);
        expect(QdrantService.createCollection).toHaveBeenCalledWith(
            `user-${userId}-my-first-collection`,
            {
                vectors: {
                    size: 1536,
                    distance: 'Cosine'
                }
            }
        );
    });

    it('should create a collection with default values', async () => {
        const res = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'simple-collection' });

        if (res.statusCode !== 201) {
            console.log('Error response:', res.body);
        }
        expect(res.statusCode).toEqual(201);
        expect(res.body.config.vectorSize).toBe(1536);
        expect(res.body.config.distance).toBe('Cosine');
    });

    it('should not create a collection for a user on the free plan', async () => {
        const updatedUser = await User.findByIdAndUpdate(userId, { plan: 'free' }, { new: true });
        expect(updatedUser.plan).toBe('free');

        const res = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'my-free-collection' });

        expect(res.statusCode).toEqual(403);
        expect(res.body.msg).toContain('limit of 0 reached');
    });

    it('should list collections for the authenticated user', async () => {
        const createRes = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'collection-one' });

        expect(createRes.statusCode).toEqual(201);
        
        const res = await request(app)
            .get('/api/qdrant/collections')
            .set('x-auth-token', token);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(1);
        expect(res.body[0].name).toBe('collection-one');
    });

    it('should get connection information for a collection', async () => {
        const createRes = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'connection-test' });

        expect(createRes.statusCode).toEqual(201);
        const collectionId = createRes.body._id;

        const res = await request(app)
            .get(`/api/qdrant/collections/${collectionId}/connection`)
            .set('x-auth-token', token);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('connectionInfo');
        expect(res.body).toHaveProperty('examples');
        expect(res.body.examples).toHaveProperty('nodeJs');
        expect(res.body.examples).toHaveProperty('python');
        expect(res.body.examples).toHaveProperty('curl');
    });

    it('should test connection for a collection', async () => {
        const createRes = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'connection-test' });

        expect(createRes.statusCode).toEqual(201);
        const collectionId = createRes.body._id;

        const res = await request(app)
            .post(`/api/qdrant/collections/${collectionId}/test-connection`)
            .set('x-auth-token', token);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('timestamp');
    });

    it('should get usage statistics for a collection', async () => {
        const createRes = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'usage-test' });

        expect(createRes.statusCode).toEqual(201);
        const collectionId = createRes.body._id;

        const res = await request(app)
            .get(`/api/qdrant/collections/${collectionId}/usage`)
            .set('x-auth-token', token);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('usage');
        expect(res.body).toHaveProperty('config');
        expect(res.body).toHaveProperty('createdAt');
    });

    it('should delete a collection', async () => {
        const createRes = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'to-be-deleted' });

        expect(createRes.statusCode).toEqual(201);
        const collectionId = createRes.body._id;

        const deleteRes = await request(app)
            .delete(`/api/qdrant/collections/${collectionId}`)
            .set('x-auth-token', token);

        expect(deleteRes.statusCode).toEqual(200);
        expect(deleteRes.body.msg).toBe('Collection deleted');
        expect(QdrantService.deleteCollection).toHaveBeenCalledTimes(1);

        const collectionInDb = await QdrantCollection.findById(collectionId);
        expect(collectionInDb).toBeNull();
    });

    it('should validate collection name format', async () => {
        const invalidNames = ['UPPERCASE', 'with spaces', 'with_underscore', 'with@special'];
        
        for (const name of invalidNames) {
            const res = await request(app)
                .post('/api/qdrant/collections')
                .set('x-auth-token', token)
                .send({ name });

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toContain('Invalid collection name');
        }
    });
});
