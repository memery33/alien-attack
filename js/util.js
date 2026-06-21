/* util.js — small shared helpers, no dependencies.
   Everything hangs off the global `G` namespace so classic <script> tags work
   without a build step (file:// friendly). */

const G = {};

G.util = {
  clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(G.util.rand(a, b + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p) { return Math.random() < p; },
  dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); },
  aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  },
  // Format a cost object like {scrap:10, energy:5} into "10 scrap · 5 energy"
  fmtCost(cost) {
    return Object.entries(cost)
      .map(([k, v]) => `${v} ${k}`)
      .join(' · ');
  },
  id() { return Math.random().toString(36).slice(2, 9); },
};

// A handful of sci-fi recruit names to draw from.
G.NAMES = [
  'Vega', 'Korhonen', 'Six', 'Dr. Aldous', 'Renn', 'Mox', 'Sable',
  'Pike', 'Okafor', 'Juno', 'Cass', 'Bishop', 'Lor', 'Wren', 'Drake',
  'Echo', 'Nadia', 'Reyes', 'Tov', 'Halsey', 'Marlow', 'Quill',
];
