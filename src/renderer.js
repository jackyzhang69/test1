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
  inviterProgressBar: () => document.getElementById('inviterProgressBar'),
  inviterMessageList: () => document.getElementById('inviterMessageList'),
  // New elements for multiple job posts
  addJobPostBtn: () => document.getElementById('add-job-post-btn'),
  jobPostsList: () => document.getElementById('job-posts-list'),
  overallProgressBar: () => document.getElementById('overallProgressBar'),
  currentJobTitle: () => document.getElementById('currentJobTitle'),
  invitationStats: () => document.getElementById('invitationStats'),
  inviterDetails: () => document.getElementById('inviter-details'),
};

// 状态管理
let currentUser = null;
let formDataList = [];
let jobbankAccountsList = [];
let jobPostCounter = 1;
let invitationStats = {};

// UI状态管理
let currentUIState = 'empty'; // empty, ready, processing, results
let isProcessing = false;


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
      // 显示当前操作在form-details区域
      const formDetails = DOM_ELEMENTS.formDetails();
      if (formDetails && (name || action)) {
        formDetails.style.display = 'block';
        formDetails.innerHTML = `<div class="current-action">Current action: ${name || action}</div>`;
      }
    }
  }
}

function resetFormFillingDisplay() {
  const messageList = DOM_ELEMENTS.messageList();
  if (messageList) {
    messageList.innerHTML = '';
  }
  updateProgress(0);
  
  // 隐藏并清空form details
  const formDetails = DOM_ELEMENTS.formDetails();
  if (formDetails) {
    formDetails.style.display = 'none';
    formDetails.innerHTML = '';
  }
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

  // For retry scenarios, keep recent messages instead of clearing all
  if (type === 'warning' || type === 'info') {
    // Keep the last few messages for context
    const messages = messageList.querySelectorAll('.message-item');
    if (messages.length > 3) {
      messageList.innerHTML = '';
    }
  } else {
    // Clear for success/error messages
    messageList.innerHTML = '';
  }
  
  const messageElement = document.createElement('div');
  messageElement.className = `message-item ${type}`;
  messageElement.textContent = message;
  
  messageList.appendChild(messageElement);
  
  // Auto-scroll to latest message
  messageElement.scrollIntoView({ behavior: 'smooth' });
}

function updateInviterCallbackInfo(info) {
  if (info.progress !== undefined) {
    updateInviterProgress(info.progress);
  }

  if (info.message) {
    const { action, name, invited, errors, completed, jobPostId, currentCandidate, totalCandidates } = info.message;
    
    // Update progress based on candidate processing
    if (action === 'progress' && currentCandidate !== undefined && totalCandidates !== undefined && totalCandidates > 0) {
      const progress = (currentCandidate / totalCandidates) * 100;
      updateInviterProgress(progress);
      
      // Update the message box with processing info
      const detailsBox = DOM_ELEMENTS.inviterDetails() || document.getElementById('inviter-details');
      if (detailsBox) {
        detailsBox.style.display = 'block';
        detailsBox.innerHTML = `<div class="processing-info">Processing row ${currentCandidate} of ${totalCandidates} total</div>`;
      }
      
      return; // Don't process further for progress updates
    }
    
    if (action === 'overall-progress') {
      const { currentJob, totalJobs, jobPostId } = info.message;
      updateOverallProgress(currentJob, totalJobs);
      updateCurrentJobTitle(jobPostId);
      
      // Also show job progress in details box
      const detailsBox = DOM_ELEMENTS.inviterDetails();
      if (detailsBox) {
        detailsBox.style.display = 'block';
        detailsBox.innerHTML = `<div class="processing-info">Processing Job Post ${jobPostId} (${currentJob} of ${totalJobs})</div>`;
      }
    } else if (action === 'complete') {
      const message = completed && completed.length > 0 
        ? completed.join(', ')
        : `Inviting completed! Invited ${invited || 0} candidates.`;
      addInviterMessage(message, 'success');
      
      // Track invitation count for this job post
      if (jobPostId && invited !== undefined) {
        invitationStats[jobPostId] = invited;
      }
      
      if (errors && errors.length > 0) {
        errors.forEach(error => addInviterMessage(`Error: ${error}`, 'error'));
      }
      
      // Hide the details box when job completes
      const detailsBox = DOM_ELEMENTS.inviterDetails();
      if (detailsBox) {
        detailsBox.style.display = 'none';
      }
    } else if (action === 'error' || info.message.error) {
      addInviterMessage(`Error: ${info.message.error || 'Unknown error'}`, 'error');
    } else if (action === 'status') {
      addInviterMessage(name || action);
      
      // Also show status in details box if it's a processing-related message
      if (name && name.includes('Processing')) {
        const detailsBox = DOM_ELEMENTS.inviterDetails();
        if (detailsBox) {
          detailsBox.style.display = 'block';
          detailsBox.innerHTML = `<div class="processing-info">${name}</div>`;
        }
      }
    }
  }
}

function resetInviterDisplay() {
  const messageList = DOM_ELEMENTS.inviterMessageList();
  if (messageList) {
    messageList.innerHTML = '';
  }
  updateInviterProgress(0);
  resetOverallProgress();
  resetCurrentJobProgress();
  hideInvitationStats();
  
  // Hide the details box
  const detailsBox = DOM_ELEMENTS.inviterDetails();
  if (detailsBox) {
    detailsBox.style.display = 'none';
    detailsBox.innerHTML = '';
  }
}

function resetOverallProgress() {
  const progressBar = DOM_ELEMENTS.overallProgressBar();
  if (progressBar) {
    progressBar.style.width = '0%';
    progressBar.textContent = '0 / 0 Job Posts';
  }
}

function resetCurrentJobProgress() {
  const progressBar = DOM_ELEMENTS.inviterProgressBar();
  const titleElement = DOM_ELEMENTS.currentJobTitle();
  
  if (progressBar) {
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
  }
  
  if (titleElement) {
    titleElement.textContent = 'Current Job Progress';
  }
}

function hideInvitationStats() {
  const statsElement = DOM_ELEMENTS.invitationStats();
  if (statsElement) {
    statsElement.classList.add('hidden');
    statsElement.innerHTML = '';
  }
}


// UI状态管理函数
function updateUIState(newState, data = {}) {
  currentUIState = newState;
  
  // 隐藏所有状态内容
  const states = ['emptyState', 'readyState', 'processingState', 'resultsState'];
  states.forEach(stateId => {
    const element = document.getElementById(stateId);
    if (element) {
      element.style.display = 'none';
      element.classList.remove('active');
    }
  });
  
  // 显示当前状态
  const currentStateElement = document.getElementById(newState + 'State');
  if (currentStateElement) {
    currentStateElement.style.display = 'flex';
    currentStateElement.classList.add('active');
  }
  
  // 根据状态显示/隐藏进度区域
  const progressSection = document.getElementById('progressSection');
  if (progressSection) {
    if (newState === 'processing') {
      progressSection.style.display = 'block';
      progressSection.classList.add('show');
      isProcessing = true;
    } else {
      progressSection.classList.remove('show');
      setTimeout(() => {
        if (currentUIState !== 'processing') {
          progressSection.style.display = 'none';
        }
      }, 300);
      isProcessing = false;
    }
  }
  
  // 更新具体内容
  switch (newState) {
    case 'ready':
      const jobCount = getJobPosts().length;
      const jobCountElement = document.getElementById('jobCount');
      if (jobCountElement) {
        jobCountElement.textContent = jobCount;
      }
      break;
      
    case 'processing':
      // 处理中状态的特殊逻辑
      break;
      
    case 'results':
      // 结果状态时显示统计信息
      displayInvitationStats();
      // 隐藏进度区域
      const progressSectionResults = document.getElementById('progressSection');
      if (progressSectionResults) {
        progressSectionResults.classList.remove('show');
        setTimeout(() => {
          if (currentUIState !== 'processing') {
            progressSectionResults.style.display = 'none';
          }
        }, 300);
      }
      break;
  }
}

function checkJobPostsAndUpdateState() {
  const jobPosts = getJobPosts();
  
  if (jobPosts.length === 0) {
    updateUIState('empty');
  } else if (!isProcessing) {
    updateUIState('ready');
  }
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
  
  // 如果只有一个账户，自动选择它
  if (rcicAccounts.length === 1) {
    select.value = "0";
  }
}

// Job Posts Management Functions
function addJobPostRow() {
  const jobPostsList = DOM_ELEMENTS.jobPostsList();
  if (!jobPostsList) return;
  
  const newRow = document.createElement('div');
  newRow.className = 'job-post-row';
  newRow.dataset.index = jobPostCounter++;
  
  newRow.innerHTML = `
    <input type="text" class="job-post-id" placeholder="Enter Job Post ID" title="Job Post ID from JobBank">
    <input type="number" class="minimum-stars" value="2" min="1" max="5" step="1" title="Minimum stars (1-5)" style="width: 120px;">
    <button class="remove-job-post-btn action-button secondary-button" title="Remove this job post">
      <i class="fas fa-trash"></i>
    </button>
  `;
  
  // Add input change listeners for state management
  const jobPostInput = newRow.querySelector('.job-post-id');
  jobPostInput.addEventListener('input', checkJobPostsAndUpdateState);
  
  // Add remove handler with animation
  const removeBtn = newRow.querySelector('.remove-job-post-btn');
  removeBtn.addEventListener('click', () => {
    addButtonClickEffect(removeBtn);
    removeJobPostRow(newRow);
  });
  
  // Add fade-in animation
  newRow.style.opacity = '0';
  newRow.style.transform = 'translateY(-10px)';
  jobPostsList.appendChild(newRow);
  
  setTimeout(() => {
    newRow.style.transition = 'all 0.3s ease';
    newRow.style.opacity = '1';
    newRow.style.transform = 'translateY(0)';
  }, 10);
  
  updateRemoveButtonsVisibility();
  checkJobPostsAndUpdateState();
}

function removeJobPostRow(row) {
  // Add fade-out animation
  row.style.transition = 'all 0.3s ease';
  row.style.opacity = '0';
  row.style.transform = 'translateY(-10px)';
  
  setTimeout(() => {
    row.remove();
    updateRemoveButtonsVisibility();
    checkJobPostsAndUpdateState();
  }, 300);
}

function updateRemoveButtonsVisibility() {
  const jobPostsList = DOM_ELEMENTS.jobPostsList();
  if (!jobPostsList) return;
  
  const rows = jobPostsList.querySelectorAll('.job-post-row');
  rows.forEach(row => {
    const removeBtn = row.querySelector('.remove-job-post-btn');
    if (removeBtn) {
      removeBtn.style.display = rows.length > 1 ? 'flex' : 'none';
    }
  });
}

function getJobPosts() {
  const jobPostsList = DOM_ELEMENTS.jobPostsList();
  if (!jobPostsList) return [];
  
  const jobPosts = [];
  const rows = jobPostsList.querySelectorAll('.job-post-row');
  
  rows.forEach(row => {
    const jobPostId = row.querySelector('.job-post-id').value.trim();
    const minimumStars = parseFloat(row.querySelector('.minimum-stars').value);
    
    if (jobPostId) {
      jobPosts.push({ jobPostId, minimumStars });
    }
  });
  
  return jobPosts;
}

function updateOverallProgress(current, total) {
  const progressBar = DOM_ELEMENTS.overallProgressBar();
  if (progressBar) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${current} / ${total} Job Posts`;
  }
  
  // 同时更新状态区域的进度计数器
  const progressCounter = document.getElementById('progressCounter');
  if (progressCounter) {
    progressCounter.textContent = `${current} / ${total} Job Posts`;
  }
}

function updateCurrentJobTitle(jobPostId) {
  const titleElement = DOM_ELEMENTS.currentJobTitle();
  if (titleElement) {
    titleElement.textContent = `Current Job Progress - ${jobPostId}`;
  }
}

function displayInvitationStats() {
  const statsElement = DOM_ELEMENTS.invitationStats();
  if (!statsElement) return;
  
  const totalInvitations = Object.values(invitationStats).reduce((sum, count) => sum + count, 0);
  
  const statsHtml = `
    <h4>Invitation Summary</h4>
    <div class="stats-list">
      ${Object.entries(invitationStats).map(([jobId, count]) => {
        return `
          <div class="stat-line">
            <span class="job-post-label">Job Post ${jobId}:</span>
            <span class="invitation-count">${count} invitations sent</span>
          </div>
        `;
      }).join('')}
    </div>
    <div class="stats-total">
      <strong>Total Invitations: ${totalInvitations}</strong>
    </div>
  `;
  
  statsElement.innerHTML = statsHtml;
  statsElement.classList.remove('hidden');
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

    resetInviterDisplay();

    const rcicResponse = await window.api.fetchJobbankAccounts(currentUser._id);
    
    if (rcicResponse.success) {
      jobbankAccountsList = rcicResponse.data;
      populateRcicAccountSelect(jobbankAccountsList);
      addInviterMessage(`Refreshed,found ${jobbankAccountsList.length} RCIC accounts`, 'success');
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
  const jobPosts = getJobPosts();
  const itemsPerPage = 100; // Default value
  const headless = DOM_ELEMENTS.inviterHeadlessMode().checked;
  const timeout = parseInt(DOM_ELEMENTS.inviterTimeout().value) || 100;

  if (!selectedIndex || selectedIndex === '') {
    addInviterMessage('Please select a Jobbank/RCIC account', 'error');
    return;
  }

  if (jobPosts.length === 0) {
    addInviterMessage('Please enter at least one Job Post ID', 'error');
    return;
  }

  const rcicData = jobbankAccountsList[selectedIndex];
  
  // 切换到处理中状态
  updateUIState('processing');
  resetInviterDisplay();
  
  // Show initial processing message
  const detailsBox = DOM_ELEMENTS.inviterDetails();
  if (detailsBox) {
    detailsBox.style.display = 'block';
    detailsBox.innerHTML = '<div class="processing-info">Starting invitation process...</div>';
  }
  
  try {
    // Update progress counter
    const progressCounter = document.getElementById('progressCounter');
    if (progressCounter) {
      progressCounter.textContent = `0 / ${jobPosts.length} Job Posts`;
    }
    
    // Update overall progress
    updateOverallProgress(0, jobPosts.length);
    
    // Call the multiple job posts handler (single login)
    const result = await window.api.runJobbankInviterMultiple(
      rcicData,
      jobPosts,
      itemsPerPage,
      headless,
      timeout
    );
    
    if (result.success) {
      // Display results from all jobs
      if (result.results && result.results.length > 0) {
        result.results.forEach(jobResult => {
          if (jobResult.success) {
            invitationStats[jobResult.jobPostId] = jobResult.invited;
          }
        });
      }
      
      const totalInvited = result.totalInvited || 0;
      addInviterMessage(`All ${jobPosts.length} job posts processed! Total invitations sent: ${totalInvited}`, 'success');
      
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => addInviterMessage(`Error: ${error}`, 'error'));
      }
    } else {
      addInviterMessage(`Error: ${result.error || 'Unknown error'}`, 'error');
    }
    
    // 切换到结果状态
    updateUIState('results');
    
  } catch (error) {
    console.error('Error running jobbank inviter:', error);
    addInviterMessage(`Critical error: ${error.message}`, 'error');
    // 处理错误时也切换到结果状态显示错误信息
    updateUIState('results');
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

// Dark Mode and Theme Management
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  
  // Apply saved theme
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme, themeIcon);
  updateLogos(savedTheme);
  
  // Theme toggle functionality
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme, themeIcon);
      updateLogos(newTheme);
      
      // Add smooth transition effect
      document.body.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        document.body.style.transition = '';
      }, 300);
    });
  }
}

function updateThemeIcon(theme, iconElement) {
  if (!iconElement) return;
  
  if (theme === 'dark') {
    iconElement.className = 'fas fa-sun';
  } else {
    iconElement.className = 'fas fa-moon';
  }
}

function updateLogos(theme) {
  const logos = document.querySelectorAll('.logo');
  logos.forEach(logo => {
    if (theme === 'dark') {
      logo.src = 'assets/logo-dark.png';
    } else {
      logo.src = 'assets/logo-light.png';
    }
  });
}

// Enhanced UI Animations
function addLoadingState(element) {
  if (element) {
    element.classList.add('loading');
    element.disabled = true;
  }
}

function removeLoadingState(element) {
  if (element) {
    element.classList.remove('loading');
    element.disabled = false;
  }
}

// Enhanced button click animations
function addButtonClickEffect(button) {
  button.style.transform = 'scale(0.98)';
  setTimeout(() => {
    button.style.transform = '';
  }, 100);
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== DOM Content Loaded ===');
  
  // Initialize theme system
  initializeTheme();
  
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
      addButtonClickEffect(fillFormBtn);
      
      const selectedIndex = DOM_ELEMENTS.applicationSelect().value;
      const formData = formDataList[selectedIndex];
      const headless = DOM_ELEMENTS.headlessMode().checked;
      const timeout = parseInt(DOM_ELEMENTS.timeout().value) || 30; // 获取超时值

      if (!formData) {
        addMessage('Please select a form first', 'error');
        return;
      }

      resetFormFillingDisplay();
      addLoadingState(fillFormBtn);
      
      // 记录开始时间
      const startTime = new Date();
      
      // 显示正在填充的表单名称
      const formDetails = DOM_ELEMENTS.formDetails();
      if (formDetails) {
        formDetails.style.display = 'block';
        formDetails.innerHTML = `<div class="form-info">Filling form: ${formData.application_name || 'Unnamed Form'}</div>`;
      }
      
      try {
        const result = await window.api.runFormFiller(formData, headless, timeout);
        
        // 计算耗时
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        
        if (result.success) {
          addMessage(`Form filled successfully! Time taken: ${timeString}`, 'success');
          updateProgress(100);
        } else {
          addMessage(`Form filling failed: ${result.error} (Time: ${timeString})`, 'error');
        }
      } catch (error) {
        console.error('Error running form filler:', error);
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        addMessage(`Error: ${error.message} (Time: ${duration}s)`, 'error');
      } finally {
        removeLoadingState(fillFormBtn);
        // 完成后隐藏form details
        if (formDetails) {
          setTimeout(() => {
            formDetails.style.display = 'none';
          }, 2000);
        }
      }
    });
  }

  // 设置回调监听
  window.api.onCallbackInfo(updateCallbackInfo);

  // 设置刷新按钮
  const refreshButton = DOM_ELEMENTS.refreshButton();
  if (refreshButton) {
    refreshButton.addEventListener('click', async () => {
      addButtonClickEffect(refreshButton);
      addLoadingState(refreshButton);
      
      try {
        await handleRefresh();
      } finally {
        removeLoadingState(refreshButton);
      }
    });
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
    startInviterBtn.addEventListener('click', async () => {
      addButtonClickEffect(startInviterBtn);
      addLoadingState(startInviterBtn);
      
      try {
        await handleStartInviter();
      } finally {
        removeLoadingState(startInviterBtn);
      }
    });
  }

  const refreshRcicBtn = DOM_ELEMENTS.refreshRcicBtn();
  if (refreshRcicBtn) {
    refreshRcicBtn.addEventListener('click', async () => {
      addButtonClickEffect(refreshRcicBtn);
      addLoadingState(refreshRcicBtn);
      
      try {
        await handleRefreshJobbanks();
      } finally {
        removeLoadingState(refreshRcicBtn);
      }
    });
  }

  // Exit inviter button removed - now handled by global exit button
  
  // Add job post button
  const addJobPostBtn = DOM_ELEMENTS.addJobPostBtn();
  if (addJobPostBtn) {
    addJobPostBtn.addEventListener('click', () => {
      addButtonClickEffect(addJobPostBtn);
      addJobPostRow();
    });
  }
  
  
  // Initialize remove buttons visibility
  updateRemoveButtonsVisibility();
  
  // Initialize UI state
  checkJobPostsAndUpdateState();

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