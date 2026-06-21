/* input.js — keyboard + mouse state, normalized to logical actions. */

G.input = {
  keys: {},
  mouse: { x: 0, y: 0, down: false },
  // edge-triggered presses consumed once per frame
  _pressed: {},
  // on-screen touch button states: left/right/jump/shoot
  virtual: { left: false, right: false, jump: false, shoot: false },
  _vjumpEdge: false,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      // Avoid scrolling the page on space/arrows while playing.
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      const k = this._norm(e.key);
      if (!this.keys[k]) this._pressed[k] = true;
      this.keys[k] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[this._norm(e.key)] = false;
    });

    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    };
    canvas.addEventListener('mousemove', toLocal);
    canvas.addEventListener('mousedown', (e) => { toLocal(e); this.mouse.down = true; });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
  },

  _norm(key) {
    if (key === ' ') return 'space';
    if (key.length === 1) return key.toLowerCase();
    return key.toLowerCase(); // arrowleft, enter, escape, etc.
  },

  down(...names) { return names.some(n => this.keys[n]); },

  // consume a one-shot press
  pressed(...names) {
    for (const n of names) {
      if (this._pressed[n]) { this._pressed[n] = false; return true; }
    }
    return false;
  },

  // Set a virtual (on-screen) button. Jump records a one-shot edge on press.
  setVirtual(action, on) {
    if (action === 'jump' && on && !this.virtual.jump) this._vjumpEdge = true;
    this.virtual[action] = on;
  },

  // Call at end of each frame to clear edge buffer for keys not re-pressed.
  endFrame() { this._pressed = {}; this._vjumpEdge = false; },

  // Semantic helpers for the platformer (keyboard OR mouse OR touch buttons)
  left()  { return this.down('a', 'arrowleft') || this.virtual.left; },
  right() { return this.down('d', 'arrowright') || this.virtual.right; },
  jumpPressed() { return this.pressed('w', 'space', 'arrowup') || this._vjumpEdge; },
  shooting() { return this.down('j') || this.mouse.down || this.virtual.shoot; },
  interact() { return this.pressed('e', 'enter'); },
  pausePressed() { return this.pressed('escape', 'p'); },
};
