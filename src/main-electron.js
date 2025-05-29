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
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Load environment variables before anything else
loadEnvConfig();

// Add this after loadEnvConfig()
console.log('App path:', app.getAppPath());
console.log('Resource path:', process.resourcesPath);
console.log('Current directory:', __dirname);

// 将 mainWindow 声明为全局变量
let mainWindow = null;
let db;
let updateDownloaded = false; // Track if an update has been downloaded

// Configure auto-updater
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Specify the preferred update file format
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;
autoUpdater.forceDevUpdateConfig = false;

// Instead of using channels, set the feed URL directly
if (process.platform === 'darwin') {
  const updateFile = process.arch === 'arm64' 
    ? 'latest-mac-arm64.yml' 
    : 'latest-mac-x64.yml';
  
  autoUpdater.setFeedURL({
    provider: 's3',
    bucket: 'formbro-updates',
    path: '',
    region: 'ca-central-1',
    updaterCacheDirName: 'formbro-updater',
    url: `https://formbro-updates.s3.ca-central-1.amazonaws.com/${updateFile}`
  });
  
  log.info(`Setting update URL to use ${updateFile}`);
}

// NOTE: The update files in S3 must be publicly accessible
// The bucket policy should allow public read access to the formbro-updates folder:
// {
//   "Version": "2012-10-17",
//   "Statement": [
//     {
//       "Effect": "Allow",
//       "Principal": "*",
//       "Action": "s3:GetObject",
//       "Resource": "arn:aws:s3:::immcopilot/formbro-updates/*"
//     }
//   ]
// }

// For S3 bucket with public access, you can optionally set the URL directly
// This is useful if you're using CloudFront or a custom domain
// autoUpdater.setFeedURL({
//   provider: 's3',
//   bucket: 'formbro-updates',
//   path: '',
//   region: 'ca-central-1'
// });

// If using a generic server with a self-signed certificate, uncomment this line
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

function getScreenshotDir() {
  if (app.isPackaged) {
    // Use app's user data directory for installed app
    return path.join(app.getPath('userData'), 'screenshots');
  } else {
    // Use current directory for development
    return path.join(process.cwd(), 'screenshots');
  }
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

    // Set up context bridge to expose version information
    mainWindow.webContents.on('did-finish-load', () => {
      const version = app.getVersion();
      mainWindow.webContents.executeJavaScript(`window.appVersion = "${version}";`);
    });
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
    
    // Check for updates after window is created
    setTimeout(() => {
      checkForUpdates();
    }, 3000); // Delay update check by 3 seconds to ensure window is fully loaded
    
    // Set up a timer to check for updates periodically (every hour)
    setInterval(checkForUpdates, 60 * 60 * 1000);
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

// Add handler for before-quit event
app.on('before-quit', () => {
  if (updateDownloaded) {
    autoUpdater.quitAndInstall(false, true);
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

// Add IPC handler for manual update checks
ipcMain.handle('check-for-updates', async () => {
  try {
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
      return { success: true, message: 'Checking for updates...' };
    } else {
      return { success: false, message: 'Updates are only available in packaged app' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fetchFormData', async (event, userId) => {
  try {
    if (!db) throw new Error("Database not connected");
    
    // 修复：直接使用 buffer 属性
    const userIdStr = Buffer.from(userId.buffer).toString('hex');
    
    const formFillingData = await db.collection('formfillingdata')
      .find({ user_id: userIdStr }).toArray();
    return { success: true, data: formFillingData };
  } catch (error) {
    console.error('Error in fetchFormData:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('runFormFiller', async (event, formData, headless, timeout) => {
  try {
    // Create screenshots directory if it doesn't exist
    const screenshotDir = getScreenshotDir();
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    console.log('Screenshot directory:', screenshotDir);

    let executablePath;
    
    if (app.isPackaged) {
      const browserPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'ms-playwright');
      
      if (process.platform === 'win32') {
        // Windows: find chrome.exe inside version-specific folder
        const chromiumDir = fs.readdirSync(browserPath)
          .find(dir => dir.startsWith('chromium-'));
        executablePath = path.join(browserPath, chromiumDir, 'chrome-win', 'chrome.exe');
      } else if (process.platform === 'darwin') {
        // macOS: find Chromium.app inside version-specific folder
        const chromiumDir = fs.readdirSync(browserPath)
          .find(dir => dir.startsWith('chromium-'));
        executablePath = path.join(browserPath, chromiumDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
      }
      
      console.log('Using Chromium executable:', executablePath);
    }

    const browser = await chromium.launch({ 
      headless,
      executablePath
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
      timeout,
      screenshotDir  // Pass screenshot directory to WebFiller
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

// Jobbank inviter handlers
ipcMain.handle('fetchJobbankAccounts', async (event, userId) => {
  try {
    if (!db) throw new Error("Database not connected");
    
    // RCIC collection uses owner_ids array with ObjectId
    const userIdStr = Buffer.from(userId.buffer).toString('hex');
    const userObjectId = new ObjectId(userIdStr);
    
    const rcicAccounts = await db.collection('rcic')
      .find({ owner_ids: userObjectId }).toArray();
    return { success: true, data: rcicAccounts };
  } catch (error) {
    console.error('Error fetching RCIC accounts:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('runJobbankInviter', async (_, rcicData, jobPostId, invitationStar, itemsPerPage, headless, timeout) => {
  try {

    const { Jobbank } = require('./jobbank');
    const { JobbankInviter } = require('./inviter');
    
    // Convert RCIC data to jobbank format
    const jobbank = new Jobbank();
    
    // Map RCIC fields to jobbank fields
    if (rcicData.personal_info) {
      jobbank.personal_info = rcicData.personal_info;
    } else {
      // Create personal_info from available fields
      jobbank.personal_info = {
        first_name: rcicData.first_name || rcicData.firstName || '',
        last_name: rcicData.last_name || rcicData.lastName || '',
        identifier: rcicData.rcic_number || rcicData.rcicNumber || ''
      };
    }
    
    // Map jobbank portal credentials - LMIA portal IS the jobbank portal
    jobbank.jobbank_portal = rcicData.lmia_portal || {
      username: '',
      password: ''
    };
    
    // Map security questions - LMIA SQA IS the jobbank SQA
    jobbank.jobbank_sqa = rcicData.lmia_sqa || [];
    
    // Map complete
    
    // Create logger that sends updates to renderer
    const logger = (message) => {
      mainWindow.webContents.send('inviter-callback-info', {
        message: { action: 'status', name: message }
      });
    };

    // Create inviter instance
    const inviter = new JobbankInviter(jobbank, logger, timeout * 1000);
    
    // Set headless mode
    if (headless) {
      process.env.environment = 'production';
    } else {
      process.env.environment = 'dev';
    }
    
    // Run the inviter
    const result = await inviter.inviteJobPost(jobPostId, invitationStar, itemsPerPage);
    
    // Send final result
    const finalMessage = {
      progress: 100,
      message: {
        action: 'complete',
        invited: result.invited,
        errors: result.errors,
        completed: result.completed
      }
    };
    
    mainWindow.webContents.send('inviter-callback-info', finalMessage);
    
    return { 
      success: true, 
      result: {
        invited: result.invited,
        errors: result.errors,
        completed: result.completed
      }
    };
  } catch (error) {
    console.error('Jobbank inviter error:', error);
    mainWindow.webContents.send('inviter-callback-info', {
      message: { action: 'error', error: error.message }
    });
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// 添加新的 IPC 处理程序
ipcMain.handle('exit-app', () => {
  // If an update is downloaded, quit and install
  if (updateDownloaded) {
    autoUpdater.quitAndInstall(false, true);
  } else {
    app.quit();
  }
});

// Function to check for updates
function checkForUpdates() {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
  if (mainWindow) {
    mainWindow.webContents.send('update-status', 'Checking for update...');
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', `Update available: ${info.version}`);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', 'No updates available');
  }
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', `Update error: ${err.message}`);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  // Format the progress display
  const percent = Math.round(progressObj.percent * 10) / 10; // Round to 1 decimal place
  const transferred = (progressObj.transferred / 1048576).toFixed(2); // Convert to MB with 2 decimal places
  const total = (progressObj.total / 1048576).toFixed(2); // Convert to MB with 2 decimal places
  const speed = (progressObj.bytesPerSecond / 1048576).toFixed(2); // Convert to MB/s with 2 decimal places
  
  const message = `Downloading: ${percent}% (${transferred} MB / ${total} MB) - ${speed} MB/s`;
  console.log(message);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', message);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  updateDownloaded = true; // Set the flag when update is downloaded
  if (mainWindow) {
    mainWindow.webContents.send('update-status', `Update downloaded. Restart now to install version ${info.version}.`);
  }
});

// Handle IPC for getting app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

module.exports = { createWindow, initMongoDB }; 