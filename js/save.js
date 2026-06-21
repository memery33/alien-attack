/* save.js — persistent game state in localStorage + the canonical state shape. */

G.SAVE_KEY = 'substrata_save_v1';

G.save = {
  newState() {
    const t = G.data.tune;
    return {
      version: 1,
      seenIntro: false,
      scrap: t.startScrap,
      energy: t.startEnergy,
      food: t.startFood,
      tech: 0,                 // alien fragments recovered
      decoded: 0,              // fragments analyzed in the lab
      // rooms: key -> { level, crew }. Command + bunks exist at start.
      rooms: {
        command: { level: 1, crew: 0 },
        bunks:   { level: 1, crew: 0 },
        generator: { level: 1, crew: 1 },
        kitchen: { level: 1, crew: 1 },
      },
      crew: 3,                 // total survivors (you + 2 starters assigned above)
      crewNames: ['Vega', 'Renn'],
      clearedBases: {},        // baseKey -> true
      stats: { raids: 0, kills: 0, deaths: 0 },
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(G.SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.version !== 1) return null;
      return s;
    } catch (e) {
      console.warn('save load failed', e);
      return null;
    }
  },

  write(state) {
    try {
      localStorage.setItem(G.SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('save write failed', e);
    }
  },

  wipe() {
    try { localStorage.removeItem(G.SAVE_KEY); } catch (e) {}
  },
};

/* ----- Derived helpers that read state ----- */
G.derive = {
  maxCrew(state) {
    const b = state.rooms.bunks;
    const lvl = b ? b.level : 0;
    return 2 + lvl * G.data.rooms.bunks.capacityPerLevel; // base 2 + bunks
  },
  maxHP(state) {
    const m = state.rooms.medbay;
    const lvl = m ? m.level : 0;
    return G.data.tune.basePlayerHP + lvl * G.data.rooms.medbay.hpPerLevel;
  },
  armoryLevel(state) {
    const a = state.rooms.armory;
    return a ? a.level : 0;
  },
  weapon(state) {
    const lvl = G.util.clamp(G.derive.armoryLevel(state), 0, G.data.weaponByLevel.length - 1);
    return G.data.weaponByLevel[lvl];
  },
  // crew currently assigned across all rooms
  assignedCrew(state) {
    return Object.values(state.rooms).reduce((n, r) => n + (r.crew || 0), 0);
  },
  idleCrew(state) {
    return Math.max(0, state.crew - G.derive.assignedCrew(state));
  },
  hasRoom(state, key) { return !!state.rooms[key]; },
  // number of map sites visible given command level + tech gates
  visibleBases(state) {
    return G.data.bases.filter(b => state.tech >= b.unlockTech);
  },
};
