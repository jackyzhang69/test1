const crypto = require('crypto');
const { connectMongo } = require('./config');

function passlibToStandardB64(passlibB64) {
  // Replace '.' with '+'
  let out = passlibB64.replace(/\./g, '+');

  // Base64 requires string length to be a multiple of 4. Passlib
  // often omits '=' padding. So if the length % 4 != 0, add '='.
  const pad = out.length % 4;
  if (pad !== 0) {
    out += '='.repeat(4 - pad);
  }
  return out;
}

function verifyPassword(plainPassword, hashedPassword) {
  try {
    const parts = hashedPassword.split('$');
    if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') {
      throw new Error('Invalid hash format');
    }

    const rounds = parseInt(parts[2], 10);

    // Convert Passlib's salt & hash to standard base64, then decode
    const saltB64 = passlibToStandardB64(parts[3]);
    const storedHashB64 = passlibToStandardB64(parts[4]);

    const salt = Buffer.from(saltB64, 'base64');
    const storedHash = Buffer.from(storedHashB64, 'base64');

    console.log('Input hash:', hashedPassword);
    console.log('Plain password:', plainPassword);
    console.log('Rounds:', rounds);
    console.log('Salt (passlib b64):', parts[3]);
    console.log('Salt (standard b64):', saltB64);
    console.log('Salt length:', salt.length);
    console.log('Salt (hex):', salt.toString('hex'));
    console.log('Stored Hash (passlib b64):', parts[4]);
    console.log('Stored Hash (standard b64):', storedHashB64);
    console.log('Stored Hash length:', storedHash.length);

    // Generate the derived key
    const derivedKey = crypto.pbkdf2Sync(plainPassword, salt, rounds, 32, 'sha256');
    console.log('Derived Key (base64):', derivedKey.toString('base64'));
    console.log('Derived Key (hex):', derivedKey.toString('hex'));

    // Compare in constant time
    const isValid = crypto.timingSafeEqual(derivedKey, storedHash);
    console.log('Is Valid:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
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
      if (await verifyPassword(password, user.password)) {
        return user;
      }
    } catch (error) {
      return [user, null];
    }
  }
  return [null, null];
}

module.exports = { login, getUserByEmail};