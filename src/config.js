// mongoClient.js

require('dotenv').config();
const { MongoClient } = require('mongodb');
const path = require('path');

// Get project's home directory
const BASEDIR = __dirname; // Node.js equivalent of Path(__file__).parent
const DATADIR = path.join(BASEDIR, 'data');

// Mongodb
const account = process.env.imm_account;
const password = process.env.imm_password;
const database = process.env.database;

const url = `mongodb+srv://${account}:${password}@noah.yi5fo.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function connectMongo() {
  try {
    // Connect to the server
    await client.connect();
    // Perform a quick ping to confirm connection
    await client.db('admin').command({ ping: 1 });
    console.log('MongoDB connection established successfully.');
  } catch (e) {
    console.error(e);
    throw new Error('Failed to connect to MongoDB');
  }
  
  if (!database) {
    throw new Error('No database name provided. Please check your .env file.');
  }
  
  // Return the database instance
  return client.db(database);
}

// If you want to run this file directly (similar to your Python “if __name__ == '__main__':”)
if (require.main === module) {
  (async () => {
    try {
      const db = await connectMongo();
      // You can now use db to perform queries...
      console.log(`Using database: ${db.databaseName}`);
      // Finally close connection, for demonstration purposes
      await client.close();
    } catch (err) {
      console.error(err);
    }
  })();
}

// Export needed references:
module.exports = {
  connectMongo,
  client, // optionally export the client if needed elsewhere
  BASEDIR,
  DATADIR,
};
