const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog } = electron;
if (!ipcMain || !app) {
  console.error(
    'تم تشغيل البرنامج بواسطة Node.js وليس Electron.\n' +
    'السبب: متغير البيئة ELECTRON_RUN_AS_NODE مضبوط على 1.\n' +
    'الحل: أزل هذا المتغير ثم شغّل البرنامج عبر "npm start" أو electron.exe'
  );
  process.exit(1);
}
const path = require('path');
const { spawn } = require('child_process');
const packageInfo = require('./package.json');

const CURRENT_VERSION = packageInfo.version;
const UNIVERSAL_ACTIVATION_CODE = '55555';
const TRIAL_SECONDS = 25 * 24 * 60 * 60;
const POST_TRIAL_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function compareVersions(a, b) {
  const left = String(a || '0.0.0').split('.').map(Number);
  const right = String(b || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) > (right[i] || 0) ? 1 : -1;
  }
  return 0;
}
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
let appDataDir;
let dataFile;
let licenseFile;

function setStoragePaths() {
  appDataDir = path.join(app.getPath('documents'), 'Sales System');
  dataFile = path.join(appDataDir, 'data.json');
  licenseFile = path.join(appDataDir, 'license.json');
}

// استبدل هذا المفتاح العام بمفتاحك العام الحقيقي الناتج من نظام إصدار الأكواد.
// لا تضع المفتاح الخاص داخل التطبيق.
const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
eyJwYXlsb2FkIjoie1wiY3VzdG9tZXJcIjpcIkNVU1RPTUVSLVwiLFwiaXNzdWVkQXRcIjpcIjIwMjYtMDktMjZUMDA6NDU6NDguMTE3WlwiLFwiZXhwaXJlc0F0XCI6MTc5MjU0MzU0ODEyNX0iLCJzaWduYXR1cmUiOiItYkU4c2t6RW41REpOUk90TU9YT2JkWktXVmI3cFJON0xHNUFPSGdhc2N4T1JHLXhVb3ZOZER2ekN3OEJRRWpZbVU4MWI0X3g0WE9zTzRLeHprNjRCUSJ9
-----END PUBLIC KEY-----`;

function ensureFiles() {
  fs.mkdirSync(appDataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({}), 'utf8');
  if (!fs.existsSync(licenseFile)) {
    fs.writeFileSync(licenseFile, JSON.stringify({
      version: 1,
      highestVersion: CURRENT_VERSION,
      minimumVersion: CURRENT_VERSION,
      trialSecondsUsed: 0,
      trialExpiredAt: null,
      lastRunAt: null,
      lastSeenAt: null,
      maxSeenAt: null,
      clockTampered: false,
      activated: false,
      activation: null
    }, null, 2), 'utf8');
  }
}

function readLicense() {
  ensureFiles();
  try { return JSON.parse(fs.readFileSync(licenseFile, 'utf8')); } catch (_) { return null; }
}

function writeLicense(license) {
  ensureFiles();
  const temp = `${licenseFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(license, null, 2), 'utf8');
  fs.renameSync(temp, licenseFile);
}

function markTrialExpired(license, now = Date.now()) {
  if (!license.trialExpiredAt && Number(license.trialSecondsUsed) >= TRIAL_SECONDS) {
    license.trialExpiredAt = now;
  }
}

function scheduleSelfRemoval() {
  if (!app.isPackaged || process.platform !== 'win32') return false;
  const installDir = path.dirname(app.getPath('exe'));
  const dataDir = appDataDir;
  const script = [
    'Start-Sleep -Seconds 3',
    `$install = '${installDir.replace(/'/g, "''")}'`,
    `$data = '${dataDir.replace(/'/g, "''")}'`,
    'for ($i = 0; $i -lt 20; $i++) {',
    '  if (Test-Path $data) { Remove-Item -LiteralPath $data -Recurse -Force -ErrorAction SilentlyContinue }',
    '  if (Test-Path $install) { Remove-Item -LiteralPath $install -Recurse -Force -ErrorAction SilentlyContinue } else { break }',
    '  Start-Sleep -Seconds 2',
    '}'
  ].join('; ');
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  child.unref();
  return true;
}

function removeExpiredTrial() {
  const license = readLicense();
  if (!license || license.activated || !license.trialExpiredAt) return false;
  if (Date.now() < Number(license.trialExpiredAt) + POST_TRIAL_GRACE_MS) return false;
  return scheduleSelfRemoval();
}

function parseActivationCode(code) {
  if (String(code || '').trim() === UNIVERSAL_ACTIVATION_CODE) return { universal: true, customer: 'universal' };
  try {
    const payload = JSON.parse(Buffer.from(String(code || ''), 'base64url').toString('utf8'));
    if (!payload || !payload.payload || !payload.signature) return null;
    if (LICENSE_PUBLIC_KEY.includes('REPLACE_WITH')) return null;
    const valid = crypto.verify(null, Buffer.from(payload.payload), LICENSE_PUBLIC_KEY, Buffer.from(payload.signature, 'base64url'));
    if (!valid) return null;
    return JSON.parse(payload.payload);
  } catch (_) { return null; }
}

function getLicenseStatus() {
  const license = readLicense();
  if (!license) return { valid: false, reason: 'تعذر قراءة ملف التفعيل' };
  if (license.minimumVersion && compareVersions(CURRENT_VERSION, license.minimumVersion) < 0) {
    return { valid: false, blockedByVersion: true, reason: `هذه النسخة قديمة. يلزم الإصدار ${license.minimumVersion} أو أحدث` };
  }
  if (compareVersions(CURRENT_VERSION, license.highestVersion) > 0) {
    license.highestVersion = CURRENT_VERSION;
    writeLicense(license);
  }
  if (license.activated && license.activation) {
    const verifiedPayload = parseActivationCode(license.activation.code || '');
    const expired = verifiedPayload && !verifiedPayload.universal && verifiedPayload.expiresAt && Date.now() > Number(verifiedPayload.expiresAt);
    if (verifiedPayload && !expired) {
      return { valid: true, activated: true, message: 'البرنامج مفعل', dataPath: dataFile };
    }
    license.activated = false;
    license.activation = null;
    license.trialExpiredAt = license.trialExpiredAt || Date.now();
    writeLicense(license);
  }

  const now = Date.now();
  const previousSeen = Number(license.lastSeenAt) || now;
  const maxSeen = Number(license.maxSeenAt) || previousSeen;
  if (now < maxSeen - 60000) {
    license.clockTampered = true;
    license.trialSecondsUsed = TRIAL_SECONDS;
  } else {
    const elapsedSeconds = Math.max(0, Math.floor((now - previousSeen) / 1000));
    license.trialSecondsUsed = Math.min(TRIAL_SECONDS, (Number(license.trialSecondsUsed) || 0) + elapsedSeconds);
    license.maxSeenAt = Math.max(maxSeen, now);
  }
  markTrialExpired(license, now);
  license.lastSeenAt = now;
  license.lastRunAt = now;
  writeLicense(license);

  const remaining = Math.max(0, TRIAL_SECONDS - license.trialSecondsUsed);
  if (removeExpiredTrial()) app.quit();
  return {
    valid: remaining > 0,
    activated: false,
    trial: true,
    remainingSeconds: remaining,
    message: license.clockTampered ? 'تم اكتشاف تغيير في ساعة الجهاز، يلزم كود التفعيل' : (remaining > 0 ? `الفترة التجريبية متبقي منها ${Math.ceil(remaining / 86400)} يوم` : 'انتهت الفترة التجريبية'),
    dataPath: dataFile
  };
}

ipcMain.handle('license-store:license-status', () => getLicenseStatus());
ipcMain.on('license-store:license-status-sync', (event) => { event.returnValue = getLicenseStatus(); });
ipcMain.on('license-store:load-state-sync', (event) => {
  ensureFiles();
  try { event.returnValue = JSON.parse(fs.readFileSync(dataFile, 'utf8') || '{}'); } catch (_) { event.returnValue = {}; }
});
ipcMain.on('license-store:save-state-sync', (event, state) => {
  ensureFiles();
  const temp = `${dataFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state || {}, null, 2), 'utf8');
  fs.renameSync(temp, dataFile);
  event.returnValue = true;
});
ipcMain.handle('license-store:load-state', () => {
  ensureFiles();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8') || '{}');
});
ipcMain.handle('license-store:save-state', (_event, state) => {
  ensureFiles();
  const temp = `${dataFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state || {}, null, 2), 'utf8');
  fs.renameSync(temp, dataFile);
  return true;
});
ipcMain.handle('license-store:data-path', () => dataFile);
ipcMain.handle('license-store:activate', (_event, code) => {
  const cleanCode = String(code || '').trim();
  const payload = parseActivationCode(cleanCode);
  if (!payload) {
    return { valid: false, message: 'كود التفعيل غير صحيح' };
  }
  const license = readLicense() || {};
  license.activated = true;
  license.clockTampered = false;
  license.activation = { ...payload, code: cleanCode, activatedAt: new Date().toISOString() };
  writeLicense(license);
  return { valid: true, message: 'تم تفعيل البرنامج بنجاح' };
});

app.whenReady().then(() => {
  setStoragePaths();
  ensureFiles();
  const storedLicense = readLicense();
  if (storedLicense && storedLicense.highestVersion && compareVersions(CURRENT_VERSION, storedLicense.highestVersion) < 0) {
    dialog.showErrorBox('نسخة قديمة غير مسموحة', `هذه النسخة ${CURRENT_VERSION} أقدم من النسخة التي تم تشغيلها سابقاً ${storedLicense.highestVersion}. ثبّت الإصدار الأحدث.`);
    app.quit();
    return;
  }
  if (storedLicense) {
    if (!storedLicense.highestVersion || compareVersions(CURRENT_VERSION, storedLicense.highestVersion) > 0) {
      storedLicense.highestVersion = CURRENT_VERSION;
      storedLicense.minimumVersion = CURRENT_VERSION;
      writeLicense(storedLicense);
    } else if (!storedLicense.minimumVersion) {
      storedLicense.minimumVersion = storedLicense.highestVersion;
      writeLicense(storedLicense);
    }
  }
  if (removeExpiredTrial()) {
    app.quit();
    return;
  }
  setInterval(() => {
    const license = readLicense();
    if (license && !license.activated && license.lastSeenAt !== null) {
      const now = Date.now();
      const previous = Number(license.lastSeenAt) || now;
      const maxSeen = Number(license.maxSeenAt) || previous;
      if (now < maxSeen - 60000) {
        license.clockTampered = true;
        license.trialSecondsUsed = TRIAL_SECONDS;
      } else {
        license.trialSecondsUsed = Math.min(TRIAL_SECONDS, (Number(license.trialSecondsUsed) || 0) + Math.max(0, Math.floor((now - previous) / 1000)));
        license.maxSeenAt = Math.max(maxSeen, now);
      }
      markTrialExpired(license, now);
      license.lastSeenAt = now;
      license.lastRunAt = now;
      writeLicense(license);
      if (removeExpiredTrial()) app.quit();
    }
  }, 60000);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
});

app.on('before-quit', () => {
  const license = readLicense();
  if (license && !license.activated && license.lastSeenAt !== null) {
    const now = Date.now();
    const previous = Number(license.lastSeenAt) || now;
    const maxSeen = Number(license.maxSeenAt) || previous;
    if (now < maxSeen - 60000) {
      license.clockTampered = true;
      license.trialSecondsUsed = TRIAL_SECONDS;
    } else {
      license.trialSecondsUsed = Math.min(TRIAL_SECONDS, (Number(license.trialSecondsUsed) || 0) + Math.max(0, Math.floor((now - previous) / 1000)));
      license.maxSeenAt = Math.max(maxSeen, now);
    }
    license.lastSeenAt = now;
    license.lastRunAt = now;
    writeLicense(license);
  }
});

app.on('window-all-closed', () => app.quit());