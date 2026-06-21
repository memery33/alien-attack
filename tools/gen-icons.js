/* gen-icons.js — generate app icons with no image libraries.
   Draws an RGBA buffer (the "alien fragment" mark) and encodes PNG via zlib.
   Run: node tools/gen-icons.js */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = a / 255;
    buf[i]   = Math.round(lerp(buf[i], r, ia));
    buf[i+1] = Math.round(lerp(buf[i+1], g, ia));
    buf[i+2] = Math.round(lerp(buf[i+2], b, ia));
    buf[i+3] = Math.max(buf[i+3], a);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // background: deep navy with a soft radial glow toward center
      const d = Math.hypot(x - cx, y - cy) / (size * 0.5);
      const glow = Math.max(0, 1 - d) ** 2;
      const r = Math.round(lerp(5, 26, glow));
      const g = Math.round(lerp(7, 22, glow));
      const b = Math.round(lerp(13, 48, glow));
      set(x, y, r, g, b, 255);
    }
  }

  // diamond (rotated square) = the alien fragment
  const R = size * 0.30;     // outer radius (manhattan)
  const edge = size * 0.022;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const md = Math.abs(x - cx) + Math.abs(y - cy); // manhattan distance
      if (md <= R) {
        const t = md / R;
        // violet core fading to brighter center
        const r = Math.round(lerp(190, 110, t));
        const g = Math.round(lerp(150, 70, t));
        const b = Math.round(lerp(255, 200, t));
        set(x, y, r, g, b, 255);
      }
      // cyan rim
      if (md > R - edge && md <= R + edge) {
        set(x, y, 54, 224, 216, 230);
      }
      // inner facet line
      if (Math.abs(md - R * 0.5) < edge * 0.6) {
        set(x, y, 220, 240, 255, 90);
      }
    }
  }

  // a couple of orbiting spark dots
  const sparks = [[0.7, -0.55], [-0.62, 0.5], [0.5, 0.62]];
  for (const [sx, sy] of sparks) {
    const px = Math.round(cx + sx * size * 0.36);
    const py = Math.round(cy + sy * size * 0.36);
    const rad = Math.max(2, size * 0.012);
    for (let y = -rad; y <= rad; y++)
      for (let x = -rad; x <= rad; x++)
        if (x * x + y * y <= rad * rad) set(px + x, py + y, 54, 224, 216, 220);
  }

  return buf;
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [180, 192, 512]) {
  const rgba = drawIcon(size);
  const png = encodePNG(size, size, rgba);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`wrote assets/icon-${size}.png (${png.length} bytes)`);
}
