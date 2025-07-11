const mongoose = require('mongoose');

module.exports = async () => {
  await mongoose.connection.close();
  const mongod = global.__MONGOD__;
  if (mongod) {
    await mongod.stop();
  }
};
