'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const IMG_RE = /\.(png|jpe?g|gif|bmp|webp)$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };

let win = null;
let dirty = false;
let forceClose = false;
let pendingFile = null;

function readImage(file) {
  try {
    const ext = path.extname(file).slice(1).toLowerCase();
    const buf = fs.readFileSync(file);
    return { name: path.basename(file), dataUrl: `data:${MIME[ext] || 'image/png'};base64,${buf.toString('base64')}` };
  } catch {
    return null;
  }
}

function fileFromArgv(argv) {
  return argv.slice(1).find(a => IMG_RE.test(a) && fs.existsSync(a)) || null;
}

function sendOpen(file) {
  const img = readImage(file);
  if (img && win) win.webContents.send('open-file', img);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1f26',
    title: 'PaintPlus',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    if (pendingFile) { sendOpen(pendingFile); pendingFile = null; }
  });
  win.on('close', e => {
    if (!dirty || forceClose) return;
    e.preventDefault();
    dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Zahodit změny', 'Zrušit'],
      defaultId: 1,
      cancelId: 1,
      title: 'PaintPlus',
      message: 'Máte neuložené změny.',
      detail: 'Opravdu chcete aplikaci zavřít? Neuložená práce se ztratí.'
    }).then(r => {
      if (r.response === 0) { forceClose = true; win.close(); }
    });
  });
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      const f = fileFromArgv(argv);
      if (f) sendOpen(f);
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    pendingFile = fileFromArgv(process.argv);
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}

ipcMain.handle('open-file', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Otevřít obrázek',
    properties: ['openFile'],
    filters: [{ name: 'Obrázky', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return readImage(r.filePaths[0]);
});

ipcMain.handle('save-file', async (_e, { dataUrl, name, ext }) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Uložit obrázek',
    defaultPath: path.join(app.getPath('pictures'), `${name}.${ext}`),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  });
  if (r.canceled || !r.filePath) return null;
  const base64 = String(dataUrl).split(',')[1] || '';
  fs.writeFileSync(r.filePath, Buffer.from(base64, 'base64'));
  return path.basename(r.filePath);
});

ipcMain.on('set-dirty', (_e, v) => { dirty = !!v; });
