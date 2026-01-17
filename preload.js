const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  isMac: process.platform === 'darwin',

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Fullscreen events
  onFullscreenChange: (callback) => ipcRenderer.on('fullscreen-change', (_, isFullscreen) => callback(isFullscreen)),

  // Clarity scoring
  calculateClarity: (name, description) => ipcRenderer.invoke('calculate-clarity', name, description),

  // Folder Explorer
  folderExplorer: {
    pickFolder: () => ipcRenderer.invoke('folder-explorer:pick-folder'),
    readDir: (dirPath) => ipcRenderer.invoke('folder-explorer:read-dir', dirPath),
    getHome: () => ipcRenderer.invoke('folder-explorer:get-home'),
    exists: (filePath) => ipcRenderer.invoke('folder-explorer:exists', filePath),
    getInfo: (filePath) => ipcRenderer.invoke('folder-explorer:get-info', filePath),
    readFile: (filePath) => ipcRenderer.invoke('folder-explorer:read-file', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('folder-explorer:write-file', filePath, content),
    deleteFile: (filePath) => ipcRenderer.invoke('folder-explorer:delete-file', filePath),
    renameFile: (oldPath, newPath) => ipcRenderer.invoke('folder-explorer:rename-file', oldPath, newPath),
    mkdir: (dirPath) => ipcRenderer.invoke('folder-explorer:mkdir', dirPath)
  }
});
