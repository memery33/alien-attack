/* base.js — the Bunker hub screen (Fallout-Shelter-style management).
   Renders a cross-section of rooms on the canvas and routes taps to DOM
   management panels for building, upgrading, and assigning crew. */

(function () {
  const U = G.util;

  // Cheap deterministic pseudo-random for static dirt speckle / pebbles.
  function hash(n) {
    const s = Math.sin(n * 91.7 + 17.3) * 43758.5453;
    return s - Math.floor(s);
  }

  class BaseScreen {
    constructor(game) {
      this.game = game;
      this.cells = [];     // tappable room cells {x,y,w,h,key|slotIndex}
      this.cycleT = 0;     // production timer
      this.animT = 0;      // cosmetic animation clock
      this.scrollY = 0;
      this.layoutDirty = true;
      this.elev = null;    // elevator car state machine {y,idx,target,dwell,rider}
      this.floaters = [];  // rising "+N resource" popups on production ticks
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
      const pad = 12;
      const top = 52;            // below HUD
      const hatchH = 40;
      const gap = 9;
      const shaftW = 24;         // elevator shaft down the left side

      // Rooms tile into a grid; landscape gets more columns.
      const cols = cw >= 820 ? 4 : cw >= 600 ? 3 : 2;
      const rows = Math.ceil(order.length / cols);
      const x0 = pad + shaftW + gap;
      const cellW = (cw - pad - x0 - gap * (cols - 1)) / cols;
      // Fit room height to the space between HUD and hatch (no scroll in landscape).
      const availH = ch - top - hatchH - pad - 10;
      const cellH = U.clamp((availH - gap * (rows - 1)) / rows, 86, 150);

      order.forEach((key, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = x0 + col * (cellW + gap);
        const y = top + row * (cellH + gap);
        this.cells.push({ key, x, y, w: cellW, h: cellH });
      });

      const gridBottom = top + rows * (cellH + gap) - gap;
      this.shaft = { x: pad, y: top, w: shaftW, h: gridBottom - top };
      this.hatch = { x: pad, y: gridBottom + 8, w: cw - pad * 2, h: hatchH };
      this.contentH = this.hatch.y + this.hatch.h + 12;
      // Elevator floor stops = vertical centre of each room row.
      this.floorYs = [];
      for (let r = 0; r < rows; r++) this.floorYs.push(top + r * (cellH + gap) + cellH / 2);
      this.elev = null; // rebuilt to match new floor positions
      this.layoutDirty = false;
    }

    update(dt, cw, ch) {
      if (this.layoutDirty) this.computeLayout(cw, ch);
      this.animT += dt;
      this.updateElevator(dt);
      for (const f of this.floaters) { f.y -= 0.4; f.life -= dt; }
      if (this.floaters.length) this.floaters = this.floaters.filter(f => f.life > 0);
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
          const cell = this.cells.find(c => c.key === key);
          if (cell) this.floaters.push({ x: cell.x + cell.w / 2, y: cell.y + 22, life: 1.7, max: 1.7, text: `+${amt} ${def.produces}`, color: def.color });
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
      this.drawEarth(ctx, cw, ch);

      ctx.save();
      ctx.translate(0, -this.scrollY);

      this.drawShaft(ctx);

      const s = this.state;
      for (const cell of this.cells) {
        const built = !!s.rooms[cell.key];
        const def = G.data.rooms[cell.key];
        this.drawRoomCell(ctx, cell, def, built ? s.rooms[cell.key] : null);
      }
      this.drawHatch(ctx);
      this.drawProdFloaters(ctx);

      ctx.restore();
      this.drawVignette(ctx, cw, ch);
    }

    // Rising "+N resource" popups when a production cycle completes.
    drawProdFloaters(ctx) {
      if (!this.floaters.length) return;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 12px Segoe UI, sans-serif';
      for (const f of this.floaters) {
        ctx.globalAlpha = Math.min(1, f.life / f.max * 1.4);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(f.text, f.x + 0.8, f.y + 0.8);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    // Subtle screen-space darkening at the edges for a "deep underground" feel.
    drawVignette(ctx, cw, ch) {
      const g = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, ch * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }

    // Layered soil/rock backdrop the bunker is carved into.
    drawEarth(ctx, cw, ch) {
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, '#0b0f18'); g.addColorStop(1, '#05070d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
      // strata lines
      ctx.fillStyle = 'rgba(255,255,255,0.022)';
      for (let y = 40; y < ch; y += 44) ctx.fillRect(0, y, cw, 1);
      // pebbles
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < 46; i++) ctx.fillRect(hash(i) * cw, hash(i * 1.7) * ch, 2, 2);
    }

    // Drive the elevator: travel to a floor, pause, pick a new floor. The car
    // carries a passenger roughly half the time so the bunker feels in use.
    updateElevator(dt) {
      const sh = this.shaft, F = this.floorYs;
      if (!sh || !F || !F.length) return;
      if (!this.elev) this.elev = { y: F[0], idx: 0, target: F[0], dwell: 0.8, rider: Math.random() < 0.6 };
      const e = this.elev;
      if (e.dwell > 0) {
        e.dwell -= dt;
        if (e.dwell <= 0 && F.length > 1) {       // doors close, choose next floor
          let ni = e.idx; while (ni === e.idx) ni = (Math.random() * F.length) | 0;
          e.idx = ni; e.target = F[ni]; e.rider = Math.random() < 0.6;
        }
        return;
      }
      const step = 78 * dt, d = e.target - e.y;
      if (Math.abs(d) <= step) { e.y = e.target; e.dwell = 1.0 + Math.random() * 1.4; }
      else e.y += Math.sign(d) * step;
    }

    // Elevator shaft connecting the floors, with a travelling car + rider.
    drawShaft(ctx) {
      const sh = this.shaft; if (!sh) return;
      ctx.fillStyle = '#070a11';
      this.roundRect(ctx, sh.x, sh.y, sh.w, sh.h, 6); ctx.fill();
      ctx.save(); this.roundRect(ctx, sh.x, sh.y, sh.w, sh.h, 6); ctx.clip();
      // guide rails
      ctx.strokeStyle = 'rgba(120,150,190,0.16)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sh.x + sh.w * 0.30, sh.y); ctx.lineTo(sh.x + sh.w * 0.30, sh.y + sh.h);
      ctx.moveTo(sh.x + sh.w * 0.70, sh.y); ctx.lineTo(sh.x + sh.w * 0.70, sh.y + sh.h);
      ctx.stroke();
      // floor-stop ledges
      for (const fy of (this.floorYs || [])) {
        ctx.strokeStyle = 'rgba(54,224,216,0.14)';
        ctx.beginPath(); ctx.moveTo(sh.x + 2, fy + 12); ctx.lineTo(sh.x + sh.w - 2, fy + 12); ctx.stroke();
      }
      const e = this.elev;
      if (e) {
        const cw = sh.w - 6, cx = sh.x + 3, cy = e.y - 11;
        const moving = Math.abs(e.target - e.y) > 0.5;
        // hoist cable
        ctx.strokeStyle = 'rgba(180,200,220,0.22)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sh.x + sh.w / 2, sh.y); ctx.lineTo(sh.x + sh.w / 2, cy); ctx.stroke();
        // car
        ctx.fillStyle = '#14263d'; this.roundRect(ctx, cx, cy, cw, 22, 4); ctx.fill();
        ctx.fillStyle = 'rgba(54,224,216,0.10)'; ctx.fillRect(cx + 1, cy + 2, cw - 2, 18); // interior glow
        // rider (drawn before doors so doors frame them)
        if (e.rider) this.drawFigure(ctx, sh.x + sh.w / 2, cy + 20, '#9fb6d6', this.animT * 3, 1);
        // doors: parted while stopped, shut while moving
        const part = moving ? 0 : 3.2;
        ctx.fillStyle = '#0b1828';
        ctx.fillRect(cx, cy + 2, cw / 2 - part, 18);
        ctx.fillRect(cx + cw / 2 + part, cy + 2, cw / 2 - part, 18);
        ctx.strokeStyle = moving ? 'rgba(54,224,216,0.85)' : 'rgba(54,224,216,0.45)';
        ctx.lineWidth = 1; this.roundRect(ctx, cx, cy, cw, 22, 4); ctx.stroke();
        // status lamp
        ctx.fillStyle = moving ? '#36e0d8' : '#1f3a4a';
        ctx.fillRect(cx + cw / 2 - 3, cy - 2, 6, 2);
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(54,224,216,0.22)'; ctx.lineWidth = 1;
      this.roundRect(ctx, sh.x, sh.y, sh.w, sh.h, 6); ctx.stroke();
    }

    drawHatch(ctx) {
      const h = this.hatch;
      const g = ctx.createLinearGradient(0, h.y, 0, h.y + h.h);
      g.addColorStop(0, '#15293c'); g.addColorStop(1, '#0b1a28');
      ctx.fillStyle = g;
      this.roundRect(ctx, h.x, h.y, h.w, h.h, 8); ctx.fill();
      // hazard stripes at each end
      ctx.save();
      this.roundRect(ctx, h.x, h.y, h.w, h.h, 8); ctx.clip();
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffb547';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(h.x + i * 14, h.y); ctx.lineTo(h.x + i * 14 + 10, h.y);
        ctx.lineTo(h.x + i * 14 - 4, h.y + h.h); ctx.lineTo(h.x + i * 14 - 14, h.y + h.h);
        ctx.closePath(); ctx.fill();
        const rx = h.x + h.w;
        ctx.beginPath();
        ctx.moveTo(rx - i * 14, h.y); ctx.lineTo(rx - i * 14 - 10, h.y);
        ctx.lineTo(rx - i * 14 + 4, h.y + h.h); ctx.lineTo(rx - i * 14 + 14, h.y + h.h);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = '#36e0d8'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
      this.roundRect(ctx, h.x, h.y, h.w, h.h, 8); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#eafffd';
      ctx.font = '700 15px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▲  SURFACE HATCH — LAUNCH RAID', h.x + h.w / 2, h.y + h.h / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    drawRoomCell(ctx, cell, def, room) {
      const { x, y, w, h } = cell;
      const r = 7;
      const floorY = y + h - 14;
      ctx.save();

      // carve the chamber (clip everything inside the rounded room)
      this.roundRect(ctx, x, y, w, h, r);
      ctx.save(); ctx.clip();
      if (room) {
        // Room interior art (if supplied) replaces the procedural chamber.
        if (!G.assets.drawIn(ctx, 'room-' + def.key, x, y, w, h, false)) {
          const bg = ctx.createLinearGradient(0, y, 0, y + h);
          bg.addColorStop(0, '#0f1828'); bg.addColorStop(1, '#0a0f1a');
          ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
          // colour wash from the room's accent
          ctx.globalAlpha = 0.13; ctx.fillStyle = def.color;
          ctx.fillRect(x, y, w, h * 0.55); ctx.globalAlpha = 1;
          // floor slab + grate
          ctx.fillStyle = '#0a1220'; ctx.fillRect(x, floorY, w, y + h - floorY);
          ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, floorY, w, 1.5);
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
          for (let gx = x + 10; gx < x + w; gx += 16) {
            ctx.beginPath(); ctx.moveTo(gx, floorY + 3); ctx.lineTo(gx - 6, y + h - 1); ctx.stroke();
          }
          // characteristic equipment so each room reads as purposeful
          this.drawRoomProps(ctx, def, x, y, w, h, floorY);
        }
        // soft ceiling-lamp light pool so built rooms read as "powered"
        const lamp = ctx.createRadialGradient(x + w * 0.5, y + 3, 2, x + w * 0.5, y + 3, h * 0.95);
        lamp.addColorStop(0, 'rgba(255,248,230,0.10)'); lamp.addColorStop(1, 'rgba(255,248,230,0)');
        ctx.fillStyle = lamp; ctx.fillRect(x, y, w, h);
        // populate: assigned crew + the commander (command) + resting idle crew (bunks)
        let pop = room.crew || 0;
        if (def.key === 'command') pop += 1;
        if (def.key === 'bunks') pop += G.derive.idleCrew(this.state);
        this.drawRoomCrew(ctx, x, w, floorY, pop, def.color);
      } else {
        // unexcavated dirt
        ctx.fillStyle = '#090b10'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        for (let i = 0; i < 16; i++) {
          ctx.fillRect(x + hash(cell.x + i) * w, y + hash(cell.y + i * 3) * h, 2, 2);
        }
      }
      ctx.restore(); // end clip

      // chamber border
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = room ? def.color : 'rgba(95,114,153,0.45)';
      ctx.globalAlpha = room ? 0.85 : 0.6;
      this.roundRect(ctx, x, y, w, h, r); ctx.stroke();
      ctx.globalAlpha = 1;

      // icon in a recessed panel
      const is = 28;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      this.roundRect(ctx, x + 9, y + 9, is, is, 5); ctx.fill();
      if (room) { ctx.strokeStyle = def.color; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = room ? '#fff' : '#41597d';
      ctx.fillText(def.icon, x + 9 + is / 2, y + 9 + is / 2 + 1);

      // name
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '600 12.5px Segoe UI, sans-serif';
      ctx.fillStyle = room ? '#eaf3ff' : '#6f86ad';
      ctx.fillText(def.name, x + 44, y + 11);

      if (room) {
        // level pips
        const maxL = def.maxLevel || 5;
        for (let i = 0; i < maxL; i++) {
          ctx.fillStyle = i < room.level ? def.color : 'rgba(255,255,255,0.12)';
          ctx.fillRect(x + 44 + i * 8, y + 28, 5, 5);
        }
        // status (top-right)
        const st = this.roomStatus(def, room);
        if (st) {
          ctx.font = '10.5px Segoe UI, sans-serif'; ctx.fillStyle = '#8fb0d8';
          ctx.textAlign = 'right';
          ctx.fillText(st, x + w - 9, y + 11);
          ctx.textAlign = 'left';
        }
      } else {
        ctx.font = '10.5px Segoe UI, sans-serif'; ctx.fillStyle = '#5d7299';
        ctx.fillText('Tap to excavate', x + 44, y + 28);
        ctx.fillStyle = '#41597d';
        ctx.fillText(U.fmtCost(def.build), x + 44, y + 43);
      }
      ctx.restore();
    }

    // Short one-line status shown in the top-right of a built room.
    roomStatus(def, room) {
      const s = this.state;
      if (def.produces) return `👤${room.crew} → ${def.produces}`;
      if (def.key === 'bunks') return `cap ${G.derive.maxCrew(s)}`;
      if (def.key === 'armory') return G.derive.weapon(s).name;
      if (def.key === 'medbay') return `HP ${G.derive.maxHP(s)}`;
      if (def.key === 'lab') return `${s.decoded}/${s.tech} decoded`;
      if (def.key === 'command') return `${G.derive.visibleBases(s).length} sites`;
      return '';
    }

    // Characteristic furniture/equipment per room so each chamber is distinct
    // even before AI room art exists. Drawn inside the clipped chamber.
    drawRoomProps(ctx, def, x, y, w, h, floorY) {
      const c = def.color, t = this.animT;
      const glow = (col, blur) => { ctx.shadowColor = col; ctx.shadowBlur = blur; };
      ctx.save();
      switch (def.key) {
        case 'command': {            // holo map table + back-wall monitors
          for (let i = 0; i < 3; i++) {
            ctx.globalAlpha = 0.6; ctx.fillStyle = '#0c1a2a';
            ctx.fillRect(x + 44 + i * 26, y + 30, 22, 14);
            ctx.globalAlpha = 0.5; ctx.fillStyle = c;
            ctx.fillRect(x + 46 + i * 26, y + 32, 18, 2 + (i % 2) * 3);
          }
          ctx.globalAlpha = 1;
          const tx = x + w * 0.5, ty = floorY - 4;
          ctx.fillStyle = '#0c1a2a'; ctx.fillRect(tx - 16, ty - 6, 32, 6);
          glow(c, 12); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2);
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.ellipse(tx, ty - 10, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'bunks': {              // stacked beds + ladder
          for (let r = 0; r < 2; r++) {
            const by = floorY - 10 - r * 16;
            ctx.globalAlpha = 0.8; ctx.fillStyle = '#1a2238';
            ctx.fillRect(x + 14, by, 34, 6);
            ctx.fillStyle = c; ctx.globalAlpha = 0.4;
            ctx.fillRect(x + 16, by + 1, 30, 2);
          }
          ctx.globalAlpha = 0.5; ctx.fillStyle = '#2a3550';
          ctx.fillRect(x + 50, floorY - 26, 3, 26);
          break;
        }
        case 'generator': {          // pulsing reactor core + cabling
          const cx = x + w * 0.5, cy = y + h * 0.5;
          const pulse = 0.6 + 0.4 * Math.sin(t * 3);
          glow(c, 18 * pulse);
          ctx.globalAlpha = pulse; ctx.fillStyle = c;
          ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = '#fff7d6';
          ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0; ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(x + 8, cy + 8);
          ctx.moveTo(cx + 12, cy); ctx.lineTo(x + w - 8, cy + 8); ctx.stroke();
          break;
        }
        case 'kitchen': {            // hydroponic plant racks under grow-lights
          for (let i = 0; i < 4; i++) {
            const px = x + 16 + i * ((w - 28) / 4);
            ctx.globalAlpha = 0.25; glow(c, 8); ctx.fillStyle = c;
            ctx.fillRect(px, y + 24, 14, 3);
            ctx.shadowBlur = 0; ctx.globalAlpha = 0.9; ctx.fillStyle = '#3f9d54';
            const sway = Math.sin(t * 2 + i) * 1.5;
            ctx.fillRect(px + 4 + sway, floorY - 16, 3, 16);
            ctx.fillStyle = '#5fc06f';
            ctx.beginPath(); ctx.arc(px + 5 + sway, floorY - 16, 4, 0, Math.PI * 2); ctx.fill();
          }
          break;
        }
        case 'workshop': {           // workbench + pegboard + intermittent sparks
          ctx.globalAlpha = 0.85; ctx.fillStyle = '#26211a';
          ctx.fillRect(x + 14, floorY - 12, 40, 12);
          ctx.fillStyle = c; ctx.globalAlpha = 0.4; ctx.fillRect(x + 14, floorY - 12, 40, 2);
          ctx.globalAlpha = 0.5; ctx.fillStyle = '#3a4250';
          for (let i = 0; i < 4; i++) ctx.fillRect(x + 18 + i * 8, y + 26, 2, 8);
          if (Math.sin(t * 9) > 0.7) {
            glow('#ffd27a', 10); ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff2c0';
            ctx.fillRect(x + 30 + Math.sin(t * 20) * 6, floorY - 14, 2, 2);
          }
          break;
        }
        case 'armory': {             // wall weapon racks + ammo crates
          ctx.globalAlpha = 0.6; ctx.fillStyle = '#2a3550';
          ctx.fillRect(x + 16, y + 24, 40, 3);
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = '#aeb8c8'; ctx.globalAlpha = 0.8;
            ctx.fillRect(x + 18 + i * 8, y + 27, 2, 14);
          }
          ctx.globalAlpha = 0.8; ctx.fillStyle = '#3a2f22';
          ctx.fillRect(x + 16, floorY - 10, 14, 10);
          ctx.strokeStyle = c; ctx.globalAlpha = 0.5; ctx.strokeRect(x + 16, floorY - 10, 14, 10);
          break;
        }
        case 'medbay': {             // med pods + cross
          for (let i = 0; i < 2; i++) {
            const px = x + 16 + i * 26;
            glow(c, 6); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2 + i);
            ctx.fillStyle = '#16324a'; this.roundRect(ctx, px, floorY - 16, 20, 16, 5); ctx.fill();
            ctx.shadowBlur = 0; ctx.globalAlpha = 0.9; ctx.fillStyle = c;
            ctx.fillRect(px + 8, floorY - 13, 4, 10); ctx.fillRect(px + 5, floorY - 10, 10, 4);
          }
          break;
        }
        case 'lab': {                // containment field with floating fragment
          const cx = x + w * 0.5, cy = y + h * 0.46;
          ctx.globalAlpha = 0.15; glow(c, 14); ctx.fillStyle = c;
          ctx.beginPath(); ctx.ellipse(cx, cy, 16, 22, 0, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 12; ctx.globalAlpha = 0.9; ctx.fillStyle = c;
          ctx.save(); ctx.translate(cx, cy + Math.sin(t * 1.6) * 3); ctx.rotate(t * 0.8);
          ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0);
          ctx.closePath(); ctx.fill(); ctx.restore();
          break;
        }
      }
      ctx.restore();
    }

    // Survivors patrolling a room's floor, each pacing at its own speed.
    drawRoomCrew(ctx, cellX, cellW, floorY, count, color) {
      const n = Math.min(count || 0, 6);
      const left = cellX + 13, right = cellX + cellW - 15, span = Math.max(18, right - left);
      for (let i = 0; i < n; i++) {
        const sp = 0.22 + (i % 3) * 0.05;          // pace varies per survivor
        const ph = this.animT * sp + i * 1.7;
        const tri = Math.abs((ph % 2) - 1);        // 0..1..0 triangle wave
        const fx = left + tri * span;
        const facing = (ph % 2) < 1 ? 1 : -1;      // face direction of travel
        this.drawFigure(ctx, fx, floorY, color, this.animT * 4.5 + i * 2, facing);
      }
    }

    // A single little survivor with a walk cycle and cyan visor glint.
    drawFigure(ctx, fx, footY, color, walkPh, facing) {
      const swing = Math.sin(walkPh) * 1.7;
      ctx.save();
      ctx.globalAlpha = 0.95;
      // legs
      ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fx, footY - 6); ctx.lineTo(fx - swing, footY);
      ctx.moveTo(fx, footY - 6); ctx.lineTo(fx + swing, footY);
      ctx.stroke();
      // torso
      ctx.fillStyle = color;
      this.roundRect(ctx, fx - 2.4, footY - 13.5, 4.8, 8, 1.6); ctx.fill();
      // head / helmet
      ctx.beginPath(); ctx.arc(fx, footY - 15.8, 2.6, 0, Math.PI * 2); ctx.fill();
      // visor glint, on the facing side
      ctx.fillStyle = 'rgba(150,242,255,0.9)';
      ctx.fillRect(fx - 0.4 + facing * 0.9, footY - 16.6, 1.6, 1.5);
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
