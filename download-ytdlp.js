const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { chmod } = require('fs/promises');
const { spawn } = require('child_process');

async function checkExistingBinary(binPath, binaryName) {
    const binaryPath = path.join(binPath, binaryName);
    
    // Check if binary exists
    if (!fs.existsSync(binaryPath)) {
        return false;
    }

    // Check if binary is working
    try {
        const ytdlp = spawn(binaryPath, ['--version']);
        const version = await new Promise((resolve, reject) => {
            let output = '';
            ytdlp.stdout.on('data', (data) => {
                output += data.toString();
            });
            ytdlp.on('close', (code) => {
                if (code === 0) resolve(output.trim());
                else reject();
            });
            ytdlp.on('error', reject);
        });
        
        return version ? true : false;
    } catch (error) {
        return false;
    }
}

async function downloadYtDlp() {
    const platform = process.platform;
    let binaryUrl;
    let binaryName;

    switch (platform) {
        case 'win32':
            binaryUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
            binaryName = 'yt-dlp.exe';
            break;
        case 'darwin':
            binaryUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
            binaryName = 'yt-dlp';
            break;
        case 'linux':
            binaryUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
            binaryName = 'yt-dlp';
            break;
        default:
            throw new Error('Unsupported platform');
    }

    const binPath = path.join(__dirname, 'bin');
    
    // Check if binary already exists and works
    const exists = await checkExistingBinary(binPath, binaryName);
    if (exists) {
        console.log('yt-dlp binary already installed and working.');
        return;
    }

    // Create bin directory if it doesn't exist
    if (!fs.existsSync(binPath)) {
        fs.mkdirSync(binPath);
    }

    console.log('Downloading yt-dlp...');
    const response = await axios({
        method: 'get',
        url: binaryUrl,
        responseType: 'stream'
    });

    const binaryPath = path.join(binPath, binaryName);
    const writer = fs.createWriteStream(binaryPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
            if (platform !== 'win32') {
                await chmod(binaryPath, 0o755);
            }
            console.log('yt-dlp downloaded successfully!');
            resolve();
        });
        writer.on('error', reject);
    });
}

module.exports = downloadYtDlp;

if (require.main === module) {
    downloadYtDlp().catch(console.error);
} 