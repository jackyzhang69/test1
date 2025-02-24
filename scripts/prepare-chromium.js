const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

async function getChromiumPath() {
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  } else if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  } else {
    return path.join(os.homedir(), '.cache', 'ms-playwright');
  }
}

async function prepareChromium() {
  const sourcePath = await getChromiumPath();
  const destPath = path.join(process.cwd(), '.local-chromium');

  // Ensure directory exists
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }

  // Find the latest Chromium and ffmpeg version directories
  const entries = fs.readdirSync(sourcePath);
  const chromiumDirs = entries
    .filter(entry => entry.startsWith('chromium-'))
    .sort((a, b) => b.localeCompare(a)); // Sort in descending order

  const ffmpegDirs = entries
    .filter(entry => entry.startsWith('ffmpeg-'))
    .sort((a, b) => b.localeCompare(a)); // Sort in descending order
  
  const latestChromium = chromiumDirs[0];
  const latestFfmpeg = ffmpegDirs[0];

  if (!latestChromium) {
    throw new Error('Chromium installation not found. Please run: npx playwright install chromium');
  }

  // Copy latest Chromium
  const sourceChromiumPath = path.join(sourcePath, latestChromium);
  const destChromiumPath = path.join(destPath, latestChromium);
  
  console.log(`Copying latest Chromium from: ${sourceChromiumPath}`);
  console.log(`Copying latest Chromium to: ${destChromiumPath}`);

  // Remove destination if it exists
  if (fs.existsSync(destChromiumPath)) {
    if (process.platform === 'win32') {
      execSync(`rmdir /s /q "${destChromiumPath}"`, { stdio: 'inherit' });
    } else {
      execSync(`rm -rf "${destChromiumPath}"`, { stdio: 'inherit' });
    }
  }

  // Use platform-specific copy command to preserve symlinks
  if (process.platform === 'win32') {
    fs.cpSync(sourceChromiumPath, destChromiumPath, { recursive: true });
  } else {
    // Use cp -R on Mac/Linux to preserve symlinks
    execSync(`cp -R "${sourceChromiumPath}" "${destChromiumPath}"`, { stdio: 'inherit' });
    // Set write permissions for the copied files on Mac/Linux
    execSync(`chmod -R u+w "${destChromiumPath}"`, { stdio: 'inherit' });
  }

  // Copy latest ffmpeg if it exists
  if (latestFfmpeg) {
    const sourceFfmpegPath = path.join(sourcePath, latestFfmpeg);
    const destFfmpegPath = path.join(destPath, latestFfmpeg);
    
    console.log(`Copying latest ffmpeg from: ${sourceFfmpegPath}`);
    console.log(`Copying latest ffmpeg to: ${destFfmpegPath}`);

    // Remove destination if it exists
    if (fs.existsSync(destFfmpegPath)) {
      if (process.platform === 'win32') {
        execSync(`rmdir /s /q "${destFfmpegPath}"`, { stdio: 'inherit' });
      } else {
        execSync(`rm -rf "${destFfmpegPath}"`, { stdio: 'inherit' });
      }
    }

    // Copy with platform-specific command
    if (process.platform === 'win32') {
      fs.cpSync(sourceFfmpegPath, destFfmpegPath, { recursive: true });
    } else {
      execSync(`cp -R "${sourceFfmpegPath}" "${destFfmpegPath}"`, { stdio: 'inherit' });
      // Set write permissions for the copied ffmpeg files on Mac/Linux
      execSync(`chmod -R u+w "${destFfmpegPath}"`, { stdio: 'inherit' });
    }
  } else {
    console.warn('ffmpeg not found. Some media capabilities might not work.');
  }
  
  console.log('Latest Chromium and ffmpeg prepared for packaging');
}

prepareChromium().catch(console.error); 