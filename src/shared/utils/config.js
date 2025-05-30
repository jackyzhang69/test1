// mongoClient.js

require('dotenv').config();
const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');
const { app } = require('electron');
const fs = require('fs');

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

/**
 * Get the bundled Chromium executable path for packaged app
 * @returns {string|null} Path to Chromium executable or null if not found
 */
function getBundledChromiumPath() {
  // Only try to find bundled Chromium in packaged app
  // Note: app might not be available in some contexts, so check both ways
  const isPackaged = (app && app.isPackaged) || process.env.NODE_ENV === 'production';
  if (!isPackaged) {
    return null;
  }

  // Get the base path for resources
  const resourcesPath = process.resourcesPath || path.join(process.cwd(), 'resources');
  
  // Try multiple possible paths for Chromium
  const possiblePaths = [
    path.join(resourcesPath, 'app.asar.unpacked', 'ms-playwright'),
    path.join(resourcesPath, 'ms-playwright'),
    // Also try the current working directory for development builds
    path.join(process.cwd(), '.local-chromium'),
  ];

  for (const basePath of possiblePaths) {
    if (fs.existsSync(basePath)) {
      try {
        const contents = fs.readdirSync(basePath);
        const chromiumDirs = contents.filter(item => item.startsWith('chromium-'));
        
        if (chromiumDirs.length > 0) {
          // Sort to get the latest version
          chromiumDirs.sort((a, b) => b.localeCompare(a));
          const chromiumDir = chromiumDirs[0];
          
          // Determine the executable path based on platform
          // These paths match the structure from prepare-chromium-cross-platform.js
          let executablePath;
          if (process.platform === 'win32') {
            // Check both possible Windows structures
            const winPath1 = path.join(basePath, chromiumDir, 'chrome-win', 'chrome.exe');
            const winPath2 = path.join(basePath, chromiumDir, 'chrome.exe');
            if (fs.existsSync(winPath1)) {
              executablePath = winPath1;
            } else if (fs.existsSync(winPath2)) {
              executablePath = winPath2;
            }
          } else if (process.platform === 'darwin') {
            // Check both possible Mac structures
            const macPath1 = path.join(basePath, chromiumDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
            const macPath2 = path.join(basePath, chromiumDir, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
            if (fs.existsSync(macPath1)) {
              executablePath = macPath1;
            } else if (fs.existsSync(macPath2)) {
              executablePath = macPath2;
            }
          } else {
            // Linux
            const linuxPath1 = path.join(basePath, chromiumDir, 'chrome-linux', 'chrome');
            const linuxPath2 = path.join(basePath, chromiumDir, 'chrome');
            if (fs.existsSync(linuxPath1)) {
              executablePath = linuxPath1;
            } else if (fs.existsSync(linuxPath2)) {
              executablePath = linuxPath2;
            }
          }
          
          // Verify the executable exists
          if (executablePath && fs.existsSync(executablePath)) {
            console.log('✅ Found bundled Chromium at:', executablePath);
            return executablePath;
          }
        }
      } catch (error) {
        // Continue to next path
        continue;
      }
    }
  }

  console.log('⚠️ Bundled Chromium not found, will use system Playwright');
  return null;
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
  getBundledChromiumPath,
};
