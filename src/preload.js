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
  refreshFormData: (userId) => ipcRenderer.invoke('fetchFormData', userId)
}); 