require('dotenv').config();
const AWS = require('aws-sdk');

// Load credentials from environment
const ACCESS_KEY = process.env.S3_ACCESS_KEY;
const SECRET_KEY = process.env.S3_SECRET_KEY;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Configure the AWS SDK
const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_KEY,
  // Optionally specify region if needed:
  // region: process.env.S3_REGION
});

/**
 * Upload a file from the local filesystem to S3.
 * @param {string} filePath - Path to local file to be uploaded
 * @param {string} objectName - S3 object key (including any folder prefixes)
 * @returns {Promise<boolean>}
 */
async function upload_to_s3(filePath, objectName) {
  try {
    await s3
      .upload({
        Bucket: BUCKET_NAME,
        Key: objectName,
        Body: require('fs').createReadStream(filePath),
      })
      .promise();

    console.log(
      `File '${filePath}' uploaded successfully to '${BUCKET_NAME}' with object name '${objectName}'`
    );
    return true;
  } catch (err) {
    console.error(`Error uploading file '${filePath}': ${err}`);
    return false;
  }
}

/**
 * Delete an object from S3.
 * @param {string} objectName - S3 object key to delete
 * @returns {Promise<boolean>}
 */
async function delete_from_s3(objectName) {
  try {
    await s3
      .deleteObject({
        Bucket: BUCKET_NAME,
        Key: objectName,
      })
      .promise();

    console.log(
      `File '${objectName}' deleted successfully from '${BUCKET_NAME}' bucket`
    );
    return true;
  } catch (err) {
    console.error(`Error deleting file '${objectName}': ${err}`);
    return false;
  }
}

/**
 * Download a file from S3 to local filesystem.
 * @param {string} objectName - The S3 object key
 * @param {string} localFilePath - Where to store the downloaded file locally
 * @returns {Promise<void>}
 */
async function download_from_s3(objectName, localFilePath) {
  try {
    const data = await s3
      .getObject({
        Bucket: BUCKET_NAME,
        Key: objectName,
      })
      .promise();

    require('fs').writeFileSync(localFilePath, data.Body);
    console.log(
      `File '${objectName}' downloaded successfully to '${localFilePath}'`
    );
  } catch (err) {
    console.error(`Error downloading file '${objectName}': ${err}`);
  }
}

/**
 * List files in a specified "folder" (prefix) in S3.
 * @param {string} folderName - S3 prefix to list
 * @returns {Promise<string[]>}
 */
async function list_files_in_s3_folder(folderName) {
  try {
    const response = await s3
      .listObjectsV2({
        Bucket: BUCKET_NAME,
        Prefix: folderName,
      })
      .promise();

    if (!response.Contents) return [];
    const files = response.Contents.map(obj => obj.Key);
    return files;
  } catch (err) {
    console.error(`Error listing files in folder '${folderName}': ${err}`);
    return [];
  }
}

// If you want to replicate the "if __name__ == '__main__':" test block:
if (require.main === module) {
  (async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    // create a test file locally
    fs.writeFileSync('test.txt', 'This is a test file', 'utf-8');

    // Test upload
    await upload_to_s3('test.txt', 'tr/testfiles/test.txt');

    // Test download
    const tempDir = os.tmpdir();
    const downloadedPath = path.join(tempDir, 'test_downloaded.txt');
    await download_from_s3('tr/testfiles/test.txt', downloadedPath);

    // Print the downloaded file content
    console.log(
      `Downloaded content:\n${fs.readFileSync(downloadedPath, 'utf-8')}`
    );

    // Test list
    const filesBeforeDelete = await list_files_in_s3_folder('tr/testfiles');
    console.log('Files before delete:', filesBeforeDelete);

    // Test delete
    await delete_from_s3('tr/testfiles/test.txt');

    const filesAfterDelete = await list_files_in_s3_folder('tr/testfiles');
    console.log('Files after delete:', filesAfterDelete);

    // delete local file
    fs.unlinkSync('test.txt');
    fs.unlinkSync(downloadedPath);
  })();
}

// Export functions for reusability in another module
module.exports = {
  upload_to_s3,
  delete_from_s3,
  download_from_s3,
  list_files_in_s3_folder,
};
