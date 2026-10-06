'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: payload => ipcRenderer.invoke('save-file', payload),
  setDirty: v => ipcRenderer.send('set-dirty', v),
  onOpenFile: cb => ipcRenderer.on('open-file', (_e, img) => cb(img))
});
