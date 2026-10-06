'use strict';
// Smoke test: node_modules/.bin/electron tools/smoke.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1380, height: 860, show: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) errors.push(msg); });
  win.webContents.on('preload-error', (_e, p, err) => errors.push('preload: ' + err));
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  const res = await win.webContents.executeJavaScript(`(async () => {
    const out = [];
    const pp = window.__pp, st = document.getElementById('stage');
    const ev = (t, x, y, o = {}) => st.dispatchEvent(new PointerEvent(t, Object.assign({ clientX: x, clientY: y, bubbles: true, button: 0, pointerId: 1, pointerType: 'mouse' }, o)));
    const r = st.getBoundingClientRect();
    const stroke = (tool, color) => { pp.setTool(tool); ev('pointerdown', r.left+100, r.top+100); ev('pointermove', r.left+200, r.top+150); ev('pointermove', r.left+300, r.top+120); ev('pointerup', r.left+300, r.top+120); };
    out.push('tools=' + document.querySelectorAll('.tool').length);
    const before = pp.getState().hist;
    for (const t of ['brush','pencil','marker','calligraphy','eraser','spray']) stroke(t);
    for (const t of ['line','arrow','rect','rrect','ellipse','triangle','star','gradient']) stroke(t);
    out.push('hist=' + before + '->' + pp.getState().hist);
    // vyplnění
    pp.setTool('fill'); ev('pointerdown', r.left+700, r.top+500); out.push('after fill hist=' + pp.getState().hist);
    // vrstvy
    document.getElementById('lAdd').click(); out.push('layers=' + pp.getState().layers);
    document.getElementById('lDup').click(); document.getElementById('lMerge').click();
    out.push('layers after merge=' + pp.getState().layers);
    // výběr + přesun
    pp.setTool('select'); ev('pointerdown', r.left+50, r.top+50); ev('pointermove', r.left+250, r.top+200); ev('pointerup', r.left+250, r.top+200);
    out.push('sel=' + JSON.stringify(pp.getState().sel));
    ev('pointerdown', r.left+100, r.top+100); ev('pointermove', r.left+160, r.top+130); ev('pointerup', r.left+160, r.top+130);
    out.push('float=' + pp.getState().float);
    pp.runAction('deselect');
    // filtry a transformace
    pp.runAction('flip-h'); pp.runAction('rot-cw'); out.push('size=' + pp.S.w + 'x' + pp.S.h);
    pp.runAction('rot-ccw');
    document.querySelector('[data-filter="grayscale(1)"]').click();
    document.querySelector('[data-filter="blur(2px)"]').click();
    pp.runAction('pixelate');
    // zpět/vpřed
    const h1 = pp.getState().hIdx; pp.undo(); pp.undo(); pp.redo(); out.push('undo ok ' + h1 + '->' + pp.getState().hIdx);
    // export
    out.push('png=' + pp.flatten().toDataURL('image/png').length);
    pp.undo(); pp.undo(); pp.undo();
    return out;
  })()`);
  console.log(res.join('\n'));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO CONSOLE ERRORS');
  await new Promise(r => setTimeout(r, 600)); const img = await win.webContents.capturePage();
  require('fs').writeFileSync(path.join(process.env.SMOKE_OUT || __dirname, 'smoke.png'), img.toPNG());
  app.quit();
});
