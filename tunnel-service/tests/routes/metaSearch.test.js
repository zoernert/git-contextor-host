const request = require('supertest');
const app = require('../../src/index');
const User = require('../../src/models/User');
const QdrantCollection = require('../../src/models/QdrantCollection');
const Tunnel = require('../../src/models/Tunnel');
const SearchTemplate = require('../../src/models/SearchTemplate');
const jwt = require('jsonwebtoken');

describe('Meta Search API', () => {
  let authToken;
  let userId;

  beforeEach(async () => {
    // Create a test user
    const user = new User({
      email: 'test@example.com',
      password: 'password123',
      apiKey: 'test-api-key',
      stripeCustomerId: 'cus_test'
    });
    await user.save();
    userId = user._id;

    // Generate auth token
    authToken = jwt.sign(
      { user: { id: userId } },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('GET /api/meta-search/sources', () => {
    test('should return available search sources', async () => {
      // Create test collection
      const collection = new QdrantCollection({
        userId,
        name: 'Test Collection',
        collectionName: 'test_collection',
        isActive: true
      });
      await collection.save();

      // Create test tunnel
      const tunnel = new Tunnel({
        userId,
        subdomain: 'test-tunnel',
        tunnelPath: 'test-tunnel',
        localPort: 3000,
        connectionId: 'conn123',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
      });
      await tunnel.save();

      const response = await request(app)
        .get('/api/meta-search/sources')
        .set('x-auth-token', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('hostedCollections');
      expect(response.body).toHaveProperty('tunnelCollections');
      expect(response.body.hostedCollections).toHaveLength(1);
      expect(response.body.tunnelCollections).toHaveLength(1);
      expect(response.body.totalSources).toBe(2);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/meta-search/sources')
        .expect(401);
    });
  });

  describe('POST /api/meta-search/search', () => {
    test('should require query parameter', async () => {
      const response = await request(app)
        .post('/api/meta-search/search')
        .set('x-auth-token', authToken)
        .send({})
        .expect(400);

      expect(response.body.msg).toBe('Query is required');
    });

    test('should require at least one source', async () => {
      const response = await request(app)
        .post('/api/meta-search/search')
        .set('x-auth-token', authToken)
        .send({
          query: 'test query',
          collections: [],
          tunnels: []
        })
        .expect(400);

      expect(response.body.msg).toBe('At least one collection, tunnel, or search template must be selected');
    });

    test('should validate query length', async () => {
      const longQuery = 'a'.repeat(1001);
      
      const response = await request(app)
        .post('/api/meta-search/search')
        .set('x-auth-token', authToken)
        .send({
          query: longQuery,
          collections: ['507f1f77bcf86cd799439011']
        })
        .expect(400);

      expect(response.body.msg).toBe('Query too long (max 1000 characters)');
    });

    test('should validate maxResults limit', async () => {
      const response = await request(app)
        .post('/api/meta-search/search')
        .set('x-auth-token', authToken)
        .send({
          query: 'test query',
          collections: ['507f1f77bcf86cd799439011'],
          maxResults: 201
        })
        .expect(400);

      expect(response.body.msg).toBe('Max results cannot exceed 200');
    });

    test('should validate maxTokens limit', async () => {
      const response = await request(app)
        .post('/api/meta-search/search')
        .set('x-auth-token', authToken)
        .send({
          query: 'test query',
          collections: ['507f1f77bcf86cd799439011'],
          maxTokens: 50001
        })
        .expect(400);

      expect(response.body.msg).toBe('Max tokens cannot exceed 50000');
    });
  });

  describe('POST /api/meta-search/templates', () => {
    test('should create search template', async () => {
      const templateData = {
        name: 'Test Template',
        description: 'A test template',
        collections: [{
          collectionId: '507f1f77bcf86cd799439011',
          enabled: true,
          weight: 1.0
        }],
        searchConfig: {
          maxResults: 50,
          scoreThreshold: 0.7,
          maxTokens: 4000
        }
      };

      const response = await request(app)
        .post('/api/meta-search/templates')
        .set('x-auth-token', authToken)
        .send(templateData)
        .expect(201);

      expect(response.body.name).toBe('Test Template');
      expect(response.body.userId).toBe(userId.toString());
      expect(response.body.collections).toHaveLength(1);
    });

    test('should require template name', async () => {
      const response = await request(app)
        .post('/api/meta-search/templates')
        .set('x-auth-token', authToken)
        .send({
          collections: [{ collectionId: '507f1f77bcf86cd799439011' }]
        })
        .expect(400);

      expect(response.body.msg).toBe('Template name is required');
    });

    test('should require at least one collection', async () => {
      const response = await request(app)
        .post('/api/meta-search/templates')
        .set('x-auth-token', authToken)
        .send({
          name: 'Test Template',
          collections: []
        })
        .expect(400);

      expect(response.body.msg).toBe('At least one collection must be selected');
    });

    test('should not allow duplicate template names', async () => {
      // Create first template
      const template = new SearchTemplate({
        userId,
        name: 'Duplicate Template',
        collections: [{ collectionId: '507f1f77bcf86cd799439011' }]
      });
      await template.save();

      const response = await request(app)
        .post('/api/meta-search/templates')
        .set('x-auth-token', authToken)
        .send({
          name: 'Duplicate Template',
          collections: [{ collectionId: '507f1f77bcf86cd799439012' }]
        })
        .expect(400);

      expect(response.body.msg).toBe('Template name already exists');
    });
  });

  describe('GET /api/meta-search/templates', () => {
    test('should return user templates', async () => {
      const template = new SearchTemplate({
        userId,
        name: 'Test Template',
        collections: [{ collectionId: '507f1f77bcf86cd799439011' }]
      });
      await template.save();

      const response = await request(app)
        .get('/api/meta-search/templates')
        .set('x-auth-token', authToken)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Test Template');
    });
  });

  describe('GET /api/meta-search/history', () => {
    test('should return paginated search history', async () => {
      const response = await request(app)
        .get('/api/meta-search/history?limit=10&page=1')
        .set('x-auth-token', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
    });
  });
});
