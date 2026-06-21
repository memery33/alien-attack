/* story.js — shared DOM panel helpers (G.ui) + narrative screens:
   title, the cryo-awakening intro, mission briefings, and the endings. */

/* ---------- Shared panel/UI helpers ---------- */
G.ui = {
  layer() { return document.getElementById('panel-layer'); },

  // Show a panel from an HTML string. Returns the panel element so callers
  // can wire up buttons by id/class.
  show(html) {
    const layer = this.layer();
    layer.classList.remove('hidden');
    layer.innerHTML = `<div class="panel">${html}</div>`;
    return layer.querySelector('.panel');
  },

  hide() {
    const layer = this.layer();
    layer.classList.add('hidden');
    layer.innerHTML = '';
  },

  toast(msg, kind = '') {
    const wrap = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  hudVisible(v) {
    document.getElementById('hud').classList.toggle('hidden', !v);
  },
};

/* ---------- Story content ---------- */
G.story = {
  // Lines for the cryo-awakening intro, shown one screen at a time.
  intro: [
    {
      title: 'SUBSTRATA',
      text: `You don't remember falling asleep. You remember the questions.<br><br>` +
            `You were <b>Agent Cole Vance</b>, cleared for the deepest tier of the program — ` +
            `the one that catalogued every recovered craft, every fragment of <span class="accent">alien technology</span> ` +
            `pulled from a crash site and buried where no one would look.`,
    },
    {
      title: 'THE PROGRAM',
      text: `For years you filed the reports and asked no questions.<br><br>` +
            `Then you started asking. <i>Where does the tech go? What are we building with it? ` +
            `Who decided we'd never tell anyone?</i><br><br>` +
            `They didn't fire you. You were too useful — and you knew too much.`,
    },
    {
      title: 'COLD STORAGE',
      text: `So they put you on ice. Cryogenic suspension, "indefinite," buried in <b>Site B</b> ` +
            `with the rest of the things they wanted forgotten.<br><br>` +
            `Decades passed. The surface changed. The program fractured. ` +
            `The bunkers went dark, one by one — but the technology is still down here.`,
    },
    {
      title: 'AWAKENING',
      text: `A power surge. Frost cracks off the glass. The pod hisses open and you ` +
            `fall to a cold steel floor, gasping your first breath in years.<br><br>` +
            `The facility is abandoned but its <span class="accent">automated security</span> still hunts intruders. ` +
            `You are now an intruder.<br><br>` +
            `Find every fragment. Rebuild a crew. Recover what they hid — and finally learn the truth.`,
    },
  ],

  showTitle(onContinue, hasSave) {
    G.ui.hudVisible(false);
    const p = G.ui.show(`
      <h2><span class="accent">SUBSTRATA</span></h2>
      <p class="sub">ALIEN TECH RECOVERY — a side-scrolling base-builder</p>
      <p style="font-size:13.5px;color:var(--ink-dim);line-height:1.6;margin-bottom:18px">
        Trapped in cryo by the program you served, you wake in an abandoned underground complex.
        Build a bunker, recruit survivors, and raid the buried black sites to recover every
        fragment of alien technology — and the truth they froze you to hide.
      </p>
      <div class="footer-actions" style="justify-content:flex-start">
        ${hasSave ? `<button class="btn primary" id="btn-continue">▶ Continue</button>` : ''}
        <button class="btn ${hasSave ? '' : 'primary'}" id="btn-new">✦ New Game</button>
        <button class="btn" id="btn-mute">🔊 Sound</button>
      </div>
      <div class="divider"></div>
      <p style="font-size:11.5px;color:var(--ink-dim)">
        Tip: In a raid, reach the end and defeat the guardian to recover the fragment. Back in the
        bunker, assign crew to rooms to generate resources, then build the <b>Research Lab</b> to decode what you find.
      </p>
    `);
    if (hasSave) p.querySelector('#btn-continue').onclick = () => { G.audio.ui(); onContinue('continue'); };
    p.querySelector('#btn-new').onclick = () => {
      G.audio.ui();
      if (!hasSave || confirm('Start a new game? This erases your current bunker and progress.')) {
        onContinue('new');
      }
    };
    p.querySelector('#btn-mute').onclick = (e) => {
      const muted = G.audio.toggleMute();
      e.target.textContent = muted ? '🔇 Muted' : '🔊 Sound';
    };
  },

  // Walk through intro screens, then call done().
  showIntro(done) {
    G.ui.hudVisible(false);
    let i = 0;
    const render = () => {
      const s = this.intro[i];
      const last = i === this.intro.length - 1;
      const p = G.ui.show(`
        <h2>${s.title}</h2>
        <p style="font-size:14.5px;line-height:1.7;color:var(--ink);margin:14px 0 22px">${s.text}</p>
        <div class="footer-actions">
          <button class="btn" id="skip">Skip</button>
          <button class="btn primary" id="next">${last ? 'Step out ▶' : 'Next →'}</button>
        </div>
        <p style="text-align:right;font-size:11px;color:var(--ink-dim);margin-top:8px">${i + 1} / ${this.intro.length}</p>
      `);
      p.querySelector('#next').onclick = () => {
        G.audio.ui();
        if (last) done(); else { i++; render(); }
      };
      p.querySelector('#skip').onclick = () => { G.audio.ui(); done(); };
    };
    render();
  },

  showVictory(state, onReset) {
    G.audio.win();
    G.ui.hudVisible(false);
    const p = G.ui.show(`
      <h2><span class="accent">THE TRUTH</span></h2>
      <p style="font-size:14.5px;line-height:1.7;margin:14px 0">
        The final fragment locks into the array in your Research Lab. The pieces light up,
        align, and project a single image into the cold air of the bunker.<br><br>
        It was never a crash. It was an <b>arrival</b> — and the program didn't bury the
        technology to study it. They buried it because they were <i>told to wait</i>.
        Now the array is complete, it's transmitting. Something is answering.<br><br>
        <span class="accent">You recovered everything they hid. The rest of the story is just beginning.</span>
      </p>
      <div class="divider"></div>
      <div class="row">
        <div class="card"><h3>Fragments</h3><p>${state.tech} / ${G.data.totalTech} recovered</p></div>
        <div class="card"><h3>Raids run</h3><p>${state.stats.raids}</p></div>
        <div class="card"><h3>Hostiles destroyed</h3><p>${state.stats.kills}</p></div>
      </div>
      <div class="footer-actions">
        <button class="btn primary" id="again">New Game +</button>
      </div>
    `);
    p.querySelector('#again').onclick = () => { G.audio.ui(); onReset(); };
  },
};
