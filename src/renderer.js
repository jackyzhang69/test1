/* renderer.js
   This file handles UI interactions: login, fetching form data, and displaying selected form details.
*/

// 常量定义
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
  // Jobbank inviter elements
  rcicAccountSelect: () => document.getElementById('rcic-account-select'),
  jobPostId: () => document.getElementById('job-post-id'),
  invitationThreshold: () => document.getElementById('invitation-threshold'),
  inviterTimeout: () => document.getElementById('inviter-timeout'),
  inviterHeadlessMode: () => document.getElementById('inviterHeadlessMode'),
  startInviterBtn: () => document.getElementById('startInviterBtn'),
  refreshRcicBtn: () => document.getElementById('refreshRcicBtn'),
  exitInviterBtn: () => document.getElementById('exitInviterBtn'),
  inviterProgressBar: () => document.getElementById('inviterProgressBar'),
  inviterMessageList: () => document.getElementById('inviterMessageList'),
};

// 状态管理
let currentUser = null;
let formDataList = [];
let jobbankAccountsList = [];

// UI 更新函数
function updateProgress(progress) {
  const progressBar = DOM_ELEMENTS.progressBar();
  if (progressBar) {
    const percentage = Math.min(Math.max(progress, 0), 100);
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${Math.round(percentage)}%`;
  }
}

function addMessage(message, type = '') {
  const messageList = DOM_ELEMENTS.messageList();
  if (!messageList) return;

  // 清除之前的消息
  messageList.innerHTML = '';
  
  const messageElement = document.createElement('div');
  messageElement.className = `message-item ${type}`;
  
  // 只显示操作名称
  messageElement.textContent = message;
  
  messageList.appendChild(messageElement);
}

function updateCallbackInfo(info) {
  // 更新进度条
  if (info.progress !== undefined) {
    updateProgress(info.progress);
  }

  // 处理消息
  if (info.message) {
    const { action, name } = info.message;
    
    if (action === 'complete') {
      addMessage('Form filling completed!', 'success');
    } else if (info.message.error) {
      addMessage(`Error: ${info.message.error}`, 'error');
    } else {
      // 只显示操作名称
      addMessage(name || action);
    }
  }
}

function resetFormFillingDisplay() {
  const messageList = DOM_ELEMENTS.messageList();
  if (messageList) {
    messageList.innerHTML = '';
  }
  updateProgress(0);
}

// Jobbank inviter UI functions
function updateInviterProgress(progress) {
  const progressBar = DOM_ELEMENTS.inviterProgressBar();
  if (progressBar) {
    const percentage = Math.min(Math.max(progress, 0), 100);
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${Math.round(percentage)}%`;
  }
}

function addInviterMessage(message, type = '') {
  const messageList = DOM_ELEMENTS.inviterMessageList();
  if (!messageList) return;

  messageList.innerHTML = '';
  
  const messageElement = document.createElement('div');
  messageElement.className = `message-item ${type}`;
  messageElement.textContent = message;
  
  messageList.appendChild(messageElement);
}

function updateInviterCallbackInfo(info) {
  if (info.progress !== undefined) {
    updateInviterProgress(info.progress);
  }

  if (info.message) {
    const { action, name, invited, errors, completed } = info.message;
    
    if (action === 'complete') {
      const message = completed && completed.length > 0 
        ? completed.join(', ')
        : `Inviting completed! Invited ${invited || 0} candidates.`;
      addInviterMessage(message, 'success');
      
      if (errors && errors.length > 0) {
        errors.forEach(error => addInviterMessage(`Error: ${error}`, 'error'));
      }
    } else if (action === 'error' || info.message.error) {
      addInviterMessage(`Error: ${info.message.error || 'Unknown error'}`, 'error');
    } else if (action === 'status') {
      addInviterMessage(name || action);
    }
  }
}

function resetInviterDisplay() {
  const messageList = DOM_ELEMENTS.inviterMessageList();
  if (messageList) {
    messageList.innerHTML = '';
  }
  updateInviterProgress(0);
}

function populateRcicAccountSelect(rcicAccounts) {
  const select = DOM_ELEMENTS.rcicAccountSelect();
  if (!select) {
    console.error('RCIC account select element not found!');
    return;
  }
  
  select.innerHTML = '<option value="">Select an RCIC account...</option>';
  
  if (!rcicAccounts || !Array.isArray(rcicAccounts)) {
    console.error('Invalid RCIC accounts data:', rcicAccounts);
    return;
  }
  
  rcicAccounts.forEach((rcic, index) => {
    
    const option = document.createElement('option');
    option.value = index;
    let label = 'Unnamed Account';
    
    // RCIC accounts have personal_info structure
    if (rcic.personal_info) {
      const firstName = rcic.personal_info.first_name || '';
      const lastName = rcic.personal_info.last_name || '';
      const rcicNumber = rcic.personal_info.rcic_number || '';
      const company = rcic.personal_info.company || rcic.personal_info.operating_name || '';
      
      label = `${firstName} ${lastName}`.trim();
      
      // Add RCIC number if available
      if (rcicNumber) {
        label += ` - ${rcicNumber}`;
      }
      
      // Add company if available
      if (company) {
        label += ` (${company})`;
      }
    }
    
    option.textContent = label;
    select.appendChild(option);
  });
}

// 事件处理函数
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorMessage = DOM_ELEMENTS.errorMessage();
  
  errorMessage.textContent = '';
  
  try {
    const result = await window.api.login({ email, password });
    
    if (result.success) {
      currentUser = result.user;
      const dataResponse = await window.api.fetchFormData(currentUser._id);
      const jobbankResponse = await window.api.fetchJobbankAccounts(currentUser._id);
      
      if (dataResponse.success) {
        formDataList = dataResponse.data;
        await populateApplicationSelect(formDataList);
        
        if (jobbankResponse.success) {
          jobbankAccountsList = jobbankResponse.data;
          populateRcicAccountSelect(jobbankAccountsList);
        }
        
        DOM_ELEMENTS.loginContainer().classList.add('hidden');
        DOM_ELEMENTS.appContainer().classList.remove('hidden');
        
        setupDeleteButton();
        setupTabNavigation();
        
        // 使用真实数据填充下拉框
        setTimeout(() => {
          if (jobbankAccountsList && jobbankAccountsList.length > 0) {
            populateRcicAccountSelect(jobbankAccountsList);
          } else {
            const noDataMessage = [
              {
                personal_info: {
                  first_name: "No RCIC accounts",
                  last_name: "found", 
                  rcic_number: "N/A",
                  company: "Please check your account setup"
                }
              }
            ];
            populateRcicAccountSelect(noDataMessage);
          }
        }, 500);
      } else {
        errorMessage.textContent = dataResponse.error || 'Login successful, but form data fetch failed.';
      }
    } else {
      errorMessage.textContent = result.error || 'Login failed. Please try again.';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorMessage.textContent = 'An error occurred. Please try again.';
  }
}

async function handleRefresh() {
  try {
    if (!currentUser) {
      addMessage('Please login first', 'error');
      return;
    }

    const dataResponse = await window.api.refreshFormData(currentUser._id);
    if (dataResponse.success) {
      formDataList = dataResponse.data;
      await populateApplicationSelect(formDataList);
      addMessage('Applications refreshed successfully', 'success');
    } else {
      addMessage(dataResponse.error || 'Failed to refresh applications', 'error');
    }
  } catch (error) {
    console.error('Refresh error:', error);
    addMessage('An error occurred while refreshing', 'error');
  }
}

// Tab navigation setup
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show/hide content
      tabContents.forEach(content => {
        if (content.id === `${targetTab}-tab`) {
          content.classList.remove('hidden');
          content.classList.add('active');
        } else {
          content.classList.add('hidden');
          content.classList.remove('active');
        }
      });
    });
  });
}

// Jobbank inviter handlers
async function handleRefreshJobbanks() {
  try {
    if (!currentUser) {
      addInviterMessage('Please login first', 'error');
      return;
    }

    const rcicResponse = await window.api.fetchJobbankAccounts(currentUser._id);
    
    if (rcicResponse.success) {
      jobbankAccountsList = rcicResponse.data;
      populateRcicAccountSelect(jobbankAccountsList);
      addInviterMessage(`刷新成功，找到 ${jobbankAccountsList.length} 个RCIC账户`, 'success');
    } else {
      addInviterMessage(rcicResponse.error || 'Failed to refresh RCIC accounts', 'error');
    }
  } catch (error) {
    console.error('Refresh Jobbank accounts error:', error);
    addInviterMessage('An error occurred while refreshing', 'error');
  }
}

async function handleStartInviter() {
  const selectedIndex = DOM_ELEMENTS.rcicAccountSelect().value;
  const jobPostId = DOM_ELEMENTS.jobPostId().value;
  const invitationThreshold = parseFloat(DOM_ELEMENTS.invitationThreshold().value);
  const itemsPerPage = 100; // Default value
  const headless = DOM_ELEMENTS.inviterHeadlessMode().checked;
  const timeout = parseInt(DOM_ELEMENTS.inviterTimeout().value) || 100;

  if (!selectedIndex || selectedIndex === '') {
    addInviterMessage('Please select a Jobbank/RCIC account', 'error');
    return;
  }

  if (!jobPostId) {
    addInviterMessage('Please enter a Job Post ID', 'error');
    return;
  }

  const rcicData = jobbankAccountsList[selectedIndex];
  
  resetInviterDisplay();
  try {
    const result = await window.api.runJobbankInviter(
      rcicData,
      jobPostId,
      invitationThreshold,
      itemsPerPage,
      headless,
      timeout
    );
    
    if (!result.success) {
      addInviterMessage(`Inviter failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error running jobbank inviter:', error);
    addInviterMessage(`Error: ${error.message}`, 'error');
  }
}

// Update status handling
function updateStatusMessage(message) {
  const updateStatus = DOM_ELEMENTS.updateStatus();
  if (updateStatus) {
    updateStatus.textContent = message;
    
    // Show restart button if update is downloaded
    if (message.includes('Update downloaded')) {
      const checkUpdatesBtn = DOM_ELEMENTS.checkUpdatesBtn();
      if (checkUpdatesBtn) {
        checkUpdatesBtn.textContent = 'Restart Now';
        checkUpdatesBtn.innerHTML = '<i class="fas fa-sync"></i> Restart Now';
        checkUpdatesBtn.classList.add('primary-button');
        checkUpdatesBtn.classList.remove('secondary-button');
        checkUpdatesBtn.style.fontWeight = 'bold';
        checkUpdatesBtn.onclick = () => {
          if (confirm('Install update and restart now?')) {
            window.api.exitApp();
          }
        };
      }
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== DOM Content Loaded ===');
  
  // Update version info from package.json using contextBridge
  const versionInfoElement = document.querySelector('.version-info');
  if (versionInfoElement && window.electron) {
    try {
      const version = await window.electron.appInfo.getVersion();
      versionInfoElement.textContent = `Version ${version}`;
    } catch (error) {
      console.error('Failed to get app version:', error);
      versionInfoElement.textContent = 'Version unknown';
    }
  }
  
  // 设置事件监听器
  DOM_ELEMENTS.loginForm()?.addEventListener('submit', handleLogin);
  
  // 设置退出按钮
  const exitButton = DOM_ELEMENTS.exitButton();
  if (exitButton) {
    exitButton.addEventListener('click', async () => {
      if (confirm('Are you sure you want to exit?')) {
        await window.api.exitApp();
      }
    });
  }

  // 修改填充表单按钮的处理程序
  const fillFormBtn = DOM_ELEMENTS.fillFormBtn();
  if (fillFormBtn) {
    fillFormBtn.addEventListener('click', async () => {
      const selectedIndex = DOM_ELEMENTS.applicationSelect().value;
      const formData = formDataList[selectedIndex];
      const headless = DOM_ELEMENTS.headlessMode().checked;
      const timeout = parseInt(DOM_ELEMENTS.timeout().value) || 30; // 获取超时值

      if (!formData) {
        addMessage('Please select a form first', 'error');
        return;
      }

      resetFormFillingDisplay();
      try {
        const result = await window.api.runFormFiller(formData, headless, timeout);
        
        if (result.success) {
          addMessage('Form filled successfully', 'success');
          updateProgress(100);
        } else {
          addMessage(`Form filling failed: ${result.error}`, 'error');
        }
      } catch (error) {
        console.error('Error running form filler:', error);
        addMessage(`Error: ${error.message}`, 'error');
      }
    });
  }

  // 设置回调监听
  window.api.onCallbackInfo(updateCallbackInfo);

  // 设置刷新按钮
  const refreshButton = DOM_ELEMENTS.refreshButton();
  if (refreshButton) {
    refreshButton.addEventListener('click', handleRefresh);
  }

  // Set up update status listener
  window.api.onUpdateStatus((message) => {
    updateStatusMessage(message);
  });
  
  // Set up check for updates button
  const checkUpdatesBtn = DOM_ELEMENTS.checkUpdatesBtn();
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', async () => {
      updateStatusMessage('Checking for updates...');
      try {
        const result = await window.api.checkForUpdates();
        if (!result.success) {
          updateStatusMessage(result.message || 'Failed to check for updates');
        }
      } catch (error) {
        updateStatusMessage(`Error checking for updates: ${error.message}`);
      }
    });
  }

  // Setup Jobbank inviter event listeners
  const startInviterBtn = DOM_ELEMENTS.startInviterBtn();
  if (startInviterBtn) {
    startInviterBtn.addEventListener('click', handleStartInviter);
  }

  const refreshRcicBtn = DOM_ELEMENTS.refreshRcicBtn();
  if (refreshRcicBtn) {
    refreshRcicBtn.addEventListener('click', handleRefreshJobbanks);
  }

  const exitInviterBtn = DOM_ELEMENTS.exitInviterBtn();
  if (exitInviterBtn) {
    exitInviterBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to exit?')) {
        await window.api.exitApp();
      }
    });
  }

  // Set up inviter callback listener
  window.api.onInviterCallbackInfo(updateInviterCallbackInfo);
});

function populateApplicationSelect(formDataList) {
  const select = DOM_ELEMENTS.applicationSelect();
  if (!select) return;
  
  select.innerHTML = '';
  formDataList.forEach((formData, index) => {
    const option = document.createElement('option');
    option.value = index;
    // 只显示名称，移除 ID 信息
    option.textContent = formData.application_name || 'Unnamed Form';
    select.appendChild(option);
  });
}

function setupDeleteButton() {
  const deleteButton = DOM_ELEMENTS.deleteButton();
  if (!deleteButton) return;

  deleteButton.addEventListener('click', async () => {
    const select = DOM_ELEMENTS.applicationSelect();
    if (!select) return;
    
    const selectedIndex = select.value;
    const selectedForm = formDataList[selectedIndex];
    
    if (!selectedForm) {
      addMessage('Please select a form first', 'error');
      return;
    }

    // 添加确认对话框
    if (!confirm('Are you sure you want to delete this form?')) {
      return;
    }

    try {
      const result = await window.api.deleteFormData(selectedForm._id);
      if (result) {
        // 从列表中移除已删除的表单
        formDataList.splice(selectedIndex, 1);
        // 重新填充选择框
        populateApplicationSelect(formDataList);
        addMessage('Form deleted successfully', 'success');
      } else {
        addMessage('Failed to delete form', 'error');
      }
    } catch (error) {
      console.error('Error deleting form:', error);
      addMessage(`Error: ${error.message}`, 'error');
    }
  });
} 