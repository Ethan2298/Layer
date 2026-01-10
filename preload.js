const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Clarity scoring
  calculateClarity: (name, description) => ipcRenderer.invoke('calculate-clarity', name, description),

  // Folder Explorer
  folderExplorer: {
    pickFolder: () => ipcRenderer.invoke('folder-explorer:pick-folder'),
    readDir: (dirPath) => ipcRenderer.invoke('folder-explorer:read-dir', dirPath),
    getHome: () => ipcRenderer.invoke('folder-explorer:get-home'),
    exists: (filePath) => ipcRenderer.invoke('folder-explorer:exists', filePath),
    getInfo: (filePath) => ipcRenderer.invoke('folder-explorer:get-info', filePath)
  }
});
