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
