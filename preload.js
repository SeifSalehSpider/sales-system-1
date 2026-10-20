const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nativeStore', {
  loadState: () => ipcRenderer.invoke('license-store:load-state'),
  loadStateSync: () => ipcRenderer.sendSync('license-store:load-state-sync'),
  saveState: (state) => ipcRenderer.invoke('license-store:save-state', state),
  saveStateSync: (state) => ipcRenderer.sendSync('license-store:save-state-sync', state),
  getLicenseStatus: () => ipcRenderer.invoke('license-store:license-status'),
  getLicenseStatusSync: () => ipcRenderer.sendSync('license-store:license-status-sync'),
  activate: (code) => ipcRenderer.invoke('license-store:activate', code),
  getDataPath: () => ipcRenderer.invoke('license-store:data-path')
});
