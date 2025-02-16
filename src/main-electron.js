/* main-electron.js
   This file creates the Electron window, connects to MongoDB,
   and defines the IPC handlers for login and fetching form data.
*/
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { login } = require('./auth');
const { connectMongo } = require('./config');
const { chromium } = require('playwright');
const { FormFillingData } = require('./form_filling_data');
const { WebFiller } = require('./webfiller');
const { MongoClient, ObjectId } = require('mongodb');
const { loadEnvConfig } = require('./config');
const fs = require('fs');

// Load environment variables before anything else
loadEnvConfig();

// Add this after loadEnvConfig()
console.log('App path:', app.getAppPath());
console.log('Resource path:', process.resourcesPath);
console.log('Current directory:', __dirname);

// 将 mainWindow 声明为全局变量
let mainWindow = null;
let db;

// 配置 Playwright 的路径
if (app.isPackaged) {
  // 更新：在打包时，ms-playwright 被 asarUnpack 到 app.asar.unpacked 内
  const playwrightPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'ms-playwright');
  process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightPath;
  console.log('Setting Playwright browsers path:', process.env.PLAYWRIGHT_BROWSERS_PATH);
}

// 添加调试日志
function logError(error) {
  console.error('Error details:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
}

async function createWindow() {
  console.log('Creating window...');
  const preloadPath = app.isPackaged 
    ? path.join(app.getAppPath(), 'src', 'preload.js')
    : path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });
  console.log('BrowserWindow instance created.');

  try {
    console.log('Attempting to load index.html...');
    const htmlPath = app.isPackaged
      ? path.join(app.getAppPath(), 'src', 'index.html')
      : path.join(__dirname, 'index.html');
    console.log('HTML path:', htmlPath);
    await mainWindow.loadFile(htmlPath);
    console.log('index.html loaded successfully.');
    mainWindow.show();
    console.log('Window is now shown.');
    mainWindow.focus();
    console.log('Window is now shown and focused.');

    
  } catch (error) {
    logError(error);
    throw error;
  }
}

async function initMongoDB() {
  console.log('Attempting MongoDB connection...');
  try {
    const db = await connectMongo();
    console.log('MongoDB initialized successfully');
    return db;
  } catch (error) {
    console.error('Failed to initialize MongoDB:', error);
    throw error;
  }
}

// 添加未捕获异常的处理
process.on('uncaughtException', (error) => {
  console.error('CRITICAL - Uncaught Exception:', error);
  app.quit();
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

console.log('App starting...');

app.whenReady().then(async () => {
  try {
    console.log('Initializing MongoDB...');
    // 先初始化数据库
    db = await initMongoDB();
    console.log('MongoDB connected successfully');

    console.log('Creating window...');
    // 再创建窗口
    await createWindow();
    console.log('Window created successfully');
  } catch (error) {
    console.error('CRITICAL - Startup error:', error);
    app.quit();
  }
}).catch(error => {
  console.error('CRITICAL - App ready error:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('login', async (event, { email, password }) => {
  try {
    const result = await login(email, password);
    const user = Array.isArray(result) ? result[0] : result;
    if (!user) throw new Error("Login failed");
    return { success: true, user: user };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fetchFormData', async (event, userId) => {
  console.log('Raw userId:', userId);
  try {
    if (!db) throw new Error("Database not connected");
    
    // 修复：直接使用 buffer 属性
    const userIdStr = Buffer.from(userId.buffer).toString('hex');
    console.log('Converted userId:', userIdStr);
    
    const formFillingData = await db.collection('formfillingdata')
      .find({ user_id: userIdStr }).toArray();
    
    console.log('Found data:', formFillingData);
    return { success: true, data: formFillingData };
  } catch (error) {
    console.error('Error in fetchFormData:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('runFormFiller', async (event, formData, headless, timeout) => {
  try {
    let executablePath;
    
    if (app.isPackaged) {
      const browserPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'ms-playwright');
      
      if (process.platform === 'win32') {
        // Windows: need to find the chrome.exe inside version-specific folder
        const chromiumDir = fs.readdirSync(browserPath)
          .find(dir => dir.startsWith('chromium-'));
        executablePath = path.join(browserPath, chromiumDir, 'chrome-win', 'chrome.exe');
      } else {
        // macOS: no need to specify the executable path
        executablePath = null; // Set to null for macOS
      }
      
      console.log('Using Chrome executable:', executablePath);
    }

    const browser = await chromium.launch({ 
      headless,
      ...(process.platform === 'win32' && executablePath ? { executablePath } : {}) // Only use executablePath for Windows
    });
    
    const page = await browser.newPage();

    // 创建一个回调函数来发送进度信息
    const logger = (info) => {
      mainWindow.webContents.send('callback-info', info);
    };

    // 创建一个获取数据的函数
    const fetch_func = async (field_name) => {
      return formData[field_name];
    };

    const filler = new WebFiller(
      formData,
      fetch_func,
      null,
      false,
      logger,
      timeout
    );

    filler.actions = formData.actions;
    const result = await filler.fill(page);
    
    // 关闭浏览器
    await browser.close();
    
    return { success: true, result };
  } catch (error) {
    console.error('Form filling error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

ipcMain.handle('delete-form-data', async (event, id) => {
    try {
        // Convert the buffer directly to ObjectId instead of hex string
        const objectId = new ObjectId(id.buffer);
        const result = await db.collection('formfillingdata').deleteOne({
            _id: objectId
        });
        
        if (result.deletedCount === 1) {
            return true;
        } else {
            throw new Error('Document not found');
        }
    } catch (error) {
        console.error('Error deleting form data:', error);
        throw error;
    }
});

// 添加新的 IPC 处理程序
ipcMain.handle('exit-app', () => {
  app.quit();
});

module.exports = { createWindow, initMongoDB }; 