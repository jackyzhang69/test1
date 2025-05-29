/* preload.js
   This file exposes a safe API to the renderer process.
*/
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  fetchFormData: (userId) => ipcRenderer.invoke('fetchFormData', userId),
  runFormFiller: (formData, headless, timeout) => ipcRenderer.invoke('runFormFiller', formData, headless, timeout),
  onCallbackInfo: (callback) => ipcRenderer.on('callback-info', (_, info) => callback(info)),
  deleteFormData: (id) => ipcRenderer.invoke('delete-form-data', id),
  exitApp: () => ipcRenderer.invoke('exit-app'),
  refreshFormData: (userId) => ipcRenderer.invoke('fetchFormData', userId),
  
  // Add update-related events
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, message) => callback(message)),
  
  // Jobbank inviter API methods
  fetchJobbankAccounts: (userId) => ipcRenderer.invoke('fetchJobbankAccounts', userId),
  runJobbankInviter: (jobbankData, jobPostId, invitationStar, itemsPerPage, headless, timeout) => 
    ipcRenderer.invoke('runJobbankInviter', jobbankData, jobPostId, invitationStar, itemsPerPage, headless, timeout),
  onInviterCallbackInfo: (callback) => ipcRenderer.on('inviter-callback-info', (_, info) => callback(info))
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    appInfo: {
      getVersion: () => ipcRenderer.invoke('get-app-version')
    },
    // Add any other API methods you need to expose here
  }
); 