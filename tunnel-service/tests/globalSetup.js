const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  global.__MONGOD__ = mongod;
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'a-secure-test-secret';
  
  // Set mock env vars for services to prevent console warnings during tests
  process.env.NGINX_PROXY_MANAGER_API_URL = 'http://mock-npm:81/api';
  process.env.NGINX_PROXY_MANAGER_API_KEY = 'mock-key';
  process.env.QDRANT_URL = 'http://mock-qdrant:6333';
};
