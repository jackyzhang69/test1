# Electron 应用打包 Playwright 指南

## 1. 依赖配置

在 `package.json` 中需要的关键依赖：

```json
{
  "dependencies": {
    "@playwright/test": "^1.42.1",
    "playwright": "^1.42.1"
  },
  "devDependencies": {
    "electron": "^34.2.0",
    "electron-builder": "^24.13.3"
  }
}
```

## 2. 脚本配置

在 `package.json` 的 `scripts` 中添加必要的脚本：

```json
{
  "scripts": {
    "postinstall": "npx playwright install chromium", // 安装依赖后自动安装 Chromium
    "prebuild": "npx playwright install chromium", // 构建前确保 Chromium 已安装
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  }
}
```

## 3. electron-builder 配置

在 `package.json` 中的 `build` 部分关键配置：

```json
{
  "build": {
    "files": [
      "src/**/*",
      "package.json",
      ".env",
      "node_modules/@playwright/test/",
      {
        "from": ".cache/ms-playwright", // Playwright 浏览器缓存位置
        "to": "ms-playwright", // 打包后的位置
        "filter": [
          "chromium-*/**/*" // 只包含 Chromium 相关文件
        ]
      }
    ],
    "asarUnpack": [
      // 这些文件不会被打包进 asar
      "node_modules/@playwright/test/**/*",
      "ms-playwright/**/*"
    ]
  }
}
```

## 4. 构建步骤

```bash
# 1. 安装依赖并下载 Playwright Chromium
npm install

# 2. 构建应用
npm run dist
```

## 5. 注意事项

1. 包体积会显著增大，因为包含了 Chromium 二进制文件
2. 确保代码中使用打包后的 Chromium 路径
3. 使用 `asarUnpack` 确保浏览器二进制文件可以正常访问
4. 只打包必要的浏览器（示例中只打包了 Chromium）
5. 如果遇到权限问题，可能需要调整文件权限设置

## 6. 优势

- 最终用户无需单独安装浏览器
- 应用是完全自包含的
- 可以确保使用特定版本的浏览器

## 7. 局限性

- 安装包体积较大
- 需要更多的系统资源（同时运行 Electron 和 Playwright）
- 初始配置相对复杂

这个配置适用于需要在 Electron 应用中进行浏览器自动化的场景，比如网页抓取、自动化测试等。

## 8. 路径处理和启动配置

### 8.1 路径处理

在主进程（main-electron.js）中：

```javascript
const { app } = require("electron");
const path = require("path");

// 获取应用根目录
const appPath = app.getAppPath();

// Playwright 浏览器路径配置
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(appPath, "ms-playwright");

// 其他资源路径示例
const resourcePath = path.join(appPath, "resources");
const userDataPath = path.join(app.getPath("userData"), "data");
```

### 8.2 macOS 配置

1. Info.plist 配置（位于 build/entitlements.mac.plist）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.debugger</key>
    <true/>
  </dict>
</plist>
```

2. 在 package.json 中添加 macOS 签名配置：

```json
{
  "build": {
    "mac": {
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "target": ["dmg"]
    }
  }
}
```

### 8.3 注意事项

1. 始终使用 `app.getAppPath()` 获取应用根目录
2. 使用 `path.join()` 处理所有路径拼接
3. 开发环境和生产环境的路径会不同，需要适当处理
4. macOS 下注意权限和签名问题
5. 确保所有资源文件都在 `files` 配置中正确包含

### 8.4 常见问题解决

1. 如果双击无法启动：

   - 检查 Info.plist 配置
   - 验证应用签名状态
   - 检查日志文件（~/Library/Logs/[应用名]）

2. 如果 Playwright 无法找到浏览器：

   - 确认 PLAYWRIGHT_BROWSERS_PATH 设置正确
   - 验证浏览器文件是否正确解压
   - 检查 asarUnpack 配置是否正确

3. 权限问题：
   - 添加适当的 entitlements
   - 确保文件权限正确（chmod）
   - 考虑使用 hardened runtime

## 9. 构建和分发详细指南

### 9.1 基础依赖配置

关键依赖包括:

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.744.0",
    "@electron/notarize": "^2.5.0",
    "@playwright/test": "^1.42.1",
    "aws-sdk": "^2.1692.0",
    "dotenv": "^16.3.1",
    "mongodb": "^6.3.0",
    "playwright": "^1.42.1"
  },
  "devDependencies": {
    "cross-env": "^7.0.3",
    "electron": "^34.2.0",
    "electron-builder": "^24.13.3"
  }
}
```

主要包含:

- `@playwright/test` 和 `playwright`: 用于浏览器自动化
- `electron` 和 `electron-builder`: 用于应用打包
- `cross-env`: 跨平台环境变量设置

### 9.2 脚本配置

关键脚本:

```json
{
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "cross-env NODE_ENV=development electron .",
    "postinstall": "npx playwright install chromium",
    "pack": "electron-builder --dir",
    "dist": "electron-builder",
    "dist-win": "npm run prepare-chromium && electron-builder --win",
    "prebuild": "npx playwright install chromium",
    "prepare-chromium": "node scripts/prepare-chromium.js",
    "package": "electron-builder build --publish never"
  }
}
```

重要脚本说明:

- `postinstall`: 安装依赖后自动安装 Chromium
- `prebuild`: 构建前确保 Chromium 已安装
- `pack`: 打包到目录
- `dist`: 构建分发包
- `dist-win`: Windows 专用构建脚本
- `prepare-chromium`: 准备 Chromium 相关文件

### 9.3 Electron Builder 配置

主要配置项:

```json
{
  "build": {
    "appId": "com.watchpup.frombro",
    "productName": "FormBro",
    "files": [
      "src/**/*",
      "package.json",
      ".env",
      "node_modules/@playwright/test/"
    ],
    "extraResources": [
      {
        "from": ".env",
        "to": ".env"
      }
    ],
    "directories": {
      "output": "dist"
    },
    "mac": {
      "target": {
        "target": "dmg",
        "arch": ["arm64", "x64"]
      },
      "category": "public.app-category.utilities",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "executableName": "FormBro",
      "timestamp": "http://timestamp.apple.com/ts01",
      "icon": "build/icon.icns",
      "notarize": {
        "teamId": "K7GGZ8W679"
      }
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico",
      "extraFiles": [
        {
          "from": ".local-chromium",
          "to": "resources/app.asar.unpacked/ms-playwright",
          "filter": ["chromium-*/**/*", "ffmpeg-*/**/*"]
        }
      ]
    },
    "asar": true,
    "asarUnpack": ["node_modules/@playwright/test/**/*", "ms-playwright/**/*"]
  }
}
```

### 9.4 Playwright 浏览器处理

1. 浏览器路径配置:

```javascript
// 配置 Playwright 的路径
if (app.isPackaged) {
  // 更新：在打包时，ms-playwright 被 asarUnpack 到 app.asar.unpacked 内
  const playwrightPath = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "ms-playwright"
  );
  process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightPath;
  console.log(
    "Setting Playwright browsers path:",
    process.env.PLAYWRIGHT_BROWSERS_PATH
  );
}
```

2. Windows 专用 Chromium 准备脚本 (scripts/prepare-chromium.js):

```javascript
async function prepareChromium() {
  const sourcePath = await getChromiumPath();
  const destPath = path.join(process.cwd(), ".local-chromium");

  // 确保目录存在
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }

  // 查找最新的 Chromium 和 ffmpeg 版本目录
  const entries = fs.readdirSync(sourcePath);
  const chromiumDirs = entries
    .filter((entry) => entry.startsWith("chromium-"))
    .sort((a, b) => b.localeCompare(a));

  const ffmpegDirs = entries
    .filter((entry) => entry.startsWith("ffmpeg-"))
    .sort((a, b) => b.localeCompare(a));

  const latestChromium = chromiumDirs[0];
  const latestFfmpeg = ffmpegDirs[0];

  // 复制最新的 Chromium 和 ffmpeg
  if (latestChromium) {
    fs.cpSync(
      path.join(sourcePath, latestChromium),
      path.join(destPath, latestChromium),
      { recursive: true }
    );
  }

  if (latestFfmpeg) {
    fs.cpSync(
      path.join(sourcePath, latestFfmpeg),
      path.join(destPath, latestFfmpeg),
      { recursive: true }
    );
  }
}
```

### 9.5 macOS 特殊处理

1. 权限配置文件 (build/entitlements.mac.plist):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.debugger</key>
    <true/>
    <key>com.apple.security.inherit</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
  </dict>
</plist>
```

2. 签名脚本示例:

```bash
export APPLE_ID="your.email@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="your-team-id"
export CSC_LINK="~/certificate.p12"
export CSC_KEY_PASSWORD="your-password"
npm run package
```

### 9.6 环境变量处理

环境变量加载逻辑:

```javascript
function loadEnvConfig() {
  if (process.env.NODE_ENV === "development") {
    dotenv.config();
  } else {
    const envPath = path.join(process.resourcesPath, ".env");
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      throw new Error("Could not load .env file");
    }
  }
}
```

### 9.7 注意事项和最佳实践

1. 路径处理:

   - 使用 `app.getAppPath()` 获取应用根目录
   - 使用 `path.join()` 处理所有路径拼接
   - 区分开发环境和生产环境的路径

2. 安全考虑:

   - macOS 的 hardened runtime
   - Windows 的文件权限处理
   - 浏览器二进制文件的完整性

3. 性能优化:

   - 只打包必要的浏览器组件
   - 使用 `asarUnpack` 处理大型二进制文件
   - 合理配置缓存策略

4. 常见问题处理:
   - 确保所有依赖都正确安装
   - 检查文件路径和权限
   - 验证签名和证书配置
   - 测试不同平台的打包结果

## 10. macOS 代码签名详细指南

### 10.1 前期准备

1. 必要条件：

   - Apple Developer 账号
   - Apple Developer 证书
   - 团队 ID (Team ID)
   - App Specific Password
   - 开发证书 (.p12 文件)

2. 依赖安装：

```bash
npm install --save-dev @electron/notarize
```

### 10.2 配置文件设置

1. package.json 中的 mac 配置：

```json
{
  "build": {
    "mac": {
      "target": {
        "target": "dmg",
        "arch": ["arm64", "x64"]
      },
      "category": "public.app-category.utilities",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "executableName": "YourAppName",
      "timestamp": "http://timestamp.apple.com/ts01",
      "icon": "build/icon.icns",
      "notarize": {
        "teamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

2. entitlements.mac.plist 权限配置：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.debugger</key>
    <true/>
    <key>com.apple.security.inherit</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
  </dict>
</plist>
```

### 10.3 环境变量配置

1. .env 文件配置：

```env
# Apple Developer 账号信息
APPLE_ID=your.email@example.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX

# 证书信息
CSC_LINK=/absolute/path/to/certificate.p12
CSC_KEY_PASSWORD=your-certificate-password
```

2. 推荐的签名脚本 (build/sign-mac.sh)：

```bash
#!/bin/bash

# 加载环境变量
source .env

# 设置错误处理
set -e

# 验证必要的环境变量
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo "Error: Missing required environment variables"
    exit 1
fi

# 验证证书文件存在
if [ ! -f "$CSC_LINK" ]; then
    echo "Error: Certificate file not found at $CSC_LINK"
    exit 1
fi

# 导出环境变量
export APPLE_ID
export APPLE_APP_SPECIFIC_PASSWORD
export APPLE_TEAM_ID
export CSC_LINK
export CSC_KEY_PASSWORD

# 运行打包命令
echo "Starting package process..."
npm run package

# 验证签名
echo "Verifying signature..."
codesign -v --verify --verbose "dist/mac/YourApp.app"

# 验证公证
echo "Verifying notarization..."
spctl --assess -v "dist/mac/YourApp.app"

echo "Package process completed successfully"
```

### 10.4 签名流程

1. 准备工作：

   ```bash
   # 添加脚本执行权限
   chmod +x build/sign-mac.sh

   # 确保环境变量文件存在
   touch .env
   ```

2. 执行签名：

   ```bash
   ./build/sign-mac.sh
   ```

3. 验证步骤：

   ```bash
   # 验证应用签名
   codesign -v --verify --verbose "dist/mac/YourApp.app"

   # 验证公证状态
   spctl --assess -v "dist/mac/YourApp.app"
   ```

### 10.5 常见问题和解决方案

1. 签名失败：

   - 检查证书有效性
   - 确认环境变量正确设置
   - 验证 Apple Developer 账号状态

2. 公证失败：

   - 确保应用已正确签名
   - 检查 entitlements 配置
   - 查看详细的公证日志：
     ```bash
     xcrun altool --notarization-history 0 -u "your.email@example.com"
     ```

3. 权限问题：
   - 检查 entitlements.mac.plist 配置
   - 确保 hardenedRuntime 已启用
   - 验证证书类型是否正确

### 10.6 安全最佳实践

1. 证书管理：

   - 安全存储证书文件
   - 定期更新证书
   - 不要在版本控制中提交证书

2. 环境变量：

   - 使用 .env 文件管理敏感信息
   - 在 .gitignore 中排除 .env 文件
   - 为不同环境维护不同的 .env 文件

3. CI/CD 集成：

   - 使用加密的环境变量
   - 安全存储证书
   - 自动化签名和验证过程

4. 日志和监控：
   - 记录签名过程
   - 监控证书有效期
   - 保存签名和公证日志

### 10.7 维护和更新

1. 定期任务：

   - 检查证书有效期
   - 更新签名脚本
   - 验证签名配置

2. 版本更新：

   - 更新 electron-builder 配置
   - 检查 entitlements 需求
   - 测试签名流程

3. 文档维护：
   - 更新签名流程文档
   - 记录问题和解决方案
   - 维护证书信息

2025-03-15 Yansong:
需要 build 的时候，test1 根目录先同步代码，npm install，然后运行 `./build/publish-update.sh --arm64`
