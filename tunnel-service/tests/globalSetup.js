const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  global.__MONGOD__ = mongod;
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'a-secure-test-secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  
  // Set mock env vars for services to prevent console warnings during tests
  process.env.NGINX_PROXY_MANAGER_API_URL = 'http://mock-npm:81/api';
  process.env.NGINX_PROXY_MANAGER_API_KEY = 'mock-key';
  // Unset QDRANT_URL to force QdrantService into mock mode for tests
  delete process.env.QDRANT_URL;
};
