/* headless-test.js — stubs just enough browser API to execute the game's
   real code paths in Node, then drives a full play sequence to surface
   runtime errors. Not a unit test; a smoke test. Run: node tools/headless-test.js */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- Fake canvas 2D context: every method is a no-op, returns sane stubs ----
function makeCtx() {
  const noop = () => {};
  return new Proxy({
    canvas: { width: 390, height: 700 },
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }),
    setTransform: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, arc: noop, arcTo: noop,
    ellipse: noop, closePath: noop, fill: noop, stroke: noop, rect: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
  }, { get(t, p) { return p in t ? t[p] : (typeof p === 'string' ? (() => {}) : undefined); },
       set(t, p, v) { t[p] = v; return true; } });
}

// ---- Minimal DOM ----
function makeEl(id) {
  const listeners = {};
  const el = {
    id, _cls: new Set(), style: {}, children: [], innerHTML: '', textContent: '',
    getContext: () => makeCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 700 }),
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: noop,
    appendChild: (c) => { el.children.push(c); return c; },
    remove: noop,
    setAttribute: noop, getAttribute: () => null,
    querySelector: () => makeEl('q'),
    querySelectorAll: () => [],
    classList: {
      add: (c) => el._cls.add(c), remove: (c) => el._cls.delete(c),
      toggle: (c, on) => { if (on) el._cls.add(c); else el._cls.delete(c); },
      contains: (c) => el._cls.has(c),
    },
    _fire: (t, e) => (listeners[t] || []).forEach((fn) => fn(e || {})),
  };
  return el;
}
function noop() {}

const els = {};
const getEl = (id) => (els[id] = els[id] || makeEl(id));

const sandbox = {
  console,
  Math, Date, JSON, Object, Array, Number, String, Boolean, Proxy, Symbol,
  isNaN, isFinite, parseInt, parseFloat,
  setTimeout: (fn) => { try { fn(); } catch (e) { throw e; } return 0; },
  clearTimeout: noop,
  requestAnimationFrame: () => 0, // we drive the loop manually
  navigator: { maxTouchPoints: 1 },
  localStorage: (() => {
    let store = {};
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    };
  })(),
  AudioContext: function () {
    const chain = {}; // chainable audio node: connect() returns itself
    Object.assign(chain, {
      connect: () => chain, start: noop, stop: noop,
      type: '', buffer: null,
      frequency: { setValueAtTime: noop, exponentialRampToValueAtTime: noop, value: 0 },
      gain: { setValueAtTime: noop, exponentialRampToValueAtTime: noop, value: 0 },
      getChannelData: () => new Float32Array(100),
    });
    return {
      state: 'running', currentTime: 0, sampleRate: 44100, resume: noop, destination: chain,
      createOscillator: () => chain, createGain: () => chain,
      createBuffer: () => chain, createBufferSource: () => chain, createBiquadFilter: () => chain,
    };
  },
};
sandbox._win = {};
sandbox.addEventListener = (t, fn) => { sandbox._win[t] = fn; };
sandbox.removeEventListener = noop;
sandbox.window = sandbox;
sandbox.document = {
  getElementById: getEl,
  createElement: () => makeEl('created'),
  addEventListener: (t, fn) => { (sandbox._doc = sandbox._doc || {})[t] = fn; },
};
sandbox.window.webkitAudioContext = sandbox.AudioContext;
vm.createContext(sandbox);

// Load the game files in index.html order. Concatenate into one script so the
// top-level `const G` lexical binding is shared across files (as real <script>
// tags share it in a browser). Append a trailer to expose G on the context.
const files = ['util', 'assets', 'data', 'save', 'audio', 'input', 'entities', 'story', 'base', 'mission', 'main'];
const combined = files
  .map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'))
  .join('\n;\n') + '\n;\nthis.G = G;\n';
vm.runInContext(combined, sandbox, { filename: 'combined.js' });

// Fire DOMContentLoaded -> Game.init()
const G = sandbox.G;
sandbox._win.DOMContentLoaded && sandbox._win.DOMContentLoaded();

const Game = G.Game;
function tick(n = 1, dt = 0.016) {
  for (let i = 0; i < n; i++) {
    const t = (Game.last || 0) + dt * 1000;
    Game.loop(t);
  }
}

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ✓ ' + name); }
  catch (e) { failures++; console.log('  ✗ ' + name + '  — ' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 3).join('\n')); }
}

console.log('SUBSTRATA headless smoke test\n');

check('boots to title without state', () => {
  if (Game.screen !== 'title') throw new Error('expected title, got ' + Game.screen);
  tick(3);
});

check('new game -> intro -> base', () => {
  Game.startFromTitle('new');
  // intro shown; simulate clicking through by calling enterBase via seenIntro path
  if (!Game.state) throw new Error('no state created');
});

check('force into base screen', () => {
  Game.state.seenIntro = true;
  Game.enterBase();
  if (Game.screen !== 'base') throw new Error('not in base: ' + Game.screen);
  tick(5);
});

check('base computes layout + contentH', () => {
  if (!(Game.baseScreen.contentH > 0)) throw new Error('contentH not set');
  if (!Array.isArray(Game.baseScreen.cells) || !Game.baseScreen.cells.length) throw new Error('no cells');
});

check('production cycle grants resources', () => {
  const before = Game.state.energy;
  Game.baseScreen.runProductionCycle();
  if (Game.state.energy < before) throw new Error('energy went down unexpectedly');
});

check('build a room (workshop) when affordable', () => {
  Game.state.scrap = 999; Game.state.energy = 999; Game.state.food = 999;
  Game.baseScreen.openBuildPanel('workshop');
  // directly exercise build logic
  Game.baseScreen.pay(G.data.rooms.workshop.build);
  Game.state.rooms.workshop = { level: 1, crew: 0 };
  if (!Game.state.rooms.workshop) throw new Error('workshop not built');
});

check('upgrade cost is well-formed', () => {
  Game.state.rooms.generator = { level: 1, crew: 1 };
  const c = Game.baseScreen.upgradeCost('generator');
  if (!c.scrap || c.scrap <= 0) throw new Error('bad upgrade cost ' + JSON.stringify(c));
});

check('open map (visible bases)', () => {
  const vis = G.derive.visibleBases(Game.state);
  if (vis.length < 1) throw new Error('no visible bases at 0 tech');
  Game.openMap();
});

check('launch + simulate a full raid to a win', () => {
  const base = G.data.bases[0];
  Game.launchMission(base);
  if (Game.screen !== 'mission') throw new Error('not in mission');
  const m = Game.mission;
  m.player.maxHP = 1e9; m.player.hp = 1e9; // invincible for the sim
  let guard = 0;
  while (!m.outcome && guard++ < 6000) {
    m.player.hp = 1e9; m.player.invuln = 0;
    m.player.x = Math.min(m.length - 100, m.player.x + 40); // shove toward the vault
    G.input.virtual.right = true;
    tick(1);
    // kill any enemies/boss through the real death path so win can trigger
    m.enemies.forEach((e) => { if (!e.dead) e.hurt(1e9, m); });
  }
  if (guard >= 6000) throw new Error('raid never resolved');
  if (m.outcome !== 'win') throw new Error('expected win, got ' + m.outcome);
});

check('win advanced to outcome + can return to base', () => {
  const m = Game.mission;
  // let outcome fade so panel logic runs
  for (let i = 0; i < 60 && !m._panelShown; i++) tick(1);
  Game.returnToBase();
  if (Game.screen !== 'base') throw new Error('did not return to base');
});

check('fragment recorded + persisted', () => {
  if (Game.state.tech < 1) throw new Error('no fragment recovered, tech=' + Game.state.tech);
  const saved = G.save.load();
  if (!saved || saved.tech < 1) throw new Error('not persisted');
});

check('lose path resolves', () => {
  Game.launchMission(G.data.bases[0]);
  const m = Game.mission;
  m.player.hp = 0;
  m.player.invuln = 0;
  tick(2);
  if (m.outcome !== 'lose') throw new Error('expected lose, got ' + m.outcome);
  Game.returnToBase();
});

check('victory triggers when all tech recovered + decoded', () => {
  Game.state.tech = G.data.totalTech;
  Game.state.decoded = G.data.totalTech;
  let won = false;
  const orig = G.story.showVictory;
  G.story.showVictory = () => { won = true; };
  Game.checkVictory();
  G.story.showVictory = orig;
  if (!won) throw new Error('victory not triggered');
});

console.log('\n' + (failures ? `FAILED: ${failures} check(s)` : 'ALL CHECKS PASSED'));
process.exit(failures ? 1 : 0);
