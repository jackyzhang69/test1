const databaseService = require('./database.service');
const { ObjectId } = require('mongodb');

class FormService {
  /**
   * Get all form filling data for a user
   * @param {string} userId 
   * @returns {Promise<Array>}
   */
  async getFormDataByUserId(userId) {
    try {
      const formCollection = await databaseService.getCollection('formfillingdata');
      const formData = await formCollection.find({ user_id: String(userId) }).toArray();
      
      console.log(`Found ${formData.length} forms for user ${userId}`);
      return formData;
    } catch (error) {
      console.error('Get form data error:', error);
      throw error;
    }
  }

  /**
   * Get specific form data by ID
   * @param {string} formId 
   * @returns {Promise<Object|null>}
   */
  async getFormDataById(formId) {
    try {
      const formCollection = await databaseService.getCollection('formfillingdata');
      const objectId = typeof formId === 'string' ? new ObjectId(formId) : formId;
      const formData = await formCollection.findOne({ _id: objectId });
      
      return formData;
    } catch (error) {
      console.error('Get form data by ID error:', error);
      throw error;
    }
  }

  /**
   * Create new form data
   * @param {Object} formData 
   * @returns {Promise<Object>}
   */
  async createFormData(formData) {
    try {
      const formCollection = await databaseService.getCollection('formfillingdata');
      
      // Add metadata
      const formWithMetadata = {
        ...formData,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await formCollection.insertOne(formWithMetadata);
      console.log('Form data created with ID:', result.insertedId);
      
      return { ...formWithMetadata, _id: result.insertedId };
    } catch (error) {
      console.error('Create form data error:', error);
      throw error;
    }
  }

  /**
   * Update existing form data
   * @param {string} formId 
   * @param {Object} updates 
   * @returns {Promise<Object|null>}
   */
  async updateFormData(formId, updates) {
    try {
      const formCollection = await databaseService.getCollection('formfillingdata');
      const objectId = typeof formId === 'string' ? new ObjectId(formId) : formId;
      
      const updateData = {
        ...updates,
        updated_at: new Date()
      };
      
      const result = await formCollection.findOneAndUpdate(
        { _id: objectId },
        { $set: updateData },
        { returnDocument: 'after' }
      );
      
      console.log('Form data updated:', formId);
      return result.value;
    } catch (error) {
      console.error('Update form data error:', error);
      throw error;
    }
  }

  /**
   * Delete form data
   * @param {string} formId 
   * @returns {Promise<boolean>}
   */
  async deleteFormData(formId) {
    try {
      const formCollection = await databaseService.getCollection('formfillingdata');
      const objectId = typeof formId === 'string' ? new ObjectId(formId) : formId;
      
      const result = await formCollection.deleteOne({ _id: objectId });
      console.log('Form data deleted:', formId);
      
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Delete form data error:', error);
      throw error;
    }
  }

  /**
   * Get RCIC accounts for a user (for JobBank Inviter)
   * @param {string} userId 
   * @returns {Promise<Array>}
   */
  async getRcicAccountsByUserId(userId) {
    try {
      const rcicCollection = await databaseService.getCollection('rcic');
      const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
      
      const rcicAccounts = await rcicCollection.find({ 
        owner_ids: objectId,
        is_active: true 
      }).toArray();
      
      console.log(`Found ${rcicAccounts.length} RCIC accounts for user ${userId}`);
      return rcicAccounts;
    } catch (error) {
      console.error('Get RCIC accounts error:', error);
      throw error;
    }
  }

  /**
   * Get specific RCIC account by ID
   * @param {string} rcicId 
   * @returns {Promise<Object|null>}
   */
  async getRcicAccountById(rcicId) {
    try {
      const rcicCollection = await databaseService.getCollection('rcic');
      const objectId = typeof rcicId === 'string' ? new ObjectId(rcicId) : rcicId;
      
      const rcicAccount = await rcicCollection.findOne({ _id: objectId });
      return rcicAccount;
    } catch (error) {
      console.error('Get RCIC account by ID error:', error);
      throw error;
    }
  }

  /**
   * Get form statistics for a user
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  async getFormStats(userId) {
    try {
      const formCollection = await databaseService.getCollection('formfillingdata');
      
      const stats = await formCollection.aggregate([
        { $match: { user_id: String(userId) } },
        {
          $group: {
            _id: null,
            totalForms: { $sum: 1 },
            totalActions: { $sum: { $size: { $ifNull: ['$actions', []] } } },
            lastUpdated: { $max: '$updated_at' }
          }
        }
      ]).toArray();
      
      return stats[0] || { totalForms: 0, totalActions: 0, lastUpdated: null };
    } catch (error) {
      console.error('Get form stats error:', error);
      throw error;
    }
  }
}

module.exports = new FormService();