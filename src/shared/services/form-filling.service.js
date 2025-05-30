const { chromium } = require('playwright');
const FormFillingData = require('../models/form_filling_data');
const { WebFiller } = require('../core/webfiller');

class FormFillingService {
  /**
   * Run form filling automation
   * @param {Object} formData - Form data from database
   * @param {Object} options - Automation options
   * @param {boolean} options.headless - Run browser in headless mode
   * @param {number} options.timeout - Timeout in seconds
   * @param {Function} options.progressCallback - Callback for progress updates
   * @param {Function} options.logger - Logger function
   * @returns {Promise<Object>} Result object
   */
  async runFormFilling(formData, options = {}) {
    const {
      headless = true,
      timeout = 30,
      progressCallback = null,
      logger = console.log
    } = options;

    let browser = null;
    
    try {
      // Create form data instance
      const form1Data = new FormFillingData(formData);
      
      // Create logger wrapper
      const loggerWrapper = (message) => {
        if (logger) logger(message);
        if (progressCallback) progressCallback(message);
      };
      
      // Create WebFiller instance
      const filler = new WebFiller(
        form1Data,      // formData
        null,           // fetch_func
        null,           // validate_func  
        true,           // debug
        loggerWrapper,  // logger
        timeout,        // timeout (seconds)
        process.cwd()   // screenshotDir
      );
      filler.actions = form1Data.actions;

      // Launch browser
      logger({ action: 'startup', message: 'Launching browser...' });
      browser = await chromium.launch({ 
        headless: headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // For server environments
      });
      
      const page = await browser.newPage();

      // Run automation
      logger({ action: 'startup', message: 'Starting form filling automation...' });
      await filler.fill(page);
      
      logger({ action: 'complete', message: 'Form filling completed successfully' });
      
      return {
        success: true,
        message: 'Form filled successfully',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Form filling automation error:', error);
      
      const errorResult = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      if (logger) {
        logger({ action: 'error', message: error.message });
      }
      
      return errorResult;
      
    } finally {
      // Always close browser
      if (browser) {
        try {
          await browser.close();
          logger({ action: 'cleanup', message: 'Browser closed' });
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
    }
  }

  /**
   * Validate form data before running automation
   * @param {Object} formData 
   * @returns {Object} Validation result
   */
  validateFormData(formData) {
    const errors = [];
    
    if (!formData) {
      errors.push('Form data is required');
    }
    
    if (!formData.actions || !Array.isArray(formData.actions)) {
      errors.push('Form data must contain actions array');
    }
    
    if (formData.actions && formData.actions.length === 0) {
      errors.push('Form data must contain at least one action');
    }
    
    // Validate essential action fields
    if (formData.actions) {
      formData.actions.forEach((action, index) => {
        if (!action.action) {
          errors.push(`Action ${index + 1}: missing action type`);
        }
        
        if (action.action !== 'pause' && !action.selector && action.action !== 'goto') {
          errors.push(`Action ${index + 1}: missing selector`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get automation capabilities and browser info
   * @returns {Promise<Object>}
   */
  async getAutomationInfo() {
    try {
      // Test browser launch
      const browser = await chromium.launch({ headless: true });
      const version = await browser.version();
      await browser.close();
      
      return {
        available: true,
        browserVersion: version,
        capabilities: {
          headless: true,
          headful: true,
          screenshots: true,
          fileDownload: true,
          networkIntercept: true
        }
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        capabilities: {}
      };
    }
  }

  /**
   * Create a test automation to verify everything works
   * @param {Function} logger 
   * @returns {Promise<Object>}
   */
  async runTestAutomation(logger = console.log) {
    const testFormData = {
      name: 'Test Automation',
      actions: [
        {
          action: 'goto',
          selector: 'https://example.com',
          name: 'Navigate to example.com'
        },
        {
          action: 'pause',
          value: 2,
          name: 'Wait 2 seconds'
        }
      ]
    };

    return await this.runFormFilling(testFormData, {
      headless: true,
      timeout: 10,
      logger: logger
    });
  }
}

module.exports = new FormFillingService();