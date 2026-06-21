/* audio.js — tiny WebAudio synth so we need zero sound asset files.
   All effects are generated procedurally. Respects a mute flag. */

G.audio = {
  ctx: null,
  muted: false,

  _ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  // Core blip: a tone with a quick envelope.
  _blip(freq, dur, type = 'square', vol = 0.15, slideTo = null) {
    if (this.muted) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  // Noise burst for explosions / hits.
  _noise(dur, vol = 0.2) {
    if (this.muted) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1200;
    src.connect(filt).connect(gain).connect(ctx.destination);
    src.start(t);
  },

  shoot()    { this._blip(720, 0.07, 'square', 0.08, 380); },
  enemyShot(){ this._blip(220, 0.10, 'sawtooth', 0.06, 140); },
  hit()      { this._blip(140, 0.05, 'square', 0.10); },
  explode()  { this._noise(0.35, 0.22); },
  pickup()   { this._blip(520, 0.08, 'triangle', 0.12, 880); setTimeout(() => this._blip(880, 0.10, 'triangle', 0.12, 1320), 60); },
  techGet()  { [392,523,659,880].forEach((f,i)=>setTimeout(()=>this._blip(f,0.18,'triangle',0.14),i*90)); },
  jump()     { this._blip(300, 0.10, 'square', 0.07, 560); },
  hurt()     { this._blip(160, 0.18, 'sawtooth', 0.14, 80); },
  build()    { this._blip(440, 0.10, 'triangle', 0.12, 660); },
  deny()     { this._blip(180, 0.14, 'square', 0.10, 120); },
  ui()       { this._blip(600, 0.04, 'square', 0.05); },
  win()      { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this._blip(f,0.3,'triangle',0.14),i*140)); },
  lose()     { [400,330,260,180].forEach((f,i)=>setTimeout(()=>this._blip(f,0.3,'sawtooth',0.12),i*160)); },

  toggleMute() { this.muted = !this.muted; return this.muted; },
};
