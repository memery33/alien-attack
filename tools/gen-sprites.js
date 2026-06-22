/* gen-sprites.js — generate clean placeholder sprites (transparent PNGs) with
   no image libraries, using signed-distance-field shapes for smooth anti-
   aliased edges + a dark outline. These prove the asset pipeline and look a
   step above the procedural shapes; replace any file with Grok art later, or
   delete it to fall back to procedural. Run: node tools/gen-sprites.js */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ---- PNG (RGBA) encoder ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- tiny SDF raster surface ----
function Surface(w, h) {
  return { w, h, buf: Buffer.alloc(w * h * 4) };
}
function blend(s, x, y, col, a) {
  if (a <= 0 || x < 0 || y < 0 || x >= s.w || y >= s.h) return;
  const i = (y * s.w + x) * 4, ia = a;
  s.buf[i]   = Math.round(s.buf[i]   * (1 - ia) + col[0] * ia);
  s.buf[i+1] = Math.round(s.buf[i+1] * (1 - ia) + col[1] * ia);
  s.buf[i+2] = Math.round(s.buf[i+2] * (1 - ia) + col[2] * ia);
  s.buf[i+3] = Math.min(255, Math.round(s.buf[i+3] + 255 * ia * (1 - s.buf[i+3] / 255)));
}
const sat = (v) => Math.max(0, Math.min(1, v));

// SDF primitives (return signed distance; <0 inside)
function sdCircle(px, py, cx, cy, r) { return Math.hypot(px - cx, py - cy) - r; }
function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - hw + r, dy = Math.abs(py - cy) - hh + r;
  const ax = Math.max(dx, 0), ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r;
}
function sdSeg(px, py, ax, ay, bx, by, r) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const hh = sat((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - bax * hh, pay - bay * hh) - r;
}

// Render a sprite: shapes = [{sdf, col, a?}] painted in order, with a unified
// dark outline grown around their union. Returns PNG buffer.
function render(w, h, shapes, opts = {}) {
  const s = Surface(w, h);
  const outline = opts.outline == null ? 2 : opts.outline;
  const oc = opts.outlineColor || [8, 12, 22];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5, py = y + 0.5;
      // outline pass: union of all solid shapes, grown
      let umin = 1e9;
      for (const sh of shapes) if (!sh.detail) umin = Math.min(umin, sh.sdf(px, py));
      const ocov = sat(0.5 - (umin - outline));
      if (ocov > 0) blend(s, x, y, oc, ocov);
      // colour passes
      for (const sh of shapes) {
        const cov = sat(0.5 - sh.sdf(px, py)) * (sh.a == null ? 1 : sh.a);
        if (cov > 0) blend(s, x, y, sh.col, cov);
      }
    }
  }
  // optional glow dots (additive-ish), drawn after
  if (opts.glow) for (const g of opts.glow) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - g.x, y + 0.5 - g.y);
      const a = sat(1 - d / g.r) ** 2 * (g.a || 0.8);
      if (a > 0) blend(s, x, y, g.col, a);
    }
  }
  return encodePNG(w, h, s.buf);
}

// palette
const C = {
  suitD: [32, 44, 68], suit: [57, 80, 122], suitL: [74, 106, 160], seam: [44, 64, 102],
  metal: [205, 215, 230], dark: [22, 31, 48], visor: [70, 240, 230],
  drone: [122, 166, 255], droneD: [40, 60, 110],
  wisp: [154, 108, 255], wispL: [200, 170, 255],
  turret: [255, 140, 74], turretD: [120, 60, 24],
  green: [75, 224, 138], greenL: [160, 255, 200],
  scrap: [199, 160, 107], scrapD: [120, 90, 50],
  tech: [154, 108, 255], techL: [210, 200, 255],
  guard: [211, 154, 94], guardD: [120, 80, 44], guardL: [240, 190, 130],
  hunter: [60, 66, 82], hunterD: [28, 32, 44], hunterL: [90, 100, 120], eye: [255, 70, 60],
  amber: [255, 181, 71], amberD: [150, 90, 24], steel: [120, 134, 156], steelD: [60, 70, 88],
  red: [220, 70, 86], redD: [110, 30, 40],
  vio: [154, 108, 255], vioD: [70, 40, 120], vioL: [205, 180, 255],
};

const sprites = {};

// ---- PLAYER (156x264), facing right ----
sprites['player'] = () => {
  const w = 156, h = 264, cx = w * 0.46;
  const sh = [];
  // legs
  sh.push({ sdf: (x, y) => sdSeg(x, y, cx - 16, h * 0.6, cx - 16, h * 0.93, 16), col: C.suitD });
  sh.push({ sdf: (x, y) => sdSeg(x, y, cx + 14, h * 0.6, cx + 18, h * 0.93, 16), col: C.suitD });
  // feet
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx - 14, h * 0.95, 20, 9, 5), col: C.dark });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 20, h * 0.95, 20, 9, 5), col: C.dark });
  // backpack
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx - 30, h * 0.42, 12, 30, 6), col: C.seam });
  // torso
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.45, 34, 42, 12), col: C.suit });
  // shoulder highlight
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.34, 34, 12, 10), col: C.suitL, detail: true });
  // chest seam
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.5, 30, 3, 2), col: C.seam, detail: true });
  // arm + gun (front)
  sh.push({ sdf: (x, y) => sdSeg(x, y, cx + 10, h * 0.4, cx + 46, h * 0.48, 11), col: C.suitL });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 60, h * 0.48, 22, 7, 3), col: C.metal });
  // head + helmet
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.2, 26, 24, 11), col: C.dark });
  // visor
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 8, h * 0.19, 12, 7, 4), col: C.visor, detail: true });
  return render(w, h, sh, { outline: 2.4, glow: [{ x: cx + 12, y: h * 0.19, r: 22, col: C.visor, a: 0.5 }] });
};

// ---- DRONE (168x132) saucer, fly ----
sprites['enemy-drone'] = () => {
  const w = 168, h = 132, cx = w / 2, cy = h / 2;
  const sh = [];
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, cy, 70, 22, 22), col: C.droneD });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, cy - 6, 50, 16, 16), col: C.drone });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, cy - 16, 26, 14, 12), col: C.droneD });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx + 18, cy + 2, 8), col: C.visor, detail: true });
  return render(w, h, sh, { outline: 2.4, glow: [{ x: cx + 18, y: cy + 2, r: 16, col: C.visor, a: 0.7 }] });
};

// ---- WISP (144x144) energy orb, fly ----
sprites['enemy-wisp'] = () => {
  const w = 144, h = 144, cx = w / 2, cy = h / 2;
  const sh = [];
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx, cy, 44), col: C.wisp, a: 0.5 });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx, cy, 30), col: C.wisp });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx - 6, cy - 6, 14), col: C.wispL, detail: true });
  return render(w, h, sh, { outline: 0, glow: [
    { x: cx, y: cy, r: 70, col: C.wisp, a: 0.5 },
    { x: cx - 6, y: cy - 6, r: 20, col: C.wispL, a: 0.8 },
  ] });
};

// ---- TURRET (180x180) wall gun, fixed ----
sprites['enemy-turret'] = () => {
  const w = 180, h = 180, cx = w / 2, cy = h * 0.56;
  const sh = [];
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.85, 60, 20, 8), col: C.turretD }); // base
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, cy, 44, 36, 16), col: C.turret });       // housing
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 50, cy - 4, 34, 9, 4), col: C.turretD });// barrel
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx - 6, cy - 4, 12), col: [20, 12, 8], detail: true });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx - 6, cy - 4, 6), col: [255, 70, 60], detail: true });
  return render(w, h, sh, { outline: 2.6, glow: [{ x: cx - 6, y: cy - 4, r: 16, col: [255, 80, 70], a: 0.7 }] });
};

// ---- PICKUPS (96x96) ----
sprites['pickup-health'] = () => {
  const w = 96, h = 96, cx = w / 2, cy = h / 2;
  const sh = [];
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, cy, 30, 30, 10), col: [16, 36, 28] });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, cy, 8, 22, 3), col: C.green, detail: true });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, cy, 22, 8, 3), col: C.green, detail: true });
  return render(w, h, sh, { outline: 2.4, glow: [{ x: cx, y: cy, r: 40, col: C.green, a: 0.35 }] });
};
sprites['pickup-scrap'] = () => {
  const w = 96, h = 96, cx = w / 2, cy = h / 2;
  const sh = [];
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx - 6, cy + 4, 22, 16, 4), col: C.scrapD });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 8, cy - 8, 18, 14, 4), col: C.scrap });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx + 8, cy - 8, 4), col: [40, 28, 16], detail: true });
  return render(w, h, sh, { outline: 2.4 });
};
sprites['pickup-tech'] = () => {
  const w = 96, h = 96, cx = w / 2, cy = h / 2;
  // diamond via rotated box (45°): use circle-of-manhattan approx with roundBox rotated -> emulate with two triangles; use diamond SDF
  const sdDiamond = (x, y, r) => (Math.abs(x - cx) + Math.abs(y - cy)) - r;
  const sh = [];
  sh.push({ sdf: (x, y) => sdDiamond(x, y, 34), col: C.tech });
  sh.push({ sdf: (x, y) => sdDiamond(x, y, 16), col: C.techL, detail: true });
  return render(w, h, sh, { outline: 2.4, glow: [{ x: cx, y: cy, r: 46, col: C.tech, a: 0.4 }] });
};

// ---- GUARD (156x240): riot-armor humanoid with stun rifle, facing right ----
sprites['enemy-guard'] = () => {
  const w = 156, h = 240, cx = w * 0.45;
  const sh = [];
  sh.push({ sdf: (x, y) => sdSeg(x, y, cx - 14, h * 0.6, cx - 16, h * 0.92, 15), col: C.guardD });
  sh.push({ sdf: (x, y) => sdSeg(x, y, cx + 14, h * 0.6, cx + 18, h * 0.92, 15), col: C.guardD });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx - 14, h * 0.95, 19, 8, 4), col: C.dark });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 20, h * 0.95, 19, 8, 4), col: C.dark });
  // torso armor
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.44, 33, 40, 11), col: C.guard });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.32, 33, 11, 9), col: C.guardL, detail: true });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.49, 26, 3, 2), col: C.guardD, detail: true });
  // riot shield on back arm
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx - 30, h * 0.46, 8, 30, 6), col: C.steelD });
  // front arm + stun rifle
  sh.push({ sdf: (x, y) => sdSeg(x, y, cx + 8, h * 0.4, cx + 44, h * 0.5, 10), col: C.guardL });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 58, h * 0.5, 22, 6, 3), col: C.steel });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 76, h * 0.5, 5, 4, 2), col: C.amber, detail: true });
  // helmet + visor
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.19, 24, 22, 10), col: C.dark });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 7, h * 0.18, 11, 6, 3), col: C.amber, detail: true });
  return render(w, h, sh, { outline: 2.4, glow: [{ x: cx + 11, y: h * 0.18, r: 16, col: C.amber, a: 0.4 }] });
};

// ---- HUNTER (180x228): lean bipedal killer robot, red eye, clawed legs ----
sprites['enemy-hunter'] = () => {
  const w = 180, h = 228, cx = w * 0.46;
  const sh = [];
  // digitigrade legs (thigh down-forward, shin down-back to clawed foot)
  for (const s of [-1, 1]) {
    const ox = cx + s * 15;
    sh.push({ sdf: (x, y) => sdSeg(x, y, ox, h * 0.52, ox + 16, h * 0.7, 7), col: C.hunterD });
    sh.push({ sdf: (x, y) => sdSeg(x, y, ox + 16, h * 0.7, ox - 4, h * 0.9, 6), col: C.hunter });
    sh.push({ sdf: (x, y) => sdSeg(x, y, ox - 4, h * 0.9, ox + 12, h * 0.95, 4), col: C.hunterD }); // claw
  }
  // hunched body
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.42, 26, 26, 12), col: C.hunter });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx - 6, h * 0.33, 24, 9, 8), col: C.hunterL, detail: true });
  // back blades
  sh.push({ sdf: (x, y) => sdSeg(x, y, cx - 18, h * 0.3, cx - 34, h * 0.16, 4), col: C.hunterD });
  // forward-thrust head with single red sensor eye
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 22, h * 0.36, 18, 11, 7), col: C.hunterD });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx + 30, h * 0.36, 5), col: C.eye, detail: true });
  // raking front claw-arm
  sh.push({ sdf: (x, y) => sdSeg(x, y, cx + 10, h * 0.42, cx + 40, h * 0.54, 6), col: C.hunter });
  sh.push({ sdf: (x, y) => sdSeg(x, y, cx + 40, h * 0.54, cx + 54, h * 0.48, 3), col: C.hunterL });
  return render(w, h, sh, { outline: 2.4, glow: [{ x: cx + 30, y: h * 0.36, r: 18, col: C.eye, a: 0.6 }] });
};

// ---- BOSS: SENTINEL (280x320) hulking amber-core guardian mech ----
sprites['boss-sentinel'] = () => {
  const w = 280, h = 320, cx = w / 2;
  const sh = [];
  for (const s of [-1, 1]) {
    sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + s * 50, h * 0.78, 26, 50, 14), col: C.steelD }); // legs
    sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + s * 50, h * 0.97, 34, 12, 6), col: C.dark });
    sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + s * 92, h * 0.34, 30, 34, 14), col: C.steel });  // shoulders
  }
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.45, 70, 70, 22), col: C.steel });             // torso
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.3, 70, 22, 18), col: C.steelD, detail: true });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx, h * 0.46, 26), col: C.amberD, detail: true });          // core housing
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx, h * 0.46, 15), col: C.amber, detail: true });           // glowing core
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.14, 30, 22, 12), col: C.steelD });              // head
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.14, 20, 5, 3), col: C.amber, detail: true });   // eye band
  return render(w, h, sh, { outline: 3, glow: [
    { x: cx, y: h * 0.46, r: 50, col: C.amber, a: 0.6 }, { x: cx, y: h * 0.14, r: 22, col: C.amber, a: 0.4 },
  ] });
};

// ---- BOSS: WARDEN (320x384) towering riot-shield war machine, red optics ----
sprites['boss-warden'] = () => {
  const w = 320, h = 384, cx = w / 2;
  const sh = [];
  for (const s of [-1, 1]) {
    sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + s * 46, h * 0.8, 28, 56, 14), col: C.redD });
    sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + s * 46, h * 0.98, 36, 12, 6), col: C.dark });
  }
  // big riot shields as arms
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx - 96, h * 0.5, 26, 76, 12), col: C.steel });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 96, h * 0.5, 26, 76, 12), col: C.steel });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx - 96, h * 0.5, 8, 70, 6), col: C.redD, detail: true });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + 96, h * 0.5, 8, 70, 6), col: C.redD, detail: true });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.46, 60, 78, 20), col: C.steelD });   // torso
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.34, 60, 20, 14), col: C.red, detail: true });
  // visor row of red optics
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.16, 34, 24, 12), col: C.dark });
  for (const ex of [-12, 0, 12]) sh.push({ sdf: (x, y) => sdCircle(x, y, cx + ex, h * 0.16, 5), col: C.eye, detail: true });
  return render(w, h, sh, { outline: 3, glow: [{ x: cx, y: h * 0.16, r: 30, col: C.eye, a: 0.55 }] });
};

// ---- BOSS: COLOSSUS (440x440) massive armored siege-walker, amber seams ----
sprites['boss-colossus'] = () => {
  const w = 440, h = 440, cx = w / 2;
  const sh = [];
  for (const s of [-1, 1]) {
    sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + s * 86, h * 0.74, 44, 84, 18), col: C.steelD }); // legs
    sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + s * 86, h * 0.96, 56, 18, 8), col: C.dark });
    sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + s * 86, h * 0.7, 50, 8, 5), col: C.amber, detail: true }); // knee seam
  }
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.42, 130, 96, 26), col: C.steel });    // huge torso
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.42, 130, 6, 4), col: C.amber, detail: true });
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.3, 130, 8, 5), col: C.amber, detail: true });
  for (const s of [-1, 1]) sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx + s * 150, h * 0.3, 30, 40, 14), col: C.steelD }); // pauldrons
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.16, 40, 26, 14), col: C.steelD });    // head
  sh.push({ sdf: (x, y) => sdRoundBox(x, y, cx, h * 0.16, 28, 6, 3), col: C.amber, detail: true });
  return render(w, h, sh, { outline: 3.4, glow: [
    { x: cx, y: h * 0.42, r: 80, col: C.amber, a: 0.4 }, { x: cx, y: h * 0.16, r: 26, col: C.amber, a: 0.5 },
  ] });
};

// ---- BOSS: OVERMIND (480x520) floating biomechanical brain-core, violet ----
sprites['boss-overmind'] = () => {
  const w = 480, h = 520, cx = w / 2, cy = h * 0.4;
  const sh = [];
  // dangling bio-mechanical tendrils
  for (const s of [-1, 1]) {
    sh.push({ sdf: (x, y) => sdSeg(x, y, cx + s * 40, cy + 70, cx + s * 80, h * 0.92, 10), col: C.vioD });
    sh.push({ sdf: (x, y) => sdSeg(x, y, cx + s * 20, cy + 80, cx + s * 24, h * 0.95, 7), col: C.vioD });
  }
  // metal cradle ring
  sh.push({ sdf: (x, y) => Math.abs(sdCircle(x, y, cx, cy, 120)) - 9, col: C.steelD });
  // brain mass (overlapping lobes)
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx, cy, 96), col: C.vioD });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx - 36, cy - 10, 56), col: C.vio, detail: true });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx + 36, cy - 10, 56), col: C.vio, detail: true });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx, cy + 26, 56), col: C.vio, detail: true });
  // central eye
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx, cy, 30), col: C.dark, detail: true });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx, cy, 16), col: C.vioL, detail: true });
  sh.push({ sdf: (x, y) => sdCircle(x, y, cx, cy, 7), col: C.dark, detail: true });
  return render(w, h, sh, { outline: 3, glow: [
    { x: cx, y: cy, r: 130, col: C.vio, a: 0.45 }, { x: cx, y: cy, r: 30, col: C.vioL, a: 0.7 },
  ] });
};

// ---- write all ----
const outDir = path.join(__dirname, '..', 'assets', 'sprites');
fs.mkdirSync(outDir, { recursive: true });
let total = 0;
for (const [name, fn] of Object.entries(sprites)) {
  const png = fn();
  fs.writeFileSync(path.join(outDir, name + '.png'), png);
  total += png.length;
  console.log(`wrote assets/sprites/${name}.png (${png.length} bytes)`);
}
console.log(`done — ${Object.keys(sprites).length} sprites, ${total} bytes`);
