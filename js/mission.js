/* mission.js — the side-scrolling raid. Owns terrain, camera, spawns, the
   boss arena, and win/lose. Reads weapon/HP from saved bunker upgrades. */

(function () {
  const U = G.util;
  const Ent = G.ent;

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

      this.buildLevel();
      G.ui.toast(this.base.intro, '');
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
      // ground
      ctx.fillStyle = '#11161f';
      ctx.fillRect(0, this.groundY, cw, ch - this.groundY);
      ctx.fillStyle = '#1b2533';
      ctx.fillRect(0, this.groundY, cw, 4);
      // platforms
      for (const pf of this.platforms) {
        const x = pf.x - cam;
        if (x > cw || x + pf.w < 0) continue;
        ctx.fillStyle = '#1c2840';
        ctx.fillRect(x, pf.y, pf.w, pf.h);
        ctx.fillStyle = '#2a3a5c';
        ctx.fillRect(x, pf.y, pf.w, 3);
      }
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

      this.drawHUD(ctx, cw, ch);

      if (this.outcome) this.drawOutcome(ctx, cw, ch);
    }

    drawBackground(ctx, cw, ch) {
      const biome = this.base.biome;
      const tints = {
        silo: ['#0a1018', '#0d141f'],
        lab:  ['#0a1416', '#0c1a20'],
        cave: ['#1a0e0a', '#0f0a08'],
        alien:['#120a1c', '#0a0814'],
      };
      const [a, b] = tints[biome] || tints.silo;
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);

      // parallax pillars
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      const spacing = 180;
      const off = (this.cam * 0.4) % spacing;
      for (let x = -off; x < cw; x += spacing) {
        ctx.fillRect(x, 0, 60, this.groundY);
      }
      // accent glow lines for alien biome
      if (biome === 'alien') {
        ctx.strokeStyle = 'rgba(154,108,255,0.12)';
        ctx.lineWidth = 2;
        const o2 = (this.cam * 0.6) % 120;
        for (let x = -o2; x < cw; x += 120) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, this.groundY); ctx.stroke();
        }
      }
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
