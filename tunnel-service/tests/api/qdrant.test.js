const request = require('supertest');
const app = require('../../src/index');
const User = require('../../src/models/User');
const QdrantCollection = require('../../src/models/QdrantCollection');
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
        await QdrantCollection.deleteMany({});
        QdrantService.createCollection.mockClear();
        QdrantService.deleteCollection.mockClear();
        QdrantService.createCollection.mockResolvedValue(true);
        QdrantService.deleteCollection.mockResolvedValue(true);
        // Ensure user starts on basic plan for most tests
        await User.findByIdAndUpdate(userId, { plan: 'basic' });
    });

    it('should create a new collection for a user on a valid plan', async () => {
        const res = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'my-first-collection' });

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('name', 'my-first-collection');
        expect(res.body.userId).toBe(userId);
        expect(QdrantService.createCollection).toHaveBeenCalledTimes(1);
        expect(QdrantService.createCollection).toHaveBeenCalledWith(`user-${userId}-my-first-collection`);
    });

    it('should not create a collection for a user on the free plan', async () => {
        await User.findByIdAndUpdate(userId, { plan: 'free' });

        const res = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'my-free-collection' });

        expect(res.statusCode).toEqual(403);
        expect(res.body.msg).toContain('limit of 0 reached');
    });

    it('should list collections for the authenticated user', async () => {
        await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'collection-one' });
        
        const res = await request(app)
            .get('/api/qdrant/collections')
            .set('x-auth-token', token);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBe(1);
        expect(res.body[0].name).toBe('collection-one');
    });

    it('should delete a collection', async () => {
        const createRes = await request(app)
            .post('/api/qdrant/collections')
            .set('x-auth-token', token)
            .send({ name: 'to-be-deleted' });

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
});
