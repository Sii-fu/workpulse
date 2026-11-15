// WorkPulse desktop shell: starts the bundled server on a fixed local port and shows the app in a window.
// The port is fixed on purpose: saved data (localStorage) belongs to the address, so it must not change.
const { app, BrowserWindow, Menu, Tray, dialog, shell, nativeImage, ipcMain, screen } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 38417;
const ORIGIN = `http://localhost:${PORT}`;
const PRELOAD = path.join(__dirname, 'preload.cjs');

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

// What Settings -> App updates shows. status: idle | checking | current | downloading | ready | error | unavailable.
let updateState = { status: app.isPackaged ? 'idle' : 'unavailable', version: app.getVersion(), message: '' };
let updater = null;

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('wp:update', updateState);
}

function installUpdate() {
  quitting = true;
  updater.quitAndInstall();
}

function setupUpdates() {
  if (!app.isPackaged) return;
  const { autoUpdater } = require('electron-updater');
  updater = autoUpdater;
  serveUpdates();
  autoUpdater.autoDownload = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.on('checking-for-update', () => setUpdateState({ status: 'checking', message: '' }));
  autoUpdater.on('update-available', (info) => setUpdateState({ status: 'downloading', newVersion: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => setUpdateState({ status: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({ status: 'ready', newVersion: info.version });
    dialog
      .showMessageBox(win && win.isVisible() ? win : undefined, {
        type: 'info',
        title: 'WorkPulse update',
        message: `WorkPulse ${info.version} is ready.`,
        detail: 'Restart now to update? Your data stays as it is. You can also do it later from Settings.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((r) => {
        if (r.response === 0) installUpdate();
      });
  });
  autoUpdater.on('update-not-available', () => setUpdateState({ status: 'current', checkedAt: Date.now() }));
  autoUpdater.on('error', () =>
    setUpdateState({ status: 'error', message: 'Could not check for updates. Close and reopen WorkPulse, then try again.' }),
  );
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 30 * 60 * 1000);
  checkNow = () => {
    if (updateState.status === 'checking' || updateState.status === 'downloading') return;
    check();
  };
}

ipcMain.handle('wp:update-state', (event) => (fromOurPage(event) ? updateState : null));
ipcMain.on('wp:update-check', (event) => {
  if (fromOurPage(event)) checkNow();
});
ipcMain.on('wp:update-install', (event) => {
  if (fromOurPage(event) && updater && updateState.status === 'ready') installUpdate();
});

let checkNow = () => {};

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 380,
    minHeight: 600,
    title: 'WorkPulse',
    autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true, preload: PRELOAD },
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
      {
        label: 'Check for updates',
        click: () => {
          showWindow();
          checkNow();
        },
      },
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

// ---- Desktop widgets ----
// Two small frameless windows (time, tasks) that show the same page in widget mode (`?widget=`). The main window
// owns the data: it sends snapshots here, we pass them on, and button presses go back the same way.
const WIDGET_SIZE = { time: { width: 232, height: 112 }, tasks: { width: 300, height: 340 } };
const widgetWins = { time: null, tasks: null };
let widgetConfig = { time: { on: false, top: true }, tasks: { on: false, top: true } };
let lastSnapshot = null;
const POS_FILE = () => path.join(app.getPath('userData'), 'widget-positions.json');

function readPositions() {
  try {
    return JSON.parse(fs.readFileSync(POS_FILE(), 'utf8')) || {};
  } catch {
    return {};
  }
}

function savePosition(kind, win) {
  const [x, y] = win.getPosition();
  const all = readPositions();
  all[kind] = { x, y };
  try {
    fs.writeFileSync(POS_FILE(), JSON.stringify(all));
  } catch {
    // position is a nicety
  }
}

// Remembered spot if it is still on a screen; else the top-right corner, time above tasks.
function widgetPosition(kind) {
  const size = WIDGET_SIZE[kind];
  const saved = readPositions()[kind];
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const area = screen.getDisplayMatching({ x: saved.x, y: saved.y, width: size.width, height: size.height }).workArea;
    const inside = saved.x + 40 > area.x && saved.x < area.x + area.width - 40 && saved.y + 40 > area.y && saved.y < area.y + area.height - 40;
    if (inside) return saved;
  }
  const area = screen.getPrimaryDisplay().workArea;
  const x = area.x + area.width - size.width - 16;
  return { x, y: kind === 'time' ? area.y + 16 : area.y + 16 + WIDGET_SIZE.time.height + 12 };
}

function openWidget(kind, top) {
  const size = WIDGET_SIZE[kind];
  const pos = widgetPosition(kind);
  const w = new BrowserWindow({
    ...size,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: top,
    focusable: true,
    title: 'WorkPulse widget',
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true, preload: PRELOAD },
  });
  if (top) w.setAlwaysOnTop(true, 'floating');
  w.loadURL(`${ORIGIN}/?widget=${kind}`);
  w.webContents.on('did-finish-load', () => {
    if (lastSnapshot) w.webContents.send('wp:state', lastSnapshot);
  });
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e) => e.preventDefault());
  w.on('moved', () => savePosition(kind, w));
  w.on('closed', () => {
    if (widgetWins[kind] === w) widgetWins[kind] = null;
  });
  widgetWins[kind] = w;
}

function applyWidgets(config) {
  widgetConfig = config;
  for (const kind of ['time', 'tasks']) {
    const want = config[kind];
    const w = widgetWins[kind];
    if (!want.on) {
      if (w) w.close();
    } else if (!w) {
      openWidget(kind, want.top);
    } else {
      w.setAlwaysOnTop(want.top, want.top ? 'floating' : 'normal');
    }
  }
}

const fromOurPage = (event) => {
  try {
    return event.senderFrame && event.senderFrame.url.startsWith(ORIGIN);
  } catch {
    return false;
  }
};

const cleanConfig = (c) => {
  const one = (x) => ({ on: !!(x && x.on === true), top: !(x && x.top === false) });
  return { time: one(c && c.time), tasks: one(c && c.tasks) };
};

ipcMain.on('wp:widget-config', (event, config) => {
  if (fromOurPage(event)) applyWidgets(cleanConfig(config));
});

ipcMain.on('wp:state', (event, snapshot) => {
  if (!fromOurPage(event) || typeof snapshot !== 'object' || snapshot === null) return;
  lastSnapshot = snapshot;
  for (const w of Object.values(widgetWins)) if (w && !w.isDestroyed()) w.webContents.send('wp:state', snapshot);
});

ipcMain.on('wp:command', (event, cmd) => {
  if (!fromOurPage(event) || typeof cmd !== 'object' || cmd === null) return;
  if (cmd.type === 'open') return showWindow();
  if (win && !win.isDestroyed()) win.webContents.send('wp:command', cmd);
});

app.on('before-quit', () => {
  quitting = true;
});
