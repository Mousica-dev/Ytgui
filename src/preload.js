const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    downloadVideo: (options) => ipcRenderer.invoke('download-video', options),
    saveDefaultPath: (path) => ipcRenderer.invoke('save-default-path', path),
    getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
    onProgress: (callback) => ipcRenderer.on('download-progress', (event, value) => callback(value)),
    onError: (callback) => ipcRenderer.on('download-error', (event, value) => callback(value)),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    updateBinary: () => ipcRenderer.invoke('update-binary'),
    onCheckUpdates: (callback) => ipcRenderer.on('check-updates', () => callback()),
    getTheme: () => ipcRenderer.invoke('get-theme'),
    setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
    checkSubtitles: (url) => ipcRenderer.invoke('check-subtitles', url),
    clearCache: () => ipcRenderer.invoke('clear-cache'),
    onCacheClearProgress: (callback) => 
        ipcRenderer.on('cache-clear-progress', (event, value) => callback(value)),
    onLoadSavedDir: (callback) =>
        ipcRenderer.on('load-saved-dir', (event, value) => callback(value)),
}); 