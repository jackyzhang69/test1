/* web-renderer.js
   Web-based version of renderer.js that uses HTTP requests instead of Electron IPC
   This file handles UI interactions for the web version of FormBro
*/

// API helper functions to replace window.api calls
const webAPI = {
  async login(email, password) {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return response.json();
  },

  async getFormData(userId) {
    const response = await fetch('/api/form-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    return response.json();
  },

  async runAutomation(formData, headless, timeout, progressCallback) {
    const response = await fetch('/api/run-automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, headless, timeout })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (progressCallback) progressCallback(data);
        } catch (e) {
          console.log('Non-JSON message:', line);
        }
      }
    }
  },

  async deleteFormData(id) {
    const response = await fetch(`/api/form-data/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  }
};

// 常量定义 (same as original renderer.js)
const DOM_ELEMENTS = {
  loginForm: () => document.getElementById('loginForm'),
  errorMessage: () => document.getElementById('errorMessage'),
  loginContainer: () => document.getElementById('login-container'),
  appContainer: () => document.getElementById('app-container'),
  applicationSelect: () => document.getElementById('application-select'),
  fillFormBtn: () => document.getElementById('fillFormBtn'),
  deleteButton: () => document.getElementById('deleteButton'),
  formDetails: () => document.getElementById('form-details'),
  progressBar: () => document.getElementById('progressBar'),
  messageList: () => document.getElementById('messageList'),
  callbackInfo: () => document.getElementById('callbackInfo'),
  exitButton: () => document.getElementById('exitButton'),
  headlessMode: () => document.getElementById('headlessMode'),
  timeout: () => document.getElementById('timeout'),
  refreshButton: () => document.getElementById('refreshButton'),
  updateStatus: () => document.getElementById('update-status'),
  checkUpdatesBtn: () => document.getElementById('check-updates-btn'),
};

// 状态管理
let currentUser = null;
let formDataList = [];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
});

async function initializeApp() {
  console.log('=== Web Renderer Initializing ===');
  
  // Update version info
  const versionInfo = document.querySelector('.version-info');
  if (versionInfo) {
    versionInfo.textContent = 'Web Version 1.1.6';
  }
  
  // Hide update status for web version
  const updateContainer = document.getElementById('update-status-container');
  if (updateContainer) {
    updateContainer.style.display = 'none';
  }

  // Set up theme toggle
  setupThemeToggle();
  
  // Set up login form
  setupLoginForm();
  
  // Set up main app interface
  setupMainInterface();
  
  // Hide desktop-specific features
  hideDesktopFeatures();
  
  console.log('=== Web Renderer Initialized ===');
}

function hideDesktopFeatures() {
  // Hide Jobbank Inviter tab for web version (since it requires additional setup)
  const jobbankTab = document.querySelector('[data-tab="jobbank-inviter"]');
  if (jobbankTab) {
    jobbankTab.style.display = 'none';
  }
  
  // Hide exit button (not needed in web version)
  const exitButton = DOM_ELEMENTS.exitButton();
  if (exitButton) {
    exitButton.style.display = 'none';
  }
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  
  if (themeToggle && themeIcon) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
      
      // Update logo
      const logos = document.querySelectorAll('.logo');
      logos.forEach(logo => {
        logo.src = isDark ? 'assets/logo-dark.png' : 'assets/logo-light.png';
      });
    });
  }
}

function setupLoginForm() {
  const loginForm = DOM_ELEMENTS.loginForm();
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = DOM_ELEMENTS.errorMessage();
    
    try {
      errorMessage.textContent = '';
      const result = await webAPI.login(email, password);
      
      if (result.success) {
        currentUser = result.user;
        showMainInterface();
        await loadFormData();
      } else {
        errorMessage.textContent = result.error || 'Login failed';
      }
    } catch (error) {
      console.error('Login error:', error);
      errorMessage.textContent = 'Network error. Please try again.';
    }
  });
}

function setupMainInterface() {
  // Fill Form button
  const fillFormBtn = DOM_ELEMENTS.fillFormBtn();
  if (fillFormBtn) {
    fillFormBtn.addEventListener('click', handleFillForm);
  }
  
  // Delete button
  const deleteButton = DOM_ELEMENTS.deleteButton();
  if (deleteButton) {
    deleteButton.addEventListener('click', handleDeleteForm);
  }
  
  // Refresh button
  const refreshButton = DOM_ELEMENTS.refreshButton();
  if (refreshButton) {
    refreshButton.addEventListener('click', loadFormData);
  }
  
  // Application select
  const applicationSelect = DOM_ELEMENTS.applicationSelect();
  if (applicationSelect) {
    applicationSelect.addEventListener('change', handleFormSelection);
  }
}

function showMainInterface() {
  const loginContainer = DOM_ELEMENTS.loginContainer();
  const appContainer = DOM_ELEMENTS.appContainer();
  
  if (loginContainer && appContainer) {
    loginContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
  }
}

async function loadFormData() {
  if (!currentUser) return;
  
  try {
    const result = await webAPI.getFormData(currentUser._id);
    
    if (result.success) {
      formDataList = result.data;
      populateApplicationSelect();
    } else {
      console.error('Failed to load form data:', result.error);
    }
  } catch (error) {
    console.error('Error loading form data:', error);
  }
}

function populateApplicationSelect() {
  const select = DOM_ELEMENTS.applicationSelect();
  if (!select) return;
  
  // Clear existing options
  select.innerHTML = '<option value="">Select an application...</option>';
  
  // Add form data options
  formDataList.forEach((form, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${form.name || 'Unnamed Form'} (${form.actions?.length || 0} actions)`;
    select.appendChild(option);
  });
}

function handleFormSelection() {
  const select = DOM_ELEMENTS.applicationSelect();
  const formDetails = DOM_ELEMENTS.formDetails();
  
  if (!select || !formDetails) return;
  
  const selectedIndex = select.value;
  
  if (selectedIndex === '') {
    formDetails.innerHTML = '';
    return;
  }
  
  const selectedForm = formDataList[selectedIndex];
  if (selectedForm) {
    displayFormDetails(selectedForm);
  }
}

function displayFormDetails(formData) {
  const formDetails = DOM_ELEMENTS.formDetails();
  if (!formDetails) return;
  
  const actionsCount = formData.actions?.length || 0;
  
  formDetails.innerHTML = `
    <div class="form-info">
      <h3>${formData.name || 'Unnamed Form'}</h3>
      <p><strong>Actions:</strong> ${actionsCount}</p>
      <p><strong>Created:</strong> ${formData.created_at ? new Date(formData.created_at).toLocaleDateString() : 'Unknown'}</p>
      ${formData.description ? `<p><strong>Description:</strong> ${formData.description}</p>` : ''}
    </div>
  `;
}

async function handleFillForm() {
  const select = DOM_ELEMENTS.applicationSelect();
  const selectedIndex = select?.value;
  
  if (!selectedIndex || selectedIndex === '') {
    alert('Please select an application first.');
    return;
  }
  
  const selectedForm = formDataList[selectedIndex];
  if (!selectedForm) {
    alert('Invalid form selection.');
    return;
  }
  
  const headless = DOM_ELEMENTS.headlessMode()?.checked !== false;
  const timeout = parseInt(DOM_ELEMENTS.timeout()?.value || '30');
  
  // Disable button and show progress
  const fillFormBtn = DOM_ELEMENTS.fillFormBtn();
  const progressBar = DOM_ELEMENTS.progressBar();
  const messageList = DOM_ELEMENTS.messageList();
  
  if (fillFormBtn) {
    fillFormBtn.disabled = true;
    fillFormBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
  }
  
  if (progressBar) {
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
  }
  
  if (messageList) {
    messageList.innerHTML = '';
  }
  
  try {
    await webAPI.runAutomation(selectedForm, headless, timeout, (data) => {
      if (data.progress !== undefined) {
        updateProgress(data);
      }
      if (data.message) {
        addLogMessage(data.message);
      }
      if (data.success !== undefined) {
        if (data.success) {
          addLogMessage({ action: 'complete', message: data.message || 'Form filled successfully' });
        } else {
          addLogMessage({ action: 'error', message: data.error || 'Form filling failed' });
        }
      }
    });
  } catch (error) {
    console.error('Automation error:', error);
    addLogMessage({ action: 'error', message: error.message });
  } finally {
    // Re-enable button
    if (fillFormBtn) {
      fillFormBtn.disabled = false;
      fillFormBtn.innerHTML = '<i class="fas fa-play"></i> Fill Form';
    }
  }
}

function updateProgress(data) {
  const progressBar = DOM_ELEMENTS.progressBar();
  if (!progressBar || !data.message) return;
  
  // Calculate progress based on action index vs total actions
  const currentForm = getCurrentSelectedForm();
  if (!currentForm || !currentForm.actions) return;
  
  const totalActions = currentForm.actions.length;
  const currentAction = data.progress || 0;
  const percentage = Math.round((currentAction / totalActions) * 100);
  
  progressBar.style.width = percentage + '%';
  progressBar.textContent = percentage + '%';
}

function addLogMessage(message) {
  const messageList = DOM_ELEMENTS.messageList();
  if (!messageList) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'log-message';
  
  const timestamp = new Date().toLocaleTimeString();
  const action = message.action || 'info';
  const text = message.message || message.name || 'Unknown action';
  
  messageDiv.innerHTML = `
    <span class="timestamp">${timestamp}</span>
    <span class="action action-${action}">${action}</span>
    <span class="text">${text}</span>
  `;
  
  messageList.appendChild(messageDiv);
  messageList.scrollTop = messageList.scrollHeight;
}

function getCurrentSelectedForm() {
  const select = DOM_ELEMENTS.applicationSelect();
  const selectedIndex = select?.value;
  
  if (!selectedIndex || selectedIndex === '') return null;
  
  return formDataList[selectedIndex];
}

async function handleDeleteForm() {
  const selectedForm = getCurrentSelectedForm();
  if (!selectedForm) {
    alert('Please select an application first.');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
    return;
  }
  
  try {
    const result = await webAPI.deleteFormData(selectedForm._id);
    
    if (result.success) {
      alert('Form deleted successfully.');
      await loadFormData(); // Refresh the list
      
      // Clear form details
      const formDetails = DOM_ELEMENTS.formDetails();
      if (formDetails) {
        formDetails.innerHTML = '';
      }
    } else {
      alert('Failed to delete form: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Network error. Please try again.');
  }
}