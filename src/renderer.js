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
        applicationSelect.innerHTML = '';
        formDataList.forEach((item, index) => {
          const option = document.createElement('option');
          option.value = index;
          option.textContent = item.application_name || `Application ${index + 1}`;
          applicationSelect.appendChild(option);
        });
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
}); 