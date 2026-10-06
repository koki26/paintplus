(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = window.api || null;

/* ============================================================
   Stav
   ============================================================ */
const S = {
  w: 1280, h: 720,
  layers: [], active: 0,
  tool: 'brush',
  color: '#000000', color2: '#ffffff',
  size: 6, opacity: 100, fill: 'outline', sym: 'none', tol: 32,
  font: 'Segoe UI', fontSize: 32, bold: false, italic: false,
  zoom: 1, grid: false,
  dirty: false, fileName: 'Bez názvu'
};
let sel = null;     // {x,y,w,h}
let float = null;   // {canvas,x,y,layer}
let drag = null;
let textState = null;
let spaceDown = false;
let history = [], hIdx = -1;
let recent = [];
try { recent = JSON.parse(localStorage.getItem('pp-recent') || '[]'); } catch { recent = []; }

const TOOLS = [
  { id: 'select', key: 's', name: 'Výběr', hint: 'Tažením vyberte oblast, pak ji přesuňte. Ctrl při přesunu = kopie. Šipky posouvají výběr.' },
  { id: 'hand', key: 'h', name: 'Posun plátna', hint: 'Tažením posouváte plátno. Stejně funguje mezerník nebo prostřední tlačítko.' },
  '-',
  { id: 'brush', key: 'b', name: 'Štětec', hint: 'Hladký štětec. Pravé tlačítko kreslí sekundární barvou.' },
  { id: 'pencil', key: 'p', name: 'Tužka', hint: 'Ostré pixely bez vyhlazení – ideální pro pixel art.' },
  { id: 'marker', key: 'm', name: 'Zvýrazňovač', hint: 'Průhledný fix, který se prolíná s podkladem.' },
  { id: 'spray', key: 'a', name: 'Sprej', hint: 'Držte tlačítko pro hustší nástřik.' },
  { id: 'calligraphy', key: 'c', name: 'Kaligrafie', hint: 'Plochý hrot pod úhlem 45°.' },
  { id: 'eraser', key: 'e', name: 'Guma', hint: 'Maže do průhlednosti (na pozadí do sekundární barvy).' },
  '-',
  { id: 'fill', key: 'g', name: 'Vyplnit', hint: 'Klepnutím vyplníte oblast podobné barvy. Tolerance určuje, jak moc podobné.' },
  { id: 'gradient', key: 'd', name: 'Přechod', hint: 'Tažením vytvoříte přechod z primární do sekundární barvy (do výběru nebo celé vrstvy).' },
  { id: 'picker', key: 'i', name: 'Kapátko', hint: 'Klepnutím převezmete barvu. Alt + klik funguje v každém nástroji.' },
  { id: 'text', key: 't', name: 'Text', hint: 'Klepněte a pište. Potvrzení: klik jinam nebo Ctrl+Enter, Esc zruší.' },
  '-',
  { id: 'line', key: 'l', name: 'Čára', hint: 'Shift = úhly po 45°.' },
  { id: 'arrow', key: '', name: 'Šipka', hint: 'Shift = úhly po 45°.' },
  { id: 'rect', key: 'r', name: 'Obdélník', hint: 'Shift = čtverec.' },
  { id: 'rrect', key: '', name: 'Zaoblený obdélník', hint: 'Shift = čtverec.' },
  { id: 'ellipse', key: 'o', name: 'Elipsa', hint: 'Shift = kruh.' },
  { id: 'triangle', key: '', name: 'Trojúhelník', hint: 'Shift = pravidelný.' },
  { id: 'star', key: '', name: 'Hvězda', hint: 'Shift = pravidelná hvězda.' }
];
const FREEHAND = ['brush', 'pencil', 'marker', 'spray', 'calligraphy', 'eraser'];
const SHAPES = ['line', 'arrow', 'rect', 'rrect', 'ellipse', 'triangle', 'star'];

const PALETTE = [
  '#000000', '#3a3a3a', '#7f7f7f', '#bdbdbd', '#ffffff', '#7a4a2b', '#c58b5c',
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#0a84ff', '#5e5ce6',
  '#bf5af2', '#ff2d92', '#8b0000', '#a0522d', '#808000', '#006400', '#008b8b',
  '#00008b', '#4b0082', '#ffb6c1', '#ffe4b5', '#98fb98', '#afeeee', '#c3b1e1'
];

/* ============================================================
   Pomocné funkce
   ============================================================ */
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

const stage = $('#stage'), workspace = $('#workspace'), layersEl = $('#layersEl');
const overlay = $('#overlay'), oc = overlay.getContext('2d');
const selBox = $('#selBox'), ring = $('#ring'), textInput = $('#textInput');

const activeLayer = () => S.layers[S.active];

/* ============================================================
   Vrstvy
   ============================================================ */
function newLayer(name, w = S.w, h = S.h) {
  const canvas = makeCanvas(w, h);
  return { name, canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }), visible: true, opacity: 100, bg: false };
}

function buildStage() {
  overlay.width = S.w; overlay.height = S.h;
  layersEl.innerHTML = '';
  S.layers.forEach(l => {
    l.canvas.style.display = l.visible ? '' : 'none';
    l.canvas.style.opacity = l.opacity / 100;
    layersEl.appendChild(l.canvas);
  });
  applyZoom();
  $('#stSize').textContent = `${S.w} × ${S.h} px`;
}

function renderLayerPanel() {
  const list = $('#layerList');
  list.innerHTML = '';
  for (let i = S.layers.length - 1; i >= 0; i--) {
    const l = S.layers[i];
    const li = document.createElement('li');
    if (i === S.active) li.classList.add('active');

    const eye = document.createElement('button');
    eye.className = 'eye' + (l.visible ? '' : ' off');
    eye.textContent = '👁';
    eye.title = 'Zobrazit / skrýt';
    eye.onclick = e => { e.stopPropagation(); l.visible = !l.visible; buildStage(); commit(); };

    const th = makeCanvas(88, 60);
    const tc = th.getContext('2d');
    tc.drawImage(l.canvas, 0, 0, 88, 60);

    const name = document.createElement('span');
    name.className = 'lname'; name.textContent = l.name;
    name.ondblclick = e => {
      e.stopPropagation();
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = l.name;
      name.replaceWith(inp); inp.focus(); inp.select();
      const done = () => { l.name = inp.value.trim() || l.name; renderLayerPanel(); };
      inp.onblur = done;
      inp.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = l.name; inp.blur(); } };
    };

    li.append(eye, th, name);
    li.onclick = () => { commitFloat(); S.active = i; syncLayerUI(); renderLayerPanel(); };
    list.appendChild(li);
  }
  syncLayerUI();
}

function syncLayerUI() {
  const l = activeLayer();
  if (!l) return;
  $('#layerOp').value = l.opacity;
  $('#layerOpOut').textContent = l.opacity;
}

function addLayer() {
  commitFloat();
  const l = newLayer(`Vrstva ${S.layers.length + 1}`);
  S.layers.splice(S.active + 1, 0, l);
  S.active++;
  buildStage(); commit();
}
function dupLayer() {
  commitFloat();
  const src = activeLayer();
  const l = newLayer(src.name + ' kopie');
  l.ctx.drawImage(src.canvas, 0, 0);
  l.opacity = src.opacity; l.visible = src.visible;
  S.layers.splice(S.active + 1, 0, l);
  S.active++;
  buildStage(); commit();
}
function delLayer() {
  commitFloat();
  if (S.layers.length < 2) { toast('Poslední vrstvu nelze smazat'); return; }
  S.layers.splice(S.active, 1);
  S.active = Math.max(0, S.active - 1);
  buildStage(); commit();
}
function moveLayer(dir) {
  commitFloat();
  const j = S.active + dir;
  if (j < 0 || j >= S.layers.length) return;
  [S.layers[S.active], S.layers[j]] = [S.layers[j], S.layers[S.active]];
  S.active = j;
  buildStage(); commit();
}
function mergeDown() {
  commitFloat();
  if (S.active === 0) { toast('Není s čím sloučit'); return; }
  const top = activeLayer(), bot = S.layers[S.active - 1];
  if (top.visible) {
    bot.ctx.save();
    bot.ctx.globalAlpha = top.opacity / 100;
    bot.ctx.drawImage(top.canvas, 0, 0);
    bot.ctx.restore();
  }
  S.layers.splice(S.active, 1);
  S.active--;
  buildStage(); commit();
}

/* ============================================================
   Historie (zpět / vpřed)
   ============================================================ */
function snapshot() {
  return {
    w: S.w, h: S.h, active: S.active,
    layers: S.layers.map(l => ({
      name: l.name, visible: l.visible, opacity: l.opacity, bg: l.bg,
      data: l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height)
    }))
  };
}
function snapBytes(s) { return s.layers.reduce((a, l) => a + l.data.data.length, 0); }

function restore(s) {
  S.w = s.w; S.h = s.h;
  S.layers = s.layers.map(d => {
    const l = newLayer(d.name, s.w, s.h);
    l.ctx.putImageData(d.data, 0, 0);
    l.visible = d.visible; l.opacity = d.opacity; l.bg = d.bg;
    return l;
  });
  S.active = clamp(s.active, 0, S.layers.length - 1);
  buildStage(); renderLayerPanel(); updateSelBox();
}

function commit() {
  history.length = hIdx + 1;
  history.push(snapshot());
  let total = history.reduce((a, s) => a + snapBytes(s), 0);
  while (history.length > 1 && (history.length > 60 || total > 600e6)) {
    total -= snapBytes(history.shift());
  }
  hIdx = history.length - 1;
  setDirty(true);
  renderLayerPanel();
  updateUndoButtons();
}

function undo() {
  commitFloat(); commitText();
  if (hIdx <= 0) return;
  hIdx--; restore(history[hIdx]); setDirty(true); updateUndoButtons();
}
function redo() {
  commitFloat(); commitText();
  if (hIdx >= history.length - 1) return;
  hIdx++; restore(history[hIdx]); setDirty(true); updateUndoButtons();
}
function updateUndoButtons() {
  $('#btnUndo').disabled = hIdx <= 0;
  $('#btnRedo').disabled = hIdx >= history.length - 1;
}

function setDirty(v) {
  S.dirty = v;
  document.title = `${S.fileName}${v ? ' •' : ''} – PaintPlus`;
  $('#stFile').textContent = S.fileName + (v ? ' (neuloženo)' : '');
  if (api) api.setDirty(v);
}

/* ============================================================
   Dokument
   ============================================================ */
function newDocument(w, h, bg, name = 'Bez názvu') {
  S.w = w; S.h = h; S.fileName = name;
  const l = newLayer('Pozadí', w, h);
  l.bg = true;
  if (bg !== 'transparent') {
    l.ctx.fillStyle = bg === 'color2' ? S.color2 : '#ffffff';
    l.ctx.fillRect(0, 0, w, h);
  }
  S.layers = [l]; S.active = 0;
  sel = null; float = null; history = []; hIdx = -1;
  buildStage(); updateSelBox();
  commit(); setDirty(false);
  fitZoom(true);
}

function docFromImage(img, name) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  S.w = w; S.h = h; S.fileName = name;
  const l = newLayer('Pozadí', w, h);
  l.bg = true;
  l.ctx.drawImage(img, 0, 0);
  S.layers = [l]; S.active = 0;
  sel = null; float = null; history = []; hIdx = -1;
  buildStage(); updateSelBox();
  commit(); setDirty(false);
  fitZoom(true);
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Obrázek se nepodařilo načíst'));
    img.src = src;
  });
}

function confirmDiscard() {
  return !S.dirty || confirm('Máte neuložené změny. Opravdu je zahodit?');
}

async function openImage() {
  if (!confirmDiscard()) return;
  if (api) {
    const f = await api.openFile();
    if (!f) return;
    try { docFromImage(await loadImage(f.dataUrl), f.name); } catch (e) { toast(e.message); }
  } else {
    $('#filePick').click();
  }
}

function flatten(bgColor) {
  const c = makeCanvas(S.w, S.h);
  const x = c.getContext('2d', { willReadFrequently: true });
  if (bgColor) { x.fillStyle = bgColor; x.fillRect(0, 0, S.w, S.h); }
  for (const l of S.layers) {
    if (!l.visible) continue;
    x.globalAlpha = l.opacity / 100;
    x.drawImage(l.canvas, 0, 0);
  }
  x.globalAlpha = 1;
  return c;
}

async function saveAs(ext) {
  commitFloat(); commitText();
  const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[ext];
  const c = flatten(ext === 'jpg' ? '#ffffff' : null);
  const dataUrl = c.toDataURL(mime, 0.93);
  const base = S.fileName.replace(/\.[^.]+$/, '') || 'obrazek';
  if (api) {
    const saved = await api.saveFile({ dataUrl, name: base, ext });
    if (!saved) return;
    S.fileName = saved;
    setDirty(false);
    toast('Uloženo: ' + saved);
  } else {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = `${base}.${ext}`; a.click();
    setDirty(false);
  }
}

async function copyCanvasToClipboard(canvas) {
  try {
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Zkopírováno do schránky');
  } catch { toast('Kopírování se nepodařilo'); }
}

/* ============================================================
   Zoom
   ============================================================ */
function applyZoom() {
  stage.style.width = S.w * S.zoom + 'px';
  stage.style.height = S.h * S.zoom + 'px';
  stage.classList.toggle('pixelated', S.zoom >= 2);
  $('#zoomLabel').textContent = Math.round(S.zoom * 100) + ' %';
  updateGrid(); updateSelBox();
  if (textState) positionText();
}
function setZoom(z, cx, cy) {
  z = clamp(z, 0.05, 32);
  const rect = stage.getBoundingClientRect();
  const wr = workspace.getBoundingClientRect();
  const px = cx ?? (wr.left + wr.width / 2), py = cy ?? (wr.top + wr.height / 2);
  const ix = (px - rect.left) / S.zoom, iy = (py - rect.top) / S.zoom;
  S.zoom = z; applyZoom();
  const r2 = stage.getBoundingClientRect();
  workspace.scrollLeft += (r2.left + ix * z) - px;
  workspace.scrollTop += (r2.top + iy * z) - py;
}
function fitZoom(capOne) {
  const aw = workspace.clientWidth - 80, ah = workspace.clientHeight - 80;
  let z = Math.min(aw / S.w, ah / S.h);
  z = capOne ? Math.min(z, 1) : Math.min(z, 8);
  S.zoom = Math.max(0.05, z);
  applyZoom();
  workspace.scrollLeft = workspace.scrollTop = 0;
}
function updateGrid() {
  const g = $('#gridLayer');
  if (!S.grid) { g.style.backgroundImage = 'none'; return; }
  const cell = (S.zoom >= 8 ? 1 : 16) * S.zoom;
  g.style.backgroundImage =
    'linear-gradient(to right, rgba(0,0,0,.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.28) 1px, transparent 1px)';
  g.style.backgroundSize = `${cell}px ${cell}px`;
}

/* ============================================================
   Výběr a plovoucí vrstva
   ============================================================ */
function updateSelBox() {
  if (!sel) { selBox.style.display = 'none'; $('#stSel').textContent = ''; return; }
  selBox.style.display = 'block';
  selBox.style.left = sel.x * S.zoom + 'px';
  selBox.style.top = sel.y * S.zoom + 'px';
  selBox.style.width = sel.w * S.zoom + 'px';
  selBox.style.height = sel.h * S.zoom + 'px';
  $('#stSel').textContent = `Výběr: ${sel.w} × ${sel.h}`;
}

function clearRegion(layer, r) {
  if (layer.bg) {
    layer.ctx.fillStyle = S.color2;
    layer.ctx.fillRect(r.x, r.y, r.w, r.h);
  } else {
    layer.ctx.clearRect(r.x, r.y, r.w, r.h);
  }
}

function liftFloat(copy) {
  const L = activeLayer();
  const c = makeCanvas(sel.w, sel.h);
  c.getContext('2d').drawImage(L.canvas, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
  if (!copy) clearRegion(L, sel);
  float = { canvas: c, x: sel.x, y: sel.y, layer: L };
  redrawFloat();
}
function redrawFloat() {
  oc.clearRect(0, 0, S.w, S.h);
  if (float) oc.drawImage(float.canvas, Math.round(float.x), Math.round(float.y));
}
function commitFloat() {
  if (!float) return;
  float.layer.ctx.drawImage(float.canvas, Math.round(float.x), Math.round(float.y));
  float = null;
  oc.clearRect(0, 0, S.w, S.h);
  commit();
}
function deleteSelection() {
  if (float) {
    float = null; oc.clearRect(0, 0, S.w, S.h);
    commit(); return;
  }
  if (!sel) { toast('Nic není vybráno'); return; }
  clearRegion(activeLayer(), sel);
  commit();
}
function selectAll() {
  commitFloat();
  setTool('select');
  sel = { x: 0, y: 0, w: S.w, h: S.h };
  updateSelBox();
}
function deselect() {
  commitFloat();
  sel = null; updateSelBox();
}
function selectionCanvas() {
  if (float) return float.canvas;
  if (!sel) return null;
  const c = makeCanvas(sel.w, sel.h);
  c.getContext('2d').drawImage(activeLayer().canvas, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
  return c;
}
async function copySelection() {
  const c = selectionCanvas();
  if (!c) { toast('Nic není vybráno'); return false; }
  await copyCanvasToClipboard(c);
  return true;
}
async function cutSelection() {
  if (await copySelection()) deleteSelection();
}
function insertImageSource(src) {
  commitFloat();
  const w = src.width, h = src.height;
  if (w > S.w || h > S.h) {
    if (confirm('Vkládaný obrázek je větší než plátno. Zvětšit plátno?')) resizeCanvasTo(Math.max(S.w, w), Math.max(S.h, h), false);
  }
  setTool('select');
  const c = makeCanvas(w, h);
  c.getContext('2d').drawImage(src, 0, 0);
  const wr = workspace.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  const x = clamp(Math.round((wr.left - sr.left) / S.zoom), 0, Math.max(0, S.w - w));
  const y = clamp(Math.round((wr.top - sr.top) / S.zoom), 0, Math.max(0, S.h - h));
  float = { canvas: c, x, y, layer: activeLayer() };
  sel = { x, y, w, h };
  redrawFloat(); updateSelBox();
}
async function pasteFromClipboard() {
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find(t => t.startsWith('image/'));
      if (type) {
        const img = await loadImage(URL.createObjectURL(await it.getType(type)));
        insertImageSource(img); return;
      }
    }
    toast('Ve schránce není obrázek');
  } catch { toast('Vložení se nepodařilo'); }
}
function cropToSelection() {
  commitFloat();
  if (!sel) { toast('Nejdřív něco vyberte'); return; }
  const r = sel;
  S.layers.forEach(l => {
    const c = makeCanvas(r.w, r.h);
    c.getContext('2d', { willReadFrequently: true }).drawImage(l.canvas, -r.x, -r.y);
    l.canvas = c; l.ctx = c.getContext('2d', { willReadFrequently: true });
  });
  S.w = r.w; S.h = r.h; sel = null;
  buildStage(); updateSelBox(); commit(); fitZoom(true);
}

/* ============================================================
   Transformace obrazu
   ============================================================ */
function replaceLayerCanvas(l, c) {
  l.canvas = c; l.ctx = c.getContext('2d', { willReadFrequently: true });
}
function transformAll(nw, nh, fn) {
  commitFloat();
  S.layers.forEach(l => {
    const c = makeCanvas(nw, nh);
    const x = c.getContext('2d', { willReadFrequently: true });
    fn(x, l.canvas);
    replaceLayerCanvas(l, c);
  });
  S.w = nw; S.h = nh; sel = null;
  buildStage(); updateSelBox(); commit();
  if (nw !== S.layers[0].canvas.width) fitZoom(true);
}
function flipH() { transformAll(S.w, S.h, (x, c) => { x.translate(S.w, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); }); }
function flipV() { transformAll(S.w, S.h, (x, c) => { x.translate(0, S.h); x.scale(1, -1); x.drawImage(c, 0, 0); }); }
function rotate(deg) {
  const w = S.w, h = S.h;
  const swap = deg !== 180;
  transformAll(swap ? h : w, swap ? w : h, (x, c) => {
    x.translate((swap ? h : w) / 2, (swap ? w : h) / 2);
    x.rotate(deg * Math.PI / 180);
    x.drawImage(c, -w / 2, -h / 2);
  });
  fitZoom(true);
}
function resizeCanvasTo(nw, nh, scale) {
  commitFloat();
  S.layers.forEach(l => {
    const c = makeCanvas(nw, nh);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    if (scale) x.drawImage(l.canvas, 0, 0, nw, nh);
    else {
      if (l.bg) { x.fillStyle = S.color2; x.fillRect(0, 0, nw, nh); }
      x.drawImage(l.canvas, 0, 0);
    }
    replaceLayerCanvas(l, c);
  });
  S.w = nw; S.h = nh; sel = null;
  buildStage(); updateSelBox(); commit(); fitZoom(true);
}

function applyFilter(css) {
  commitFloat();
  const L = activeLayer();
  const t = makeCanvas(S.w, S.h), tc = t.getContext('2d');
  tc.filter = css;
  tc.drawImage(L.canvas, 0, 0);
  regionReplace(L, t);
  commit();
}
function regionReplace(L, src) {
  L.ctx.save();
  if (sel) { L.ctx.beginPath(); L.ctx.rect(sel.x, sel.y, sel.w, sel.h); L.ctx.clip(); }
  L.ctx.clearRect(0, 0, S.w, S.h);
  L.ctx.drawImage(src, 0, 0);
  L.ctx.restore();
}
function pixelate() {
  commitFloat();
  const L = activeLayer();
  const px = Math.max(4, Math.round(Math.max(S.w, S.h) / 100));
  const small = makeCanvas(Math.ceil(S.w / px), Math.ceil(S.h / px));
  small.getContext('2d').drawImage(L.canvas, 0, 0, small.width, small.height);
  const t = makeCanvas(S.w, S.h), tc = t.getContext('2d');
  tc.imageSmoothingEnabled = false;
  tc.drawImage(small, 0, 0, small.width * px, small.height * px);
  regionReplace(L, t);
  commit();
}

/* ============================================================
   Barvy
   ============================================================ */
function setColor(hex, secondary) {
  if (secondary) { S.color2 = hex; $('#color2').value = hex; $('.sw2').style.background = hex; }
  else { S.color = hex; $('#color1').value = hex; $('.sw1').style.background = hex; }
  if (textState) textInput.style.color = S.color;
}
function addRecent(hex) {
  recent = [hex, ...recent.filter(c => c !== hex)].slice(0, 10);
  try { localStorage.setItem('pp-recent', JSON.stringify(recent)); } catch {}
  renderRecent();
}
function chip(hex) {
  const b = document.createElement('button');
  b.className = 'chip'; b.style.background = hex; b.title = hex;
  b.onclick = () => setColor(hex, false);
  b.oncontextmenu = e => { e.preventDefault(); setColor(hex, true); };
  return b;
}
function renderRecent() {
  const r = $('#recent'); r.innerHTML = '';
  recent.forEach(c => r.appendChild(chip(c)));
}
function samplePixel(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= S.w || y >= S.h) return null;
  const d = flatten().getContext('2d').getImageData(x, y, 1, 1).data;
  return d[3] === 0 ? '#ffffff' : rgbToHex(d[0], d[1], d[2]);
}
function pickColor(p, secondary) {
  const c = samplePixel(p.x, p.y);
  if (c) { setColor(c, secondary); addRecent(c); }
}

/* ============================================================
   Kreslení
   ============================================================ */
const getPos = e => {
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left) / S.zoom, y: (e.clientY - r.top) / S.zoom };
};

function symmetry(ctx, fn) {
  const t = [[1, 0, 0, 1, 0, 0]];
  if (S.sym === 'h' || S.sym === 'both') t.push([-1, 0, 0, 1, S.w, 0]);
  if (S.sym === 'v' || S.sym === 'both') t.push([1, 0, 0, -1, 0, S.h]);
  if (S.sym === 'both') t.push([-1, 0, 0, -1, S.w, S.h]);
  for (const m of t) {
    ctx.save();
    ctx.setTransform(...m);
    fn();
    ctx.restore();
  }
}

function strokeWidth(e) {
  let w = S.size;
  if (drag.tool === 'marker') w *= 2.5;
  if (e && e.pointerType === 'pen') w *= Math.max(0.15, e.pressure * 1.6);
  return w;
}

function drawCtx() {
  if (drag.tool === 'eraser') {
    const L = activeLayer();
    return L.ctx;
  }
  return oc;
}

function eraserStyle(ctx) {
  const L = activeLayer();
  if (L.bg) { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = ctx.fillStyle = S.color2; }
  else { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = ctx.fillStyle = '#000'; }
  ctx.globalAlpha = S.opacity / 100;
}

function dab(p, w) {
  const ctx = drawCtx();
  const t = drag.tool;
  ctx.save();
  if (t === 'eraser') eraserStyle(ctx); else ctx.fillStyle = ctx.strokeStyle = drag.color;
  if (t === 'pencil') {
    const s = Math.max(1, Math.round(S.size));
    symmetry(ctx, () => ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s));
  } else if (t === 'calligraphy') {
    calligraphyStamp(ctx, p);
  } else {
    symmetry(ctx, () => { ctx.beginPath(); ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.restore();
}

function calligraphyStamp(ctx, p) {
  const d = S.size * 0.7;
  symmetry(ctx, () => {
    ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x - d, p.y + d); ctx.lineTo(p.x + d, p.y - d); ctx.stroke();
  });
}

function segment(a, b, e) {
  const ctx = drawCtx();
  const t = drag.tool;
  const w = strokeWidth(e);
  ctx.save();
  if (t === 'eraser') eraserStyle(ctx); else ctx.fillStyle = ctx.strokeStyle = drag.color;
  if (t === 'pencil') {
    // Bresenham
    const s = Math.max(1, Math.round(S.size));
    let x0 = Math.round(a.x), y0 = Math.round(a.y);
    const x1 = Math.round(b.x), y1 = Math.round(b.y);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    symmetry(ctx, () => {
      let x = x0, y = y0, er = err;
      for (;;) {
        ctx.fillRect(x - Math.floor(s / 2), y - Math.floor(s / 2), s, s);
        if (x === x1 && y === y1) break;
        const e2 = 2 * er;
        if (e2 >= dy) { er += dy; x += sx; }
        if (e2 <= dx) { er += dx; y += sy; }
      }
    });
  } else if (t === 'calligraphy') {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(dist));
    for (let i = 1; i <= n; i++) {
      calligraphyStamp(ctx, { x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n });
    }
  } else {
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = w;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    symmetry(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(drag.mid.x, drag.mid.y);
      ctx.quadraticCurveTo(a.x, a.y, m.x, m.y);
      ctx.stroke();
    });
    drag.mid = m;
  }
  ctx.restore();
}

function sprayTick() {
  if (!drag || drag.tool !== 'spray') return;
  const p = drag.last, r = S.size * 2.2;
  oc.save();
  oc.fillStyle = drag.color;
  symmetry(oc, () => {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      oc.fillRect(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.2, 1.2);
    }
  });
  oc.restore();
}

function shapePath(ctx, type, a, b, shift) {
  let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
  let dx = x1 - x0, dy = y1 - y0;
  if (shift) {
    if (type === 'line' || type === 'arrow') {
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      dx = Math.cos(ang) * len; dy = Math.sin(ang) * len;
    } else {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      dx = (dx < 0 ? -1 : 1) * m; dy = (dy < 0 ? -1 : 1) * m;
    }
    x1 = x0 + dx; y1 = y0 + dy;
  }
  const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(dx), h = Math.abs(dy);
  ctx.beginPath();
  switch (type) {
    case 'line': ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); break;
    case 'arrow': {
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      const ang = Math.atan2(y1 - y0, x1 - x0), hl = Math.max(14, S.size * 4);
      ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(ang - 0.45), y1 - hl * Math.sin(ang - 0.45));
      ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(ang + 0.45), y1 - hl * Math.sin(ang + 0.45));
      break;
    }
    case 'rect': ctx.rect(x, y, w, h); break;
    case 'rrect': ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.22); break;
    case 'ellipse': ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); break;
    case 'triangle': ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); break;
    case 'star': {
      const cx = x + w / 2, cy = y + h / 2;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.4 : 1, ang = -Math.PI / 2 + i * Math.PI / 5;
        const px = cx + Math.cos(ang) * (w / 2) * r, py = cy + Math.sin(ang) * (h / 2) * r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); break;
    }
  }
}

function drawShape(ctx, type, a, b, shift, color, other) {
  ctx.save();
  ctx.lineWidth = S.size; ctx.lineJoin = ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  const lineOnly = type === 'line' || type === 'arrow';
  const mode = lineOnly ? 'outline' : S.fill;
  ctx.fillStyle = mode === 'both' ? other : color;
  symmetry(ctx, () => {
    shapePath(ctx, type, a, b, shift);
    if (mode === 'filled' || mode === 'both') ctx.fill();
    if (mode === 'outline' || mode === 'both') ctx.stroke();
  });
  ctx.restore();
}

function drawGradient(a, b) {
  oc.clearRect(0, 0, S.w, S.h);
  const g = oc.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, drag.color); g.addColorStop(1, drag.other);
  oc.fillStyle = g;
  const r = sel || { x: 0, y: 0, w: S.w, h: S.h };
  oc.fillRect(r.x, r.y, r.w, r.h);
}

function commitOverlay(composite = 'source-over', alpha = S.opacity / 100) {
  const L = activeLayer();
  L.ctx.save();
  L.ctx.globalAlpha = alpha;
  L.ctx.globalCompositeOperation = composite;
  L.ctx.drawImage(overlay, 0, 0);
  L.ctx.restore();
  oc.clearRect(0, 0, S.w, S.h);
  overlay.style.opacity = 1;
  overlay.style.mixBlendMode = 'normal';
  commit();
}

/* ---- vyplnění ---- */
function floodFill(p, hex) {
  const W = S.w, H = S.h;
  const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
  if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
  const src = flatten().getContext('2d').getImageData(0, 0, W, H).data;
  const i0 = (y0 * W + x0) * 4;
  const tr = src[i0], tg = src[i0 + 1], tb = src[i0 + 2], ta = src[i0 + 3];
  const tol = S.tol;
  const match = i => Math.abs(src[i] - tr) <= tol && Math.abs(src[i + 1] - tg) <= tol &&
                     Math.abs(src[i + 2] - tb) <= tol && Math.abs(src[i + 3] - ta) <= tol;
  const lim = sel ? { x0: sel.x, y0: sel.y, x1: sel.x + sel.w, y1: sel.y + sel.h } : { x0: 0, y0: 0, x1: W, y1: H };
  if (x0 < lim.x0 || x0 >= lim.x1 || y0 < lim.y0 || y0 >= lim.y1) return;
  const mask = new Uint8Array(W * H);
  const stack = [x0, y0];
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    let xl = x;
    while (xl >= lim.x0 && !mask[y * W + xl] && match((y * W + xl) * 4)) xl--;
    xl++;
    let up = false, down = false;
    for (let xx = xl; xx < lim.x1 && !mask[y * W + xx] && match((y * W + xx) * 4); xx++) {
      mask[y * W + xx] = 1;
      if (y > lim.y0) {
        const ok = !mask[(y - 1) * W + xx] && match(((y - 1) * W + xx) * 4);
        if (ok && !up) { stack.push(xx, y - 1); up = true; } else if (!ok) up = false;
      }
      if (y < lim.y1 - 1) {
        const ok = !mask[(y + 1) * W + xx] && match(((y + 1) * W + xx) * 4);
        if (ok && !down) { stack.push(xx, y + 1); down = true; } else if (!ok) down = false;
      }
    }
  }
  const L = activeLayer();
  const img = L.ctx.getImageData(0, 0, W, H), d = img.data;
  const [cr, cg, cb] = hexToRgb(hex), sa = S.opacity / 100;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const j = i * 4, da = d[j + 3] / 255;
    const oa = sa + da * (1 - sa);
    d[j] = (cr * sa + d[j] * da * (1 - sa)) / oa;
    d[j + 1] = (cg * sa + d[j + 1] * da * (1 - sa)) / oa;
    d[j + 2] = (cb * sa + d[j + 2] * da * (1 - sa)) / oa;
    d[j + 3] = oa * 255;
  }
  L.ctx.putImageData(img, 0, 0);
  addRecent(hex);
  commit();
}

/* ---- text ---- */
function fontString() {
  return `${S.italic ? 'italic ' : ''}${S.bold ? 'bold ' : ''}${S.fontSize}px "${S.font}"`;
}
function positionText() {
  textInput.style.left = textState.x * S.zoom - 1 + 'px';
  textInput.style.top = textState.y * S.zoom - 1 + 'px';
  textInput.style.font = fontString().replace(/(\d+)px/, (_, n) => n * S.zoom + 'px');
  textInput.style.lineHeight = '1.2';
  textInput.style.color = S.color;
  autoGrowText();
}
function autoGrowText() {
  textInput.style.width = '10px'; textInput.style.height = '10px';
  textInput.style.width = Math.max(80, textInput.scrollWidth + 6) + 'px';
  textInput.style.height = Math.max(S.fontSize * S.zoom * 1.2, textInput.scrollHeight) + 'px';
}
function startText(p) {
  commitText();
  textState = { x: p.x, y: p.y };
  textInput.value = '';
  textInput.style.display = 'block';
  positionText();
  textInput.focus();
}
function commitText() {
  if (!textState) return;
  const val = textInput.value, st = textState;
  textState = null;
  textInput.style.display = 'none'; textInput.value = '';
  if (!val.trim()) return;
  const L = activeLayer();
  if (!L.visible) { toast('Vrstva je skrytá'); return; }
  L.ctx.save();
  L.ctx.font = fontString();
  L.ctx.fillStyle = S.color;
  L.ctx.globalAlpha = S.opacity / 100;
  L.ctx.textBaseline = 'top';
  val.split('\n').forEach((line, i) => L.ctx.fillText(line, st.x, st.y + i * S.fontSize * 1.2));
  L.ctx.restore();
  addRecent(S.color);
  commit();
}
function cancelText() {
  textState = null; textInput.style.display = 'none'; textInput.value = '';
}

/* ============================================================
   Ukazatel – události
   ============================================================ */
let panState = null;

stage.addEventListener('contextmenu', e => e.preventDefault());

workspace.addEventListener('pointerdown', e => {
  if (e.button === 1 || (e.button === 0 && (spaceDown || S.tool === 'hand'))) {
    e.preventDefault();
    panState = { x: e.clientX, y: e.clientY, sl: workspace.scrollLeft, st: workspace.scrollTop };
    stage.classList.add('panning');
    workspace.setPointerCapture(e.pointerId);
  }
});
workspace.addEventListener('pointermove', e => {
  if (!panState) return;
  workspace.scrollLeft = panState.sl - (e.clientX - panState.x);
  workspace.scrollTop = panState.st - (e.clientY - panState.y);
});
const endPan = () => { panState = null; stage.classList.remove('panning'); };
workspace.addEventListener('pointerup', endPan);
workspace.addEventListener('pointercancel', endPan);

stage.addEventListener('pointerdown', e => {
  if (panState || e.button === 1) return;
  if (e.button !== 0 && e.button !== 2) return;
  if (spaceDown || S.tool === 'hand') return;
  e.preventDefault();
  if (textState) commitText();

  const p = getPos(e);
  const secondary = e.button === 2;
  const color = secondary ? S.color2 : S.color;
  const other = secondary ? S.color : S.color2;
  const tool = S.tool;

  if (e.altKey && tool !== 'select') { pickColor(p, secondary); return; }
  if (tool === 'picker') { pickColor(p, secondary); return; }
  if (tool === 'text') { startText(p); return; }
  if (tool === 'select') { selectDown(p, e); return; }

  const L = activeLayer();
  if (!L.visible) { toast('Vrstva je skrytá – nejdřív ji zobrazte'); return; }
  if (tool === 'fill') { floodFill(p, color); return; }

  stage.setPointerCapture(e.pointerId);
  drag = { tool, start: p, last: p, mid: p, color, other, shift: e.shiftKey };

  if (FREEHAND.includes(tool)) {
    if (tool === 'marker') { overlay.style.opacity = S.opacity / 100 * 0.6; overlay.style.mixBlendMode = 'multiply'; }
    else if (tool !== 'eraser') overlay.style.opacity = S.opacity / 100;
    dab(p, strokeWidth(e));
    if (tool === 'spray') { sprayTick(); drag.timer = setInterval(sprayTick, 25); }
  } else if (SHAPES.includes(tool)) {
    overlay.style.opacity = S.opacity / 100;
  } else if (tool === 'gradient') {
    overlay.style.opacity = S.opacity / 100;
  }
});

stage.addEventListener('pointermove', e => {
  const p = getPos(e);
  $('#stPos').textContent = `${Math.floor(p.x)}, ${Math.floor(p.y)} px`;
  moveRing(e);
  if (!drag) return;

  if (drag.mode) { selectMove(p, e); return; }

  const tool = drag.tool;
  if (FREEHAND.includes(tool)) {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      let q = getPos(ev);
      if (e.shiftKey) {
        // rovná čára od posledního bodu po ose
        const dx = Math.abs(q.x - drag.start.x), dy = Math.abs(q.y - drag.start.y);
        q = dx > dy ? { x: q.x, y: drag.start.y } : { x: drag.start.x, y: q.y };
      }
      segment(drag.last, q, ev);
      drag.last = q;
    }
  } else if (SHAPES.includes(tool)) {
    oc.clearRect(0, 0, S.w, S.h);
    drawShape(oc, tool, drag.start, p, e.shiftKey, drag.color, drag.other);
    drag.last = p; drag.shift = e.shiftKey;
  } else if (tool === 'gradient') {
    drawGradient(drag.start, p);
    drag.last = p;
  }
});

function endDraw(e) {
  if (!drag) return;
  if (drag.mode) { selectUp(); return; }
  const d = drag; drag = null;
  if (d.timer) clearInterval(d.timer);
  const tool = d.tool;
  if (FREEHAND.includes(tool)) {
    if (tool !== 'pencil' && tool !== 'calligraphy' && tool !== 'spray') {
      // dokončení křivky
      drag = d;
      const ctx = drawCtx();
      ctx.save();
      if (tool === 'eraser') eraserStyle(ctx); else ctx.strokeStyle = d.color;
      ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = strokeWidth(e);
      symmetry(ctx, () => { ctx.beginPath(); ctx.moveTo(d.mid.x, d.mid.y); ctx.lineTo(d.last.x, d.last.y); ctx.stroke(); });
      ctx.restore();
      drag = null;
    }
    if (tool === 'eraser') commit();
    else if (tool === 'marker') { commitOverlay('multiply', S.opacity / 100 * 0.6); addRecent(d.color); }
    else { commitOverlay(); addRecent(d.color); }
  } else if (SHAPES.includes(tool) || tool === 'gradient') {
    commitOverlay(); addRecent(d.color);
  }
}
stage.addEventListener('pointerup', endDraw);
stage.addEventListener('pointercancel', endDraw);
stage.addEventListener('pointerleave', () => { ring.style.display = 'none'; });

/* ---- select tool ---- */
function selectDown(p, e) {
  stage.setPointerCapture(e.pointerId);
  const inside = sel && p.x >= sel.x && p.x < sel.x + sel.w && p.y >= sel.y && p.y < sel.y + sel.h;
  if (inside) {
    if (!float) {
      if (!activeLayer().visible) { toast('Vrstva je skrytá'); return; }
      liftFloat(e.ctrlKey);
    }
    drag = { mode: 'move', last: p };
  } else {
    commitFloat();
    const sx = clamp(Math.round(p.x), 0, S.w), sy = clamp(Math.round(p.y), 0, S.h);
    sel = { x: sx, y: sy, w: 0, h: 0 };
    drag = { mode: 'new', sx, sy };
  }
}
function selectMove(p) {
  if (drag.mode === 'new') {
    const x1 = clamp(Math.round(p.x), 0, S.w), y1 = clamp(Math.round(p.y), 0, S.h);
    sel = { x: Math.min(drag.sx, x1), y: Math.min(drag.sy, y1), w: Math.abs(x1 - drag.sx), h: Math.abs(y1 - drag.sy) };
  } else if (float) {
    float.x += p.x - drag.last.x; float.y += p.y - drag.last.y;
    drag.last = p;
    sel.x = Math.round(float.x); sel.y = Math.round(float.y);
    redrawFloat();
  }
  updateSelBox();
}
function selectUp() {
  if (drag.mode === 'new' && (sel.w < 2 || sel.h < 2)) sel = null;
  drag = null; updateSelBox();
}

/* ---- kurzor ---- */
function moveRing(e) {
  const show = ['brush', 'eraser', 'marker', 'spray', 'calligraphy', 'pencil'].includes(S.tool) && !spaceDown;
  if (!show) { ring.style.display = 'none'; return; }
  let d = S.size * (S.tool === 'marker' ? 2.5 : S.tool === 'spray' ? 4.4 : S.tool === 'calligraphy' ? 1.4 : 1) * S.zoom;
  d = Math.max(d, 4);
  ring.style.display = 'block';
  ring.style.width = ring.style.height = d + 'px';
  ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
}

workspace.addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setZoom(S.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
}, { passive: false });

/* ============================================================
   Nástroje / UI
   ============================================================ */
function buildToolbar() {
  const box = $('#tools');
  for (const t of TOOLS) {
    if (t === '-') { const s = document.createElement('div'); s.className = 'tool-sep'; box.appendChild(s); continue; }
    const b = document.createElement('button');
    b.className = 'tool'; b.dataset.tool = t.id;
    b.title = t.name + (t.key ? ` (${t.key.toUpperCase()})` : '');
    b.innerHTML = icon(t.id);
    b.onclick = () => setTool(t.id);
    box.appendChild(b);
  }
}

function setTool(id) {
  if (textState) commitText();
  if (id !== 'select') { commitFloat(); sel = null; updateSelBox(); }
  S.tool = id;
  $$('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === id));
  const t = TOOLS.find(x => x.id === id);
  $('#toolName').textContent = t.name;
  $('#toolHint').textContent = t.hint;
  $$('.opt[data-tools]').forEach(o => o.classList.toggle('hidden', !o.dataset.tools.split(' ').includes(id)));
  stage.classList.toggle('pan', id === 'hand');
  if (id === 'hand') ring.style.display = 'none';
}

function bindUI() {
  // paleta
  const pal = $('#palette');
  PALETTE.forEach(c => pal.appendChild(chip(c)));
  renderRecent();
  setColor(S.color, false); setColor(S.color2, true);
  $('#color1').oninput = e => setColor(e.target.value, false);
  $('#color2').oninput = e => setColor(e.target.value, true);
  $('#color1').onchange = e => addRecent(e.target.value);
  $('#color2').onchange = e => addRecent(e.target.value);
  $('#swapColors').onclick = swapColors;

  // možnosti
  const bindRange = (id, out, key) => {
    $(id).oninput = e => { S[key] = +e.target.value; $(out).textContent = e.target.value; };
  };
  bindRange('#size', '#sizeOut', 'size');
  bindRange('#opacity', '#opacityOut', 'opacity');
  bindRange('#tol', '#tolOut', 'tol');
  $('#fillMode').onchange = e => S.fill = e.target.value;
  $('#symmetry').onchange = e => S.sym = e.target.value;
  $('#fontFamily').onchange = e => { S.font = e.target.value; if (textState) positionText(); };
  $('#fontSize').oninput = e => { S.fontSize = clamp(+e.target.value || 32, 6, 400); if (textState) positionText(); };
  $('#fontBold').onchange = e => { S.bold = e.target.checked; if (textState) positionText(); };
  $('#fontItalic').onchange = e => { S.italic = e.target.checked; if (textState) positionText(); };

  textInput.addEventListener('input', autoGrowText);
  textInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') cancelText();
    if (e.key === 'Enter' && e.ctrlKey) commitText();
  });
  textInput.addEventListener('blur', () => setTimeout(commitText, 0));

  // vrstvy
  $('#lAdd').onclick = addLayer;
  $('#lDup').onclick = dupLayer;
  $('#lDel').onclick = delLayer;
  $('#lUp').onclick = () => moveLayer(1);
  $('#lDown').onclick = () => moveLayer(-1);
  $('#lMerge').onclick = mergeDown;
  $('#layerOp').oninput = e => {
    const l = activeLayer();
    l.opacity = +e.target.value; $('#layerOpOut').textContent = e.target.value;
    l.canvas.style.opacity = l.opacity / 100;
  };
  $('#layerOp').onchange = commit;

  // ikony horní lišty
  $('#btnUndo').innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';
  $('#btnRedo').innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>';

  // menu
  $$('.menu').forEach(m => {
    $('.menu-btn', m).onclick = e => {
      e.stopPropagation();
      const open = m.classList.contains('open');
      closeMenus();
      if (!open) m.classList.add('open');
    };
    m.addEventListener('mouseenter', () => { if ($('.menu.open') && !m.classList.contains('open')) { closeMenus(); m.classList.add('open'); } });
  });
  document.addEventListener('click', closeMenus);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (b) runAction(b.dataset.action);
    const f = e.target.closest('[data-filter]');
    if (f) applyFilter(f.dataset.filter);
  });

  // dialogy
  $('#newPreset').onchange = e => { const [w, h] = e.target.value.split('x'); $('#newW').value = w; $('#newH').value = h; };
  $('#dlgNew').addEventListener('close', () => {
    if ($('#dlgNew').returnValue !== 'ok') return;
    const w = clamp(+$('#newW').value || 1280, 1, 8000), h = clamp(+$('#newH').value || 720, 1, 8000);
    newDocument(w, h, $('#newBg').value);
  });
  const rsW = $('#rsW'), rsH = $('#rsH');
  rsW.oninput = () => { if ($('#rsLock').checked) rsH.value = Math.max(1, Math.round(rsW.value * S.h / S.w)); };
  rsH.oninput = () => { if ($('#rsLock').checked) rsW.value = Math.max(1, Math.round(rsH.value * S.w / S.h)); };
  $('#dlgResize').addEventListener('close', () => {
    if ($('#dlgResize').returnValue !== 'ok') return;
    const w = clamp(+rsW.value || S.w, 1, 8000), h = clamp(+rsH.value || S.h, 1, 8000);
    resizeCanvasTo(w, h, $('#rsMode').value === 'scale');
  });

  $('#filePick').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { docFromImage(await loadImage(URL.createObjectURL(f)), f.name); } catch (err) { toast(err.message); }
  };

  // přetažení souboru do okna
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', async e => {
    e.preventDefault();
    const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
    if (!f) return;
    try { insertImageSource(await loadImage(URL.createObjectURL(f))); toast('Obrázek vložen – přesuňte ho myší'); } catch (err) { toast(err.message); }
  });

  // vložení ze schránky
  document.addEventListener('paste', async e => {
    if (isTyping(e.target)) return;
    const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (!it) return;
    e.preventDefault();
    try { insertImageSource(await loadImage(URL.createObjectURL(it.getAsFile()))); } catch (err) { toast(err.message); }
  });

  if (api) api.onOpenFile(async img => {
    if (!confirmDiscard()) return;
    try { docFromImage(await loadImage(img.dataUrl), img.name); } catch (err) { toast(err.message); }
  });

  window.addEventListener('resize', () => applyZoom());
}

function closeMenus() { $$('.menu.open').forEach(m => m.classList.remove('open')); }

function swapColors() {
  const a = S.color, b = S.color2;
  setColor(b, false); setColor(a, true);
}

function openResize() {
  $('#rsW').value = S.w; $('#rsH').value = S.h;
  $('#dlgResize').showModal();
}

function runAction(a) {
  closeMenus();
  switch (a) {
    case 'new': if (confirmDiscard()) $('#dlgNew').showModal(); break;
    case 'open': openImage(); break;
    case 'save-png': saveAs('png'); break;
    case 'save-jpg': saveAs('jpg'); break;
    case 'save-webp': saveAs('webp'); break;
    case 'copy-all': commitFloat(); copyCanvasToClipboard(flatten()); break;
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'cut': cutSelection(); break;
    case 'copy': copySelection(); break;
    case 'paste': pasteFromClipboard(); break;
    case 'select-all': selectAll(); break;
    case 'deselect': deselect(); break;
    case 'delete-sel': deleteSelection(); break;
    case 'crop-sel': cropToSelection(); break;
    case 'resize': openResize(); break;
    case 'flip-h': flipH(); break;
    case 'flip-v': flipV(); break;
    case 'rot-cw': rotate(90); break;
    case 'rot-ccw': rotate(-90); break;
    case 'rot-180': rotate(180); break;
    case 'fill-layer': {
      commitFloat();
      const L = activeLayer(), r = sel || { x: 0, y: 0, w: S.w, h: S.h };
      L.ctx.save(); L.ctx.globalAlpha = S.opacity / 100; L.ctx.fillStyle = S.color;
      L.ctx.fillRect(r.x, r.y, r.w, r.h); L.ctx.restore(); commit(); break;
    }
    case 'clear-layer': { commitFloat(); const L = activeLayer(); clearRegion(L, sel || { x: 0, y: 0, w: S.w, h: S.h }); commit(); break; }
    case 'pixelate': pixelate(); break;
    case 'zoom-in': setZoom(S.zoom * 1.25); break;
    case 'zoom-out': setZoom(S.zoom / 1.25); break;
    case 'zoom-100': setZoom(1); break;
    case 'zoom-fit': fitZoom(false); break;
    case 'toggle-grid':
      S.grid = !S.grid; updateGrid();
      $('[data-action="toggle-grid"]').classList.toggle('on', S.grid); break;
    case 'help': $('#dlgHelp').showModal(); break;
  }
}

/* ============================================================
   Klávesnice
   ============================================================ */
function isTyping(t) {
  return t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
    (t.tagName === 'INPUT' && ['text', 'number'].includes(t.type)));
}

document.addEventListener('keydown', e => {
  if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase();

  if (e.key === ' ') { spaceDown = true; stage.classList.add('pan'); ring.style.display = 'none'; e.preventDefault(); return; }

  if (e.ctrlKey || e.metaKey) {
    const map = {
      z: () => e.shiftKey ? redo() : undo(), y: redo,
      n: () => runAction('new'), o: () => runAction('open'),
      s: () => saveAs('png'),
      c: () => copySelection(), x: () => cutSelection(),
      a: selectAll, g: () => runAction('toggle-grid'),
      '0': () => fitZoom(false), '1': () => setZoom(1),
      '=': () => setZoom(S.zoom * 1.25), '+': () => setZoom(S.zoom * 1.25), '-': () => setZoom(S.zoom / 1.25)
    };
    if (map[k]) { e.preventDefault(); map[k](); }
    return;
  }

  if (e.key === 'Escape') { if (sel || float) deselect(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelection(); return; }
  if (e.key === 'F1') { runAction('help'); return; }
  if (e.key.startsWith('Arrow') && sel && S.tool === 'select') {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!float) liftFloat(false);
    float.x += dx; float.y += dy; sel.x = Math.round(float.x); sel.y = Math.round(float.y);
    redrawFloat(); updateSelBox();
    return;
  }
  if (k === 'x') { swapColors(); return; }
  if (k === '[') { setSize(S.size - (S.size > 20 ? 5 : 1)); return; }
  if (k === ']') { setSize(S.size + (S.size >= 20 ? 5 : 1)); return; }
  if (k === '+' || k === '=') { setZoom(S.zoom * 1.25); return; }
  if (k === '-') { setZoom(S.zoom / 1.25); return; }
  const t = TOOLS.find(x => x !== '-' && x.key && x.key === k);
  if (t) setTool(t.id);
});
document.addEventListener('keyup', e => {
  if (e.key === ' ') { spaceDown = false; stage.classList.toggle('pan', S.tool === 'hand'); }
});

function setSize(v) {
  S.size = clamp(v, 1, 200);
  $('#size').value = S.size; $('#sizeOut').textContent = S.size;
}

/* ============================================================
   Start
   ============================================================ */
buildToolbar();
bindUI();
setTool('brush');
newDocument(1280, 720, 'white');
updateUndoButtons();

// pro testy
window.__pp = { S, runAction, setTool, newDocument, getState: () => ({ layers: S.layers.length, hIdx, hist: history.length, sel, float: !!float }), flatten, floodFill, undo, redo };
})();
