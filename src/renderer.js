/* renderer.js
   This file handles UI interactions: login, fetching form data, and displaying selected form details.
*/

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');

  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  const applicationSelect = document.getElementById('application-select');
  const loadFormBtn = document.getElementById('load-form-btn');
  const formDetails = document.getElementById('form-details');

  let currentUser = null;
  let formDataList = [];

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    console.log('Login form submitted');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Clear previous error
    errorMessage.textContent = '';
    
    try {
      const result = await window.api.login({ email, password });
      console.log('Login result:', result);
      
      if (result.success) {
        console.log('Login successful, fetching form data...');
        currentUser = result.user;
        const dataResponse = await window.api.fetchFormData(currentUser._id);
        console.log('Form data response:', dataResponse);
        
        if (dataResponse.success) {
          console.log('Form data fetched successfully');
          formDataList = dataResponse.data;
          await populateApplicationSelect(formDataList);
          console.log('Application select populated');
          
          loginContainer.classList.add('hidden');
          appContainer.classList.remove('hidden');
          console.log('Containers visibility updated');
          
          // Verify visibility
          console.log('Login container hidden:', loginContainer.classList.contains('hidden'));
          console.log('App container hidden:', appContainer.classList.contains('hidden'));
        } else {
          console.error('Failed to fetch form data:', dataResponse.error);
          errorMessage.textContent = dataResponse.error || 'Login successful, but form data fetch failed.';
        }
      } else {
        console.error('Login failed:', result.error);
        errorMessage.textContent = result.error || 'Login failed. Please try again.';
      }
    } catch (error) {
      console.error('Login error:', error);
      errorMessage.textContent = 'An error occurred. Please try again.';
    }
  });

  // Update fill form button handler
  const fillFormBtn = document.getElementById('fillFormBtn');
  fillFormBtn.addEventListener('click', async () => {
    const selectedIndex = applicationSelect.value;
    const formData = formDataList[selectedIndex];
    
    if (!formData) {
      console.error('No form data available');
      alert('Please select a form first');
      return;
    }

    try {
      console.log('Running form filler with data:', formData);
      const result = await window.api.runFormFiller(formData);
      
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

  // Update delete button handler
  const deleteButton = document.getElementById('deleteButton');
  deleteButton.addEventListener('click', async () => {
    const selectedIndex = applicationSelect.value;
    const selectedData = formDataList[selectedIndex];
    if (!selectedData) {
      alert('Please select an item to delete');
      return;
    }

    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await window.api.deleteFormData(selectedData._id);
        // Refresh form data list
        const dataResponse = await window.api.fetchFormData(currentUser._id);
        if (dataResponse.success) {
          formDataList = dataResponse.data;
          await populateApplicationSelect(formDataList);
        }
      } catch (error) {
        console.error('Error deleting form data:', error);
        alert('Failed to delete the item');
      }
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