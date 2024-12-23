const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    downloadVideo: (options) => ipcRenderer.invoke('download-video', options),
    saveDefaultPath: (path) => ipcRenderer.invoke('save-default-path', path),
    onProgress: (callback) => ipcRenderer.on('download-progress', (event, value) => callback(value)),
    onError: (callback) => ipcRenderer.on('download-error', (event, value) => callback(value)),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    updateBinary: () => ipcRenderer.invoke('update-binary'),
    onCheckUpdates: (callback) => ipcRenderer.on('check-updates', () => callback()),
    getTheme: () => ipcRenderer.invoke('get-theme'),
    setTheme: (theme) => ipcRenderer.invoke('set-theme', theme)
}); 