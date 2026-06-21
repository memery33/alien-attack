/* base.js — the Bunker hub screen (Fallout-Shelter-style management).
   Renders a cross-section of rooms on the canvas and routes taps to DOM
   management panels for building, upgrading, and assigning crew. */

(function () {
  const U = G.util;

  class BaseScreen {
    constructor(game) {
      this.game = game;
      this.cells = [];     // tappable room cells {x,y,w,h,key|slotIndex}
      this.cycleT = 0;     // production timer
      this.scrollY = 0;
      this.layoutDirty = true;
    }

    get state() { return this.game.state; }

    enter() {
      G.ui.hudVisible(true);
      this.game.refreshHUD();
      this.layoutDirty = true;
      G.ui.toast('Bunker — assign crew & build rooms. Tap the hatch to raid.');
    }

    // The ordered set of rooms to display: built rooms + buildable empty slots.
    roomOrder() {
      // Fixed display order; unbuilt ones render as "Build" slots.
      return ['command', 'bunks', 'generator', 'kitchen', 'workshop', 'armory', 'medbay', 'lab'];
    }

    computeLayout(cw, ch) {
      this.cells = [];
      const order = this.roomOrder();
      const pad = 14;
      const top = 64;            // below HUD
      const cols = cw < 620 ? 1 : 2;
      const cellW = (cw - pad * (cols + 1)) / cols;
      const cellH = 78;
      order.forEach((key, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = pad + col * (cellW + pad);
        const y = top + row * (cellH + pad);
        this.cells.push({ key, x, y, w: cellW, h: cellH });
      });
      // hatch button (go to surface map) at the bottom
      const rows = Math.ceil(order.length / cols);
      this.hatch = {
        x: pad, y: top + rows * (cellH + pad) + 4,
        w: cw - pad * 2, h: 46,
      };
      this.contentH = this.hatch.y + this.hatch.h + 16;
      this.layoutDirty = false;
    }

    update(dt, cw, ch) {
      if (this.layoutDirty) this.computeLayout(cw, ch);
      // production cycle
      this.cycleT += dt;
      const period = G.data.tune.cycleSeconds;
      if (this.cycleT >= period) {
        this.cycleT -= period;
        this.runProductionCycle();
      }
    }

    runProductionCycle() {
      const s = this.state;
      let gained = {};
      for (const key of Object.keys(s.rooms)) {
        const def = G.data.rooms[key];
        if (!def.produces) continue;
        const room = s.rooms[key];
        const amt = Math.round((room.crew || 0) * def.ratePerCrew * (1 + (room.level - 1) * 0.5));
        if (amt > 0) {
          s[def.produces] = (s[def.produces] || 0) + amt;
          gained[def.produces] = (gained[def.produces] || 0) + amt;
        }
      }
      // crew eats rations
      const upkeep = s.crew;
      s.food = Math.max(0, s.food - upkeep);
      this.game.refreshHUD();
      this.game.persist();
      const parts = Object.entries(gained).map(([k, v]) => `+${v} ${k}`);
      if (parts.length) G.ui.toast(parts.join('  ') + (s.food === 0 ? '  ⚠ rations empty!' : ''), s.food === 0 ? 'warn' : '');
    }

    draw(ctx, cw, ch) {
      if (this.layoutDirty) this.computeLayout(cw, ch);
      ctx.clearRect(0, 0, cw, ch);
      // dirt/rock backdrop
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, '#0a0f18'); g.addColorStop(1, '#070a11');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);

      ctx.save();
      ctx.translate(0, -this.scrollY);

      const s = this.state;
      for (const cell of this.cells) {
        const built = !!s.rooms[cell.key];
        const def = G.data.rooms[cell.key];
        this.drawRoomCell(ctx, cell, def, built ? s.rooms[cell.key] : null);
      }
      // hatch
      const h = this.hatch;
      ctx.fillStyle = '#10202e';
      ctx.strokeStyle = '#36e0d8'; ctx.lineWidth = 1.5;
      this.roundRect(ctx, h.x, h.y, h.w, h.h, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#cfe6ff';
      ctx.font = '600 16px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▲  SURFACE HATCH — Launch a Raid', h.x + h.w / 2, h.y + h.h / 2);

      ctx.restore();
    }

    drawRoomCell(ctx, cell, def, room) {
      const { x, y, w, h } = cell;
      ctx.save();
      // panel
      ctx.fillStyle = room ? '#101a2a' : '#0c121c';
      ctx.strokeStyle = room ? def.color : '#1f3350';
      ctx.lineWidth = 1.4;
      this.roundRect(ctx, x, y, w, h, 8); ctx.fill();
      ctx.globalAlpha = room ? 0.9 : 0.5; ctx.stroke(); ctx.globalAlpha = 1;

      // left color tab + icon
      ctx.fillStyle = def.color; ctx.globalAlpha = room ? 1 : 0.35;
      ctx.fillRect(x, y, 5, h);
      ctx.globalAlpha = 1;
      ctx.font = '22px serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = room ? '#fff' : '#41597d';
      ctx.fillText(def.icon, x + 14, y + 12);

      // name + level
      ctx.font = '600 14px Segoe UI, sans-serif';
      ctx.fillStyle = room ? '#eaf3ff' : '#5d7299';
      ctx.fillText(def.name, x + 44, y + 12);

      ctx.font = '12px Segoe UI, sans-serif';
      if (room) {
        ctx.fillStyle = def.color;
        ctx.fillText('LVL ' + room.level + (def.maxLevel ? '/' + def.maxLevel : ''), x + 44, y + 32);
        // crew
        ctx.fillStyle = '#8fb0d8';
        const crewTxt = def.produces || ['generator','kitchen','workshop'].includes(def.key)
          ? `👤 ${room.crew}` : '';
        if (def.produces) ctx.fillText(`👤 ${room.crew}  →  ${def.produces}`, x + 44, y + 50);
        else if (def.key === 'bunks') ctx.fillText(`max crew ${G.derive.maxCrew(this.state)}`, x + 44, y + 50);
        else if (def.key === 'armory') ctx.fillText(`weapon: ${G.derive.weapon(this.state).name}`, x + 44, y + 50);
        else if (def.key === 'medbay') ctx.fillText(`max HP ${G.derive.maxHP(this.state)}`, x + 44, y + 50);
        else if (def.key === 'lab') ctx.fillText(`decoded ${this.state.decoded}/${this.state.tech}`, x + 44, y + 50);
        else if (def.key === 'command') ctx.fillText(`sites visible: ${G.derive.visibleBases(this.state).length}`, x + 44, y + 50);
      } else {
        ctx.fillStyle = '#5d7299';
        ctx.fillText('Tap to build · ' + U.fmtCost(def.build), x + 44, y + 36);
      }
      ctx.restore();
    }

    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    handleTap(mx, my) {
      const y = my + this.scrollY;
      // hatch?
      if (this.hatch && this.pointIn(mx, y, this.hatch)) {
        G.audio.ui();
        this.game.openMap();
        return;
      }
      for (const cell of this.cells) {
        if (this.pointIn(mx, y, cell)) {
          G.audio.ui();
          const built = !!this.state.rooms[cell.key];
          if (built) this.openRoomPanel(cell.key);
          else this.openBuildPanel(cell.key);
          return;
        }
      }
    }

    pointIn(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

    canAfford(cost) {
      return Object.entries(cost).every(([k, v]) => (this.state[k] || 0) >= v);
    }
    pay(cost) {
      for (const [k, v] of Object.entries(cost)) this.state[k] -= v;
    }

    openBuildPanel(key) {
      const def = G.data.rooms[key];
      const can = this.canAfford(def.build);
      const p = G.ui.show(`
        <h2>${def.icon} ${def.name}</h2>
        <p class="sub">${def.desc}</p>
        <div class="card">
          <p>${def.perk}</p>
          <div class="cost ${can ? '' : 'cant'}">Cost: <b>${U.fmtCost(def.build)}</b></div>
        </div>
        <div class="footer-actions">
          <button class="btn" id="close">Back</button>
          <button class="btn primary" id="build" ${can ? '' : 'disabled'}>Build</button>
        </div>
      `);
      p.querySelector('#close').onclick = () => { G.audio.ui(); G.ui.hide(); };
      p.querySelector('#build').onclick = () => {
        if (!this.canAfford(def.build)) { G.audio.deny(); return; }
        this.pay(def.build);
        this.state.rooms[key] = { level: 1, crew: 0 };
        G.audio.build();
        this.game.refreshHUD(); this.game.persist();
        G.ui.hide();
        G.ui.toast(`${def.name} built.`);
        this.openRoomPanel(key);
      };
    }

    upgradeCost(key) {
      const room = this.state.rooms[key];
      const def = G.data.rooms[key];
      const lvl = room.level;
      // cost scales with level off the build cost (or a default)
      const baseCost = Object.keys(def.build).length ? def.build : { scrap: 20 };
      const out = {};
      for (const [k, v] of Object.entries(baseCost)) out[k] = Math.round(v * (1 + lvl * 0.8));
      if (!out.scrap) out.scrap = Math.round(15 * (1 + lvl * 0.8));
      return out;
    }

    openRoomPanel(key) {
      const def = G.data.rooms[key];
      const room = this.state.rooms[key];
      const s = this.state;
      const maxed = def.maxLevel && room.level >= def.maxLevel;
      const upCost = maxed ? null : this.upgradeCost(key);
      const canUp = upCost && this.canAfford(upCost);
      const producer = !!def.produces;
      const idle = G.derive.idleCrew(s);

      let special = '';
      if (key === 'lab' && s.tech > s.decoded) {
        special = `
          <div class="divider"></div>
          <div class="card">
            <h3>Decode a fragment</h3>
            <p>You have <b>${s.tech - s.decoded}</b> undecoded fragment(s). Decoding reveals
            program data and yields a research bonus.</p>
            <button class="btn primary" id="decode">Decode (1 fragment)</button>
          </div>`;
      }

      const crewControls = producer ? `
        <div class="divider"></div>
        <div class="card">
          <h3>Assigned crew: ${room.crew}</h3>
          <p>Idle crew available: <b>${idle}</b>. More crew = more ${def.produces} per cycle.</p>
          <div class="row">
            <button class="btn" id="unassign" ${room.crew <= 0 ? 'disabled' : ''}>– Remove</button>
            <button class="btn" id="assign" ${idle <= 0 ? 'disabled' : ''}>+ Assign</button>
          </div>
        </div>` : '';

      const p = G.ui.show(`
        <h2>${def.icon} ${def.name}</h2>
        <p class="sub">Level ${room.level}${def.maxLevel ? ' / ' + def.maxLevel : ''} — ${def.perk}</p>
        ${producer ? `<div class="meta">Producing ~${Math.round((room.crew) * def.ratePerCrew * (1 + (room.level - 1) * 0.5))} ${def.produces}/cycle</div>` : ''}
        ${crewControls}
        ${special}
        <div class="divider"></div>
        <div class="footer-actions">
          <button class="btn" id="close">Back</button>
          ${maxed
            ? `<button class="btn" disabled>Max level</button>`
            : `<button class="btn primary" id="upgrade" ${canUp ? '' : 'disabled'}>Upgrade · ${U.fmtCost(upCost)}</button>`}
        </div>
      `);

      p.querySelector('#close').onclick = () => { G.audio.ui(); G.ui.hide(); };
      const up = p.querySelector('#upgrade');
      if (up) up.onclick = () => {
        if (!this.canAfford(upCost)) { G.audio.deny(); return; }
        this.pay(upCost); room.level++;
        G.audio.build(); this.game.refreshHUD(); this.game.persist();
        this.openRoomPanel(key);
      };
      const asn = p.querySelector('#assign');
      if (asn) asn.onclick = () => {
        if (G.derive.idleCrew(s) <= 0) { G.audio.deny(); return; }
        room.crew++; G.audio.ui(); this.game.persist(); this.openRoomPanel(key);
      };
      const un = p.querySelector('#unassign');
      if (un) un.onclick = () => {
        if (room.crew <= 0) return;
        room.crew--; G.audio.ui(); this.game.persist(); this.openRoomPanel(key);
      };
      const dec = p.querySelector('#decode');
      if (dec) dec.onclick = () => {
        if (s.tech <= s.decoded) return;
        s.decoded++;
        s.scrap += 30; s.energy += 20;
        G.audio.techGet();
        G.ui.toast('Fragment decoded. +30 scrap +20 energy');
        this.game.refreshHUD(); this.game.persist();
        this.openRoomPanel(key);
      };
    }
  }

  G.BaseScreen = BaseScreen;
})();
