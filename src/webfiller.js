// pwEngine.js

const { expect } = require('@playwright/test'); // for toBeVisible etc. (Playwright Test)
const fs = require('fs');
const path = require('path');
const { download_from_s3 } = require('./s3'); // 修改这里，从 s3Client 改为 s3
// const { FillerGraph } = require('./fillerGraph');  // If needed for references
// date/time formatting
function currentTimeString() {
  // In Python: datetime.datetime.now().strftime("%H%M")
  const dateObj = new Date();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const mins = String(dateObj.getMinutes()).padStart(2, '0');
  return `${hours}${mins}`;
}

/**
 * Sleep for N seconds (Python's `time.sleep(float(data))`).
 * @param {number} seconds
 */
async function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

class PwEngine {
  constructor(page, context, exhandler = null) {
    this.page = page;        // playwright Page instance
    this.context = context;  // dictionary-like object
    this.exhandler = exhandler;
    this.screenshotDir = process.cwd(); // Default value, will be overridden
    this.timeout = 30000; // Default timeout of 30 seconds in milliseconds
  }

  /**
   * Helper that modifies the selector if it contains "{}" and data != null
   * Also processes special "get_by_" logic in Python code.
   */
  async _element(selector, data = null) {
    let finalSelector = selector;

    // If there's a '{}' placeholder, substitute
    if (finalSelector.includes('{}') && data !== null) {
      finalSelector = finalSelector.replace('{}', String(data));
    }

    // "get_by_" logic from Python
    // e.g. "get_by_role('button', name='Edit IMM...')"
    // The Python code used eval to do something like self.page.get_by_role(...)
    // We do our best to replicate. If you want truly dynamic calls, you'd parse the string.
    if (finalSelector.startsWith('get_by_')) {
      // If there's an "or_" within the selector
      // e.g. get_by_role(...)or_(get_by_role(...))
      if (finalSelector.includes('or_')) {
        const selectors = finalSelector.split('or_');
        // s1 => the left side e.g. get_by_role('button', name='Edit IMM 5562')
        // s2 => the right side e.g. get_by_role('button', name='Start IMM')
        const s1 = selectors[0]; // "get_by_role('button', name='Edit IMM 5562')"
        // remove leading/trailing parentheses or underscores for the second
        let s2 = selectors[1];
        // The Python code does s2 = s2[1:-1], but we must parse carefully
        // Usually it's something like: or_(get_by_role('...'))
        s2 = s2.replace(/^(\(|\))|(\(|\))$/g, '');

        // We attempt each separately:
        const e1 = await this._evaluateGetBy(s1);
        const e2 = await this._evaluateGetBy(s2);

        // Python code: expect(e1.or_(e2)).to_be_visible(); if e2.is_visible() => return e2 else e1
        // We'll do an approximate approach in Node:
        // Wait up to some small time for either to be visible. If e2 is visible, we return e2, otherwise e1.
        await Promise.all([
          expect(e1).toBeVisible({ timeout: 5000 }).catch(() => null),
          expect(e2).toBeVisible({ timeout: 5000 }).catch(() => null),
        ]);

        const e2Visible = await e2.isVisible();
        return e2Visible ? e2 : e1;
      }
      // Otherwise parse single get_by_... call
      return this._evaluateGetBy(finalSelector);
    } else {
      // Default: return page.locator(finalSelector)
      return this.page.locator(finalSelector);
    }
  }

  /**
   * Attempt to parse the string, e.g. `get_by_role('button', { name: 'Start IMM' })`
   * In Python, you used eval(f"self.page.{s1}"). In JS, there's no direct eval for method calls.
   * We'll do a simple pattern-based approach. Adjust if your usage differs.
   */
  async _evaluateGetBy(getByString) {
    // Example: "get_by_role('button', name='Edit IMM 5562')"
    // We want to call `this.page.getByRole('button', { name: 'Edit IMM 5562' })`.
    // So let's do a quick parse:
    // 1) extract the method name after "get_by_"
    // 2) parse the arguments
    // This is approximate.

    const trimmed = getByString.trim(); // e.g. get_by_role('button', name='Edit IMM 5562')

    // Find the method: e.g. 'role'
    // Updated regex to only capture up to the first closing parenthesis
    const methodMatch = trimmed.match(/^get_by_(\w+)\(([^)]+)\)(.*)/);
    if (!methodMatch) {
      // fallback
      return this.page.locator(trimmed);
    }
    const method = methodMatch[1]; // "role"
    const innerArgs = methodMatch[2]; // "'button', name='Edit IMM 5562'"
    const chainedOps = methodMatch[3]; // ".nth(0)" or empty string

    // Quick parse of innerArgs. We must handle quotes, etc. We'll do a naive approach:
    // If it starts with e.g. "'button', name='something'"
    // Then arg1 = 'button'
    // Then we parse the rest into an options object if there's `name='...'`
    const argParts = innerArgs.split(','); // ["'button'", " name='Edit IMM 5562'"]
    const mainArg = argParts[0].trim(); // "'button'"
    // Clean quotes
    const mainValue = mainArg.replace(/^['"]|['"]$/g, '');

    // Build a param object
    const options = {};
    for (let i = 1; i < argParts.length; i++) {
      const kv = argParts[i].trim(); // e.g. "name='Edit IMM 5562'"
      const eqIndex = kv.indexOf('=');
      if (eqIndex > 0) {
        const key = kv.substring(0, eqIndex).trim();
        let val = kv.substring(eqIndex + 1).trim(); // "'Edit IMM 5562'"
        // remove quotes
        val = val.replace(/^['"]|['"]$/g, '');
        options[key] = val;
      }
    }

    let result;
    switch (method) {
      case 'role':
        // page.getByRole(mainValue, options)
        result = this.page.getByRole(mainValue, options);
        break;
      case 'text':
        // page.getByText('some text', options)
        result = this.page.getByText(mainValue, options);
        break;
      case 'label':
        result = this.page.getByLabel(mainValue, options);
        break;
      // etc. Extend if needed
      default:
        // fallback
        result = this.page.locator(trimmed);
    }

    // Handle chained operations
    if (chainedOps) {
      // Extract the operation and its argument
      const opMatch = chainedOps.match(/\.(\w+)\((\d+)\)/);
      if (opMatch) {
        const [_, op, arg] = opMatch;
        if (op === 'nth') {
          result = result.nth(parseInt(arg));
        }
      }
    }

    return result;
  }

  // --------------------------------------------------
  // Methods that mirror the Python definitions
  // --------------------------------------------------

  async fill(selector, option, data) {
    if (typeof data === 'number') {
      data = String(data);
    }
    const element = await this._element(selector);
    if (option === 'type') {
      console.log('typing ...');
      // Python calls press_sequentially; in Node you can do something like:
      for (const ch of data) {
        await element.press(ch, { delay: 100 });
      }
    } else {
      await element.fill(data);
    }
  }

  async fill_date(selector, option, data) {
    // Python comment: "bcpnp needs to use typing, lmia can fill directly"
    // We'll replicate logic as is
    const element = await this._element(selector);
    if (option === 'us') {
      await element.fill(data);
    } else {
      await element.click();
      await this.page.keyboard.type(data);
      await this.page.keyboard.press('Enter');
    }
  }

  async match_select(selector, option, data) {
    // We replicate the Python logic of reading all <option> from a <select>
    // to find partial text match
    const selectElement = await (await this._element(selector)).elementHandle();
    const options = await selectElement.$$(`option`);
    const availableOptions = [];

    for (const o of options) {
      const text = await o.innerText();
      availableOptions.push(text);
      const value = await o.getAttribute('value');
      if (text.toLowerCase().includes(data.toLowerCase())) {
        // found match => do select
        await (await this._element(selector)).selectOption(value);
        return;
      }
    }
    // if no match
    if (this.exhandler) {
      const ret = this.exhandler(availableOptions);
      await (await this._element(selector)).selectOption(ret);
    } else {
      throw new Error(`Option (${data}) not found in ${availableOptions}`);
    }
  }

  async select(selector, option, data) {
    // replicate logic
    if (typeof data === 'boolean') {
      data = data ? 'Yes' : 'No';
    }
    if (option && option.includes('label')) {
      await (await this._element(selector)).selectOption({ label: data });
    } else {
      await (await this._element(selector)).selectOption(data);
    }
  }

  async check(selector, option, data) {
    if (typeof data === 'boolean') {
      data = data ? 'Yes' : 'No';
    }
    if (data) {
      if (option === 'name') {
        await this.page
          .locator(`input[name="${selector}"] + label:has-text("${data}")`)
          .check();
      } else if (option === 'iname') {
        // e.g. "#isConvictedInCanada_{yes/no}"
        const finalSelector = selector.replace('{}', data.toLowerCase());
        await this.page.locator(finalSelector).check();
      } else {
        await (await this._element(selector, data)).check();
      }
    } else {
      // if data is falsy, the Python code just checks the base element
      await (await this._element(selector)).check();
    }
  }

  async fieldset_check(selector, option, data) {
    if (typeof data === 'boolean') {
      data = data ? 'Yes' : 'No';
    }
    // locate the fieldset
    // Xpath: //fieldset[legend/span[@class="field-name" and contains(text(), "{selector}")]]
    // In Node: page.locator('xpath=...')
    const fieldset = this.page.locator(
      `xpath=//fieldset[legend/span[@class="field-name" and contains(text(), "${selector}")]]`
    );
    if (option === 'multiple') {
      // multiple checkboxes
      const checkbox = fieldset.locator(`input[type="checkbox"][value="${data}"]`);
      await checkbox.check();
    } else {
      // radio
      const radio = fieldset.locator(`input[type="radio"][value="${data}"]`);
      await radio.check();
    }
  }

  async click(selector, option, data) {
    const element = await this._element(selector, data);
    if (option === 'force') {
      await element.click({ force: true });
    } else {
      await element.click();
    }
  }

  async goto(selector, option, data) {
    let url = selector;
    if (data) {
      url = selector.replace('{}', String(data));
    }
    await this.page.goto(url);
  }

  async get(selector, option, data) {
    if (selector === 'url') {
      // store current url in context
      this.context.url = this.page.url();
      if (option) {
        // parse out varName & urlTemplate
        // e.g. "case_id=https://prson-srpel.apps.cic.gc.ca/en/application/profile/{}"
        const [varName, urlTemplate] = option.split('=');
        // approximate parse: find the placeholder
        const currentUrl = this.page.url();
        // e.g. parse("...{}", currentUrl)
        // We do a naive approach: split by '{}' if it exists
        if (urlTemplate.includes('{}')) {
          const prefix = urlTemplate.split('{}')[0];
          const suffix = urlTemplate.split('{}')[1] || '';
          const isMatch =
            currentUrl.startsWith(prefix) && currentUrl.endsWith(suffix);
          if (isMatch) {
            const matchedMiddle = currentUrl.substring(
              prefix.length,
              currentUrl.length - suffix.length
            );
            this.context[varName] = matchedMiddle;
          } else {
            this.context[varName] = null;
          }
        }
      }
    } else {
      // compare the content with data
      const content = await (await this._element(selector)).innerText();
      console.log(content);
      if (typeof data === 'string' && content.toLowerCase() === data.toLowerCase()) {
        // Python code sets context["goto"] = option
        this.context.goto = option;
      }
    }
  }

  async qa(selector, option, data) {
    // The code checks question text in "option", fills with data from the QA array
    const questionEl = await this._element(option);
    const question = await questionEl.innerText();

    for (const qa of data) {
      // Python checks if qa is a dict or object
      // We'll assume everything is an object with question/answer
      const qText = qa.question || qa['question'];
      const aText = qa.answer || qa['answer'];
      if (qText && question.includes(qText)) {
        const answerEl = await this._element(selector);
        await answerEl.fill(aText);
      }
    }
  }

  async pause(selector, option, data) {
    if (data) {
      console.log(`Pause for ${data} seconds...`);
      await sleep(parseFloat(data));
    } else {
      // Skip pause in production, do nothing
      console.log('Skipping pause in production');
    }
  }

  async upload(selector, option, data) {
    // data might be a string "s3://..." or local path or an object with .path
    const element = await this._element(selector);
    if (typeof data === 'string') {
      if (data.startsWith('s3://')) {
        const s3Path = data.slice(5); // remove "s3://"
        const fileName = path.basename(s3Path);
        const tempDir = require('os').tmpdir();
        const localFilePath = path.join(tempDir, fileName);
        // download from s3, then set_input_files
        await download_from_s3(s3Path, localFilePath);
        await element.setInputFiles(localFilePath, { timeout: this.timeout });
      } else {
        await element.setInputFiles(data, { timeout: this.timeout });
      }
    } else if (data && data.path) {
      await element.setInputFiles(data.path, { timeout: this.timeout });
    }
  }

  async lmia_finalize(selector, option, data) {
    // replicate logic that navigates the LMIA application
    // wait 2s
    await sleep(2);
    // find last Edit link
    const editLink = this.page.locator('a:has-text("Edit")').last();
    const editUrl = await editLink.getAttribute('href');
    console.log('Edit URL: ', editUrl);

    // parse out /Employer/{employer_id}/Application/{application_id}/...
    const parts = editUrl.split('/');
    const employer_id = parts[2];
    const application_id = parts[5];

    await this.page.goto(`https://tfwp.lmia.esdc.gc.ca${editUrl}`);

    // repeatedly click `#next` until it's disabled
    while (true) {
      const nextBtn = this.page.locator('#next');
      await sleep(2); // let the page logic update
      const btnDisabled = await nextBtn.isDisabled();
      console.log(btnDisabled);
      if (btnDisabled) {
        break;
      }
      await nextBtn.click();
    }
    this.context.summary_url = `https://tfwp.lmia.esdc.gc.ca/Employer/${employer_id}/Application/${application_id}/Summary`;
  }

  async keyboard(selector, option, data) {
    // data is which key to press
    await this.page.keyboard.press(data);
  }

  async wait(selector, option, data) {
    try {
      await expect(await this._element(selector)).toBeVisible({ timeout: this.timeout });
      console.log(`Element "${selector}" found`);
    } catch (error) {
      console.error(`Timeout waiting for element "${selector}" after ${this.timeout/1000}s`);
      throw error;
    }
  }

  async batch_click(selector, option, data) {
    // click all matching elements, possibly confirm each time
    let elements = await (await this._element(selector)).all();
    while (elements.length > 0) {
      await elements[elements.length - 1].click();
      await sleep(3);
      if (option) {
        const confirm = await this._element(option);
        await confirm.click();
        await sleep(3);
      }
      elements = await (await this._element(selector)).all();
    }
  }

  /**
   * The Python code used a dictionary mapping actions -> method references.
   * We'll replicate that as a property on the class.
   */
  actionsMap() {
    return {
      fill: this.fill.bind(this),
      fill_date: this.fill_date.bind(this),
      match_select: this.match_select.bind(this),
      select: this.select.bind(this),
      check: this.check.bind(this),
      fieldset_check: this.fieldset_check.bind(this),
      click: this.click.bind(this),
      goto: this.goto.bind(this),
      get: this.get.bind(this),
      qa: this.qa.bind(this),
      pause: this.pause.bind(this),
      upload: this.upload.bind(this),
      lmia_finalize: this.lmia_finalize.bind(this),
      keyboard: this.keyboard.bind(this),
      wait: this.wait.bind(this),
      batch_click: this.batch_click.bind(this),
    };
  }

  /**
   * Perform the given action.
   */
  async act(action, selector, option, data) {
    const actions = this.actionsMap();
    if (actions[action]) {
      // Simplify action logging
      console.log(`${action}: ${selector}`);
      
      if (option && option.includes('skip_disabled')) {
        const locator = await this._element(selector);
        const disabled = await locator.isDisabled();
        if (disabled) {
          console.log(`Skipping disabled element: ${selector}`);
          return;
        }
      }
      if (option && option.includes('skip_nonexist')) {
        await sleep(5); // replicate the Python code's wait
        const locator = await this._element(selector);
        const count = await locator.count();
        if (count === 0) {
          console.log(`Skipping nonexistent element: ${selector}`);
          return;
        }
      }
      try {
        await actions[action](selector, option, data);
      } catch (err) {
        // In Python, you screenshot and raise a RuntimeError
        const timeStr = currentTimeString();
        const screenshotPath = path.join(this.screenshotDir, `error_${action}_${timeStr}.png`);
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('Error screenshot saved:', screenshotPath);
        throw new Error(
          `Error with action (${action}), locator (${selector}), option (${option}), data (${data}), error: ${err}, screenshot: (${screenshotPath})`
        );
      }
      if (option === 'post_pause') {
        console.log('Pausing for 2 seconds...');
        await sleep(2);
      }
    } else {
      console.log('Unknown action:', action, selector, option, data);
    }
  }
}

// -------------------------------------------------------------------
// WebFiller class
// -------------------------------------------------------------------
class WebFiller {
  constructor(formData, fetch_func, validate_func, debug, logger, timeout, screenshotDir) {
    // Keep only essential logging for timeout
    console.log('WebFiller timeout setting:', timeout, 'seconds');
    
    this.fillergraph = formData;
    this.fetch_func = fetch_func;
    this.invalid_fields = [];
    this.actions = [];
    this.pause_at = null;
    this.screenshot = false;
    this.logger = logger;
    this.cursor = 0;
    this.context = {};
    
    // Check if timeout is a number and convert it if it's a string
    if (typeof timeout === 'string') {
      this.timeout = parseInt(timeout, 10) * 1000; // Convert seconds to milliseconds
    } else if (typeof timeout === 'number') {
      this.timeout = timeout * 1000; // Convert seconds to milliseconds
    } else {
      // Default timeout if none provided or invalid
      this.timeout = 30000; // 30 seconds in milliseconds
      console.log('Using default timeout of 30 seconds');
    }
    
    this.screenshotDir = screenshotDir || process.cwd(); // Use provided dir or fallback to cwd
  }

  async fill(page) {
    const pwfiller = new PwEngine(page, this.context);
    // Pass the timeout value to the PwEngine instance
    pwfiller.timeout = this.timeout;
    console.log('Using timeout value:', this.timeout / 1000, 'seconds');
    pwfiller.screenshotDir = this.screenshotDir;
    
    let index = 0;
    const steps = this.actions.length;
    
    console.log('Total steps to execute:', steps);
    
    while (index < steps) {
      const item = this.actions[index];
      
      const [name, action, selector, option, data] = item;
      
      const logMessage = {
        progress: Math.round((index * 100) / steps),
        message: {
          action: action,
          name: name,
          selector: selector,
          option: option,
          value: data
        }
      };
      
      this.logger(logMessage);

      try {
        await pwfiller.act(action, selector, option, data);
        
        const nodeName = pwfiller.context.goto;
        if (nodeName) {
          for (let i = 0; i < this.actions.length; i++) {
            if (this.actions[i][0].toLowerCase() === nodeName.toLowerCase()) {
              index = i;
              console.log(`Jumping to node: ${nodeName}`);
              delete pwfiller.context.goto;
              break;
            }
          }
        } else {
          index++;
        }
      } catch (error) {
        console.error('Action execution error:', error.message);
        const errorMessage = {
          message: {
            error: error.message,
            action: action,
            name: name,
            selector: selector,
            value: data
          },
          progress: Math.round((index * 100) / steps)
        };
        
        this.logger(errorMessage);
        throw error;
      }
    }

    const completeMessage = {
      progress: 100,
      message: {
        action: 'complete',
        success: true
      }
    };
    this.logger(completeMessage);

    return pwfiller.context.summary_url;
  }

  // Also add logging to a method that uses the timeout
  async waitForElement(selector) {
    console.log(`Waiting for element "${selector}" with timeout: ${this.timeout}ms`);
    await expect(await this._element(selector)).toBeVisible({ timeout: this.timeout });
    console.log(`Element "${selector}" found within timeout`);
  }
}

// Define the FillerGraph class as a proper constructor
class FillerGraph {
  constructor(data) {
    this.data = data;
    // 初始化逻辑...
  }

  // 示例方法，可根据需要扩展
  processData() {
    console.log("Processing data:", this.data);
  }
}

// Test function for PwEngine._element method
async function testElementMethod() {
  // Store actual method calls for verification
  const actualCalls = {
    locator: [],
    getByRole: [],
    getByText: [],
    getByLabel: []
  };

  // Create a simple mock page
  const mockPage = {
    locator: (selector) => {
      actualCalls.locator.push(selector);
      return { 
        isVisible: async () => true,
        nth: (index) => {
          actualCalls.locator.push(`nth(${index})`);
          return { isVisible: async () => true };
        }
      };
    },
    getByRole: (role, options) => {
      actualCalls.getByRole.push({ role, options });
      return { 
        isVisible: async () => true,
        nth: (index) => {
          actualCalls.getByRole.push(`nth(${index})`);
          return { isVisible: async () => true };
        }
      };
    },
    getByText: (text, options) => {
      actualCalls.getByText.push({ text, options });
      return { 
        isVisible: async () => true,
        nth: (index) => {
          actualCalls.getByText.push(`nth(${index})`);
          return { isVisible: async () => true };
        }
      };
    },
    getByLabel: (label, options) => {
      actualCalls.getByLabel.push({ label, options });
      return { 
        isVisible: async () => true,
        nth: (index) => {
          actualCalls.getByLabel.push(`nth(${index})`);
          return { isVisible: async () => true };
        }
      };
    }
  };

  // Create a PwEngine instance
  const pwEngine = new PwEngine(mockPage, {});

  // Test cases with expected outputs
  const testCases = [
    { 
      name: "Basic CSS selector (from pr.json)", 
      selector: "#absenceForm-reason0", 
      data: null,
      expected: {
        method: "locator",
        args: "#absenceForm-reason0"
      }
    },
    { 
      name: "XPath selector (from pr.json)", 
      selector: "(//td[@class='absence-table__action']//button)[1]", 
      data: null,
      expected: {
        method: "locator",
        args: "(//td[@class='absence-table__action']//button)[1]"
      }
    },
    { 
      name: "get_by_role with chained nth (from pr.json)", 
      selector: "get_by_role('button', name='Save Table').nth(0)", 
      data: null,
      expected: {
        method: "getByRole",
        args: [
          { role: "button", options: { name: "Save Table" } },
          "nth(0)"
        ]
      }
    },
    { 
      name: "Selector with placeholder", 
      selector: "#user-{}", 
      data: "12345",
      expected: {
        method: "locator",
        args: "#user-12345"
      }
    },
    { 
      name: "get_by_role with name", 
      selector: "get_by_role('button', name='Submit')", 
      data: null,
      expected: {
        method: "getByRole",
        args: { role: "button", options: { name: "Submit" } }
      }
    },
    { 
      name: "get_by_text with placeholder", 
      selector: "get_by_text('Welcome {}')", 
      data: "User",
      expected: {
        method: "getByText",
        args: { text: "Welcome User", options: {} }
      }
    },
    { 
      name: "get_by_label with options", 
      selector: "get_by_label('Username', exact=true)", 
      data: null,
      expected: {
        method: "getByLabel",
        args: { label: "Username", options: { exact: "true" } }
      }
    }
  ];

  console.log("Testing PwEngine._element method\n");
  
  for (const test of testCases) {
    console.log(`\nTest: ${test.name}`);
    console.log(`Input: selector="${test.selector}", data=${test.data || 'null'}`);
    
    // Clear previous calls
    Object.keys(actualCalls).forEach(key => actualCalls[key] = []);
    
    try {
      await pwEngine._element(test.selector, test.data);
      
      // Get the last call for the expected method
      const method = test.expected.method;
      const calls = actualCalls[method];
      
      // For chained operations, we need to check multiple calls
      const isMatch = Array.isArray(test.expected.args) 
        ? calls.length === test.expected.args.length && 
          test.expected.args.every((expected, i) => 
            JSON.stringify(calls[i]) === JSON.stringify(expected)
          )
        : method === 'locator' 
          ? calls[calls.length - 1] === test.expected.args
          : JSON.stringify(calls[calls.length - 1]) === JSON.stringify(test.expected.args);
      
      if (isMatch) {
        console.log("✅ Success");
        console.log(`Expected: ${test.expected.method}(${JSON.stringify(test.expected.args)})`);
        console.log(`Actual: ${test.expected.method}(${JSON.stringify(calls)})`);
      } else {
        console.error("❌ Failed");
        console.log(`Expected: ${test.expected.method}(${JSON.stringify(test.expected.args)})`);
        console.log(`Actual: ${test.expected.method}(${JSON.stringify(calls)})`);
      }
    } catch (error) {
      console.error("❌ Error:", error.message);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testElementMethod().catch(console.error);
}

// Export the classes
module.exports = {
  FillerGraph,
  WebFiller,
};
