# FormBro - Clean Architecture Implementation

## Overview
FormBro has been successfully refactored to use a clean, shared service architecture that enables maximum code reuse between desktop (Electron) and web versions.

## Directory Structure

```
/src/
├── shared/                    # 🔄 Shared Business Logic
│   ├── services/             # Business logic services  
│   │   ├── auth.service.js          # User authentication
│   │   ├── form.service.js          # Form CRUD operations
│   │   ├── form-filling.service.js  # Form automation orchestration
│   │   └── database.service.js      # MongoDB connection management
│   ├── models/               # Data models
│   │   └── form_filling_data.js     # Form data model
│   ├── core/                 # Core automation engines
│   │   └── webfiller.js             # Form filling automation engine
│   └── utils/                # Shared utilities
│       ├── config.js                # Configuration management
│       └── s3.js                    # S3 file operations
│
├── desktop/                   # 🖥️ Electron-Specific Code
│   ├── main-electron.js             # Main process (uses shared services)
│   ├── renderer.js                  # Desktop UI logic
│   ├── preload.js                   # Security bridge
│   └── index.html                   # Desktop HTML
│
├── web/                       # 🌐 Web-Specific Code
│   ├── server/
│   │   └── web-server.js            # Express server (uses shared services)
│   └── client/
│       ├── web-renderer.js          # Web UI logic
│       └── web-index.html           # Web HTML
│
├── assets/                    # 🎨 Shared Static Assets
│   ├── logo-light.png
│   └── logo-dark.png
│
└── styles.css                 # 🎨 Shared Styles
```

## Service Layer Architecture

### 🔐 AuthService
- **Purpose**: User authentication and management
- **Methods**: 
  - `login(email, password)` - Authenticate user
  - `getUserById(userId)` - Get user details
  - `userExists(email)` - Check if user exists
- **Used by**: Both desktop and web versions

### 📄 FormService
- **Purpose**: Form data CRUD operations and RCIC account management
- **Methods**:
  - `getFormDataByUserId(userId)` - Get user's forms
  - `getFormDataById(formId)` - Get specific form
  - `createFormData(formData)` - Create new form
  - `updateFormData(formId, updates)` - Update form
  - `deleteFormData(formId)` - Delete form
  - `getRcicAccountsByUserId(userId)` - Get RCIC accounts
  - `getFormStats(userId)` - Get form statistics
- **Used by**: Both desktop and web versions

### 🤖 FormFillingService
- **Purpose**: Orchestrates Playwright automation for form filling
- **Methods**:
  - `runFormFilling(formData, options)` - Execute automation
  - `validateFormData(formData)` - Validate form before execution
  - `getAutomationInfo()` - Get browser capabilities
  - `runTestAutomation()` - Test automation setup
- **Features**:
  - Real-time progress callbacks
  - Headless/headful browser support
  - Configurable timeouts
  - Error handling and recovery
- **Used by**: Both desktop and web versions

### 🗄️ DatabaseService
- **Purpose**: MongoDB connection and management
- **Methods**:
  - `connect()` - Establish connection
  - `getDatabase()` - Get database instance
  - `getCollection(name)` - Get collection
  - `ping()` - Health check
- **Features**:
  - Singleton pattern
  - Connection pooling
  - Support for legacy environment variables
  - Automatic reconnection
- **Used by**: All other services

## Platform Integration

### 🖥️ Desktop (Electron)
```javascript
// main-electron.js
const authService = require('../shared/services/auth.service');
const formService = require('../shared/services/form.service');
const formFillingService = require('../shared/services/form-filling.service');

// IPC Handler
ipcMain.handle('login', async (event, { email, password }) => {
  const user = await authService.login(email, password);
  return { success: !!user, user };
});

ipcMain.handle('runFormFiller', async (event, formData, headless, timeout) => {
  return await formFillingService.runFormFilling(formData, {
    headless, timeout,
    progressCallback: (info) => mainWindow.webContents.send('callback-info', info)
  });
});
```

### 🌐 Web (Express Server)
```javascript
// web-server.js
const authService = require('../../shared/services/auth.service');
const formService = require('../../shared/services/form.service');
const formFillingService = require('../../shared/services/form-filling.service');

// HTTP Endpoint
app.post('/api/login', async (req, res) => {
  const user = await authService.login(req.body.email, req.body.password);
  res.json({ success: !!user, user });
});

app.post('/api/run-automation', async (req, res) => {
  // Streaming response for real-time updates
  const progressCallback = (message) => res.write(JSON.stringify(message) + '\n');
  
  const result = await formFillingService.runFormFilling(req.body.formData, {
    headless: req.body.headless,
    timeout: req.body.timeout,
    progressCallback
  });
});
```

## Benefits Achieved

### ✅ Code Reuse
- **Authentication logic**: Single implementation, used by both platforms
- **Database operations**: Shared MongoDB service with connection pooling
- **Form automation**: Identical Playwright automation for both versions
- **Data validation**: Same validation rules across platforms

### ✅ Consistency
- **Business logic**: Identical behavior between desktop and web
- **Error handling**: Consistent error messages and recovery
- **Data structures**: Same models and interfaces
- **Performance**: Optimized connection pooling and caching

### ✅ Maintainability
- **Single source of truth**: Fix bugs once, affects both platforms
- **Clear separation**: Platform-specific vs shared code clearly defined
- **Testability**: Services can be unit tested independently
- **Documentation**: Self-documenting service interfaces

### ✅ Scalability
- **Easy platform addition**: Add mobile app using same services
- **Feature development**: New features automatically available to both platforms
- **Database optimization**: Centralized query optimization
- **Performance monitoring**: Single place to add metrics

## Migration Summary

### Files Moved
- ✅ `form_filling_data.js` → `shared/models/`
- ✅ `webfiller.js` → `shared/core/`
- ✅ `config.js` → `shared/utils/`
- ✅ `s3.js` → `shared/utils/`
- ✅ Desktop files → `desktop/`
- ✅ Web files → `web/`

### Services Created
- ✅ `AuthService` - Replaces `auth.js`
- ✅ `FormService` - Replaces direct MongoDB queries
- ✅ `FormFillingService` - Replaces inline automation code
- ✅ `DatabaseService` - Replaces `connectMongo()`

### Platform Updates
- ✅ Desktop IPC handlers updated to use shared services
- ✅ Web server endpoints updated to use shared services
- ✅ Database connections centralized through DatabaseService
- ✅ Error handling standardized across platforms

## Testing

### Desktop Version
```bash
npm start  # Electron app with shared services
```

### Web Version  
```bash
npm run start-web  # Express server with shared services
# Open http://localhost:3000
```

### Health Check
```bash
curl http://localhost:3000/api/health
# Returns database and automation status
```

## Future Enhancements

### Planned Improvements
- [ ] **JobBank Inviter Service** - Extract JobBank automation to shared service
- [ ] **S3 Service** - Create dedicated service for file operations  
- [ ] **Logging Service** - Centralized logging with different outputs
- [ ] **Configuration Service** - Environment-specific settings management
- [ ] **Caching Service** - Redis integration for performance
- [ ] **Queue Service** - Background job processing

### Additional Platforms
- [ ] **Mobile App** - React Native using same services via API
- [ ] **CLI Tool** - Command-line interface using shared services
- [ ] **Web API** - Public API for third-party integrations

---

**Architecture implemented on**: 2025-05-30  
**Status**: ✅ Complete and functional  
**Next Steps**: Add JobBank Inviter service and additional platform support