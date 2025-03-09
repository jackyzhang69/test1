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
};

// 状态管理
let currentUser = null;
let formDataList = [];

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
      
      if (dataResponse.success) {
        formDataList = dataResponse.data;
        await populateApplicationSelect(formDataList);
        
        DOM_ELEMENTS.loginContainer().classList.add('hidden');
        DOM_ELEMENTS.appContainer().classList.remove('hidden');
        
        setupDeleteButton();
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

// Update status handling
function updateStatusMessage(message) {
  const updateStatus = DOM_ELEMENTS.updateStatus();
  if (updateStatus) {
    updateStatus.textContent = message;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
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