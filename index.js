require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');

// ============================================
// 🔐 CONFIGURATION
// ============================================

const GITLAB_USERNAME = process.env.GITLAB_USERNAME || 'ALI-XER';
const GITLAB_REPO = process.env.GITLAB_REPO || 'ali-md';
const GITLAB_BRANCH = process.env.GITLAB_BRANCH || 'main';
const GITLAB_TOKEN = process.env.GITLAB_TOKEN || null; // Optional private repo support

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
// 🔍 DEBUG INFO
// ============================================
function showDebugInfo() {
    log('\n🔍 Configuration:', 'cyan');
    log(`   GitLab User: ${GITLAB_USERNAME}`, 'cyan');
    log(`   Repository: ${GITLAB_REPO}`, 'cyan');
    log(`   Branch: ${GITLAB_BRANCH}`, 'cyan');
    log(`   Token: ${GITLAB_TOKEN ? '✓ Set' : '✗ Not set (public only)'}`, 'cyan');
    log(`   Bot Dir: ${BOT_DIR}`, 'cyan');
    log('');
}

// ============================================
// 📥 DOWNLOAD BOT FROM GITLAB (FIXED HEADERS!)
// ============================================
async function downloadBot() {
    try {
        log('📦 Downloading bot from GitLab...', 'cyan');
        
        const zipUrl = `https://gitlab.com/${GITLAB_USERNAME}/${GITLAB_REPO}/-/archive/${GITLAB_BRANCH}/${GITLAB_REPO}-${GITLAB_BRANCH}.zip`;
        
        log(`📌 URL: ${zipUrl}`, 'cyan');
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        };
        
        // Add token if available for private repos
        if (GITLAB_TOKEN) {
            headers['PRIVATE-TOKEN'] = GITLAB_TOKEN;
        }
        
        const response = await fetch(zipUrl, {
            headers,
            redirect: 'follow'
        });

        if (response.status === 404) {
            log(`\n❌ Repository not found (404)`, 'red');
            log(`\n💡 Troubleshooting:`, 'yellow');
            log(`   1. Verify repo exists: https://gitlab.com/${GITLAB_USERNAME}/${GITLAB_REPO}`, 'yellow');
            log(`   2. Check username: ${GITLAB_USERNAME}`, 'yellow');
            log(`   3. Check repo name: ${GITLAB_REPO}`, 'yellow');
            log(`   4. Check branch exists: ${GITLAB_BRANCH}`, 'yellow');
            log(`   5. If private, set GITLAB_TOKEN env var`, 'yellow');
            log(`\n📝 Set env vars in .env:`, 'cyan');
            log(`   GITLAB_USERNAME=your-username`, 'cyan');
            log(`   GITLAB_REPO=your-repo`, 'cyan');
            log(`   GITLAB_BRANCH=main (or your branch)`, 'cyan');
            log(`   GITLAB_TOKEN=glpat-xxxx (if private)`, 'cyan');
            return false;
        }

        if (!response.ok) {
            throw new Error(`GitLab error: ${response.status} - ${response.statusText}`);
        }

        const buffer = await response.buffer();
        log(`📦 Downloaded ${(buffer.length / 1024).toFixed(2)} KB`, 'cyan');
        
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
// 📥 DOWNLOAD .env (FIXED HEADERS!)
// ============================================
async function downloadEnv() {
    try {
        if (fs.existsSync(ENV_FILE)) {
            log('✅ .env file already exists, skipping...', 'green');
            return true;
        }

        log('📥 Downloading .env from GitLab...', 'cyan');
        
        const envUrl = `https://gitlab.com/${GITLAB_USERNAME}/${GITLAB_REPO}/-/raw/${GITLAB_BRANCH}/.env`;
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        };
        
        if (GITLAB_TOKEN) {
            headers['PRIVATE-TOKEN'] = GITLAB_TOKEN;
        }

        const response = await fetch(envUrl, { headers });

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
// 📥 DOWNLOAD CONFIG.JS (FIXED HEADERS!)
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
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        };
        
        if (GITLAB_TOKEN) {
            headers['PRIVATE-TOKEN'] = GITLAB_TOKEN;
        }

        const response = await fetch(configUrl, { headers });

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
    log('\n🔥 ALI-MD GitLab Deployer v2.0', 'bright');
    log('═'.repeat(50), 'cyan');
    
    showDebugInfo();
    
    const botExists = fs.existsSync(BOT_DIR) && 
                      fs.existsSync(path.join(BOT_DIR, 'index.js'));
    
    if (!botExists) {
        log('📦 First time setup detected...', 'yellow');
        
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
