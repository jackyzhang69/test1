const { MongoClient } = require('mongodb');

class DatabaseService {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected && this.db) {
      return this.db;
    }

    try {
      // Support both new MONGODB_URI format and legacy env vars
      let uri;
      if (process.env.MONGODB_URI) {
        uri = process.env.MONGODB_URI;
      } else {
        const username = process.env.imm_account;
        const password = process.env.imm_password;
        
        if (!username || !password) {
          throw new Error('MongoDB credentials not found in environment variables');
        }
        
        uri = `mongodb+srv://${username}:${password}@noah.yi5fo.mongodb.net/?retryWrites=true&w=majority`;
      }

      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        maxPoolSize: 50,
        minPoolSize: 0
      });

      await this.client.connect();
      await this.client.db('admin').command({ ping: 1 });

      const database = process.env.database || 'visa';
      this.db = this.client.db(database);
      this.isConnected = true;
      
      console.log(`Connected to MongoDB successfully - Database: ${database}`);
      return this.db;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      this.client = null;
      this.db = null;
      console.log('Disconnected from MongoDB');
    }
  }

  async getDatabase() {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.db;
  }

  async getCollection(collectionName) {
    const db = await this.getDatabase();
    return db.collection(collectionName);
  }

  // Health check
  async ping() {
    try {
      const db = await this.getDatabase();
      await db.admin().ping();
      return true;
    } catch (error) {
      console.error('Database ping failed:', error);
      return false;
    }
  }
}

// Singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;