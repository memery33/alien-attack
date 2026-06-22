/* audio.js — tiny WebAudio synth so we need zero sound asset files.
   All effects are generated procedurally. Routed through a master gain +
   limiter for polish. Respects a mute flag. Optional ambient music bed. */

G.audio = {
  ctx: null,
  muted: false,
  volume: 0.8,          // master SFX/music volume (0..1)

  _master: null,        // master gain node
  _comp: null,          // master compressor/limiter
  _musicGain: null,     // music sub-bus (quieter, sits under SFX)
  _musicTimer: null,    // setInterval handle for the music scheduler
  _musicMood: null,     // currently playing mood, or null
  _musicVoices: [],     // live music oscillators (so we can stop them)

  // ---- Core graph -------------------------------------------------------

  _ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.ctx = null; }
    }
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Build the master chain once: source -> master gain -> limiter -> out.
    if (!this._master) {
      const master = this.ctx.createGain();
      master.gain.value = this.volume;
      // Gentle limiter so overlapping sounds don't clip or get harsh.
      // Guarded: some environments (headless/partial stubs) lack it.
      let comp = null;
      try {
        if (this.ctx.createDynamicsCompressor) {
          comp = this.ctx.createDynamicsCompressor();
          comp.threshold.value = -12;
          comp.knee.value = 24;
          comp.ratio.value = 6;
          comp.attack.value = 0.003;
          comp.release.value = 0.25;
        }
      } catch (e) { comp = null; }
      if (comp) master.connect(comp).connect(this.ctx.destination);
      else master.connect(this.ctx.destination);
      this._comp = comp;
      this._master = master;
    }
    return this.ctx;
  },

  // Where SFX should connect (falls back to destination if graph missing).
  _out() { return this._master || (this.ctx && this.ctx.destination); },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._master && this.ctx) {
      const g = this._master.gain;
      if (g.setTargetAtTime) g.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
      else g.value = this.volume;
    }
    return this.volume;
  },

  // ---- Primitive voices -------------------------------------------------

  // Core blip: a tone with a quick attack/decay envelope, optional pitch slide.
  // dest lets callers route into a sub-bus (e.g. music). attack shapes the onset.
  _blip(freq, dur, type = 'square', vol = 0.15, slideTo = null, dest = null, attack = 0.005, detune = 0) {
    if (this.muted) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    if (detune && osc.detune) osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    // Short attack avoids clicks; exponential decay sounds natural.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(dest || this._out());
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  // Filtered noise burst for explosions / hits. Returns nothing.
  _noise(dur, vol = 0.2, filterType = 'lowpass', cutoff = 1200, dest = null) {
    if (this.muted) return;
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = cutoff;
    src.connect(filt).connect(gain).connect(dest || this._out());
    src.start(t);
  },

  // ---- Game SFX ---------------------------------------------------------

  // Tight laser: fast pitch drop + tiny noise transient for body. Quiet so
  // sustained fire stays comfortable.
  shoot() {
    this._blip(900, 0.06, 'square', 0.05, 300);
    this._blip(900, 0.06, 'sawtooth', 0.025, 300, null, 0.002, 8);
    this._noise(0.025, 0.03, 'highpass', 2000);
  },

  enemyShot() {
    this._blip(240, 0.10, 'sawtooth', 0.05, 130);
    this._noise(0.03, 0.025, 'bandpass', 600);
  },

  // Short percussive thock: filtered noise click + low tone.
  hit() {
    this._noise(0.05, 0.10, 'lowpass', 900);
    this._blip(150, 0.06, 'square', 0.07, 90);
  },

  // Layered explosion: low sine boom sweeping down + filtered noise burst
  // with a longer tail. Big enough to read as boss-scale.
  explode() {
    this._blip(120, 0.45, 'sine', 0.22, 35, null, 0.004);   // low boom
    this._blip(90, 0.5, 'triangle', 0.12, 28, null, 0.004); // sub layer
    this._noise(0.4, 0.18, 'lowpass', 1600);                // debris/tail
    this._noise(0.08, 0.10, 'highpass', 3000);              // initial crack
  },

  // Pleasant rising arpeggios (kept).
  pickup() {
    this._blip(520, 0.08, 'triangle', 0.10, 880);
    setTimeout(() => this._blip(880, 0.10, 'triangle', 0.10, 1320), 60);
  },
  techGet() {
    [392, 523, 659, 880].forEach((f, i) =>
      setTimeout(() => this._blip(f, 0.18, 'triangle', 0.11), i * 90));
  },

  jump() { this._blip(320, 0.10, 'square', 0.06, 600, null, 0.004); },

  // Damped negative buzz: detuned saws sliding down.
  hurt() {
    this._blip(180, 0.20, 'sawtooth', 0.10, 70);
    this._blip(180, 0.20, 'sawtooth', 0.06, 70, null, 0.004, -14);
  },

  build() {
    this._blip(440, 0.10, 'triangle', 0.09, 660, null, 0.004);
    setTimeout(() => this._blip(660, 0.10, 'triangle', 0.08, 880), 70);
  },
  deny() {
    this._blip(200, 0.10, 'square', 0.08, 150);
    setTimeout(() => this._blip(150, 0.14, 'square', 0.08, 100), 90);
  },
  ui() { this._blip(620, 0.04, 'triangle', 0.04, null, null, 0.003); },

  // Short musical stings.
  win() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => {
        this._blip(f, 0.3, 'triangle', 0.11);
        this._blip(f, 0.3, 'sine', 0.05, null, null, 0.005, 6);
      }, i * 130));
  },
  lose() {
    [392, 311, 247, 185].forEach((f, i) =>
      setTimeout(() => {
        this._blip(f, 0.34, 'sawtooth', 0.09);
        this._blip(f / 2, 0.34, 'sine', 0.05);
      }, i * 160));
  },

  // ---- Ambient music bed ------------------------------------------------

  // Mood definitions: root note (Hz), a minor/sci-fi scale (semitone offsets),
  // pad oscillator type, and arpeggio note length / tempo feel.
  _moods: {
    bunker: { root: 110.00, scale: [0, 3, 7, 10, 12],  type: 'sine',     beat: 1.6, cutoff: 700 },  // A minor-ish, warm
    silo:   { root: 98.00,  scale: [0, 2, 3, 7, 8],    type: 'triangle', beat: 1.8, cutoff: 600 },  // G phrygian-ish, cold
    lab:    { root: 130.81, scale: [0, 2, 5, 7, 9],    type: 'sine',     beat: 1.3, cutoff: 1100 }, // C, bright/clinical
    cave:   { root: 73.42,  scale: [0, 3, 5, 6, 10],   type: 'triangle', beat: 2.2, cutoff: 450 },  // D low, dark/blue
    alien:  { root: 138.59, scale: [0, 1, 4, 6, 11],   type: 'sawtooth', beat: 1.1, cutoff: 900 },  // dissonant/sci-fi
  },

  // Start a slow, very quiet looping pad/arpeggio. Safe to call repeatedly.
  startMusic(mood) {
    if (this.muted) return;
    const ctx = this._ensure();
    if (!ctx) return;
    this.stopMusic();                 // never stack two beds

    const def = this._moods[mood] || this._moods.bunker;
    this._musicMood = (this._moods[mood] ? mood : 'bunker');

    // Dedicated quiet sub-bus so music sits well under SFX.
    const bus = ctx.createGain();
    bus.gain.value = 0.0001;
    bus.connect(this._out());
    if (bus.gain.setTargetAtTime) bus.gain.setTargetAtTime(0.18, ctx.currentTime, 1.5);  // slow fade-in
    else bus.gain.value = 0.18;
    this._musicGain = bus;

    let step = 0;
    const semi = (n) => def.root * Math.pow(2, n / 12);

    const tick = () => {
      if (this.muted || !this._musicGain) return;
      const t = this.ctx.currentTime;

      // Sustained low drone pad: two slightly detuned voices through a soft
      // lowpass. Re-triggered each bar so it loops cleanly without buildup.
      [0, 0.5].forEach((det, k) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = def.cutoff;
        osc.type = def.type;
        osc.frequency.value = def.root;
        if (osc.detune) osc.detune.value = (k === 0 ? -det : det) * 14;
        const dur = def.beat * 4;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.14, t + def.beat);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(f).connect(g).connect(this._musicGain);
        osc.start(t);
        osc.stop(t + dur + 0.05);
        this._musicVoices.push(osc);
      });

      // Sparse arpeggio note from the scale, a couple octaves up.
      const sc = def.scale;
      const note = sc[step % sc.length] + 12 * (1 + (step % 3 === 0 ? 1 : 0));
      const a = this.ctx.createOscillator();
      const ag = this.ctx.createGain();
      const af = this.ctx.createBiquadFilter();
      af.type = 'lowpass'; af.frequency.value = def.cutoff * 2.5;
      a.type = 'triangle';
      a.frequency.value = semi(note);
      const adur = def.beat * 1.4;
      ag.gain.setValueAtTime(0.0001, t);
      ag.gain.exponentialRampToValueAtTime(0.06, t + 0.08);
      ag.gain.exponentialRampToValueAtTime(0.0001, t + adur);
      a.connect(af).connect(ag).connect(this._musicGain);
      a.start(t);
      a.stop(t + adur + 0.05);
      this._musicVoices.push(a);

      // Trim the voice list so it can't grow unbounded.
      if (this._musicVoices.length > 24) this._musicVoices.splice(0, this._musicVoices.length - 24);

      step++;
    };

    tick();                                          // immediate first hit
    this._musicTimer = setInterval(tick, def.beat * 1000);
  },

  // Fade out and clear the loop cleanly (no leaked intervals/voices).
  stopMusic() {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    this._musicMood = null;
    const ctx = this.ctx;
    const bus = this._musicGain;
    const voices = this._musicVoices;
    this._musicGain = null;
    this._musicVoices = [];
    if (ctx && bus) {
      const t = ctx.currentTime;
      try {
        if (bus.gain.cancelScheduledValues) bus.gain.cancelScheduledValues(t);
        if (bus.gain.setTargetAtTime) bus.gain.setTargetAtTime(0.0001, t, 0.4);
        else bus.gain.value = 0.0001;
      } catch (e) { /* ignore */ }
      // Stop voices and tear down the bus after the fade.
      setTimeout(() => {
        voices.forEach(v => { try { v.stop(); } catch (e) {} });
        try { bus.disconnect(); } catch (e) {}
      }, 1500);
    }
  },

  // ---- Mute -------------------------------------------------------------

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopMusic();   // silence ambient bed on mute
    return this.muted;
  },
};
