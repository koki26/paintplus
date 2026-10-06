'use strict';
// Vygeneruje build/icon.png (512×512) bez externích závislostí.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const N = 512, SS = 3;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => lerp(v, c2[i], t));

function sdRoundRect(x, y, half, r) {
  const qx = Math.abs(x - N / 2) - (half - r), qy = Math.abs(y - N / 2) - (half - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// vlnovka tvořící tah štětcem
const wave = [];
for (let i = 0; i <= 80; i++) {
  const t = i / 80;
  wave.push({ x: 110 + t * 292, y: 300 - Math.sin(t * Math.PI * 1.6) * 90 - t * 60, t });
}
function distWave(x, y) {
  let best = 1e9, bt = 0;
  for (let i = 0; i < wave.length - 1; i++) {
    const a = wave[i], b = wave[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(x - (a.x + dx * u), y - (a.y + dy * u));
    if (d < best) { best = d; bt = lerp(a.t, b.t, u); }
  }
  return [best, bt];
}
const dots = [[150, 410, [255, 82, 82]], [256, 420, [255, 215, 64]], [362, 410, [105, 240, 174]]];

const raw = Buffer.alloc((N * 4 + 1) * N);
for (let py = 0; py < N; py++) {
  raw[py * (N * 4 + 1)] = 0;
  for (let px = 0; px < N; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const x = px + (sx + 0.5) / SS, y = py + (sy + 0.5) / SS;
      if (sdRoundRect(x, y, 244, 112) > 0) continue;
      let c = [60, 120, 240];
      const [d, t] = distWave(x, y);
      const w = 30 - t * 8;
      if (d < w) c = [255, 255, 255];
      r += c[0]; g += c[1]; b += c[2]; a += 1;
    }
    const o = py * (N * 4 + 1) + 1 + px * 4, n = SS * SS;
    if (a) { raw[o] = r / a; raw[o + 1] = g / a; raw[o + 2] = b / a; raw[o + 3] = 255 * a / n; }
  }
}

const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = buf => { let c = -1; for (const v of buf) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
]);
const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('Ikona vytvořena:', out, png.length, 'B');
