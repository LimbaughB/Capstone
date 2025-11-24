const { MongoClient } = require('mongodb');

let dbConnection;

module.exports = {
  connectToDb: (cb) => {
    MongoClient.connect(process.env.MONGO_URI)
      .then((client) => {
        // Updated log message for a professional format
        console.log('[INFO] Connected successfully to MongoDB');
        dbConnection = client.db();
        return cb();
      })
      .catch((err) => {
        console.error('[ERROR] Failed to connect to MongoDB');
        console.error(err);
        return cb(err);
      });
  },
  getDb: () => dbConnection,
};
