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
  serverSelectionTimeoutMS: 5000,  // 服务器选择超时时间
  connectTimeoutMS: 10000,         // 连接超时时间
  maxPoolSize: 50,                 // 连接池最大连接数
  minPoolSize: 0                   // 连接池最小连接数
});

async function connectMongo() {
  try {
    // 连接到服务器
    await client.connect();
    
    // 快速 ping 确认连接
    await client.db('admin').command({ ping: 1 });
    console.log('MongoDB connection established successfully.');

    if (!database) {
      throw new Error('No database name provided. Please check your .env file.');
    }
    
    // 返回数据库实例
    return client.db(database);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
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
  client, // optionally export the client if needed elsewhere
  BASEDIR,
  DATADIR,
};
