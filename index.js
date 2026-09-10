require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');

// ============================================
// 🔐 CONFIGURATION — SAHI REPO NAME!
// ============================================

// 🔥 TU Mera GitLab Repo
const GITLAB_USERNAME = 'ALI-XER';
const GITLAB_REPO = 'ali-md';        // ✅ CHHOTE LETTERS MEIN!
const GITLAB_BRANCH = 'main';        // Agar master hai toh change karo

const BOT_DIR = path.join(__dirname, 'bot');
const ENV_FILE = path.join(BOT_DIR, '.env');

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
// 📥 DOWNLOAD BOT FROM GITLAB
// ============================================
async function downloadBot() {
    try {
        log('\n📦 Downloading bot from GitLab...', 'cyan');
        
        const zipUrl = `https://gitlab.com/${GITLAB_USERNAME}/${GITLAB_REPO}/-/archive/${GITLAB_BRANCH}/${GITLAB_REPO}-${GITLAB_BRANCH}.zip`;
        
        log(`📌 URL: ${zipUrl}`, 'cyan');
        
        const response = await fetch(zipUrl, {
            headers: { 'User-Agent': 'ALI-MD-Deployer' },
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`GitLab error: ${response.status} - ${response.statusText}`);
        }

        const buffer = await response.buffer();
        
        if (fs.existsSync(BOT_DIR)) {
            log('🧹 Cleaning old bot directory...', 'yellow');
            fs.rmSync(BOT_DIR, { recursive: true, force: true });
        }
        
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        const rootFolder = zipEntries[0].entryName.split('/')[0];
        
        zip.extractAllTo(__dirname, true);
        
        const extractedPath = path.join(__dirname, rootFolder);
        if (fs.existsSync(extractedPath)) {
            fs.renameSync(extractedPath, BOT_DIR);
            log('✅ Bot downloaded from GitLab!', 'green');
        }
        
        return true;
    } catch (error) {
        log(`❌ Download failed: ${error.message}`, 'red');
        return false;
    }
}

// ============================================
// 📥 DOWNLOAD .env
// ============================================
async function downloadEnv() {
    try {
        if (fs.existsSync(ENV_FILE)) {
            log('✅ .env file already exists, skipping...', 'green');
            return true;
        }

        log('📥 Downloading .env from GitLab...', 'cyan');
        
        const envUrl = `https://gitlab.com/${GITLAB_USERNAME}/${GITLAB_REPO}/-/raw/${GITLAB_BRANCH}/.env`;
        
        const response = await fetch(envUrl, {
            headers: { 'User-Agent': 'ALI-MD-Deployer' }
        });

        if (!response.ok) {
            if (response.status === 404) {
                log('⚠️ No .env file found in GitLab repo', 'yellow');
                return false;
            }
            throw new Error(`GitLab error: ${response.status}`);
        }

        const content = await response.text();
        
        if (!fs.existsSync(BOT_DIR)) {
            fs.mkdirSync(BOT_DIR, { recursive: true });
        }
        
        fs.writeFileSync(ENV_FILE, content);
        log('✅ .env downloaded from GitLab!', 'green');
        return true;
    } catch (error) {
        log(`⚠️ .env download failed: ${error.message}`, 'yellow');
        return false;
    }
}

// ============================================
// 📥 DOWNLOAD CONFIG.JS
// ============================================
async function downloadConfig() {
    try {
        const configPath = path.join(BOT_DIR, 'config.js');
        
        if (fs.existsSync(configPath)) {
            log('✅ config.js already exists, skipping...', 'green');
            return true;
        }

        log('📥 Downloading config.js from GitLab...', 'cyan');
        
        const configUrl = `https://gitlab.com/${GITLAB_USERNAME}/${GITLAB_REPO}/-/raw/${GITLAB_BRANCH}/config.js`;
        
        const response = await fetch(configUrl, {
            headers: { 'User-Agent': 'ALI-MD-Deployer' }
        });

        if (!response.ok) {
            if (response.status === 404) {
                log('⚠️ No config.js in GitLab repo', 'yellow');
                return false;
            }
            throw new Error(`GitLab error: ${response.status}`);
        }

        const content = await response.text();
        
        if (!fs.existsSync(BOT_DIR)) {
            fs.mkdirSync(BOT_DIR, { recursive: true });
        }
        
        fs.writeFileSync(configPath, content);
        log('✅ config.js downloaded from GitLab!', 'green');
        return true;
    } catch (error) {
        log(`⚠️ config.js download failed: ${error.message}`, 'yellow');
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
                log('✅ Dependencies installed!', 'green');
                resolve(true);
            } else {
                log('❌ Dependencies failed', 'red');
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
        log('❌ index.js not found!', 'red');
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
        log(`❌ Bot error: ${error.message}`, 'red');
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
// 🎯 MAIN
// ============================================
async function main() {
    console.clear();
    log('\n🔥 ALI-MD GitLab Deployer v1.0', 'bright');
    log('═'.repeat(50), 'cyan');
    log(`📁 GitLab Repo: ${GITLAB_USERNAME}/${GITLAB_REPO}`, 'magenta');
    log(`📂 Bot Directory: ${BOT_DIR}`, 'magenta');
    log('═'.repeat(50), 'cyan');
    
    log('\n✅ GitLab Public Repo - No token needed!', 'green');
    
    const botExists = fs.existsSync(BOT_DIR) && 
                      fs.existsSync(path.join(BOT_DIR, 'index.js'));
    
    if (!botExists) {
        log('\n📦 First time setup detected...', 'yellow');
        
        const downloaded = await downloadBot();
        if (!downloaded) {
            log('❌ Failed to download bot!', 'red');
            process.exit(1);
        }
        
        await downloadEnv();
        await downloadConfig();
        
        const installed = await installDependencies();
        if (!installed) {
            log('❌ Failed to install dependencies!', 'red');
            process.exit(1);
        }
    }
    
    startBot();
}

// ============================================
// 🛑 SIGNALS
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
