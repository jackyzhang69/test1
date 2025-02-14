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
const { MongoClient } = require('mongodb');

// 将 mainWindow 声明为全局变量
let mainWindow = null;
let db;

async function createWindow() {
  console.log('Creating window...');
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // 开始时隐藏
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  console.log('BrowserWindow instance created.');

  try {
    console.log('Attempting to load index.html...');
    // 加载本地 HTML 文件
    await mainWindow.loadFile('index.html');
    console.log('index.html loaded successfully.');
    mainWindow.show();
    console.log('Window is now shown.');
    mainWindow.focus();
    console.log('Window is now shown and focused.');
  } catch (error) {
    console.error('Failed to load window:', error);
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

ipcMain.handle('runFormFiller', async (event, formData) => {
  console.log('runFormFiller called with data:', formData);
  try {
    // 添加 fetch_func 回调
    const fetch_func = (key) => {
      const value = formData[key];
      // 通过 event.sender 发送回调信息
      event.sender.send('callback-info', `Fetching data for key: ${key} = ${value}`);
      return value;
    };

    console.log('Initializing WebFiller...');
    // 传入 fetch_func 回调
    const filler = new WebFiller(
      formData,
      fetch_func,
      null,
      false,
      (message) => {
        // 发送日志信息
        event.sender.send('callback-info', message);
      }
    );
    
    filler.actions = formData.actions;
    console.log('WebFiller initialized with actions:', filler.actions);
    
    // 启动浏览器
    console.log('Launching browser...');
    const browser = await chromium.launch({ 
      headless: false,
      slowMo: 50
    });
    const page = await browser.newPage();
    
    // 执行填充
    console.log('Starting form filling...');
    await filler.fill(page);
    console.log('Form filled successfully');
    
    // 关闭浏览器
    await browser.close();
    
    return { success: true, message: 'Form filled successfully' };
  } catch (error) {
    console.error('Error in form filling:', error);
    return { success: false, error: error.message };
  }
});

module.exports = { createWindow, initMongoDB }; 