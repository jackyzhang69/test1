/* renderer.js
   This file handles UI interactions: login, fetching form data, and displaying selected form details.
*/

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('login-error');
  
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  const applicationSelect = document.getElementById('application-select');
  const loadFormBtn = document.getElementById('load-form-btn');
  const formDetails = document.getElementById('form-details');

  let currentUser = null;
  let formDataList = [];

  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    const response = await window.electronAPI.login({ email, password });
    if (response.success) {
      currentUser = response.user;
      const dataResponse = await window.electronAPI.fetchFormData(currentUser._id);
      if (dataResponse.success) {
        formDataList = dataResponse.data;
        await populateApplicationSelect(formDataList);
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
      } else {
        loginError.textContent = dataResponse.error;
      }
    } else {
      loginError.textContent = response.error;
    }
  });

  loadFormBtn.addEventListener('click', () => {
    const index = applicationSelect.value;
    const selectedData = formDataList[index];
    if (selectedData) {
      formDetails.textContent = JSON.stringify(selectedData, null, 2);
    }
  });

  // 修改事件监听器，使用正确的按钮 ID
  const fillFormBtn = document.getElementById('fill-form-btn'); // 而不是 'fillForm'
  fillFormBtn.addEventListener('click', async () => {
    const selectedIndex = applicationSelect.value;
    const formData = formDataList[selectedIndex];
    
    if (!formData) {
      console.error('No form data available');
      alert('No form data available');
      return;
    }

    try {
      console.log('Running form filler with data:', formData);
      const result = await window.electron.runFormFiller(formData);
      
      if (result.success) {
        alert('Form filled successfully');
      } else {
        alert('Form filling failed: ' + result.error);
      }
    } catch (error) {
      console.error('Error running form filler:', error);
      alert('Error: ' + error.message);
    }
  });

  // 添加一个函数来格式化callback信息
  function formatCallbackInfo(info) {
    // 如果info是对象,转换为字符串
    if (typeof info === 'object') {
      return JSON.stringify(info, null, 2);
    }
    return info;
  }

  // 添加一个函数来更新callback显示
  function updateCallbackInfo(info) {
    const callbackElement = document.getElementById('callbackInfo');
    if (!callbackElement) return;

    // 只显示有价值的信息
    let displayText = '';
    if (typeof info === 'string' && info.includes('Filling')) {
      displayText = info;  // 显示填充相关的信息
    } else if (typeof info === 'object' && info.action) {
      displayText = `${info.action}: ${info.value || ''}`; // 显示动作和值
    }

    if (displayText) {
      callbackElement.textContent = displayText;
    }
  }

  // 在初始化时设置callback监听
  window.electron.onCallbackInfo((info) => {
    updateCallbackInfo(info);
  });
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