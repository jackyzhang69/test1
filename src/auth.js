const crypto = require('crypto');
const { connectMongo } = require('./config');

// PBKDF2 defaults to match Passlib
const ALGORITHM = 'sha256';
const ITERATIONS = 29000;
const KEY_LENGTH = 32;  // 32 bytes
const SALT_SIZE = 16;   // 16 bytes

/**
 * Generate a Passlib-compatible PBKDF2-SHA256 hash
 * @param {string} password - plaintext password
 * @returns {Promise<string>} - The full Passlib-style hash string
 */
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    // Generate random 16-byte salt
    const salt = crypto.randomBytes(SALT_SIZE);

    // Derive a 32-byte key using PBKDF2 with 29000 iterations of SHA256
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, ALGORITHM, (err, derivedKey) => {
      if (err) return reject(err);

      // Base64 encode the salt and derived key
      const saltB64 = salt.toString('base64');
      const dkB64 = derivedKey.toString('base64');

      // Build a string identical to what passlib.pbkdf2_sha256 produces:
      // $pbkdf2-sha256$29000$saltInBase64$derivedKeyInBase64
      const fullHash = `$pbkdf2-sha256$${ITERATIONS}$${saltB64}$${dkB64}`;
      resolve(fullHash);
    });
  });
}

/**
 * Verify a plaintext password against a Passlib-style PBKDF2-SHA256 hash
 * @param {string} plainPassword - plaintext password to verify
 * @param {string} passlibHash - passlib-compatible hash (e.g. stored in DB)
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plainPassword, passlibHash) {
  return new Promise((resolve, reject) => {
    // Example format:
    //   $pbkdf2-sha256$29000$uDdvW1nF0adFSc9TKTGfIQ$yA2DCEt4aoszh6P/vfYVrco/PgXB8lX2Iz2FSZ5ZmNU
    const parts = passlibHash.split('$');
    // parts[1] = 'pbkdf2-sha256'
    // parts[2] = iterations
    // parts[3] = salt (base64)
    // parts[4] = derivedKey (base64)

    if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') {
      return resolve(false);  // not a valid passlib pbkdf2-sha256 hash
    }

    const iterations = parseInt(parts[2], 10);
    const salt = Buffer.from(parts[3], 'base64');
    const storedKey = Buffer.from(parts[4], 'base64');
    const keyLength = storedKey.length;

    // Derive a key from the provided plainPassword, using same salt, iteration, length
    crypto.pbkdf2(plainPassword, salt, iterations, keyLength, ALGORITHM, (err, derivedKey) => {
      if (err) return reject(err);
      // Compare derived key to the stored key
      resolve(crypto.timingSafeEqual(derivedKey, storedKey));
    });
  });
}

/**
 * 根据邮箱获取用户
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function getUserByEmail(email) {
  const db = await connectMongo();
  return await db.collection('user').findOne({ email: email.toLowerCase() });
}

/**
 * 用户登录函数
 *
 * @param {string} email 用户邮箱
 * @param {string} password 用户密码
 * @param {boolean} loginByForce 是否强制登录（未使用）
 * @returns {Promise<Object|Array>} 登录成功返回用户对象，否则返回 [null, null]
 */
async function login(email, password, loginByForce = false) {
  const user = await getUserByEmail(email);
  if (user && user.password) {
    try {
      if (verifyPassword(password, user.password)) {
        return user;
      }
    } catch (error) {
      return [user, null];
    }
  }
  return [null, null];
}

module.exports = { login, getUserByEmail};