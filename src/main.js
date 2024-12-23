const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('electron-store');
const store = new Store();
const fs = require('fs');
const axios = require('axios');

let mainWindow;
const ytdlpPath = path.join(__dirname, '..', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

async function getLatestVersion() {
    try {
        const response = await axios.get('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
        return response.data.tag_name;
    } catch (error) {
        console.error('Error checking version:', error);
        return null;
    }
}

async function getCurrentVersion() {
    return new Promise((resolve) => {
        const ytdlp = spawn(ytdlpPath, ['--version']);
        let version = '';

        ytdlp.stdout.on('data', (data) => {
            version += data.toString();
        });

        ytdlp.on('close', () => {
            resolve(version.trim());
        });

        ytdlp.on('error', () => {
            resolve(null);
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '..', 'assets', 'icon_512x512.png')
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('check-updates');
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

function cleanupTempFiles(directory) {
    if (fs.existsSync(directory)) {
        const files = fs.readdirSync(directory);
        files.forEach(file => {
            if (file.includes('.temp') || file.includes('.part')) {
                try {
                    fs.unlinkSync(path.join(directory, file));
                } catch (err) {
                    console.error('Error deleting temp file:', err);
                }
            }
        });
    }
}

// IPC Handlers
ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

ipcMain.handle('download-video', async (event, { url, downloadPath, useDefaultPath }) => {
    const finalPath = useDefaultPath ? store.get('defaultPath') : downloadPath;
    
    if (!finalPath) throw new Error('No download path specified');

    cleanupTempFiles(finalPath);

    return new Promise((resolve, reject) => {
        const ytdlp = spawn(ytdlpPath, [url, '-P', finalPath]);

        ytdlp.stdout.on('data', (data) => mainWindow.webContents.send('download-progress', data.toString()));
        ytdlp.stderr.on('data', (data) => mainWindow.webContents.send('download-error', data.toString()));
        ytdlp.on('close', (code) => {
            cleanupTempFiles(finalPath);
            code === 0 ? resolve('Download completed successfully') : reject(`Process exited with code ${code}`);
        });
    });
});

ipcMain.handle('save-default-path', (event, path) => {
    store.set('defaultPath', path);
    return true;
});

ipcMain.handle('check-for-updates', async () => {
    const currentVersion = await getCurrentVersion();
    const latestVersion = await getLatestVersion();
    
    if (!currentVersion || !latestVersion) {
        return { needsUpdate: false };
    }

    return {
        needsUpdate: currentVersion !== latestVersion,
        currentVersion,
        latestVersion
    };
});

ipcMain.handle('update-binary', async () => {
    try {
        const downloadYtDlp = require('./download-ytdlp.js');
        await downloadYtDlp();
        return true;
    } catch (error) {
        console.error('Error updating binary:', error);
        return false;
    }
});

ipcMain.handle('get-theme', () => {
    return store.get('theme', 'system');
});

ipcMain.handle('set-theme', (event, theme) => {
    store.set('theme', theme);
    switch (theme) {
        case 'dark':
            nativeTheme.themeSource = 'dark';
            break;
        case 'light':
            nativeTheme.themeSource = 'light';
            break;
        default:
            nativeTheme.themeSource = 'system';
    }
    return theme;
});

app.on('before-quit', () => {
    const defaultPath = store.get('defaultPath');
    if (defaultPath) {
        cleanupTempFiles(defaultPath);
    }
}); 