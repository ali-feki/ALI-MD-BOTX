


require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const AdmZip = require('adm-zip');
const fetch = require('node-fetch');

// ============================================
// 🔐 CONFIGURATION — FILE ID YAHAN DAALO!
// ============================================

// 🔥 APNI GOOGLE DRIVE FILE ID YAHAN DAALO!
const GDRIVE_FILE_ID = '1FnGY0l5WJ9FXcq6fPh_-LCNFbbaTIF1e'; // 🔥 CHANGE THIS!

const BOT_DIR = path.join(__dirname, 'bot');
const ENV_FILE = path.join(BOT_DIR, '.env');
const COMMIT_FILE = path.join(__dirname, '.last_commit');

// ============================================
// 🎨 LOGGING
// ============================================
const log = (msg, color = 'reset') => {
    const colors = {
        reset: '\x1b[0m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        red: '\x1b[31m',
        cyan: '\x1b[36m',
        bright: '\x1b[1m',
        magenta: '\x1b[35m'
    };
    console.log(`${colors[color] || colors.reset}${msg}${colors.reset}`);
};

// ============================================
// 📥 DOWNLOAD FROM GOOGLE DRIVE
// ============================================
async function downloadFromGDrive() {
    try {
        log('\n📦 Downloading bot from Google Drive...', 'cyan');
        
        // Google Drive direct download URL
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${GDRIVE_FILE_ID}`;
        
        log(`📌 File ID: ${GDRIVE_FILE_ID}`, 'cyan');
        
        const response = await fetch(downloadUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`Download error: ${response.status}`);
        }

        const buffer = await response.buffer();
        
        // Check if file is a valid ZIP
        if (buffer.length < 100) {
            throw new Error('Downloaded file is too small or invalid');
        }
        
        // Check ZIP signature (PK)
        if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
            throw new Error('File is not a valid ZIP. Make sure Google Drive file is a ZIP.');
        }
        
        // Clean old bot
        if (fs.existsSync(BOT_DIR)) {
            log('🧹 Cleaning old bot directory...', 'yellow');
            fs.rmSync(BOT_DIR, { recursive: true, force: true });
        }
        
        // Extract ZIP
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        
        if (zipEntries.length === 0) {
            throw new Error('ZIP file is empty');
        }
        
        const rootFolder = zipEntries[0].entryName.split('/')[0];
        
        zip.extractAllTo(__dirname, true);
        
        const extractedPath = path.join(__dirname, rootFolder);
        if (fs.existsSync(extractedPath)) {
            fs.renameSync(extractedPath, BOT_DIR);
            log('✅ Bot downloaded successfully!', 'green');
        } else {
            // If no root folder, files are extracted directly
            if (!fs.existsSync(BOT_DIR)) {
                fs.mkdirSync(BOT_DIR, { recursive: true });
            }
            log('✅ Bot extracted successfully!', 'green');
        }

        return true;
    } catch (error) {
        log(`❌ Download failed: ${error.message}`, 'red');
        return false;
    }
}

// ============================================
// 📥 DOWNLOAD .env FROM BOT DIRECTORY
// ============================================
async function downloadEnv() {
    try {
        if (fs.existsSync(ENV_FILE)) {
            log('✅ .env file already exists, skipping...', 'green');
            return true;
        }

        log('📥 Checking for .env in bot directory...', 'cyan');
        
        // Check if .env was included in ZIP
        const envInBot = path.join(BOT_DIR, '.env');
        if (fs.existsSync(envInBot)) {
            log('✅ .env found in bot directory!', 'green');
            return true;
        }
        
        log('⚠️ No .env file found in bot directory', 'yellow');
        log('📌 Using environment variables from platform', 'yellow');
        return false;
    } catch (error) {
        log(`⚠️ .env check failed: ${error.message}`, 'yellow');
        return false;
    }
}

// ============================================
// 📦 INSTALL DEPENDENCIES
// ============================================
async function installDependencies() {
    log('\n📦 Installing dependencies...', 'yellow');
    log('⏳ This may take a few minutes...', 'cyan');
    
    return new Promise((resolve) => {
        const install = exec('npm install --production --no-audit --no-fund', { 
            cwd: BOT_DIR,
            maxBuffer: 1024 * 1024 * 10
        });
        
        install.stdout.on('data', (data) => process.stdout.write(data));
        install.stderr.on('data', (data) => process.stderr.write(data));
        
        install.on('close', (code) => {
            if (code === 0) {
                log('✅ Dependencies installed successfully!', 'green');
                resolve(true);
            } else {
                log('❌ Dependencies installation failed', 'red');
                resolve(false);
            }
        });
    });
}

// ============================================
// 🚀 START BOT
// ============================================
function startBot() {
    log('\n🚀 Starting ALI-MD Bot...', 'bright');
    log('═'.repeat(50), 'cyan');
    
    const indexFile = path.join(BOT_DIR, 'index.js');
    if (!fs.existsSync(indexFile)) {
        log('❌ index.js not found in bot directory!', 'red');
        log('📌 Please check your Google Drive ZIP structure', 'yellow');
        process.exit(1);
    }
    
    if (fs.existsSync(ENV_FILE)) {
        require('dotenv').config({ path: ENV_FILE });
        log('✅ Loaded .env file', 'green');
    }
    
    const botProcess = spawn('node', ['index.js'], {
        cwd: BOT_DIR,
        stdio: 'inherit',
        env: { ...process.env }
    });

    botProcess.on('error', (error) => {
        log(`❌ Bot process error: ${error.message}`, 'red');
    });

    botProcess.on('exit', (code) => {
        log(`\n⚠️ Bot exited with code ${code}`, 'yellow');
        if (code !== 0 && code !== null) {
            log('🔄 Restarting in 5 seconds...', 'yellow');
            setTimeout(() => startBot(), 5000);
        }
    });

    return botProcess;
}

// ============================================
// 🔄 CHECK FOR UPDATES (Using File ID)
// ============================================
async function checkForUpdates() {
    try {
        // Check if .last_commit exists and matches current file ID
        if (fs.existsSync(COMMIT_FILE)) {
            const lastCommit = fs.readFileSync(COMMIT_FILE, 'utf8').trim();
            if (lastCommit === GDRIVE_FILE_ID) {
                return false; // Same file ID, no update
            }
        }
        
        // New file ID, update available
        fs.writeFileSync(COMMIT_FILE, GDRIVE_FILE_ID);
        return true;
    } catch (error) {
        return false;
    }
}

// ============================================
// 🎯 MAIN FUNCTION
// ============================================
async function main() {
    console.clear();
    log('\n🔥 ALI-MD Google Drive Deployer v1.0', 'bright');
    log('═'.repeat(50), 'cyan');
    log(`📁 File ID: ${GDRIVE_FILE_ID}`, 'magenta');
    log(`📂 Bot Directory: ${BOT_DIR}`, 'magenta');
    log('═'.repeat(50), 'cyan');
    
    // ✅ Check if File ID is set
    if (!GDRIVE_FILE_ID || GDRIVE_FILE_ID === '1A2B3C4D5E6F7G8H9') {
        log('\n❌ Please add your REAL Google Drive File ID in deploy.js!', 'red');
        log('📌 Open deploy.js and replace:', 'yellow');
        log('   const GDRIVE_FILE_ID = "YOUR_REAL_FILE_ID";', 'cyan');
        process.exit(1);
    }
    
    const botExists = fs.existsSync(BOT_DIR) && 
                      fs.existsSync(path.join(BOT_DIR, 'index.js'));
    
    if (!botExists) {
        log('\n📦 First time setup detected...', 'yellow');
        
        const downloaded = await downloadFromGDrive();
        if (!downloaded) {
            log('❌ Failed to download bot. Exiting...', 'red');
            process.exit(1);
        }
        
        await downloadEnv();
        
        const installed = await installDependencies();
        if (!installed) {
            log('❌ Failed to install dependencies. Exiting...', 'red');
            process.exit(1);
        }
    } else {
        log('\n🔍 Checking for updates...', 'cyan');
        const hasUpdate = await checkForUpdates();
        if (hasUpdate) {
            log('🔄 New version available! Updating...', 'yellow');
            const downloaded = await downloadFromGDrive();
            if (downloaded) {
                await downloadEnv();
                await installDependencies();
                log('✅ Update complete!', 'green');
            }
        } else {
            log('✅ Bot is up to date', 'green');
        }
    }
    
    startBot();
}

// ============================================
// 🛑 HANDLE PROCESS SIGNALS
// ============================================
process.on('SIGINT', () => {
    log('\n\n👋 Shutting down...', 'yellow');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('\n\n👋 Shutting down...', 'yellow');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    log(`\n❌ Uncaught Exception: ${error.message}`, 'red');
});

process.on('unhandledRejection', (reason) => {
    log(`\n❌ Unhandled Rejection: ${reason}`, 'red');
});

// ============================================
// 🚀 RUN
// ============================================
main().catch((error) => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
});
