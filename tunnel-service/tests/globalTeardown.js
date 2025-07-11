const mongoose = require('mongoose');

module.exports = async () => {
  try {
    // Close all mongoose connections
    await mongoose.connection.close();
    
    // Close all connections in the connection pool
    await mongoose.disconnect();
    
    // Stop the MongoDB memory server
    const mongod = global.__MONGOD__;
    if (mongod) {
      await mongod.stop();
    }
    
    // Give some time for all connections to close
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    console.error('Error in globalTeardown:', error);
  }
};
