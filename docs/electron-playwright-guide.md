# Complete Guide: Building Cross-Platform Electron Apps with Playwright & Web/Desktop Dual Architecture

> **Based on FormBro Project Analysis** - A comprehensive guide for developing, building, and distributing cross-platform applications with both web and desktop interfaces, featuring Playwright automation capabilities.

## Table of Contents

1. [Project Setup & Dual Architecture](#1-project-setup--dual-architecture)
2. [Web/Desktop Synchronous Development](#2-webdesktop-synchronous-development)
3. [Cross-Platform Chromium Packaging](#3-cross-platform-chromium-packaging)
4. [Playwright Integration](#4-playwright-integration)
5. [Build Configuration](#5-build-configuration)
6. [Code Signing & Notarization](#6-code-signing--notarization)
7. [Auto-Updater Implementation](#7-auto-updater-implementation)
8. [Environment & Secrets Management](#8-environment--secrets-management)
9. [Common Issues & Solutions](#9-common-issues--solutions)
10. [Deployment Checklist](#10-deployment-checklist)
11. [Templates & Examples](#11-templates--examples)

---

## 1. Project Setup & Dual Architecture

### Directory Structure Best Practices

```
your-electron-app/
├── src/
│   ├── desktop/                     # Desktop-specific code
│   │   ├── main-electron.js         # Main Electron process
│   │   ├── renderer.js              # Desktop frontend logic
│   │   ├── preload.js               # Security bridge
│   │   └── index.html               # Desktop UI
│   ├── web/                         # Web-specific code
│   │   ├── server/                  # Web server
│   │   │   ├── web-server.js        # Express.js server
│   │   │   └── routes/              # API routes
│   │   └── client/                  # Web client
│   │       ├── web-index.html       # Web UI
│   │       └── web-renderer.js      # Web frontend logic
│   ├── shared/                      # Shared business logic
│   │   ├── core/                    # Core automation
│   │   │   └── webfiller.js         # Playwright wrapper
│   │   ├── models/                  # Data models
│   │   ├── services/                # Business services
│   │   │   ├── form-filling.service.js
│   │   │   ├── jobbank-inviter.service.js
│   │   │   ├── auth.service.js
│   │   │   └── database.service.js
│   │   └── utils/                   # Utilities
│   │       ├── config.js            # Environment config
│   │       └── s3.js                # AWS utilities
│   ├── assets/                      # Static assets
│   └── styles.css                   # Shared styling
├── scripts/
│   ├── prepare-chromium.js          # Main Chromium setup
│   ├── prepare-chromium-cross-platform.js  # Cross-platform downloads
│   ├── notarize.js                  # macOS notarization
│   └── rename-update-files.js       # Update file management
├── build/
│   ├── entitlements.mac.plist       # macOS entitlements
│   └── icon.icns                    # App icon
├── dist/                            # Build output
├── .env                             # Environment variables
├── package.json                     # Dependencies & build config
└── README.md
```

### 🚨 Critical: Web/Desktop Synchronous Development Rule

**ABSOLUTE REQUIREMENT**: Every feature MUST be implemented in BOTH web and desktop versions simultaneously. No exceptions.

#### Implementation Guidelines:
1. **Feature Parity**: Web and desktop must have identical functionality
2. **Shared Services**: All business logic goes in `src/shared/services/`
3. **UI Consistency**: Both interfaces should provide the same user experience
4. **Testing Coverage**: Test features on both platforms before considering complete
5. **Documentation**: Update both web and desktop sections for every change

---

## 2. Web/Desktop Synchronous Development

### Shared Service Layer Architecture

All business logic must be platform-agnostic and located in `src/shared/`:

```javascript
// src/shared/services/example.service.js
class ExampleService {
  async performAction(params) {
    // Business logic that works for both web and desktop
    const result = await this.processData(params);
    return result;
  }
  
  // Platform detection for specialized behavior
  getExecutionContext() {
    if (typeof window !== 'undefined' && window.api) {
      return 'desktop'; // Electron renderer
    } else if (typeof process !== 'undefined' && process.versions.electron) {
      return 'desktop-main'; // Electron main
    } else {
      return 'web'; // Web browser/server
    }
  }
}

module.exports = { ExampleService };
```

### Desktop Implementation

**src/desktop/main-electron.js** - Register shared services:
```javascript
const { ExampleService } = require('../shared/services/example.service');

// IPC handler for shared service
ipcMain.handle('example-service-action', async (event, params) => {
  const service = new ExampleService();
  return await service.performAction(params);
});
```

**src/desktop/preload.js** - Expose service APIs:
```javascript
contextBridge.exposeInMainWorld('api', {
  exampleAction: (params) => ipcRenderer.invoke('example-service-action', params)
});
```

**src/desktop/renderer.js** - Use service in UI:
```javascript
async function handleUserAction() {
  try {
    const result = await window.api.exampleAction(userParams);
    updateUI(result);
  } catch (error) {
    showError(error.message);
  }
}
```

### Web Implementation

**src/web/server/web-server.js** - Register shared services:
```javascript
const { ExampleService } = require('../../shared/services/example.service');

app.post('/api/example-action', async (req, res) => {
  try {
    const service = new ExampleService();
    const result = await service.performAction(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**src/web/client/web-renderer.js** - Use service in web UI:
```javascript
async function handleUserAction() {
  try {
    const response = await fetch('/api/example-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userParams)
    });
    const result = await response.json();
    updateUI(result);
  } catch (error) {
    showError(error.message);
  }
}
```

### Development Workflow for Dual Platform

#### 1. Feature Development Checklist
- [ ] Create/update shared service in `src/shared/services/`
- [ ] Implement desktop IPC handler in `main-electron.js`
- [ ] Add desktop UI integration in `renderer.js`
- [ ] Create web API endpoint in `web-server.js`
- [ ] Add web UI integration in `web-renderer.js`
- [ ] Test feature on both desktop and web
- [ ] Update documentation for both platforms

#### 2. Testing Commands
```bash
# Test desktop version
npm run start

# Test web version
npm run start:web

# Run both simultaneously for development
npm run dev:dual
```

#### 3. Package.json Scripts Setup
```json
{
  "scripts": {
    "start": "electron src/desktop/main-electron.js",
    "start:web": "node src/web/server/web-server.js",
    "dev:dual": "concurrently \"npm run start\" \"npm run start:web\"",
    "test:desktop": "jest tests/desktop/",
    "test:web": "jest tests/web/",
    "test:all": "npm run test:desktop && npm run test:web"
  }
}
```

---

## 3. Cross-Platform Chromium Packaging

### Revolutionary Cross-Platform Build System

**Key Innovation**: Build Windows packages on Mac and vice versa with platform-specific Chromium.

#### Problem Solved:
- ❌ **Before**: Mac builds contained Mac Chromium → Windows packages failed (700MB waste)
- ✅ **After**: Smart platform detection → 304MB optimized packages that work

### Cross-Platform Chromium Download System

**scripts/prepare-chromium-cross-platform.js**:
```javascript
const PLAYWRIGHT_CDN = 'https://playwright.azureedge.net/builds/chromium';
const CHROMIUM_VERSION = '1169'; // Match your Playwright version

const PLATFORM_MAP = {
  'darwin': {
    name: 'mac',
    archiveName: 'chromium-mac.zip',
    executablePath: 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'
  },
  'win32': {
    name: 'win64',
    archiveName: 'chromium-win64.zip', 
    executablePath: 'chrome-win/chrome.exe'
  },
  'linux': {
    name: 'linux',
    archiveName: 'chromium-linux.zip',
    executablePath: 'chrome-linux/chrome'
  }
};

async function downloadChromiumForPlatform(targetPlatform) {
  const platform = PLATFORM_MAP[targetPlatform];
  const destPath = path.join(process.cwd(), `.local-chromium-${targetPlatform}`);
  const downloadUrl = `${PLAYWRIGHT_CDN}/${CHROMIUM_VERSION}/${platform.archiveName}`;
  
  // Download and extract platform-specific Chromium
  await downloadFile(downloadUrl, zipPath);
  await extractZip(zipPath, chromiumPath, targetPlatform);
  
  // Verify executable exists
  const expectedExePath = path.join(chromiumPath, platform.executablePath);
  if (!fs.existsSync(expectedExePath)) {
    throw new Error(`Executable not found: ${platform.executablePath}`);
  }
  
  console.log(`✅ ${targetPlatform} Chromium ready!`);
}
```

### Smart Platform Detection

**scripts/prepare-chromium.js**:
```javascript
async function prepareChromium() {
  // Check for cross-platform builds
  const targetPlatforms = process.env.TARGET_PLATFORMS;
  
  if (targetPlatforms) {
    console.log(`🎯 Cross-platform build: ${targetPlatforms}`);
    await prepareChromiumCrossPlatform();
    
    // Copy platform-specific Chromium to build location
    const targetPlatform = targetPlatforms.split(',')[0];
    const sourcePath = path.join(process.cwd(), `.local-chromium-${targetPlatform}`);
    const destPath = path.join(process.cwd(), '.local-chromium');
    
    // Use appropriate copy method for host OS
    if (process.platform === 'win32') {
      fs.cpSync(sourcePath, destPath, { recursive: true });
    } else {
      execSync(`cp -R "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
    }
    
    console.log(`✅ Copied ${targetPlatform} Chromium to .local-chromium`);
    return;
  }
  
  // Standard same-platform build logic...
}
```

### Build Commands with Platform Targeting

```json
{
  "scripts": {
    "dist-win": "cross-env TARGET_PLATFORMS=win32 npm run prepare-chromium && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win",
    "dist-mac": "npm run prepare-chromium && electron-builder --mac",
    "dist-linux": "cross-env TARGET_PLATFORMS=linux npm run prepare-chromium && electron-builder --linux",
    
    "publish-update-win": "cross-env TARGET_PLATFORMS=win32 npm run prepare-chromium && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder build --win --publish always",
    "publish-update-mac-arm64": "npm run prepare-chromium && electron-builder build --mac --arm64 --publish always && node scripts/rename-update-files.js mac arm64",
    "publish-update-mac-x64": "npm run prepare-chromium && electron-builder build --mac --x64 --publish always && node scripts/rename-update-files.js mac x64"
  }
}
```

### Package Size Optimization Results

| Platform | Before | After | Reduction |
|----------|--------|-------|-----------|
| Windows  | 700MB  | 304MB | 57% ⬇️ |
| Mac ARM64| 650MB  | 233MB | 64% ⬇️ |
| Mac x64  | 650MB  | 239MB | 63% ⬇️ |

---

## 4. Playwright Integration

### Bundled Chromium Path Detection

**src/shared/utils/config.js** - Universal Chromium path resolver:
```javascript
function getBundledChromiumPath() {
  const isPackaged = (app && app.isPackaged) || process.env.NODE_ENV === 'production';
  if (!isPackaged) return null;

  const resourcesPath = process.resourcesPath || path.join(process.cwd(), 'resources');
  
  const possiblePaths = [
    path.join(resourcesPath, 'app.asar.unpacked', 'ms-playwright'),
    path.join(resourcesPath, 'ms-playwright'),
    path.join(process.cwd(), '.local-chromium'), // Development builds
  ];

  for (const basePath of possiblePaths) {
    if (fs.existsSync(basePath)) {
      const chromiumDirs = fs.readdirSync(basePath)
        .filter(item => item.startsWith('chromium-'))
        .sort((a, b) => b.localeCompare(a)); // Latest version first
        
      if (chromiumDirs.length > 0) {
        const chromiumDir = chromiumDirs[0];
        
        // Platform-specific executable paths
        let executablePath;
        if (process.platform === 'win32') {
          executablePath = path.join(basePath, chromiumDir, 'chrome-win', 'chrome.exe');
        } else if (process.platform === 'darwin') {
          executablePath = path.join(basePath, chromiumDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
        } else {
          executablePath = path.join(basePath, chromiumDir, 'chrome-linux', 'chrome');
        }
        
        if (fs.existsSync(executablePath)) {
          console.log('✅ Found bundled Chromium:', executablePath);
          return executablePath;
        }
      }
    }
  }

  return null;
}
```

### Service Integration with Bundled Chromium

**All services use unified Chromium path detection**:
```javascript
const { getBundledChromiumPath } = require('../utils/config');

async function launchBrowser(options = {}) {
  const bundledChromiumPath = getBundledChromiumPath();
  
  const launchOptions = {
    headless: options.headless || false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
  
  if (bundledChromiumPath) {
    launchOptions.executablePath = bundledChromiumPath;
    console.log(`✅ Using bundled Chromium: ${bundledChromiumPath}`);
  } else {
    console.log('⚠️ Using system Playwright (development mode)');
  }
  
  const browser = await chromium.launch(launchOptions);
  return browser;
}
```

---

## 5. Build Configuration

### Complete Multi-Platform Build Setup

```json
{
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
        "to": "ms-playwright",
        "filter": ["**/*"]
      }
    ],
    "extraResources": [
      {
        "from": ".local-chromium",
        "to": "ms-playwright",
        "filter": ["**/*"]
      }
    ],
    "publish": [
      {
        "provider": "s3",
        "bucket": "your-updates-bucket",
        "region": "ca-central-1",
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

---

## 6. Code Signing & Notarization

### Enhanced Entitlements for Chromium

**build/entitlements.mac.plist**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Essential for Playwright/Chromium -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  
  <!-- Automation capabilities -->
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

---

## 7. Auto-Updater Implementation

### Universal Auto-Update System

**src/desktop/main-electron.js** - Platform-specific update configuration:
```javascript
const { autoUpdater } = require('electron-updater');

// Configure auto-updater for all platforms
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
} else if (process.platform === 'win32') {
  autoUpdater.setFeedURL({
    provider: 's3',
    bucket: 'formbro-updates',
    path: '',
    region: 'ca-central-1',
    updaterCacheDirName: 'formbro-updater',
    url: 'https://formbro-updates.s3.ca-central-1.amazonaws.com/latest.yml'
  });
  
  log.info('Setting update URL for Windows to use latest.yml');
}

// Universal update event handlers
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  // Notify user through your UI
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  // Show restart dialog
});
```

### Update File Management

**Why both DMG and ZIP for Mac**:
- **DMG**: User manual downloads
- **ZIP**: Auto-updater system (required by electron-updater)

**Windows**: Uses `.exe` files directly for auto-update

---

## 8. Environment & Secrets Management

### Unified Environment Loading

**src/shared/utils/config.js**:
```javascript
function loadEnvConfig() {
  const path = require('path');
  const dotenv = require('dotenv');
  
  if (process.env.NODE_ENV === 'development') {
    // Development: Load from project root
    dotenv.config();
  } else {
    // Production: Load from resources directory
    const envPath = path.join(process.resourcesPath, '.env');
    dotenv.config({ path: envPath });
  }
}

// Validate critical environment variables
function validateEnvironment() {
  const required = [
    'MONGODB_URI',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

module.exports = { loadEnvConfig, validateEnvironment, getBundledChromiumPath };
```

---

## 9. Common Issues & Solutions

### Cross-Platform Build Issues

#### Issue: Wrong Chromium Architecture
```
Error: Executable doesn't exist at chrome-mac/Chromium.app
```

**Solution**: Use TARGET_PLATFORMS environment variable
```bash
# Build Windows on Mac
TARGET_PLATFORMS=win32 npm run dist-win

# Build Mac on Windows (if configured)
TARGET_PLATFORMS=darwin npm run dist-mac
```

#### Issue: Update File Format Mismatch
```
Update error: ZIP file not provided
```

**Solution**: Ensure both DMG and ZIP are generated for Mac
```json
{
  "mac": {
    "target": [
      { "target": "dmg" },
      { "target": "zip" }  // Required for auto-updates
    ]
  }
}
```

### Web/Desktop Sync Issues

#### Issue: Feature Works on Desktop but Not Web
**Root Cause**: Business logic implemented in desktop-only code

**Solution**: Move logic to shared services
```javascript
// ❌ Wrong - Desktop only
// src/desktop/main-electron.js
ipcMain.handle('business-logic', async () => {
  // Business logic here
});

// ✅ Correct - Shared service
// src/shared/services/business.service.js
class BusinessService {
  async performAction() {
    // Platform-agnostic business logic
  }
}
```

---

## 10. Deployment Checklist

### Pre-Release Testing
- [ ] **Desktop Testing**:
  - [ ] Test all features in packaged desktop app
  - [ ] Verify Chromium bundling works correctly
  - [ ] Test auto-update mechanism
  - [ ] Confirm code signing and notarization

- [ ] **Web Testing**:
  - [ ] Test all features in web interface
  - [ ] Verify server endpoints work
  - [ ] Test on multiple browsers
  - [ ] Confirm production environment setup

- [ ] **Cross-Platform Testing**:
  - [ ] Test Windows package on Windows
  - [ ] Test Mac ARM64 package on M1/M2 Mac
  - [ ] Test Mac x64 package on Intel Mac
  - [ ] Verify cross-platform builds work correctly

### Build Verification
```bash
# Verify Chromium inclusion
find dist/ -name "chrome-*" -type d

# Check package sizes
ls -lh dist/*.{dmg,exe,zip}

# Verify code signatures (macOS)
codesign --verify --deep --strict --verbose=2 dist/mac*/YourApp.app
spctl -a -t exec -vvv dist/mac*/YourApp.app
```

### Deployment Workflow
1. **Feature Implementation**: Both web and desktop simultaneously
2. **Version Bump**: Update `package.json` version
3. **Clean Build**: `rm -rf dist/ && npm run clean`
4. **Build All Platforms**:
   ```bash
   npm run publish-update-mac-arm64
   npm run publish-update-mac-x64
   npm run publish-update-win
   ```
5. **Verify Updates**: Test auto-update on all platforms
6. **Web Deployment**: Deploy web version to production server

---

## 11. Templates & Examples

### Minimal Dual-Platform Project

**package.json**:
```json
{
  "name": "your-dual-platform-app",
  "version": "1.0.0",
  "main": "src/desktop/main-electron.js",
  "scripts": {
    "start": "electron .",
    "start:web": "node src/web/server/web-server.js",
    "dev": "concurrently \"npm run start\" \"npm run start:web\"",
    
    "prepare-chromium": "node scripts/prepare-chromium.js",
    "postinstall": "npm run prepare-chromium",
    
    "dist-win": "cross-env TARGET_PLATFORMS=win32 npm run prepare-chromium && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win",
    "dist-mac-arm64": "npm run prepare-chromium && electron-builder --mac --arm64",
    "dist-mac-x64": "npm run prepare-chromium && electron-builder --mac --x64",
    
    "publish-update-win": "cross-env TARGET_PLATFORMS=win32 npm run prepare-chromium && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder build --win --publish always",
    "publish-update-mac-arm64": "npm run prepare-chromium && electron-builder build --mac --arm64 --publish always && node scripts/rename-update-files.js mac arm64",
    "publish-update-mac-x64": "npm run prepare-chromium && electron-builder build --mac --x64 --publish always && node scripts/rename-update-files.js mac x64"
  },
  "dependencies": {
    "electron-updater": "^6.3.9",
    "@playwright/test": "^1.42.1",
    "playwright": "^1.42.1",
    "express": "^4.18.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "electron": "^34.2.0",
    "electron-builder": "^24.13.3",
    "@electron/notarize": "^2.5.0",
    "cross-env": "^7.0.3",
    "concurrently": "^7.6.0"
  }
}
```

### Quick Start Commands

```bash
# 1. Initialize project
mkdir my-dual-platform-app && cd my-dual-platform-app
npm init -y

# 2. Install dependencies
npm install electron electron-builder electron-updater @playwright/test playwright express dotenv
npm install --save-dev @electron/notarize cross-env concurrently

# 3. Create directory structure
mkdir -p src/{desktop,web/{server,client},shared/{core,models,services,utils}}
mkdir -p scripts build

# 4. Install Playwright
npx playwright install chromium

# 5. Start development
npm run dev  # Runs both desktop and web simultaneously
```

---

## Conclusion

This guide provides a battle-tested approach for building applications that work seamlessly across desktop and web platforms with:

### Key Achievements:
1. **🎯 Dual Platform Parity**: Web and desktop features always in sync
2. **📦 Optimized Packaging**: 57% size reduction through smart Chromium bundling
3. **🔄 Universal Auto-Updates**: All platforms (Windows, Mac ARM64, Mac x64) supported
4. **🛡️ Production Ready**: Code signing, notarization, and security best practices
5. **⚡ Cross-Platform Builds**: Build Windows on Mac and vice versa

### Critical Success Factors:
- **Never implement features on just one platform** - Web/Desktop sync is mandatory
- **Always use shared services** - Business logic must be platform-agnostic
- **Test on all target platforms** - Cross-platform compatibility is essential
- **Use TARGET_PLATFORMS** - Leverage smart Chromium packaging for optimal builds

The patterns in this guide are proven from the FormBro project and will help you build robust, efficient, dual-platform applications.

---

*Generated from FormBro project analysis - A production-ready Electron + Web application with cross-platform distribution, auto-updates, and synchronized feature development.*