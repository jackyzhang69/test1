const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

// Playwright CDN configuration
const PLAYWRIGHT_CDN = 'https://playwright.azureedge.net/builds/chromium';
const CHROMIUM_VERSION = '1169'; // Should match your playwright version

// Platform configurations
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

async function downloadFile(url, dest) {
  console.log(`Downloading from: ${url}`);
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const progress = ((downloadedSize / totalSize) * 100).toFixed(2);
          process.stdout.write(`\rDownloading: ${progress}%`);
        }
      });
      
      const fileStream = createWriteStream(dest);
      
      streamPipeline(response, fileStream)
        .then(() => {
          console.log('\nDownload complete!');
          resolve();
        })
        .catch(reject);
        
    }).on('error', reject);
  });
}

async function extractZip(zipPath, destPath, platform) {
  console.log(`Extracting ${zipPath} to ${destPath}...`);
  
  if (process.platform === 'win32') {
    // Use PowerShell on Windows
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`, { stdio: 'inherit' });
  } else {
    // Use unzip on Mac/Linux
    execSync(`unzip -o "${zipPath}" -d "${destPath}"`, { stdio: 'inherit' });
  }
}

async function downloadChromiumForPlatform(targetPlatform) {
  const platform = PLATFORM_MAP[targetPlatform];
  if (!platform) {
    throw new Error(`Unsupported platform: ${targetPlatform}`);
  }
  
  // Create platform-specific directory
  const destPath = path.join(process.cwd(), `.local-chromium-${targetPlatform}`);
  const chromiumPath = path.join(destPath, `chromium-${CHROMIUM_VERSION}`);
  
  // Create directory
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }
  
  // Check if already exists for this platform
  const expectedExePath = path.join(chromiumPath, platform.executablePath);
  if (fs.existsSync(chromiumPath) && fs.existsSync(expectedExePath)) {
    console.log(`${targetPlatform} Chromium already exists at: ${chromiumPath}`);
    return chromiumPath;
  }
  
  // Download URL
  const downloadUrl = `${PLAYWRIGHT_CDN}/${CHROMIUM_VERSION}/${platform.archiveName}`;
  const zipPath = path.join(destPath, platform.archiveName);
  
  console.log(`\nDownloading Chromium for ${targetPlatform} (version ${CHROMIUM_VERSION})...`);
  
  try {
    // Download the zip file
    await downloadFile(downloadUrl, zipPath);
    
    // Remove existing directory if partial
    if (fs.existsSync(chromiumPath)) {
      console.log('Removing partial installation...');
      if (process.platform === 'win32') {
        execSync(`rmdir /s /q "${chromiumPath}"`, { stdio: 'inherit' });
      } else {
        execSync(`rm -rf "${chromiumPath}"`, { stdio: 'inherit' });
      }
    }
    
    // Create chromium version directory
    fs.mkdirSync(chromiumPath, { recursive: true });
    
    // Extract the zip file
    await extractZip(zipPath, chromiumPath, targetPlatform);
    
    // Clean up zip file
    fs.unlinkSync(zipPath);
    
    // Create marker files (like Playwright does)
    fs.writeFileSync(path.join(chromiumPath, 'INSTALLATION_COMPLETE'), '');
    fs.writeFileSync(path.join(chromiumPath, 'DEPENDENCIES_VALIDATED'), '');
    
    console.log(`✅ ${targetPlatform} Chromium downloaded successfully!`);
    
    // Verify the executable exists
    if (fs.existsSync(expectedExePath)) {
      console.log(`✅ Executable verified at: ${platform.executablePath}`);
    } else {
      throw new Error(`Executable not found at expected path: ${platform.executablePath}`);
    }
    
    return chromiumPath;
    
  } catch (error) {
    console.error(`Failed to download ${targetPlatform} Chromium:`, error);
    // Clean up on error
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    throw error;
  }
}

async function downloadFFmpeg(targetPlatform) {
  // Also download ffmpeg for the target platform
  const destPath = path.join(process.cwd(), `.local-chromium-${targetPlatform || process.platform}`);
  const ffmpegPath = path.join(destPath, 'ffmpeg-1011');
  
  if (fs.existsSync(ffmpegPath)) {
    console.log('FFmpeg already exists');
    return;
  }
  
  // Copy from local playwright installation if available
  const os = require('os');
  let sourceFfmpegPath;
  
  if (process.platform === 'win32') {
    sourceFfmpegPath = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'ffmpeg-1011');
  } else if (process.platform === 'darwin') {
    sourceFfmpegPath = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright', 'ffmpeg-1011');
  } else {
    sourceFfmpegPath = path.join(os.homedir(), '.cache', 'ms-playwright', 'ffmpeg-1011');
  }
  
  if (fs.existsSync(sourceFfmpegPath)) {
    console.log('Copying ffmpeg from local installation...');
    if (process.platform === 'win32') {
      execSync(`robocopy "${sourceFfmpegPath}" "${ffmpegPath}" /E /COPY:DAT /R:3 /W:1`, { stdio: 'inherit' });
    } else {
      execSync(`cp -R "${sourceFfmpegPath}" "${ffmpegPath}"`, { stdio: 'inherit' });
    }
    console.log('✅ FFmpeg copied successfully');
  }
}

async function prepareChromiumCrossPlatform() {
  console.log('=== Cross-Platform Chromium Preparation ===');
  console.log(`Current platform: ${process.platform}`);
  
  const targetPlatforms = process.env.TARGET_PLATFORMS ? 
    process.env.TARGET_PLATFORMS.split(',') : 
    ['win32', 'darwin']; // Default to both Windows and Mac
  
  console.log(`Target platforms: ${targetPlatforms.join(', ')}`);
  
  for (const platform of targetPlatforms) {
    try {
      await downloadChromiumForPlatform(platform);
      // Download ffmpeg for the same platform
      await downloadFFmpeg(platform);
    } catch (error) {
      console.error(`Failed to prepare Chromium for ${platform}:`, error);
      // Continue with other platforms
    }
  }
  
  console.log('\n✅ Cross-platform Chromium preparation complete!');
}

// Run if called directly
if (require.main === module) {
  prepareChromiumCrossPlatform().catch(console.error);
}

module.exports = { prepareChromiumCrossPlatform, downloadChromiumForPlatform };