/* entities.js — actors for the side-scrolling raids: Player, Enemy, Boss,
   Bullet, Pickup, Particle. Physics + AI live here; the Mission orchestrates. */

(function () {
  const U = G.util;
  const T = G.data.tune;

  // A flexible particle: sparks, smoke, debris chunks, and shockwave rings.
  // Back-compatible — `new Particle(x, y, color)` still gives a default spark.
  class Particle {
    constructor(x, y, color, opts) {
      opts = opts || {};
      this.x = x; this.y = y;
      this.kind = opts.kind || 'spark';   // spark | smoke | debris | ring | glow
      this.vx = opts.vx != null ? opts.vx : U.rand(-3, 3);
      this.vy = opts.vy != null ? opts.vy : U.rand(-4, 1);
      this.life = opts.life != null ? opts.life : U.rand(18, 34);
      this.max = this.life;
      this.color = color;
      this.size = opts.size != null ? opts.size : U.rand(1.5, 3.5);
      this.grav = opts.grav != null ? opts.grav : 0.2;
      this.drag = opts.drag != null ? opts.drag : 1;
      this.glow = opts.glow || 0;
      this.spin = opts.spin || 0; this.ang = Math.random() * Math.PI * 2;
      if (this.kind === 'ring') { this.r = opts.r0 || 2; this.grow = opts.grow || 3; }
    }
    update() {
      if (this.kind === 'ring') { this.r += this.grow; this.grow *= 0.9; this.life--; return; }
      this.x += this.vx; this.y += this.vy;
      this.vy += this.grav; this.vx *= this.drag; this.vy *= this.drag;
      if (this.kind === 'smoke') this.size += 0.35;
      this.ang += this.spin;
      this.life--;
    }
    get dead() { return this.life <= 0; }
    draw(ctx, cam) {
      const t = Math.max(0, this.life / this.max);
      const x = this.x - cam;
      if (this.kind === 'ring') {
        ctx.save();
        ctx.globalAlpha = t * 0.6; ctx.strokeStyle = this.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, this.y, this.r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore(); return;
      }
      ctx.globalAlpha = this.kind === 'smoke' ? t * 0.4 : t;
      if (this.glow) { ctx.save(); ctx.shadowColor = this.color; ctx.shadowBlur = this.glow; }
      ctx.fillStyle = this.color;
      const s = this.size * (this.kind === 'spark' ? (0.4 + t * 0.6) : 1);
      if (this.kind === 'debris') {
        ctx.save(); ctx.translate(x, this.y); ctx.rotate(this.ang);
        ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
      } else {
        ctx.fillRect(x - s / 2, this.y - s / 2, s, s);
      }
      if (this.glow) ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  class Bullet {
    constructor(x, y, vx, vy, dmg, owner, color) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.dmg = dmg; this.owner = owner; // 'player' | 'enemy'
      this.w = 6; this.h = 3; this.color = color || (owner === 'player' ? '#36e0d8' : '#ff7755');
      this.dead = false;
      this.life = 120;
    }
    update() {
      this.x += this.vx; this.y += this.vy; this.life--;
      if (this.life <= 0) this.dead = true;
    }
    draw(ctx, cam) {
      const x = this.x - cam;
      ctx.save();
      // soft motion trail
      ctx.globalAlpha = 0.35; ctx.fillStyle = this.color;
      const tl = Math.max(10, Math.abs(this.vx) * 1.6);
      ctx.fillRect(x, this.y - this.h / 2, this.vx >= 0 ? -tl : tl, this.h);
      // bright glowing head
      ctx.globalAlpha = 1;
      ctx.shadowColor = this.color; ctx.shadowBlur = 9;
      const w = Math.max(this.w, Math.abs(this.vx) * 0.6);
      ctx.fillRect(x, this.y - this.h / 2, this.vx >= 0 ? w : -w, this.h);
      ctx.restore();
    }
  }

  class Pickup {
    constructor(x, y, kind, amount) {
      this.x = x; this.y = y; this.w = 18; this.h = 18;
      this.kind = kind;     // 'tech' | 'health' | 'scrap'
      this.amount = amount || 0;
      this.dead = false;
      this.bob = Math.random() * Math.PI * 2;
    }
    update() { this.bob += 0.08; }
    draw(ctx, cam) {
      const y = this.y + Math.sin(this.bob) * 4;
      if (G.assets.drawIn(ctx, 'pickup-' + this.kind, this.x - cam - 3, y - 3, this.w + 6, this.h + 6, false)) return;
      ctx.save();
      const colors = { tech: '#9a6cff', health: '#4be08a', scrap: '#c7a06b' };
      ctx.shadowColor = colors[this.kind]; ctx.shadowBlur = 14;
      ctx.fillStyle = colors[this.kind];
      if (this.kind === 'tech') {
        // diamond
        ctx.translate(this.x - cam + this.w / 2, y + this.h / 2);
        ctx.rotate(this.bob * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(9, 0); ctx.lineTo(0, 11); ctx.lineTo(-9, 0);
        ctx.closePath(); ctx.fill();
      } else if (this.kind === 'health') {
        ctx.fillRect(this.x - cam + 6, y, 6, 18);
        ctx.fillRect(this.x - cam, y + 6, 18, 6);
      } else {
        ctx.fillRect(this.x - cam, y, this.w, this.h);
      }
      ctx.restore();
    }
  }

  class Player {
    constructor(x, y, weapon, maxHP) {
      this.x = x; this.y = y; this.w = 26; this.h = 44;
      this.vx = 0; this.vy = 0;
      this.onGround = false;
      this.facing = 1;
      this.weapon = weapon;
      this.maxHP = maxHP; this.hp = maxHP;
      this.cooldown = 0;
      this.ammo = weapon.mag; this.reload = 0;
      this.invuln = 0;
      this.walkAnim = 0;
      this.muzzle = 0;
      this.recoil = 0;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    update(mission) {
      this.mission = mission;       // kept so hurt()/effects can reach the FX bus
      const inp = G.input;
      // horizontal
      if (inp.left())  { this.vx = -T.playerSpeed; this.facing = -1; }
      else if (inp.right()) { this.vx = T.playerSpeed; this.facing = 1; }
      else this.vx = 0;

      if (Math.abs(this.vx) > 0) this.walkAnim += 0.25; else this.walkAnim = 0;

      // jump
      if (inp.jumpPressed() && this.onGround) {
        this.vy = -T.jumpForce; this.onGround = false; G.audio.jump();
        mission.fx(this.cx, this.y + this.h, '#9fb0c8', 5, { kind: 'smoke', vy: 0.3, grav: -0.03, life: 16, size: 2, drag: 0.92 });
      }
      // gravity
      this.vy += T.gravity;
      if (this.vy > 16) this.vy = 16;

      // apply with terrain collision (handled by mission via ground segments)
      const wasAir = !this.onGround, fallV = this.vy;
      mission.moveActor(this);
      // landing impact: dust kick + a touch of screen shake on a hard fall
      if (wasAir && this.onGround && fallV > 7) {
        mission.fx(this.cx, this.y + this.h, '#9fb0c8', 7, { kind: 'smoke', vy: -0.4, grav: -0.02, life: 18, size: 2.4, drag: 0.9, vx: undefined });
        mission.addShake(Math.min(3, fallV * 0.18));
      }

      // shooting
      if (this.cooldown > 0) this.cooldown--;
      if (this.reload > 0) { this.reload--; if (this.reload === 0) this.ammo = this.weapon.mag; }
      if (inp.shooting() && this.cooldown === 0 && this.reload === 0) {
        this.shoot(mission);
      }
      if (this.invuln > 0) this.invuln--;
      if (this.muzzle > 0) this.muzzle--;
      if (this.recoil > 0) this.recoil -= 0.5;
    }

    shoot(mission) {
      if (this.ammo <= 0) { this.reload = 45; G.audio.deny(); return; }
      this.ammo--;
      this.cooldown = this.weapon.fireRate;
      const bx = this.facing > 0 ? this.x + this.w : this.x;
      const by = this.y + 16;
      mission.bullets.push(new Bullet(bx, by, this.facing * this.weapon.bulletSpeed, 0, this.weapon.dmg, 'player'));
      this.muzzle = 5;
      // muzzle smoke + a few forward sparks for kick
      const mx = this.facing > 0 ? this.x + this.w + 8 : this.x - 8;
      for (let i = 0; i < 3; i++) {
        mission.particles.push(new Particle(mx, by, '#bfe9ff', {
          kind: 'spark', vx: this.facing * U.rand(1, 4), vy: U.rand(-1, 1),
          life: U.rand(6, 12), size: U.rand(1, 2.4), grav: 0.05, glow: 6,
        }));
      }
      this.recoil = 2;            // visual kickback, read by draw()
      mission.addShake(0.5);
      G.audio.shoot();
      if (this.ammo === 0) this.reload = 45;
    }

    hurt(dmg) {
      if (this.invuln > 0) return;
      this.hp -= dmg; this.invuln = 40; G.audio.hurt();
      if (this.hp < 0) this.hp = 0;
      // impact feedback: red flash, shake, brief freeze, spray
      const m = this.mission;
      if (m) {
        m.addShake(4); m.addFlash(0.32, 'red'); m.setHitStop(0.05);
        m.fx(this.cx, this.cy, '#ff5566', 8, { kind: 'spark', life: U.rand(10, 20), glow: 6, grav: 0.15 });
      }
    }

    draw(ctx, cam) {
      const x = this.x - cam - this.facing * (this.recoil || 0), y = this.y;
      // contact shadow under the feet
      ctx.save();
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x + this.w / 2, y + this.h + 1, this.w * 0.55, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      if (this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.4;
      // sprite if available, else procedural armored suit
      if (!G.assets.drawIn(ctx, 'player', x - 4, y - 6, this.w + 8, this.h + 8, this.facing < 0)) {
        // legs (alternating stride)
        const legSwing = this.onGround ? Math.sin(this.walkAnim) * 4 : 2;
        ctx.fillStyle = '#202c44';
        ctx.fillRect(x + 4, y + 30, 7, 14 - legSwing);
        ctx.fillRect(x + 15, y + 30, 7, 14 + legSwing);
        // body — armored suit with shading
        ctx.fillStyle = '#39507a';
        ctx.fillRect(x + 2, y + 12, this.w - 4, 22);
        ctx.fillStyle = '#4a6aa0';
        ctx.fillRect(x + 2, y + 12, this.w - 4, 6);
        ctx.fillStyle = '#2c4066'; // chest seam
        ctx.fillRect(x + 2, y + 22, this.w - 4, 2);
        // backpack
        ctx.fillStyle = '#2a3a5c';
        ctx.fillRect(this.facing > 0 ? x : x + this.w - 5, y + 14, 5, 16);
        // visor head with glow
        ctx.fillStyle = '#161f30';
        ctx.fillRect(x + 6, y, 14, 14);
        ctx.save();
        ctx.shadowColor = '#36e0d8'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#46f0e6';
        ctx.fillRect(x + (this.facing > 0 ? 11 : 7), y + 4, 7, 4);
        ctx.restore();
        // gun
        ctx.fillStyle = '#cdd7e6';
        const gx = this.facing > 0 ? x + this.w - 2 : x - 12;
        ctx.fillRect(gx, y + 16, 14, 5);
      }
      // muzzle flash
      if (this.muzzle > 0) {
        const fx = this.facing > 0 ? x + this.w + 10 : x - 10;
        ctx.save();
        ctx.shadowColor = '#bfe9ff'; ctx.shadowBlur = 12;
        ctx.fillStyle = '#eafaff';
        ctx.beginPath();
        ctx.arc(fx, y + 18, 4 + this.muzzle, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  class Enemy {
    constructor(type, x, y, def) {
      this.type = type;
      this.def = def;
      this.x = x; this.y = y; this.w = def.w; this.h = def.h;
      this.hp = def.hp; this.maxHP = def.hp;
      this.vx = 0; this.vy = 0;
      this.onGround = false;
      this.cooldown = U.randInt(20, def.fireRate || 60);
      this.dead = false;
      this.flash = 0;
      this.baseY = y;
      this.face = -1;
      this.t = Math.random() * Math.PI * 2;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    update(mission) {
      const p = mission.player;
      const def = this.def;
      const dx = p.cx - this.cx;
      const dir = Math.sign(dx) || 1;
      this.face = dir;

      if (def.fly) {
        // hover toward player at a height, bob
        this.t += 0.05;
        const targetY = p.cy - 60 + Math.sin(this.t) * 30;
        this.y += U.clamp(targetY - this.y, -def.speed, def.speed);
        if (Math.abs(dx) > 120) this.x += dir * def.speed;
        else this.x += dir * def.speed * 0.3;
      } else if (def.fixed) {
        // turret — stays put, gravity to settle
        this.vy += T.gravity; mission.moveActor(this);
      } else {
        // walker — chase if in range
        if (Math.abs(dx) < 360) this.vx = dir * def.speed;
        else this.vx = 0;
        this.vy += T.gravity;
        mission.moveActor(this);
      }

      // contact damage
      if (U.aabb(this, p)) p.hurt(def.dmg * 0.04 + 0.2);

      // ranged fire
      if (def.fireRate > 0) {
        this.cooldown--;
        if (this.cooldown <= 0 && Math.abs(dx) < 460 && Math.abs(p.cy - this.cy) < 120) {
          this.cooldown = def.fireRate + U.randInt(-8, 8);
          const speed = 5;
          const ang = Math.atan2(p.cy - this.cy, p.cx - this.cx);
          mission.bullets.push(new Bullet(this.cx, this.cy, Math.cos(ang) * speed, Math.sin(ang) * speed, def.dmg, 'enemy'));
          G.audio.enemyShot();
        }
      }
      if (this.flash > 0) this.flash--;
    }

    hurt(dmg, mission) {
      this.hp -= dmg; this.flash = 6;
      // hit sparks + a floating damage number for readable feedback
      mission.fx(this.cx, this.cy - this.h * 0.2, '#ffe6a0', 4, { kind: 'spark', life: U.rand(8, 16), glow: 5, grav: 0.12 });
      mission.floater(this.cx, this.y - 4, Math.round(dmg), '#ffd27a');
      if (this.isBoss) mission.addShake(1);
      if (this.hp <= 0) { this.dead = true; this.die(mission); }
    }

    die(mission) {
      const c = this.def.color;
      if (this.isBoss) {
        // boss: layered explosion, hard shake, white flash, brief freeze
        mission.burst(this.cx, this.cy, c, 2.4);
        for (let i = 0; i < 3; i++) {
          mission.particles.push(new Particle(this.cx, this.cy, '#ffffff', { kind: 'ring', r0: 4 + i * 6, grow: 6, life: 26 }));
        }
        mission.addShake(11); mission.addFlash(0.55, 'white'); mission.setHitStop(0.16);
      } else {
        mission.burst(this.cx, this.cy, c, 1);
        mission.addShake(3.2); mission.setHitStop(0.04);
      }
      G.audio.explode();
      mission.kills++;
      mission.score += this.def.score;
      // chance to drop pickups
      if (U.chance(0.25)) mission.pickups.push(new Pickup(this.cx, this.cy, 'health', 20));
      else if (U.chance(0.4)) mission.pickups.push(new Pickup(this.cx, this.cy, 'scrap', U.randInt(2, 6)));
    }

    draw(ctx, cam) {
      const x = this.x - cam, y = this.y;
      // contact shadow for grounded units
      if (!this.def.fly) {
        ctx.save();
        ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(x + this.w / 2, y + this.h + 1, this.w * 0.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const eKey = 'enemy-' + this.type;
      if (G.assets.image(eKey)) {
        G.assets.drawIn(ctx, eKey, x, y, this.w, this.h, this.face < 0);
        if (this.flash > 0) { ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, this.w, this.h); ctx.restore(); }
      } else {
        ctx.save();
        ctx.fillStyle = this.flash > 0 ? '#ffffff' : this.def.color;
        ctx.shadowColor = this.def.color; ctx.shadowBlur = this.def.fly ? 10 : 4;
        if (this.def.fly) {
          // saucer drone
          ctx.beginPath();
          ctx.ellipse(x + this.w / 2, y + this.h / 2, this.w / 2, this.h / 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0b1018';
          ctx.fillRect(x + this.w / 2 - 3, y + this.h / 2 - 1, 6, 3);
        } else if (this.def.fixed) {
          ctx.fillRect(x, y, this.w, this.h);
          ctx.fillStyle = '#0b1018';
          ctx.fillRect(x + 4, y + this.h / 2 - 3, this.w - 8, 6);
        } else {
          // humanoid
          ctx.fillRect(x + 3, y, this.w - 6, this.h);
          ctx.fillStyle = '#0b1018';
          ctx.fillRect(x + 5, y + 4, this.w - 10, 6);
        }
        ctx.restore();
      }
      // hp bar
      if (this.hp < this.maxHP) {
        ctx.fillStyle = '#22120f';
        ctx.fillRect(x, y - 7, this.w, 3);
        ctx.fillStyle = '#ff5566';
        ctx.fillRect(x, y - 7, this.w * (this.hp / this.maxHP), 3);
      }
    }
  }

  class Boss extends Enemy {
    constructor(def, x, y) {
      super('boss', x, y, def);
      this.isBoss = true;
      this.phase = 0;
      this.salvo = 0;
    }
    update(mission) {
      const p = mission.player;
      this.t += 0.02;
      // float menacingly, track player loosely
      this.y = this.baseY + Math.sin(this.t) * 24;
      const dx = p.cx - this.cx;
      this.face = Math.sign(dx) || -1;
      if (Math.abs(dx) > 220) this.x += Math.sign(dx) * 1.1;

      this.cooldown--;
      if (this.cooldown <= 0) {
        this.cooldown = this.def.fireRate;
        // spread shot
        const n = 3 + Math.floor((1 - this.hp / this.maxHP) * 4);
        const baseAng = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        for (let i = 0; i < n; i++) {
          const ang = baseAng + (i - (n - 1) / 2) * 0.18;
          const sp = 4.5;
          mission.bullets.push(new Bullet(this.cx, this.cy, Math.cos(ang) * sp, Math.sin(ang) * sp, this.def.dmg, 'enemy', '#ff88aa'));
        }
        G.audio.enemyShot();
      }
      if (U.aabb(this, p)) p.hurt(this.def.dmg * 0.05 + 0.3);
      if (this.flash > 0) this.flash--;
    }
    draw(ctx, cam) {
      const x = this.x - cam, y = this.y;
      const bKey = 'boss-' + (this.def.key || '');
      if (G.assets.image(bKey)) {
        G.assets.drawIn(ctx, bKey, x, y, this.w, this.h, this.face < 0);
        if (this.flash > 0) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, this.w, this.h); ctx.restore(); }
        return;
      }
      ctx.save();
      ctx.shadowColor = this.def.color; ctx.shadowBlur = 24;
      ctx.fillStyle = this.flash > 0 ? '#fff' : this.def.color;
      ctx.beginPath();
      ctx.ellipse(x + this.w / 2, y + this.h / 2, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // core eye
      ctx.fillStyle = '#0b1018';
      ctx.beginPath();
      ctx.arc(x + this.w / 2, y + this.h / 2, this.w / 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff3355';
      ctx.beginPath();
      ctx.arc(x + this.w / 2, y + this.h / 2, this.w / 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  G.ent = { Particle, Bullet, Pickup, Player, Enemy, Boss };
})();
