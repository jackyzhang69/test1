const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Get the architecture from command line arguments
const platform = process.argv[2]; // 'mac'
const arch = process.argv[3]; // 'x64' or 'arm64'

if (platform !== 'mac' || !arch) {
  console.error('Platform must be "mac" and architecture must be specified. Usage: node rename-update-files.js mac [x64|arm64]');
  process.exit(1);
}

const distDir = path.join(__dirname, '../dist');
const sourceFile = path.join(distDir, 'latest-mac.yml');
const targetFileName = `latest-mac-${arch}.yml`;
const targetFile = path.join(distDir, targetFileName);

// Create a copy of the file with the new name
if (fs.existsSync(sourceFile)) {
  // Simply copy the file without modifying its content
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`Created copy of ${sourceFile} as ${targetFile}`);
  
  // Upload the file to S3
  uploadToS3(targetFile, targetFileName).catch(err => {
    console.error('Error uploading to S3:', err);
    process.exit(1);
  });
} else {
  console.error(`Source file ${sourceFile} not found`);
  process.exit(1);
}

async function uploadToS3(filePath, fileName) {
  // Create S3 client
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ca-central-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  // Read file content
  const fileContent = fs.readFileSync(filePath);
  
  // Set up parameters for S3 upload
  const params = {
    Bucket: process.env.AWS_S3_BUCKET || 'formbro-updates',
    Key: fileName,
    Body: fileContent,
    ContentType: 'application/x-yaml'
  };

  // Upload to S3
  try {
    console.log(`Uploading ${fileName} to S3...`);
    const data = await s3Client.send(new PutObjectCommand(params));
    console.log(`Successfully uploaded ${fileName} to S3`);
    return data;
  } catch (err) {
    console.error(`Error uploading ${fileName} to S3:`, err);
    throw err;
  }
} 