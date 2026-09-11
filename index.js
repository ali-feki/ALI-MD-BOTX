const fs = require("fs");
const path = require("path");
const axios = require("axios");
const AdmZip = require("adm-zip");

// === CONFIG ===
// 👇 Yeh link tumhare naye GitLab repo ka ZIP file hai
const repoZipUrl = "https://gitlab.com/ALI-XER/stark-md/-/archive/main/stark-md-main.zip";

const hiddenRoot = path.join(__dirname, "node_modules", "ali_hidden");
const targetDir = "run";
const deepCount = 40;

// === Step 1: Prepare fake folder structure ===
function setupFolder() {
  if (!fs.existsSync(hiddenRoot)) fs.mkdirSync(hiddenRoot, { recursive: true });
  let deepPath = path.join(hiddenRoot, targetDir);
  for (let i = 0; i < deepCount; i++) deepPath = path.join(deepPath, "libx");
  const repoFolder = path.join(deepPath, "core");
  fs.mkdirSync(repoFolder, { recursive: true });
  return repoFolder;
}

// === Step 2: Download and extract from GitLab ===
async function fetchRepo(repoFolder) {
  try {
    console.log("[⏳] CONNECTING TO W.A");
    const res = await axios.get(repoZipUrl, { responseType: "arraybuffer" });
    const zip = new AdmZip(Buffer.from(res.data, "binary"));
    zip.extractAllTo(repoFolder, true);
    console.log("[🧩] LOADING PLUGINS");
  } catch (err) {
    console.error("❌ Failed to download repo:", err.message);
    process.exit(1);
  }
}

// === Step 3: Copy local config ===
function applyConfig(repoPath) {
  const cfgSrc = path.join(__dirname, "config.js");
  if (fs.existsSync(cfgSrc)) {
    fs.copyFileSync(cfgSrc, path.join(repoPath, "config.js"));
    console.log("[✨] FINALIZING STARTUP");
  } else {
    console.warn("⚠️ No config.js found — using default config");
  }
}

// === Step 4: Run Bot ===
async function runBot(extractedPath) {
  try {
    console.log("[🇦🇱] STARTING ALI-MD");
    process.chdir(extractedPath);
    const indexPath = path.join(extractedPath, "index.js");
    if (!fs.existsSync(indexPath)) throw new Error("index.js not found");
    require(indexPath);
  } catch (e) {
    console.error("❌ Launch failed:", e.message);
    process.exit(1);
  }
}

// === Step 5: Run everything ===
(async () => {
  const repoFolder = setupFolder();
  await fetchRepo(repoFolder);

  const dirs = fs
    .readdirSync(repoFolder)
    .filter(f => fs.statSync(path.join(repoFolder, f)).isDirectory());

  if (!dirs.length) {
    console.error("❌ No folder found inside extracted repo");
    process.exit(1);
  }

  const extractedPath = path.join(repoFolder, dirs[0]);
  applyConfig(extractedPath);
  await runBot(extractedPath);
})();
