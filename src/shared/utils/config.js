// mongoClient.js

require('dotenv').config();
const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');
const { app } = require('electron');

// Get project's home directory
const BASEDIR = __dirname;
const DATADIR = path.join(BASEDIR, 'data');

// Don't create the client here anymore
let client = null;

async function connectMongo() {
  const username = process.env.imm_account;
  const password = process.env.imm_password;
  const database = process.env.database;
  
  if (!username || !password) {
    throw new Error('MongoDB credentials not found in environment variables');
  }

  try {
    const uri = `mongodb+srv://${username}:${password}@noah.yi5fo.mongodb.net/?retryWrites=true&w=majority`;
    
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      maxPoolSize: 50,
      minPoolSize: 0
    });
    
    await client.connect();
    await client.db('admin').command({ ping: 1 });

    if (!database) {
      throw new Error('No database name provided. Please check your .env file.');
    }
    
    return client.db(database);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

function loadEnvConfig() {
  if (process.env.NODE_ENV === 'development') {
    dotenv.config();
  } else {
    const envPath = path.join(process.resourcesPath, '.env');
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      throw new Error('Could not load .env file');
    }
  }
}

// If you want to run this file directly (similar to your Python "if __name__ == '__main__':")
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
  client,
  BASEDIR,
  DATADIR,
  loadEnvConfig,
};
