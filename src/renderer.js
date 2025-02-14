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
  callbackInfo: () => document.getElementById('callbackInfo')
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

function addMessage(message, type = 'info') {
  const messageList = DOM_ELEMENTS.messageList();
  if (!messageList) return;

  const messageItem = document.createElement('div');
  messageItem.className = `message-item ${type}`;
  messageItem.textContent = message;
  
  messageList.appendChild(messageItem);
  messageList.scrollTop = messageList.scrollHeight;
}

function updateCallbackInfo(info) {
  if (!info) return;

  // 更新进度条
  if (info.progress !== undefined) {
    updateProgress(info.progress);
  }

  // 处理消息
  if (info.message) {
    const { action, name, value, error } = info.message;
    
    if (error) {
      addMessage(`Error in ${action}: ${error}`, 'error');
    } else if (action === 'complete') {
      addMessage('Form filling completed successfully!', 'success');
    } else {
      let messageText = `${action}: ${name}`;
      if (value !== null && value !== undefined) {
        messageText += ` = ${value}`;
      }
      addMessage(messageText);
    }
  }

  // 更新详细信息显示
  const callbackElement = DOM_ELEMENTS.callbackInfo();
  if (callbackElement) {
    callbackElement.textContent = JSON.stringify(info, null, 2);
  }
}

function resetFormFillingDisplay() {
  const messageList = DOM_ELEMENTS.messageList();
  if (messageList) {
    messageList.innerHTML = '';
  }
  updateProgress(0);
  const callbackElement = DOM_ELEMENTS.callbackInfo();
  if (callbackElement) {
    callbackElement.textContent = 'Starting form filling...';
  }
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

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 设置事件监听器
  DOM_ELEMENTS.loginForm()?.addEventListener('submit', handleLogin);
  
  DOM_ELEMENTS.fillFormBtn()?.addEventListener('click', async () => {
    const selectedIndex = DOM_ELEMENTS.applicationSelect()?.value;
    const formData = formDataList[selectedIndex];
    
    if (!formData) {
      addMessage('Please select a form first', 'error');
      return;
    }

    try {
      resetFormFillingDisplay();
      const result = await window.api.runFormFiller(formData);
      
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

  // 设置回调监听
  window.api.onCallbackInfo(updateCallbackInfo);
});

async function populateApplicationSelect(formData) {
  const select = document.getElementById('application-select');
  select.innerHTML = '<option value="">Select an application...</option>';
  
  formData.forEach((form, index) => {
    const option = document.createElement('option');
    option.value = index;
    // 使用应用名称而不是序号
    option.textContent = `${form.application_name} (${form.application_id})`;
    select.appendChild(option);
  });
} 