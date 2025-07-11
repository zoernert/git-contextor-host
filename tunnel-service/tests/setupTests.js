const mongoose = require('mongoose');

// Setup cleanup for each test
afterEach(async () => {
  // Clear all collections after each test
  if (mongoose.connection.readyState === 1) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});

// Global cleanup
afterAll(async () => {
  // Close mongoose connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  
  // Close any remaining timers
  jest.clearAllTimers();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});
