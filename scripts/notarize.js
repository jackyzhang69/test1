require('dotenv').config();
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  console.log('Notarize hook called');
  console.log('Platform:', electronPlatformName);
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  
  console.log('Starting notarization...');
  console.log('App path:', appPath);
  console.log('Apple ID:', process.env.APPLE_ID);
  console.log('Team ID:', process.env.APPLE_TEAM_ID);

  try {
    await notarize({
      tool: 'notarytool',
      appBundleId: 'com.watchpup.frombro',
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