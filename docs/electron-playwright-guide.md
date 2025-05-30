# Complete Guide: Building & Packaging Electron Apps with Playwright Integration

> **Based on FormBro Project Analysis** - A comprehensive guide for developing, building, and distributing cross-platform Electron applications with Playwright automation capabilities.

## Table of Contents

1. [Project Setup & Architecture](#1-project-setup--architecture)
2. [Playwright Integration](#2-playwright-integration)
3. [Build Configuration](#3-build-configuration)
4. [Code Signing & Notarization](#4-code-signing--notarization)
5. [Auto-Updater Implementation](#5-auto-updater-implementation)
6. [Environment & Secrets Management](#6-environment--secrets-management)
7. [Common Issues & Solutions](#7-common-issues--solutions)
8. [Deployment Checklist](#8-deployment-checklist)
9. [Templates & Examples](#9-templates--examples)

---

## 1. Project Setup & Architecture

### Directory Structure Best Practices

```
your-electron-app/
├── src/
│   ├── main-electron.js          # Main Electron process
│   ├── renderer.js               # Frontend logic
│   ├── preload.js               # Security bridge
│   ├── index.html               # Main UI
│   ├── styles.css               # Styling
│   ├── assets/                  # Static assets
│   └── [feature-modules]/       # Business logic modules
├── scripts/
│   ├── prepare-chromium.js      # Playwright binary setup
│   ├── notarize.js             # macOS notarization
│   └── rename-update-files.js   # Update file management
├── build/
│   ├── entitlements.mac.plist   # macOS entitlements
│   └── icon.icns                # App icon
├── dist/                        # Build output
├── .env                         # Environment variables
├── package.json                 # Dependencies & build config
└── README.md
```

### Entry Point Configuration

**main-electron.js** - Secure main process setup:
```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// Security-first configuration
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,        // Disable Node.js in renderer
      contextIsolation: true,        // Enable context isolation
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true              // Enable web security
    }
  });

  // Load the app
  mainWindow.loadFile('src/index.html');
}
```

**preload.js** - Secure API exposure:
```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('api', {
  // Example: Playwright automation
  runAutomation: (config) => ipcRenderer.invoke('run-automation', config),
  
  // Example: File operations
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  
  // Example: Updates
  checkForUpdates: () => ipcRenderer.invoke('check-updates')
});
```

---

## 2. Playwright Integration

### Bundling Strategy for Chromium Binaries

**Key Challenge**: Playwright requires Chromium binaries that must be properly bundled with the Electron app.

#### prepare-chromium.js Script
```javascript
const fs = require('fs');
const path = require('path');

function prepareChromium() {
  const sourceChromium = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.cache/ms-playwright' // Linux/macOS
    // Windows: AppData/Local/ms-playwright
  );
  
  const targetDir = path.join(__dirname, '..', '.local-chromium');
  
  // Find latest Chromium version
  const chromiumDirs = fs.readdirSync(sourceChromium)
    .filter(dir => dir.startsWith('chromium-'))
    .sort()
    .reverse();
    
  if (chromiumDirs.length === 0) {
    throw new Error('No Chromium installation found. Run: npx playwright install chromium');
  }
  
  const latestChromium = chromiumDirs[0];
  const sourcePath = path.join(sourceChromium, latestChromium);
  const targetPath = path.join(targetDir, latestChromium);
  
  // Copy Chromium to local directory
  console.log(`Copying ${latestChromium} to local directory...`);
  copyDirSync(sourcePath, targetPath);
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = { prepareChromium };
```

#### Cross-Platform Path Management

**In main process** - Dynamic Playwright path resolution:
```javascript
function getPlaywrightPath() {
  if (app.isPackaged) {
    // Production: Use bundled Chromium
    return path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'ms-playwright'
    );
  } else {
    // Development: Use local Chromium
    return path.join(__dirname, '..', '.local-chromium');
  }
}

// Set Playwright browser path
process.env.PLAYWRIGHT_BROWSERS_PATH = getPlaywrightPath();

// Launch browser example
async function launchBrowser() {
  const { chromium } = require('playwright');
  
  const browser = await chromium.launch({
    headless: false,
    executablePath: getChromiumExecutable()
  });
  
  return browser;
}

function getChromiumExecutable() {
  const playwrightPath = getPlaywrightPath();
  const platform = process.platform;
  
  if (platform === 'darwin') {
    return path.join(
      playwrightPath,
      'chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (platform === 'win32') {
    return path.join(
      playwrightPath,
      'chromium-*/chrome-win/chrome.exe'
    );
  } else {
    return path.join(
      playwrightPath,
      'chromium-*/chrome-linux/chrome'
    );
  }
}
```

### Memory Optimization Techniques

**Problem**: Large memory usage from bundling Chromium (300MB+)

**Solution**: Use `asarUnpack` to exclude Playwright binaries from ASAR compression:

```json
{
  "build": {
    "asarUnpack": [
      "node_modules/@playwright/**/*",
      ".local-chromium/**/*"
    ],
    "extraFiles": [
      {
        "from": ".local-chromium",
        "to": "resources/app.asar.unpacked/ms-playwright",
        "filter": ["chromium-*/**/*", "ffmpeg-*/**/*"]
      }
    ]
  }
}
```

---

## 3. Build Configuration

### Electron-Builder Setup for Multiple Platforms

#### Complete package.json Build Configuration
```json
{
  "main": "src/main-electron.js",
  "scripts": {
    "start": "electron .",
    "prepare-chromium": "node scripts/prepare-chromium.js",
    "postinstall": "npm run prepare-chromium",
    
    "build": "npm run prepare-chromium && electron-builder",
    "dist-mac-arm64": "npm run prepare-chromium && electron-builder --mac --arm64",
    "dist-mac-x64": "npm run prepare-chromium && electron-builder --mac --x64",
    "dist-win": "npm run prepare-chromium && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win",
    
    "publish-update-mac-arm64": "npm run prepare-chromium && electron-builder build --mac --arm64 --publish always && node scripts/rename-update-files.js mac arm64",
    "publish-update-mac-x64": "npm run prepare-chromium && electron-builder build --mac --x64 --publish always && node scripts/rename-update-files.js mac x64",
    "publish-update-win": "npm run prepare-chromium && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder build --win --publish always"
  },
  "build": {
    "appId": "com.yourcompany.yourapp",
    "productName": "YourApp",
    "afterSign": "scripts/notarize.js",
    "files": [
      "src/**/*",
      "package.json",
      ".env",
      "node_modules/@playwright/test/"
    ],
    "asarUnpack": [
      "node_modules/@playwright/**/*",
      ".local-chromium/**/*"
    ],
    "extraFiles": [
      {
        "from": ".local-chromium",
        "to": "resources/app.asar.unpacked/ms-playwright",
        "filter": ["chromium-*/**/*", "ffmpeg-*/**/*"]
      }
    ],
    "publish": [
      {
        "provider": "s3",
        "bucket": "your-updates-bucket",
        "region": "your-region",
        "path": "",
        "acl": null
      }
    ],
    "mac": {
      "artifactName": "${productName}-${arch}.${ext}",
      "target": [
        { "target": "dmg" },
        { "target": "zip" }
      ],
      "category": "public.app-category.utilities",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "notarize": {
        "teamId": "YOUR_APPLE_TEAM_ID"
      }
    },
    "win": {
      "artifactName": "${productName} Setup.${ext}",
      "target": [
        { "target": "nsis" },
        { "target": "zip" }
      ]
    }
  }
}
```

#### Dependencies Management
```json
{
  "dependencies": {
    "electron-updater": "^6.3.9",
    "@playwright/test": "^1.42.1",
    "playwright": "^1.42.1"
  },
  "devDependencies": {
    "electron": "^34.2.0",
    "electron-builder": "^24.13.3",
    "@electron/notarize": "^2.5.0",
    "cross-env": "^7.0.3",
    "dotenv": "^16.0.0"
  }
}
```

---

## 4. Code Signing & Notarization

### macOS Developer ID Setup

#### Required Certificates
1. **Developer ID Application**: For code signing apps outside Mac App Store
2. **Developer ID Installer**: For signed installer packages (optional)

#### Certificate Installation
```bash
# Import certificate to Keychain
security import ~/certificate.p12 -P "YOUR_CERTIFICATE_PASSWORD" -A

# Verify certificate installation
security find-identity -v -p codesigning
```

#### Entitlements Configuration

**build/entitlements.mac.plist**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Required for Playwright/Chromium -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  
  <!-- Required for automation features -->
  <key>com.apple.security.automation.apple-events</key>
  <true/>
  
  <!-- Network access -->
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>
  
  <!-- File system access -->
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  <key>com.apple.security.files.downloads.read-write</key>
  <true/>
</dict>
</plist>
```

### Automated Notarization Workflow

**scripts/notarize.js**:
```javascript
require('dotenv').config();
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  
  console.log('Starting notarization...');
  console.log('App path:', appPath);

  try {
    await notarize({
      tool: 'notarytool',
      appBundleId: 'com.yourcompany.yourapp',
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    });
    console.log('Notarization completed successfully!');
  } catch (error) {
    console.error('Notarization failed:', error.message);
    throw error;
  }
};
```

#### Environment Variables for Notarization
```bash
# .env file
APPLE_ID=your-apple-id@example.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=YOUR10DIGIT
```

#### Verification Commands
```bash
# Verify code signature
codesign --verify --deep --strict --verbose=2 dist/mac*/YourApp.app

# Check notarization status
spctl -a -t exec -vvv dist/mac*/YourApp.app

# Should output: "accepted" and "source=Notarized Developer ID"
```

---

## 5. Auto-Updater Implementation

### S3-Based Distribution System

#### Auto-Updater Setup in Main Process
```javascript
const { autoUpdater } = require('electron-updater');

function setupAutoUpdater() {
  // Configure update feed
  autoUpdater.setFeedURL({
    provider: 's3',
    bucket: 'your-updates-bucket',
    region: 'your-region',
    path: '',
    updaterCacheDirName: 'your-app-updater'
  });

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const { percent, bytesPerSecond, total, transferred } = progressObj;
    console.log(`Download progress: ${percent}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    // Notify user and restart
    autoUpdater.quitAndInstall();
  });

  // Check for updates periodically
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1000); // Every hour

  // Initial check
  autoUpdater.checkForUpdatesAndNotify();
}
```

### Architecture-Specific Update Handling

**Problem**: Single `latest-mac.yml` doesn't support multiple architectures (ARM64 vs x64)

**Solution**: Generate architecture-specific update files

**scripts/rename-update-files.js**:
```javascript
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

async function renameUpdateFiles(platform, arch) {
  const distDir = path.join(__dirname, '..', 'dist');
  
  if (platform === 'mac') {
    const sourceFile = path.join(distDir, 'latest-mac.yml');
    const targetFile = path.join(distDir, `latest-mac-${arch}.yml`);
    
    // Create architecture-specific file
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`Created copy of ${sourceFile} as ${targetFile}`);
    
    // Upload to S3
    await uploadToS3(targetFile, `latest-mac-${arch}.yml`);
  }
}

async function uploadToS3(filePath, key) {
  const s3 = new AWS.S3({
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  const fileContent = fs.readFileSync(filePath);
  
  const params = {
    Bucket: 'your-updates-bucket',
    Key: key,
    Body: fileContent,
    ContentType: 'text/yaml'
  };
  
  try {
    await s3.upload(params).promise();
    console.log(`Successfully uploaded ${key} to S3`);
  } catch (error) {
    console.error(`Failed to upload ${key}:`, error);
  }
}

// Usage
const [platform, arch] = process.argv.slice(2);
renameUpdateFiles(platform, arch);
```

#### Client-Side Architecture Detection
```javascript
// In main process
function getUpdateFeedURL() {
  const arch = process.arch; // 'arm64' or 'x64'
  const platform = process.platform; // 'darwin', 'win32', etc.
  
  let feedUrl = {
    provider: 's3',
    bucket: 'your-updates-bucket',
    region: 'your-region',
    path: ''
  };
  
  if (platform === 'darwin') {
    // Use architecture-specific update file
    feedUrl.updaterCacheDirName = 'your-app-updater';
    
    // Override the update check to use architecture-specific file
    const originalCheckForUpdates = autoUpdater.checkForUpdatesAndNotify;
    autoUpdater.checkForUpdatesAndNotify = async function() {
      // Temporarily modify the feed URL to use arch-specific file
      const originalUrl = this.getFeedURL();
      
      // Set architecture-specific feed
      this.setFeedURL({
        ...feedUrl,
        // This will look for latest-mac-arm64.yml or latest-mac-x64.yml
        channel: arch === 'arm64' ? 'latest-mac-arm64' : 'latest-mac-x64'
      });
      
      return originalCheckForUpdates.call(this);
    };
  }
  
  return feedUrl;
}
```

---

## 6. Environment & Secrets Management

### .env Configuration Patterns

#### Development vs Production Loading
```javascript
const path = require('path');
const dotenv = require('dotenv');

function loadEnvConfig() {
  if (process.env.NODE_ENV === 'development') {
    // Development: Load from project root
    dotenv.config();
  } else {
    // Production: Load from resources directory
    const envPath = path.join(process.resourcesPath, '.env');
    dotenv.config({ path: envPath });
  }
}

// Call before any environment variable usage
loadEnvConfig();
```

#### .env Template (DO NOT include real secrets)
```bash
# .env.example - Copy to .env and fill in real values

# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# AWS Configuration (for S3 updates)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region

# Apple Developer (for macOS notarization)
APPLE_ID=your.apple.id@example.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=YOUR10DIGIT

# Application Configuration
NODE_ENV=development
DEBUG_MODE=true
```

#### Secure Credential Handling
```javascript
// Validate required environment variables
function validateEnvironment() {
  const required = [
    'MONGODB_URI',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }
}

// Runtime configuration object
const config = {
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      useUnifiedTopology: true,
      useNewUrlParser: true
    }
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  },
  app: {
    isDevelopment: process.env.NODE_ENV === 'development',
    debugMode: process.env.DEBUG_MODE === 'true'
  }
};

module.exports = { config, validateEnvironment };
```

---

## 7. Common Issues & Solutions

### Memory Allocation Problems

#### Issue: "JavaScript heap out of memory" during build
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

#### Solutions:
1. **Increase Node.js memory limit**:
   ```bash
   node --max-old-space-size=8192 node_modules/.bin/electron-builder
   ```

2. **Use asarUnpack for large files**:
   ```json
   {
     "build": {
       "asarUnpack": [
         "node_modules/@playwright/**/*",
         ".local-chromium/**/*"
       ]
     }
   }
   ```

3. **Optimize build scripts**:
   ```json
   {
     "scripts": {
       "build-win": "cross-env NODE_OPTIONS='--max-old-space-size=8192' electron-builder --win"
     }
   }
   ```

### Code Signing Failures

#### Issue: "code failed to satisfy specified code requirement(s)"
```
FormBro.app: code has no resources but signature indicates they must be present
```

#### Solutions:
1. **Verify certificate installation**:
   ```bash
   security find-identity -v -p codesigning
   ```

2. **Check entitlements**:
   ```bash
   codesign -d --entitlements :- dist/mac*/YourApp.app
   ```

3. **Force re-signing**:
   ```bash
   codesign --force --deep --sign "Developer ID Application: Your Name" dist/mac*/YourApp.app
   ```

#### Issue: Chromium binaries not signed
```
ERROR: Unsigned binaries detected in Chromium bundle
```

#### Solution: Proper entitlements configuration
```xml
<!-- In entitlements.mac.plist -->
<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
<true/>
<key>com.apple.security.cs.allow-jit</key>
<true/>
```

### Update Validation Errors

#### Issue: "Code signature at URL did not pass validation"
```
Code signature at URL file:///path/to/update did not pass validation
```

#### Root Causes & Solutions:
1. **Architecture mismatch**: Use architecture-specific update files
2. **Unsigned update**: Ensure proper build and signing process
3. **Corrupted cache**: Clear update cache
   ```bash
   rm -rf ~/Library/Caches/your-app-updater/pending/*
   ```

#### Issue: SHA512 hash mismatch
```
Expected: abc123...
Actual: def456...
```

#### Solution: Regenerate update files
```bash
# Clean build and upload
npm run clean
npm run publish-update-mac-arm64
```

### Cross-Platform Compatibility

#### Path Handling Issues
```javascript
// ❌ Wrong - hardcoded separators
const filePath = 'src/assets/icon.png';

// ✅ Correct - platform-agnostic
const filePath = path.join('src', 'assets', 'icon.png');
```

#### Binary Execution Issues
```javascript
// ❌ Wrong - assumes Unix-like system
const chromiumPath = '/path/to/chromium';

// ✅ Correct - platform detection
function getChromiumPath() {
  const platform = process.platform;
  if (platform === 'darwin') {
    return path.join(playwrightPath, 'chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium');
  } else if (platform === 'win32') {
    return path.join(playwrightPath, 'chromium-*/chrome-win/chrome.exe');
  } else {
    return path.join(playwrightPath, 'chromium-*/chrome-linux/chrome');
  }
}
```

---

## 8. Deployment Checklist

### Pre-Release Testing
- [ ] Test Playwright automation in both development and packaged app
- [ ] Verify all environment variables are properly loaded
- [ ] Test app functionality on target platforms (macOS ARM64/x64, Windows)
- [ ] Confirm file permissions and access rights
- [ ] Test auto-updater mechanism with staging environment

### Build Verification Steps
1. **Code Signing Verification**:
   ```bash
   # macOS
   codesign --verify --deep --strict --verbose=2 dist/mac*/YourApp.app
   spctl -a -t exec -vvv dist/mac*/YourApp.app
   
   # Should show: "accepted" and "source=Notarized Developer ID"
   ```

2. **Notarization Status Check**:
   ```bash
   xcrun notarytool history --apple-id your@email.com --password xxxx-xxxx-xxxx-xxxx --team-id YOUR10DIGIT
   ```

3. **Update File Validation**:
   ```bash
   # Verify YAML files contain correct hashes
   cat dist/latest-mac-arm64.yml
   cat dist/latest-mac-x64.yml
   cat dist/latest.yml
   ```

4. **S3 Upload Verification**:
   ```bash
   aws s3 ls s3://your-updates-bucket/ --region your-region
   ```

### Distribution Workflow
1. **Version Bump**: Update version in `package.json`
2. **Clean Build**: `rm -rf dist/ && npm run clean`
3. **Build All Platforms**:
   ```bash
   npm run publish-update-mac-arm64
   npm run publish-update-mac-x64
   npm run publish-update-win
   ```
4. **Verify Uploads**: Check S3 bucket for all files
5. **Test Updates**: Install previous version and test update mechanism
6. **Release Notes**: Update changelog and release documentation

---

## 9. Templates & Examples

### Minimal Project Template

#### package.json (Essential sections)
```json
{
  "name": "your-electron-playwright-app",
  "version": "1.0.0",
  "main": "src/main-electron.js",
  "scripts": {
    "start": "electron .",
    "prepare-chromium": "node scripts/prepare-chromium.js",
    "postinstall": "npm run prepare-chromium",
    "build": "npm run prepare-chromium && electron-builder",
    "dist-mac-arm64": "npm run prepare-chromium && electron-builder --mac --arm64",
    "dist-win": "npm run prepare-chromium && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win"
  },
  "dependencies": {
    "electron-updater": "^6.3.9",
    "@playwright/test": "^1.42.1",
    "playwright": "^1.42.1",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "electron": "^34.2.0",
    "electron-builder": "^24.13.3",
    "@electron/notarize": "^2.5.0",
    "cross-env": "^7.0.3"
  },
  "build": {
    "appId": "com.yourcompany.yourapp",
    "productName": "YourApp",
    "afterSign": "scripts/notarize.js",
    "files": [
      "src/**/*",
      "package.json",
      ".env",
      "node_modules/@playwright/test/"
    ],
    "asarUnpack": [
      "node_modules/@playwright/**/*",
      ".local-chromium/**/*"
    ],
    "extraFiles": [
      {
        "from": ".local-chromium",
        "to": "resources/app.asar.unpacked/ms-playwright",
        "filter": ["chromium-*/**/*", "ffmpeg-*/**/*"]
      }
    ],
    "mac": {
      "target": [{"target": "dmg"}, {"target": "zip"}],
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist",
      "notarize": {"teamId": "YOUR_APPLE_TEAM_ID"}
    },
    "win": {
      "target": [{"target": "nsis"}, {"target": "zip"}]
    }
  }
}
```

#### Basic Main Process (src/main-electron.js)
```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
require('dotenv').config();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/index.html');
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('run-playwright-automation', async (event, config) => {
  // Your Playwright automation logic here
  const { chromium } = require('playwright');
  
  try {
    const browser = await chromium.launch({
      headless: config.headless || false
    });
    
    const page = await browser.newPage();
    // Your automation steps...
    
    await browser.close();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Auto-updater setup
function setupAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify();
}
```

### Quick Start Commands

#### Initial Setup
```bash
# 1. Create new project
mkdir my-electron-playwright-app
cd my-electron-playwright-app

# 2. Initialize npm
npm init -y

# 3. Install dependencies
npm install electron electron-builder electron-updater @playwright/test playwright dotenv
npm install --save-dev @electron/notarize cross-env

# 4. Install Playwright browsers
npx playwright install chromium

# 5. Create basic structure
mkdir -p src scripts build docs
touch src/main-electron.js src/preload.js src/index.html
touch scripts/prepare-chromium.js scripts/notarize.js
touch build/entitlements.mac.plist
touch .env.example

# 6. Copy template files (use templates above)
```

#### Development Workflow
```bash
# Development
npm start

# Build for current platform
npm run build

# Build for specific platforms
npm run dist-mac-arm64
npm run dist-mac-x64
npm run dist-win

# Publish updates
npm run publish-update-mac-arm64
```

---

## Conclusion

This guide provides a comprehensive foundation for building and distributing Electron applications with Playwright integration. Key takeaways:

1. **Security First**: Always use context isolation and proper IPC patterns
2. **Memory Management**: Use `asarUnpack` for large binaries like Chromium
3. **Cross-Platform**: Test on all target platforms and handle path differences
4. **Code Signing**: Essential for macOS distribution and user trust
5. **Auto-Updates**: Architecture-specific update files for proper multi-arch support
6. **Environment Management**: Secure handling of secrets and configuration

The patterns and solutions in this guide are battle-tested from the FormBro project and will help you avoid common pitfalls when building similar applications.

For additional support, refer to:
- [Electron Documentation](https://www.electronjs.org/docs)
- [Playwright Documentation](https://playwright.dev)
- [electron-builder Documentation](https://www.electron.build)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)

---

*Generated from FormBro project analysis - A complete Electron + Playwright application with cross-platform distribution and auto-updates.*