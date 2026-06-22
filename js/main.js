/* main.js — game orchestrator: state, screen routing, the loop, responsive
   canvas, touch wiring, HUD, and the surface map (raid select). */

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const Game = {
    state: null,
    screen: 'title',     // title | intro | base | mission
    baseScreen: null,
    mission: null,
    cw: 960, ch: 540,
    last: 0,

    init() {
      this.initNative();
      G.input.init(canvas);
      this.setupPointer();
      this.setupTouchControls();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));

      this.baseScreen = new G.BaseScreen(this);

      const save = G.save.load();
      G.story.showTitle((choice) => this.startFromTitle(choice), !!save);

      requestAnimationFrame((t) => this.loop(t));
    },

    // When wrapped by Capacitor (App Store build), hide the native splash once
    // we're ready and style the status bar. No-ops in a plain browser/PWA.
    initNative() {
      const cap = window.Capacitor;
      if (!cap || !cap.Plugins) return;
      try {
        const { SplashScreen, StatusBar } = cap.Plugins;
        if (StatusBar) { StatusBar.setStyle({ style: 'DARK' }); StatusBar.hide(); }
        if (SplashScreen) setTimeout(() => SplashScreen.hide(), 400);
      } catch (e) { /* plugins optional */ }
    },

    startFromTitle(choice) {
      const existing = G.save.load();
      if (choice === 'continue' && existing) {
        this.state = existing;
        G.ui.hide();
        this.enterBase();
      } else {
        this.state = G.save.newState();
        G.save.write(this.state);
        if (this.state.seenIntro) { G.ui.hide(); this.enterBase(); }
        else {
          G.story.showIntro(() => {
            this.state.seenIntro = true;
            this.persist();
            G.ui.hide();
            this.enterBase();
          });
        }
      }
    },

    // ---------- screen transitions ----------
    enterBase() {
      this.screen = 'base';
      this.mission = null;
      this.setTouchControls(false);
      this.baseScreen.enter();
      if (G.audio.startMusic) G.audio.startMusic('bunker');
      this.checkVictory();
    },

    returnToBase() { this.enterBase(); },

    openMap() {
      const visible = G.derive.visibleBases(this.state);
      const cards = visible.map(b => {
        const cleared = this.state.clearedBases[b.key];
        const reward = Object.entries(b.reward).map(([k, v]) => `${v} ${k}`).join(' · ');
        return `
          <div class="card">
            <h3>${b.name} ${cleared ? '<span style="color:var(--ok);font-size:12px">✓ cleared</span>' : ''}</h3>
            <div class="meta">Threat ${'◆'.repeat(b.difficulty)}${'◇'.repeat(4 - b.difficulty)} · ${cleared ? 'fragment recovered' : '✦ 1 fragment'}</div>
            <p>${b.desc}</p>
            <p style="color:var(--ink-dim);font-size:11.5px">Salvage: ${reward}</p>
            <button class="btn primary full" data-base="${b.key}">${cleared ? 'Re-run (salvage)' : 'Launch raid ▶'}</button>
          </div>`;
      }).join('');
      const locked = G.data.bases.length - visible.length;
      const p = G.ui.show(`
        <h2>Surface Map — <span class="accent">Underground Sites</span></h2>
        <p class="sub">Recover alien fragments: <b>${this.state.tech}/${G.data.totalTech}</b>. ${locked ? `${locked} site(s) still need more fragments to locate.` : 'All sites located.'}</p>
        <div class="row">${cards}</div>
        <div class="footer-actions">
          <button class="btn" id="close">Back to Bunker</button>
        </div>
      `);
      p.querySelector('#close').onclick = () => { G.audio.ui(); G.ui.hide(); };
      p.querySelectorAll('[data-base]').forEach(btn => {
        btn.onclick = () => {
          const key = btn.getAttribute('data-base');
          const baseDef = G.data.bases.find(b => b.key === key);
          // food gate: need crew fed-ish; just a soft warning
          G.audio.ui();
          G.ui.hide();
          this.launchMission(baseDef);
        };
      });
    },

    launchMission(baseDef) {
      this.screen = 'mission';
      this.mission = new G.Mission(this, baseDef);
      this.mission.enter(this.cw, this.ch);
      this.setTouchControls(true);
      if (G.audio.startMusic) G.audio.startMusic(baseDef.biome || 'silo');
    },

    checkVictory() {
      if (this.state.tech >= G.data.totalTech && this.state.decoded >= G.data.totalTech) {
        G.story.showVictory(this.state, () => {
          G.save.wipe();
          this.state = G.save.newState();
          this.state.seenIntro = true;
          G.save.write(this.state);
          this.enterBase();
        });
      } else if (this.state.tech >= G.data.totalTech && this.state.decoded < G.data.totalTech) {
        G.ui.toast('All fragments recovered! Decode them all in the Research Lab to finish.', 'warn');
      }
    },

    // ---------- loop ----------
    loop(t) {
      const dt = Math.min(0.05, (t - this.last) / 1000) || 0;
      this.last = t;

      if (this.screen === 'base') {
        this.baseScreen.update(dt, this.cw, this.ch);
        this.baseScreen.draw(ctx, this.cw, this.ch);
      } else if (this.screen === 'mission' && this.mission) {
        this.mission.update(dt, this.cw, this.ch);
        this.mission.draw(ctx, this.cw, this.ch);
      } else {
        // title/intro: subtle animated backdrop
        this.drawIdleBackdrop(t);
      }

      G.input.endFrame();
      requestAnimationFrame((tt) => this.loop(tt));
    },

    drawIdleBackdrop(t) {
      ctx.clearRect(0, 0, this.cw, this.ch);
      const g = ctx.createLinearGradient(0, 0, 0, this.ch);
      g.addColorStop(0, '#0a1424'); g.addColorStop(1, '#04060c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.cw, this.ch);
      // drifting starfield / dust
      ctx.fillStyle = 'rgba(154,108,255,0.5)';
      for (let i = 0; i < 40; i++) {
        const x = (i * 137.5 + t * 0.02) % this.cw;
        const y = (i * 53.3 + Math.sin(t * 0.0005 + i) * 20) % this.ch;
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 0.001 + i);
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    },

    // ---------- HUD / persistence ----------
    refreshHUD() {
      const s = this.state; if (!s) return;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('res-scrap', Math.floor(s.scrap));
      set('res-energy', Math.floor(s.energy));
      set('res-food', Math.floor(s.food));
      set('res-tech', s.tech);
      set('res-tech-total', G.data.totalTech);
      set('res-crew', s.crew);
    },

    persist() { if (this.state) G.save.write(this.state); },

    // ---------- input plumbing ----------
    setupPointer() {
      const toLocal = (clientX, clientY) => {
        const r = canvas.getBoundingClientRect();
        return {
          x: (clientX - r.left) * (this.cw / r.width),
          y: (clientY - r.top) * (this.ch / r.height),
        };
      };
      const maxScroll = () => Math.max(0, (this.baseScreen.contentH || 0) - this.ch);

      // Desktop click = tap on the base screen.
      canvas.addEventListener('click', (e) => {
        if (this.screen !== 'base') return;
        const { x, y } = toLocal(e.clientX, e.clientY);
        this.baseScreen.handleTap(x, y);
      });
      // Desktop wheel scrolls the bunker list.
      canvas.addEventListener('wheel', (e) => {
        if (this.screen !== 'base') return;
        e.preventDefault();
        this.baseScreen.scrollY = G.util.clamp(this.baseScreen.scrollY + e.deltaY, 0, maxScroll());
      }, { passive: false });

      // Touch: drag to scroll, tap (no drag) to interact.
      let startX = 0, startY = 0, startScroll = 0, moved = false;
      canvas.addEventListener('touchstart', (e) => {
        if (this.screen !== 'base' || !e.touches[0]) return;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        startScroll = this.baseScreen.scrollY; moved = false;
      }, { passive: true });
      canvas.addEventListener('touchmove', (e) => {
        if (this.screen !== 'base' || !e.touches[0]) return;
        const dy = e.touches[0].clientY - startY;
        const dx = e.touches[0].clientX - startX;
        if (Math.abs(dy) > 8 || Math.abs(dx) > 8) moved = true;
        if (moved) {
          e.preventDefault();
          this.baseScreen.scrollY = G.util.clamp(startScroll - dy, 0, maxScroll());
        }
      }, { passive: false });
      canvas.addEventListener('touchend', (e) => {
        if (this.screen !== 'base' || moved) return;
        const { x, y } = toLocal(startX, startY);
        this.baseScreen.handleTap(x, y);
      });
    },

    setupTouchControls() {
      const map = {
        'tc-left': 'left', 'tc-right': 'right', 'tc-jump': 'jump', 'tc-shoot': 'shoot',
      };
      Object.entries(map).forEach(([id, action]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const press = (e) => { e.preventDefault(); G.input.setVirtual(action, true); };
        const release = (e) => { e.preventDefault(); G.input.setVirtual(action, false); };
        el.addEventListener('touchstart', press, { passive: false });
        el.addEventListener('touchend', release, { passive: false });
        el.addEventListener('touchcancel', release, { passive: false });
        el.addEventListener('mousedown', press);
        el.addEventListener('mouseup', release);
        el.addEventListener('mouseleave', release);
      });
      const pause = document.getElementById('tc-pause');
      if (pause) pause.addEventListener('click', () => { if (this.mission) this.mission.togglePause(); });
    },

    setTouchControls(on) {
      const el = document.getElementById('touch-controls');
      if (el) el.classList.toggle('hidden', !on || !this.isTouch());
    },

    isTouch() {
      return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    },

    // ---------- responsive canvas ----------
    resize() {
      const frame = document.getElementById('game-frame');
      const rect = frame.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cw = Math.round(rect.width);
      this.ch = Math.round(rect.height);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.baseScreen) this.baseScreen.layoutDirty = true;
      if (this.mission) {
        // recompute zoom + ground anchor for the new size
        this.mission.cw = this.cw; this.mission.ch = this.ch;
        if (this.mission.computeView) this.mission.computeView();
      }
    },
  };

  G.Game = Game;
  window.addEventListener('DOMContentLoaded', () => Game.init());
})();
