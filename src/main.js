const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('electron-store');
const store = new Store();
const fs = require('fs');
const axios = require('axios');
const { execSync } = require('child_process');

let mainWindow;
const ytdlpPath = path.join(__dirname, '..', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const savedDirPath = path.join(__dirname, '..', 'saved_download_dir.json');

// Function to load saved directory
function loadSavedDirectory() {
    try {
        if (fs.existsSync(savedDirPath)) {
            const data = JSON.parse(fs.readFileSync(savedDirPath, 'utf8'));
            return data.defaultDownloadDir || '';
        }
    } catch (error) {
        console.error('Error loading saved directory:', error);
    }
    return '';
}

// Function to save directory
function saveDirectory(directory) {
    try {
        fs.writeFileSync(savedDirPath, JSON.stringify({ defaultDownloadDir: directory }, null, 4));
        return true;
    } catch (error) {
        console.error('Error saving directory:', error);
        return false;
    }
}

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
        icon: path.join(__dirname, '..', 'assets', 'icon_512x512.png'),
        autoHideMenuBar: true,
        menuBarVisible: false
    });

    mainWindow.setMenu(null);

    mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
    
    // Load saved directory when window is created
    const savedDir = loadSavedDirectory();
    if (savedDir) {
        store.set('defaultPath', savedDir);
    }

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('check-updates');
        // Send saved directory to renderer
        mainWindow.webContents.send('load-saved-dir', savedDir);
    });
}

app.whenReady().then(createWindow);

// Save directory before app quits
app.on('before-quit', () => {
    const defaultPath = store.get('defaultPath');
    if (defaultPath) {
        saveDirectory(defaultPath);
    }
    cleanupTempFiles(defaultPath);
});

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

ipcMain.handle('download-video', async (event, { url, downloadPath, useDefaultPath, customFileName, fileType, videoQuality, subtitleOptions }) => {
    const finalPath = useDefaultPath ? store.get('defaultPath') : downloadPath;
    
    if (!finalPath) throw new Error('No download path specified');

    cleanupTempFiles(finalPath);

    return new Promise((resolve, reject) => {
        const args = [url, '-P', finalPath];

        // Handle quality selection
        if (videoQuality === 'audio') {
            args.push('-f', 'bestaudio');
        } else if (videoQuality === 'best') {
            args.push('-f', 'bestvideo+bestaudio');
        } else {
            args.push('-f', `bestvideo[height<=${videoQuality}]+bestaudio/best[height<=${videoQuality}]`);
        }

        // Add subtitle options
        if (subtitleOptions?.enabled) {
            args.push('--write-subs');                   // Enable subtitle download
            args.push('--sub-langs', subtitleOptions.language); // Language code (not --sub-lang)
            args.push('--embed-subs');                   // Embed subtitles in the video
            args.push('--convert-subs', 'srt');          // Convert to SRT format
            args.push('--write-auto-subs');              // Also get auto-generated subs if available
        }

        // Add format conversion
        if (fileType) {
            args.push('--recode-video', fileType);
        }
        
        if (customFileName) {
            args.push('-o', `${customFileName}.${fileType}`);
        }

        const ytdlp = spawn(ytdlpPath, args);

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
    return saveDirectory(path);
});

ipcMain.handle('get-default-path', () => {
    return loadSavedDirectory();
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

// Add new IPC handler for subtitle check
ipcMain.handle('check-subtitles', async (event, url) => {
    return new Promise((resolve, reject) => {
        const args = [
            url,
            '--list-subs',    // List available subtitles
            '--quiet',        // Don't show progress
        ];

        const ytdlp = spawn(ytdlpPath, args);
        let output = '';

        ytdlp.stdout.on('data', (data) => {
            output += data.toString();
        });

        ytdlp.stderr.on('data', (data) => {
            output += data.toString();
        });

        ytdlp.on('close', (code) => {
            if (code === 0) {
                // Check if subtitles are available
                const hasSubtitles = output.includes('Available subtitles');
                const hasAutoSubs = output.includes('Available automatic captions');
                resolve({
                    available: hasSubtitles || hasAutoSubs,
                    hasManual: hasSubtitles,
                    hasAuto: hasAutoSubs
                });
            } else {
                reject('Failed to check subtitles');
            }
        });
    });
});

// Add new IPC handler for cache cleaning
ipcMain.handle('clear-cache', async () => {
    return new Promise((resolve, reject) => {
        const steps = [
            {
                cmd: 'rm',
                args: ['-rf', 'dist/', 'build/', '.webpack/'],
                message: '📦 Cleaning build directories...'
            },
            {
                cmd: 'find',
                args: ['.', '-type', 'f', '-name', '*.tmp', '-delete'],
                message: '🗑️ Cleaning temporary files...'
            },
            {
                cmd: 'find',
                args: ['.', '-type', 'f', '-name', '*.f*-*.mp4', '-delete'],
                message: '🎥 Cleaning video fragments...'
            },
            {
                cmd: 'find',
                args: ['.', '-type', 'f', '-name', '*.vtt.tmp', '-delete'],
                message: '💬 Cleaning subtitle files...'
            },
            {
                cmd: 'npm',
                args: ['cache', 'clean', '--force'],
                message: '📦 Cleaning npm cache...'
            }
        ];

        let completed = 0;
        
        for (const step of steps) {
            mainWindow.webContents.send('cache-clear-progress', {
                message: step.message,
                progress: (completed / steps.length) * 100
            });

            try {
                execSync(`${step.cmd} ${step.args.join(' ')}`);
                completed++;
            } catch (error) {
                console.error(`Error in step: ${step.message}`, error);
            }
        }

        // Check and reinstall yt-dlp if needed
        if (!fs.existsSync(ytdlpPath)) {
            mainWindow.webContents.send('cache-clear-progress', {
                message: '⚠️ Reinstalling yt-dlp...',
                progress: 90
            });
            
            try {
                execSync('npm run postinstall');
            } catch (error) {
                console.error('Error reinstalling yt-dlp:', error);
            }
        }

        mainWindow.webContents.send('cache-clear-progress', {
            message: '✨ Cache cleared successfully!',
            progress: 100
        });

        resolve('Cache cleared successfully');
    });
});

app.on('before-quit', () => {
    const defaultPath = store.get('defaultPath');
    if (defaultPath) {
        cleanupTempFiles(defaultPath);
    }
}); 