const crypto = require('crypto');
const databaseService = require('./database.service');

class AuthService {
  /**
   * Authenticate user with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} User object if successful, null if failed
   */
  async login(email, password) {
    try {
      // Process email: lowercase and strip whitespace
      const processedEmail = email.trim().toLowerCase();
      
      const userCollection = await databaseService.getCollection('user');
      const user = await userCollection.findOne({ email: processedEmail });

      if (!user) {
        console.log('User not found:', processedEmail);
        return null;
      }

      // Verify password using PBKDF2
      const isValid = this.verifyPassword(password, user.password);
      
      if (isValid) {
        console.log('Login successful for:', processedEmail);
        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      } else {
        console.log('Invalid password for:', processedEmail);
        return null;
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Convert passlib base64 format to standard base64
   * @param {string} passlibB64 
   * @returns {string}
   */
  passlibToStandardB64(passlibB64) {
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

  /**
   * Verify password using PBKDF2 hash
   * @param {string} plainPassword 
   * @param {string} hashedPassword 
   * @returns {boolean}
   */
  verifyPassword(plainPassword, hashedPassword) {
    try {
      // Parse the passlib format: $pbkdf2-sha256$rounds$salt$hash
      const parts = hashedPassword.split('$');
      if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') {
        throw new Error('Invalid password hash format');
      }

      const rounds = parseInt(parts[2]);
      const saltB64 = parts[3];
      const storedHashB64 = parts[4];

      console.log('Input hash:', hashedPassword);
      console.log('Plain password:', plainPassword);

      // Convert passlib base64 to standard base64 with proper padding
      const saltStandardB64 = this.passlibToStandardB64(saltB64);
      const storedHashStandardB64 = this.passlibToStandardB64(storedHashB64);

      // Decode salt and stored hash
      const salt = Buffer.from(saltStandardB64, 'base64');
      const storedHash = Buffer.from(storedHashStandardB64, 'base64');

      // Derive key using Node.js crypto module
      const derivedKey = crypto.pbkdf2Sync(plainPassword, salt, rounds, storedHash.length, 'sha256');

      // Use timing-safe comparison
      const isValid = crypto.timingSafeEqual(derivedKey, storedHash);
      console.log('Is Valid:', isValid);

      return isValid;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  async getUserById(userId) {
    try {
      const userCollection = await databaseService.getCollection('user');
      const user = await userCollection.findOne({ _id: userId });
      
      if (user) {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
      
      return null;
    } catch (error) {
      console.error('Get user by ID error:', error);
      throw error;
    }
  }

  /**
   * Check if user exists by email
   * @param {string} email 
   * @returns {Promise<boolean>}
   */
  async userExists(email) {
    try {
      // Process email: lowercase and strip whitespace
      const processedEmail = email.trim().toLowerCase();
      
      const userCollection = await databaseService.getCollection('user');
      const user = await userCollection.findOne({ email: processedEmail }, { projection: { _id: 1 } });
      return !!user;
    } catch (error) {
      console.error('User exists check error:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();