/* mission.js — the side-scrolling raid. Owns terrain, camera, spawns, the
   boss arena, and win/lose. Reads weapon/HP from saved bunker upgrades. */

(function () {
  const U = G.util;
  const Ent = G.ent;

  // Per-biome art palette: gradient, structures, fog, and accent lighting.
  const PALETTES = {
    silo:  { top: '#0e1a2a', bot: '#05080f', fog: '#0a1320', struct: '#141f30',
             structLit: '#26354f', sil: '#0c1626', accent: '#46b4ff', warm: '#ffb24a' },
    lab:   { top: '#0a1a1f', bot: '#040b0e', fog: '#08161a', struct: '#102329',
             structLit: '#1d4049', sil: '#0a1b20', accent: '#39e0d8', warm: '#8ad0ff' },
    cave:  { top: '#22110a', bot: '#0a0503', fog: '#1a0c06', struct: '#2a160e',
             structLit: '#5e2c18', sil: '#190b07', accent: '#ff7a2a', warm: '#ffd24a' },
    alien: { top: '#170c28', bot: '#08040f', fog: '#120a1e', struct: '#1d1430',
             structLit: '#3c2c60', sil: '#110a1f', accent: '#b06cff', warm: '#ff6cc4' },
  };

  // Cheap deterministic pseudo-random in [0,1) keyed by an integer, so parallax
  // structures stay put frame-to-frame without storing them all.
  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  class Mission {
    constructor(game, baseDef) {
      this.game = game;
      this.base = baseDef;
      this.done = false;
      this.paused = false;
    }

    get state() { return this.game.state; }

    enter(cw, ch) {
      G.ui.hudVisible(false);
      this.cw = cw; this.ch = ch;
      this.groundY = ch - 56;
      this.length = this.base.length;
      this.cam = 0;

      const weapon = G.derive.weapon(this.state);
      const maxHP = G.derive.maxHP(this.state);
      this.player = new Ent.Player(60, this.groundY - 44, weapon, maxHP);

      this.bullets = [];
      this.enemies = [];
      this.pickups = [];
      this.particles = [];
      this.platforms = [];
      this.spawns = [];
      this.kills = 0;
      this.score = 0;
      this.fragmentTaken = false;
      this.boss = null;
      this.bossSpawned = false;
      this.outcome = null; // 'win' | 'lose'
      this.fadeT = 0;

      this.pal = PALETTES[this.base.biome] || PALETTES.silo;
      this.ceilingH = Math.max(48, Math.min(130, Math.round(ch * 0.15)));
      this.t = 0;

      this.buildLevel();
      this.initAmbient();
      G.ui.toast(this.base.intro, '');
    }

    // Drifting dust motes in the air, with parallax tied to camera depth.
    initAmbient() {
      this.dust = [];
      const n = 46;
      for (let i = 0; i < n; i++) {
        const z = U.rand(0.2, 0.7);
        this.dust.push({
          wx: this.cam * z + U.rand(0, this.cw),
          y: U.rand(this.ceilingH, this.groundY - 8),
          z, r: U.rand(0.6, 2.3),
          a: U.rand(0.05, 0.22),
          vy: U.rand(-0.05, 0.05),
        });
      }
    }

    updateAmbient() {
      const cam = this.cam, cw = this.cw;
      for (const m of this.dust) {
        m.y += m.vy; m.wx -= 0.05; // gentle air current
        if (m.y < this.ceilingH) m.y = this.groundY - 8;
        if (m.y > this.groundY - 4) m.y = this.ceilingH;
        const sx = m.wx - cam * m.z;
        if (sx < -20) { m.wx = cam * m.z + cw + 20; m.y = U.rand(this.ceilingH, this.groundY - 8); }
        else if (sx > cw + 20) { m.wx = cam * m.z - 20; }
      }
    }

    buildLevel() {
      const def = this.base;
      // platforms scattered through the level
      let x = 360;
      while (x < this.length - 500) {
        if (U.chance(0.6)) {
          const pw = U.randInt(70, 150);
          const py = this.groundY - U.randInt(70, 150);
          this.platforms.push({ x, y: py, w: pw, h: 14 });
        }
        x += U.randInt(220, 360);
      }
      // enemy spawn markers
      let ex = 400;
      const pool = def.enemies;
      while (ex < this.length - 420) {
        this.spawns.push({ x: ex, type: U.pick(pool), used: false });
        ex += U.randInt(180, 340) / def.difficulty * 1.4;
      }
      // a couple of scrap/health pickups on the path
      for (let i = 0; i < 5; i++) {
        const px = U.randInt(500, this.length - 500);
        this.pickups.push(new Ent.Pickup(px, this.groundY - 90, U.chance(0.5) ? 'scrap' : 'health', U.randInt(5, 12)));
      }
      this.bossX = this.length - 220;
    }

    // Collision + movement against ground, platforms, and level bounds.
    moveActor(a) {
      // horizontal
      a.x += a.vx;
      if (a.x < 0) a.x = 0;
      if (a.x + a.w > this.length) a.x = this.length - a.w;

      // vertical
      a.y += a.vy;
      a.onGround = false;

      // ground floor
      if (a.y + a.h >= this.groundY) {
        a.y = this.groundY - a.h; a.vy = 0; a.onGround = true;
      }
      // platforms (land only when falling onto the top)
      if (a.vy >= 0) {
        for (const pf of this.platforms) {
          if (a.x + a.w > pf.x && a.x < pf.x + pf.w) {
            const prevBottom = a.y + a.h - a.vy;
            if (prevBottom <= pf.y + 6 && a.y + a.h >= pf.y && a.y + a.h <= pf.y + pf.h + 12) {
              a.y = pf.y - a.h; a.vy = 0; a.onGround = true;
            }
          }
        }
      }
    }

    update(dt, cw, ch) {
      this.cw = cw; this.ch = ch;
      if (G.input.pausePressed()) { this.togglePause(); return; }
      if (this.paused || this.outcome) {
        if (this.outcome) this.fadeT += dt;
        return;
      }

      this.t += dt;
      this.updateAmbient();

      const p = this.player;
      p.update(this);

      // camera follows player
      const targetCam = U.clamp(p.cx - cw * 0.4, 0, Math.max(0, this.length - cw));
      this.cam += (targetCam - this.cam) * 0.12;

      // activate spawns the player has reached
      for (const sp of this.spawns) {
        if (!sp.used && p.x + cw > sp.x) {
          sp.used = true;
          const def = G.data.enemies[sp.type];
          const ey = def.fly ? this.groundY - 120 : this.groundY - def.h;
          this.enemies.push(new Ent.Enemy(sp.type, sp.x, ey, def));
        }
      }

      // boss
      if (!this.bossSpawned && p.x > this.bossX - cw * 0.7) {
        this.bossSpawned = true;
        const bdef = G.data.bosses[this.base.boss];
        this.boss = new Ent.Boss(bdef, this.bossX, this.groundY - bdef.h - 40);
        this.enemies.push(this.boss);
        G.ui.toast('⚠ GUARDIAN ENGAGED — ' + bdef.name, 'bad');
      }

      this.enemies.forEach(e => e.update(this));
      this.bullets.forEach(b => b.update());
      this.pickups.forEach(pk => pk.update());
      this.particles.forEach(pt => pt.update());

      this.resolveCollisions();

      // cull
      this.enemies = this.enemies.filter(e => !e.dead);
      this.bullets = this.bullets.filter(b => !b.dead && b.x > this.cam - 80 && b.x < this.cam + cw + 80);
      this.pickups = this.pickups.filter(p => !p.dead);
      this.particles = this.particles.filter(p => !p.dead);

      // win: boss dead -> drop fragment -> grab it (auto when boss dies we mark)
      if (this.bossSpawned && !this.boss && !this.fragmentTaken) {
        // boss reference cleared when dead via cull (boss.dead). Recover fragment.
        this.recoverFragment();
      }

      // lose
      if (p.hp <= 0 && !this.outcome) this.fail();
    }

    resolveCollisions() {
      const p = this.player;
      for (const b of this.bullets) {
        if (b.dead) continue;
        if (b.owner === 'player') {
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (U.aabb(b, e)) {
              e.hurt(b.dmg, this); b.dead = true; G.audio.hit();
              break;
            }
          }
        } else {
          if (U.aabb(b, p)) { p.hurt(b.dmg); b.dead = true; }
        }
      }
      // pickups
      for (const pk of this.pickups) {
        if (pk.dead) continue;
        if (U.aabb(pk, p)) {
          pk.dead = true;
          if (pk.kind === 'health') { p.hp = Math.min(p.maxHP, p.hp + pk.amount); G.audio.pickup(); }
          else if (pk.kind === 'scrap') { this._pendingScrap = (this._pendingScrap || 0) + pk.amount; G.audio.pickup(); }
        }
      }
      // track boss death flag
      if (this.boss && this.boss.dead) this.boss = null;
    }

    recoverFragment() {
      this.fragmentTaken = true;
      this.win();
    }

    win() {
      if (this.outcome) return;
      this.outcome = 'win';
      const s = this.state;
      const reward = this.base.reward;
      const firstClear = !s.clearedBases[this.base.key];
      // grant rewards
      for (const [k, v] of Object.entries(reward)) s[k] = (s[k] || 0) + v;
      s.scrap += (this._pendingScrap || 0);
      // fragment(s) only on first clear
      let gotTech = 0;
      if (firstClear) {
        gotTech = this.base.tech;
        s.tech += gotTech;
        s.clearedBases[this.base.key] = true;
      }
      // chance to recruit a survivor if you have bunk space
      let recruited = null;
      if (G.derive.idleCrew(s) + G.derive.assignedCrew(s) < G.derive.maxCrew(s) && U.chance(0.6)) {
        if (s.crew < G.derive.maxCrew(s)) {
          s.crew++;
          recruited = U.pick(G.NAMES.filter(n => !s.crewNames.includes(n))) || 'Survivor';
          s.crewNames.push(recruited);
        }
      }
      s.stats.raids++; s.stats.kills += this.kills;
      this.game.persist();
      G.audio.win();
      this._summary = { reward, gotTech, recruited, firstClear };
    }

    fail() {
      this.outcome = 'lose';
      this.state.stats.deaths++;
      this.state.stats.raids++;
      // keep scrap collected as a consolation
      this.state.scrap += (this._pendingScrap || 0);
      this.game.persist();
      G.audio.lose();
    }

    togglePause() {
      if (this.outcome) return;
      this.paused = !this.paused;
      if (this.paused) this.showPause(); else G.ui.hide();
    }

    showPause() {
      const p = G.ui.show(`
        <h2>Paused</h2>
        <p class="sub">${this.base.name}</p>
        <div class="footer-actions" style="justify-content:flex-start">
          <button class="btn primary" id="resume">Resume</button>
          <button class="btn danger" id="abort">Abort raid</button>
        </div>
      `);
      p.querySelector('#resume').onclick = () => { G.audio.ui(); this.paused = false; G.ui.hide(); };
      p.querySelector('#abort').onclick = () => { G.audio.ui(); G.ui.hide(); this.game.returnToBase(); };
    }

    // ---------- rendering ----------
    draw(ctx, cw, ch) {
      ctx.clearRect(0, 0, cw, ch);
      this.drawBackground(ctx, cw, ch);

      const cam = this.cam;
      this.drawDust(ctx);
      this.drawGround(ctx, cw, ch);
      this.drawPlatforms(ctx, cw);
      // exit / fragment shrine at the end
      const ex = this.bossX + 120 - cam;
      if (ex < cw + 100) {
        ctx.save();
        ctx.shadowColor = '#9a6cff'; ctx.shadowBlur = 24;
        ctx.fillStyle = this.fragmentTaken ? '#2a2440' : '#9a6cff';
        ctx.fillRect(ex, this.groundY - 90, 8, 90);
        ctx.fillRect(ex + 40, this.groundY - 90, 8, 90);
        ctx.fillRect(ex, this.groundY - 96, 48, 8);
        ctx.restore();
      }

      this.pickups.forEach(p => p.draw(ctx, cam));
      this.enemies.forEach(e => e.draw(ctx, cam));
      this.bullets.forEach(b => b.draw(ctx, cam));
      this.particles.forEach(p => p.draw(ctx, cam));
      this.player.draw(ctx, cam);

      this.drawPost(ctx, cw, ch);
      this.drawHUD(ctx, cw, ch);

      if (this.outcome) this.drawOutcome(ctx, cw, ch);
    }

    drawBackground(ctx, cw, ch) {
      const pal = this.pal;
      // base gradient sky/atmosphere
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, pal.top); g.addColorStop(0.6, pal.bot); g.addColorStop(1, pal.bot);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);

      this.drawFarStructures(ctx, cw, ch);
      this.drawConduits(ctx, cw);
      this.drawColumns(ctx, cw);
      this.drawCeiling(ctx, cw);
      this.drawFog(ctx, cw, ch);
    }

    // Distant machinery silhouettes rising from the floor (deep parallax).
    drawFarStructures(ctx, cw, ch) {
      const pal = this.pal, cam = this.cam, gY = this.groundY, p = 0.28;
      const sp = 300;
      const start = Math.floor((cam * p) / sp) - 1;
      ctx.fillStyle = pal.sil;
      for (let i = start; ; i++) {
        const sx = i * sp - cam * p;
        if (sx > cw + 200) break;
        if (sx + 240 < 0) continue;
        const r = hash(i * 2.3);
        const w = 90 + r * 150;
        const hgt = gY * (0.3 + hash(i * 5.1) * 0.45);
        const x = sx + (hash(i * 1.7) - 0.5) * 80;
        const y = gY - hgt;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = pal.sil;
        ctx.fillRect(x, y, w, hgt);
        // a lighter cap / tank top
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = pal.struct;
        ctx.fillRect(x, y, w, 10);
        if (r > 0.5) { // chimney/antenna
          ctx.fillRect(x + w * 0.5 - 4, y - 30 - r * 30, 8, 30 + r * 30);
        }
        // blinking status light
        const blink = (Math.sin(this.t * 2 + i) > 0.3) ? 1 : 0.15;
        ctx.globalAlpha = blink * 0.9;
        ctx.fillStyle = (i % 3 === 0) ? pal.warm : pal.accent;
        ctx.fillRect(x + w - 8, y + 6, 4, 4);
      }
      ctx.globalAlpha = 1;
    }

    // Horizontal pipe/conduit runs and faint support pillars (mid parallax).
    drawConduits(ctx, cw) {
      const pal = this.pal, cam = this.cam, p = 0.5;
      const bands = [0.22, 0.4, 0.58];
      for (let bi = 0; bi < bands.length; bi++) {
        const y = this.ceilingH + (this.groundY - this.ceilingH) * bands[bi];
        ctx.fillStyle = pal.struct;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(0, y, cw, 6);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = pal.structLit;
        ctx.fillRect(0, y, cw, 1.5);
        // joints / valves along the pipe
        const sp = 150;
        const off = (cam * p) % sp;
        for (let x = -off; x < cw; x += sp) {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = pal.struct;
          ctx.fillRect(x - 3, y - 3, 8, 12);
        }
      }
      ctx.globalAlpha = 1;
    }

    drawColumns(ctx, cw) {
      const pal = this.pal, cam = this.cam, p = 0.5, sp = 230;
      const off = (cam * p) % sp;
      for (let x = -off; x < cw; x += sp) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = pal.struct;
        ctx.fillRect(x, this.ceilingH, 26, this.groundY - this.ceilingH);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = pal.structLit;
        ctx.fillRect(x, this.ceilingH, 3, this.groundY - this.ceilingH);
        ctx.fillRect(x + 23, this.ceilingH, 3, this.groundY - this.ceilingH);
      }
      ctx.globalAlpha = 1;
    }

    // Structural ceiling with hanging girders and glow lamps.
    drawCeiling(ctx, cw) {
      const pal = this.pal, cam = this.cam, H = this.ceilingH;
      const cg = ctx.createLinearGradient(0, 0, 0, H + 30);
      cg.addColorStop(0, pal.struct); cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, cw, H + 30);
      // truss line
      ctx.strokeStyle = pal.structLit; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(cw, H); ctx.stroke();
      ctx.globalAlpha = 1;
      // hanging girders + lamps
      const sp = 200, off = (cam * 0.5) % sp;
      for (let x = -off; x < cw + sp; x += sp) {
        const drop = 24 + hash(Math.round(x + cam)) * 26;
        ctx.fillStyle = pal.struct;
        ctx.fillRect(x, H, 5, drop);
        // lamp
        ctx.save();
        ctx.shadowColor = pal.warm; ctx.shadowBlur = 22;
        ctx.fillStyle = pal.warm; ctx.globalAlpha = 0.9;
        ctx.fillRect(x - 5, H + drop, 15, 5);
        ctx.restore();
        // soft light cone
        const lg = ctx.createLinearGradient(0, H + drop, 0, H + drop + 150);
        lg.addColorStop(0, 'rgba(255,210,120,0.06)');
        lg.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(x - 2, H + drop + 5); ctx.lineTo(x + 7, H + drop + 5);
        ctx.lineTo(x + 34, H + drop + 150); ctx.lineTo(x - 29, H + drop + 150);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawFog(ctx, cw, ch) {
      const pal = this.pal, gY = this.groundY;
      const fg = ctx.createLinearGradient(0, gY - 160, 0, gY);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(1, pal.fog);
      ctx.fillStyle = fg; ctx.fillRect(0, gY - 160, cw, 160);
    }

    drawDust(ctx) {
      const cam = this.cam;
      for (const m of this.dust) {
        const sx = m.wx - cam * m.z;
        ctx.globalAlpha = m.a;
        ctx.fillStyle = this.pal.accent;
        ctx.fillRect(sx, m.y, m.r, m.r);
      }
      ctx.globalAlpha = 1;
    }

    // Detailed metal floor: slab, lit edge, scrolling hazard stripe, seams.
    drawGround(ctx, cw, ch) {
      const pal = this.pal, cam = this.cam, gY = this.groundY;
      ctx.fillStyle = pal.struct;
      ctx.fillRect(0, gY, cw, ch - gY);
      // darker base toward the bottom
      const fg = ctx.createLinearGradient(0, gY, 0, ch);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = fg; ctx.fillRect(0, gY, cw, ch - gY);
      // lit top edge
      ctx.save();
      ctx.shadowColor = pal.accent; ctx.shadowBlur = 10;
      ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.55;
      ctx.fillRect(0, gY, cw, 2);
      ctx.restore();
      ctx.globalAlpha = 1;
      // hazard stripes just under the edge
      const bandY = gY + 5, bandH = 7, sw = 16;
      const off = (cam * 1) % (sw * 2);
      for (let x = -off; x < cw; x += sw * 2) {
        ctx.fillStyle = pal.warm; ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(x, bandY + bandH); ctx.lineTo(x + sw, bandY);
        ctx.lineTo(x + sw * 1.6, bandY); ctx.lineTo(x + sw * 0.6, bandY + bandH);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // floor panel seams
      const psp = 64, poff = cam % psp;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      for (let x = -poff; x < cw; x += psp) {
        ctx.beginPath(); ctx.moveTo(x, gY + 16); ctx.lineTo(x, ch); ctx.stroke();
      }
    }

    // Platforms drawn as lit catwalks with support legs.
    drawPlatforms(ctx, cw) {
      const pal = this.pal, cam = this.cam;
      for (const pf of this.platforms) {
        const x = pf.x - cam;
        if (x > cw || x + pf.w < 0) continue;
        // support legs
        ctx.fillStyle = pal.struct; ctx.globalAlpha = 0.5;
        ctx.fillRect(x + 8, pf.y + pf.h, 5, this.groundY - (pf.y + pf.h));
        ctx.fillRect(x + pf.w - 13, pf.y + pf.h, 5, this.groundY - (pf.y + pf.h));
        ctx.globalAlpha = 1;
        // slab
        ctx.fillStyle = pal.structLit;
        ctx.fillRect(x, pf.y, pf.w, pf.h);
        ctx.fillStyle = pal.struct;
        ctx.fillRect(x, pf.y + 4, pf.w, pf.h - 4);
        // lit leading edge
        ctx.save();
        ctx.shadowColor = pal.accent; ctx.shadowBlur = 8;
        ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.7;
        ctx.fillRect(x, pf.y, pf.w, 2);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    // Vignette + corner darkening to focus the action.
    drawPost(ctx, cw, ch) {
      const r = Math.max(cw, ch);
      const v = ctx.createRadialGradient(cw / 2, ch * 0.5, r * 0.35, cw / 2, ch * 0.5, r * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, cw, ch);
    }

    drawHUD(ctx, cw, ch) {
      const p = this.player;
      // HP bar
      ctx.fillStyle = 'rgba(8,12,20,0.85)';
      ctx.fillRect(12, 12, 220, 46);
      ctx.strokeStyle = '#1f3350'; ctx.strokeRect(12, 12, 220, 46);
      ctx.fillStyle = '#7c1f2c'; ctx.fillRect(20, 20, 204, 12);
      ctx.fillStyle = '#4be08a'; ctx.fillRect(20, 20, 204 * (p.hp / p.maxHP), 12);
      ctx.fillStyle = '#cfe6ff'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHP}`, 22, 21);
      const ammoTxt = p.reload > 0 ? 'RELOADING…' : `AMMO ${p.ammo}/${p.weapon.mag}`;
      ctx.fillText(`${p.weapon.name}   ${ammoTxt}`, 20, 40);

      // progress / objective
      const prog = U.clamp(p.x / this.length, 0, 1);
      ctx.fillStyle = 'rgba(8,12,20,0.85)';
      ctx.fillRect(cw - 232, 12, 220, 40);
      ctx.strokeStyle = '#1f3350'; ctx.strokeRect(cw - 232, 12, 220, 40);
      ctx.fillStyle = '#22304a'; ctx.fillRect(cw - 224, 36, 204, 8);
      ctx.fillStyle = '#36e0d8'; ctx.fillRect(cw - 224, 36, 204 * prog, 8);
      ctx.fillStyle = '#cfe6ff'; ctx.font = '11px Segoe UI, sans-serif';
      ctx.fillText(this.bossSpawned ? 'DEFEAT THE GUARDIAN' : 'REACH THE VAULT', cw - 224, 20);

      // boss bar
      if (this.boss && !this.boss.dead) {
        const b = this.boss;
        ctx.fillStyle = 'rgba(8,12,20,0.85)';
        ctx.fillRect(cw / 2 - 180, ch - 34, 360, 22);
        ctx.fillStyle = '#3a0f18'; ctx.fillRect(cw / 2 - 174, ch - 28, 348, 10);
        ctx.fillStyle = b.def.color; ctx.fillRect(cw / 2 - 174, ch - 28, 348 * (b.hp / b.maxHP), 10);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(b.def.name, cw / 2, ch - 30);
        ctx.textAlign = 'left';
      }
    }

    drawOutcome(ctx, cw, ch) {
      const a = U.clamp(this.fadeT * 1.5, 0, 0.82);
      ctx.fillStyle = `rgba(2,4,8,${a})`;
      ctx.fillRect(0, 0, cw, ch);
      if (this.fadeT < 0.5) return; // small delay before showing panel
      if (!this._panelShown) { this._panelShown = true; this.showOutcomePanel(); }
    }

    showOutcomePanel() {
      if (this.outcome === 'win') {
        const sm = this._summary || {};
        const rl = Object.entries(sm.reward || {}).map(([k, v]) => `+${v} ${k}`).join(' · ');
        const p = G.ui.show(`
          <h2><span class="accent">RAID COMPLETE</span></h2>
          <p class="sub">${this.base.name}</p>
          <div class="row">
            <div class="card"><h3>Salvage</h3><p>${rl}${this._pendingScrap ? ` · +${this._pendingScrap} scrap (field)` : ''}</p></div>
            <div class="card"><h3>Hostiles</h3><p>${this.kills} destroyed</p></div>
          </div>
          ${sm.gotTech ? `<div class="card" style="border-color:var(--violet)"><h3>✦ Alien fragment recovered</h3><p>Take it to the Research Lab to decode it.</p></div>`
                       : `<div class="card"><p>Site already stripped of fragments — salvage only.</p></div>`}
          ${sm.recruited ? `<div class="card"><h3>Survivor recruited</h3><p><b>${sm.recruited}</b> joined your bunker.</p></div>` : ''}
          <div class="footer-actions">
            <button class="btn primary" id="back">Return to Bunker</button>
          </div>
        `);
        p.querySelector('#back').onclick = () => { G.audio.ui(); G.ui.hide(); this.game.returnToBase(); };
      } else {
        const p = G.ui.show(`
          <h2 style="color:var(--danger)">YOU WENT DARK</h2>
          <p class="sub">${this.base.name}</p>
          <p style="font-size:13.5px;color:var(--ink-dim);line-height:1.6">
            Your suit flatlined. A recovery drone dragged you back to the bunker — battered, but alive.
            Any field scrap you grabbed was logged. Upgrade the <b>Med Bay</b> and <b>Armory</b>, then try again.
          </p>
          <div class="footer-actions">
            <button class="btn primary" id="back">Return to Bunker</button>
          </div>
        `);
        p.querySelector('#back').onclick = () => { G.audio.ui(); G.ui.hide(); this.game.returnToBase(); };
      }
    }
  }

  G.Mission = Mission;
})();
