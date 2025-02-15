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
    const methodMatch = trimmed.match(/^get_by_(\w+)\((.*)\)/);
    if (!methodMatch) {
      // fallback
      return this.page.locator(trimmed);
    }
    const method = methodMatch[1]; // "role"
    const innerArgs = methodMatch[2]; // "'button', name='Edit IMM 5562'"

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

    switch (method) {
      case 'role':
        // page.getByRole(mainValue, options)
        return this.page.getByRole(mainValue, options);
      case 'text':
        // page.getByText('some text', options)
        return this.page.getByText(mainValue, options);
      case 'label':
        return this.page.getByLabel(mainValue, options);
      // etc. Extend if needed
      default:
        // fallback
        return this.page.locator(trimmed);
    }
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
    // 使用配置的超时时间
    await expect(await this._element(selector)).toBeVisible({ timeout: this.timeout });
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
      console.log(`Action: ${action}, Selector: ${selector}, Option: ${option}, Data: ${data}`);
      if (option && option.includes('skip_disabled')) {
        const locator = await this._element(selector);
        const disabled = await locator.isDisabled();
        if (disabled) {
          console.log(`>> Skip disabled element: ${selector}`);
          return;
        }
      }
      if (option && option.includes('skip_nonexist')) {
        await sleep(5); // replicate the Python code's wait
        const locator = await this._element(selector);
        const count = await locator.count();
        if (count === 0) {
          console.log(`>> Skip nonexist element: ${selector}`);
          return;
        }
      }
      try {
        await actions[action](selector, option, data);
      } catch (err) {
        // In Python, you screenshot and raise a RuntimeError
        const timeStr = currentTimeString();
        const screenshotPath = `error_${action}_${timeStr}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        throw new Error(
          `Error with action (${action}), locator (${selector}), option (${option}), data (${data}), error: ${err}, screenshot: (${screenshotPath})`
        );
      }
      if (option === 'post_pause') {
        console.log('>> Post pause for 2 seconds...');
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
  constructor(fillergraph, fetch_func, pause_at = null, screenshot = false, logger = console.log, timeout = 30) {
    this.fillergraph = fillergraph;
    this.fetch_func = fetch_func;
    this.invalid_fields = [];
    this.actions = [];
    this.pause_at = pause_at;
    this.screenshot = screenshot;
    this.logger = logger;
    this.cursor = 0;
    this.context = {};
    this.timeout = timeout * 1000; // 转换为毫秒
  }

  async fill(page) {
    const pwfiller = new PwEngine(page, this.context);
    
    let index = 0;
    const steps = this.actions.length;
    
    console.log('Debug: Total steps:', steps);
    console.log('Debug: All actions:', JSON.stringify(this.actions, null, 2));
    
    while (index < steps) {
      const item = this.actions[index];
      console.log('Debug: Current action item:', JSON.stringify(item, null, 2));
      
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
      
      console.log('Debug: Sending log message:', JSON.stringify(logMessage, null, 2));
      this.logger(logMessage);

      try {
        console.log(`Debug: Executing action: ${action} with selector: ${selector}`);
        await pwfiller.act(action, selector, option, data);
        
        const nodeName = pwfiller.context.goto;
        if (nodeName) {
          console.log('Debug: Found goto:', nodeName);
          for (let i = 0; i < this.actions.length; i++) {
            if (this.actions[i][0].toLowerCase() === nodeName.toLowerCase()) {
              index = i;
              console.log(`Debug: Jumping to node at index ${i}: ${nodeName}`);
              delete pwfiller.context.goto;
              break;
            }
          }
        } else {
          index++;
        }
      } catch (error) {
        console.error('Debug: Action execution error:', error);
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
        
        console.log('Debug: Sending error message:', JSON.stringify(errorMessage, null, 2));
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
    console.log('Debug: Sending complete message:', JSON.stringify(completeMessage, null, 2));
    this.logger(completeMessage);

    return pwfiller.context.summary_url;
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

// 同时导出 FillerGraph 和别名 WebFiller
module.exports = {
  FillerGraph,
  WebFiller,
};
