// WorkPulse desktop shell: starts the bundled server on a fixed local port and shows the app in a window.
// The port is fixed on purpose: saved data (localStorage) belongs to the address, so it must not change.
const { app, BrowserWindow, Menu, Tray, dialog, shell, nativeImage } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 38417;
const ORIGIN = `http://localhost:${PORT}`;

process.env.PORT = String(PORT);
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'production';
process.env.WORKPULSE_DIST = path.join(__dirname, 'app', 'dist');

let win = null;
let tray = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  process.on('uncaughtException', (err) => {
    dialog.showErrorBox(
      'WorkPulse could not start',
      err && err.code === 'EADDRINUSE'
        ? `Port ${PORT} is already in use. Close the other program using it (or another copy of WorkPulse) and open WorkPulse again.`
        : String((err && err.message) || err),
    );
    quitting = true;
    app.quit();
  });
  app.whenReady().then(start);
}

function waitForServer(tries = 100) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http
        .get(`${ORIGIN}/api/health`, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => (n <= 0 ? reject(new Error('The WorkPulse server did not start.')) : setTimeout(() => attempt(n - 1), 200)));
    };
    attempt(tries);
  });
}

async function start() {
  require(path.join(__dirname, 'app', 'server.cjs'));
  await waitForServer();
  createWindow();
  createTray();
  setupUpdates();
}

// ---- Updates ----
// `npm run desktop:build` writes the new installer and latest.yml to UPDATE_DIR. A tiny server (this PC only)
// hands them to the updater, which downloads the new version and asks before restarting.
const UPDATE_DIR = path.join(os.homedir(), 'wp-release');
const UPDATE_PORT = 38418;

function serveUpdates() {
  const server = http.createServer((req, res) => {
    const name = path.basename(decodeURIComponent((req.url || '').split('?')[0]));
    const file = path.join(UPDATE_DIR, name);
    if (!/^(latest\.yml|.*\.(exe|blockmap))$/i.test(name) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Length': fs.statSync(file).size });
    fs.createReadStream(file).pipe(res);
  });
  server.on('error', () => {});
  server.listen(UPDATE_PORT, '127.0.0.1');
}

let manualCheck = false;

function setupUpdates() {
  if (!app.isPackaged) return;
  const { autoUpdater } = require('electron-updater');
  serveUpdates();
  autoUpdater.autoDownload = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.on('update-downloaded', (info) => {
    manualCheck = false;
    dialog
      .showMessageBox(win && win.isVisible() ? win : undefined, {
        type: 'info',
        title: 'WorkPulse update',
        message: `WorkPulse ${info.version} is ready.`,
        detail: 'Restart now to update? Your data stays as it is.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((r) => {
        if (r.response === 0) {
          quitting = true;
          autoUpdater.quitAndInstall();
        }
      });
  });
  autoUpdater.on('update-not-available', () => {
    if (manualCheck) dialog.showMessageBox({ type: 'info', title: 'WorkPulse', message: 'WorkPulse is up to date.' });
    manualCheck = false;
  });
  autoUpdater.on('error', () => {
    manualCheck = false;
  });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 30 * 60 * 1000);
  checkNow = () => {
    manualCheck = true;
    check();
  };
}

let checkNow = () => {};

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 380,
    minHeight: 600,
    title: 'WorkPulse',
    autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.loadURL(ORIGIN);
  // Links to other sites (WhatsApp Web, the phone link, docs) open in the normal browser.
  const external = (url) => {
    if (!url.startsWith(ORIGIN)) {
      shell.openExternal(url);
      return true;
    }
    return false;
  };
  win.webContents.setWindowOpenHandler(({ url }) => (external(url) ? { action: 'deny' } : { action: 'allow' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (external(url)) e.preventDefault();
  });
  // Closing the window keeps WorkPulse (and running timers) in the tray; "Quit" in the tray really quits.
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(process.execPath).resize({ width: 16, height: 16 }));
  tray.setToolTip('WorkPulse');
  const build = () =>
    Menu.buildFromTemplate([
      { label: 'Open WorkPulse', click: showWindow },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked });
        },
      },
      { label: 'Check for updates', click: () => checkNow() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]);
  tray.setContextMenu(build());
  tray.on('click', showWindow);
}

app.on('before-quit', () => {
  quitting = true;
});
