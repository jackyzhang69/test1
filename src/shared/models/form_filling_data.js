// formFillingData.js

/**
 * In Python, Pydantic provides data validation.
 * In Node.js, you might use Joi, Yup, Zod, or similar packages to achieve the same.
 * Here, we create a simple class that mirrors the Python structure.
 */
class FormFillingData {
  /**
   * @param {object} options
   * @param {string} options.user_id
   * @param {string} options.application_id
   * @param {string} options.application_name
   * @param {Array<Array>} options.actions - an array of tuples (in JS, an array of arrays)
   */
  constructor({ user_id, application_id, application_name, actions }) {
    // Basic checks (optional — you can expand these based on your needs)
    if (typeof user_id !== 'string') {
      throw new Error('user_id must be a string');
    }
    if (typeof application_id !== 'string') {
      throw new Error('application_id must be a string');
    }
    if (typeof application_name !== 'string') {
      throw new Error('application_name must be a string');
    }
    if (!Array.isArray(actions)) {
      throw new Error('actions must be an array (of tuples/arrays)');
    }

    // Assign the fields
    this.user_id = user_id;
    this.application_id = application_id;
    this.application_name = application_name;
    this.actions = actions; // each element can be a [ ... ] array, emulating Python's tuple
  }
}

module.exports = FormFillingData;
