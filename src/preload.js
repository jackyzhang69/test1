/* preload.js
   This file exposes a safe API to the renderer process.
*/
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  fetchFormData: (userId) => ipcRenderer.invoke('fetchFormData', userId)
});

contextBridge.exposeInMainWorld('electron', {
  runFormFiller: (formData) => ipcRenderer.invoke('runFormFiller', formData),
  onCallbackInfo: (callback) => ipcRenderer.on('callback-info', (_, info) => callback(info))
}); 