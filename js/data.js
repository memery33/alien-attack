/* data.js — static game definitions: rooms, bases (missions), enemies, tech.
   Pure data + tuning constants. Systems read from here. */

G.data = {};

/* ----- Resource keys ----- */
G.data.resources = ['scrap', 'energy', 'food'];

/* ----- Rooms in the bunker (Fallout-Shelter-style) -----
   Each room produces a resource per "tick" scaled by assigned crew and level.
   `build` is the one-time cost; `upgrade(level)` returns cost to reach next. */
G.data.rooms = {
  command: {
    key: 'command', name: 'Command Center', produces: null,
    desc: 'The heart of the bunker. Unlocks the surface map and lets you launch raids.',
    color: '#36e0d8', icon: '⌖',
    base: true, // exists from the start, cannot be removed
    maxLevel: 5,
    build: {},
    perk: 'Higher level reveals more underground sites on the map.',
  },
  bunks: {
    key: 'bunks', name: 'Crew Bunks', produces: null,
    desc: 'Beds for survivors you recruit. Raises your maximum crew size.',
    color: '#9a6cff', icon: '⌂',
    maxLevel: 5,
    capacityPerLevel: 2, // +2 max crew per level
    build: { scrap: 15 },
    perk: '+2 maximum crew per level.',
  },
  generator: {
    key: 'generator', name: 'Fusion Generator', produces: 'energy',
    desc: 'Salvaged reactor core. Generates Energy to power gear and rooms.',
    color: '#ffd24a', icon: '⚡',
    maxLevel: 5,
    ratePerCrew: 3,
    build: { scrap: 20 },
    perk: 'Energy powers weapon upgrades and the Research Lab.',
  },
  kitchen: {
    key: 'kitchen', name: 'Hydroponics & Kitchen', produces: 'food',
    desc: 'Grow rations so your crew does not starve between raids.',
    color: '#6fd07a', icon: '🍴',
    maxLevel: 5,
    ratePerCrew: 3,
    build: { scrap: 20 },
    perk: 'Rations are consumed by crew each cycle.',
  },
  workshop: {
    key: 'workshop', name: 'Salvage Workshop', produces: 'scrap',
    desc: 'Crew break down junk into usable Scrap for construction.',
    color: '#c7a06b', icon: '⚙',
    maxLevel: 5,
    ratePerCrew: 3,
    build: { scrap: 25, energy: 10 },
    perk: 'Scrap builds and upgrades everything.',
  },
  armory: {
    key: 'armory', name: 'Armory', produces: null,
    desc: 'Upgrade your weapon: more damage, faster fire, bigger magazine.',
    color: '#ff5566', icon: '✚',
    maxLevel: 6,
    build: { scrap: 30, energy: 15 },
    perk: 'Each level boosts your raid loadout. (See Armory panel.)',
  },
  medbay: {
    key: 'medbay', name: 'Med Bay', produces: null,
    desc: 'Stims and trauma care. Raises your max health on raids.',
    color: '#4be08a', icon: '✛',
    maxLevel: 5,
    hpPerLevel: 25,
    build: { scrap: 30, food: 15 },
    perk: '+25 max health per level.',
  },
  lab: {
    key: 'lab', name: 'Research Lab', produces: null,
    desc: 'Analyze recovered alien fragments to unlock the truth — and rewards.',
    color: '#9a6cff', icon: '✦',
    maxLevel: 5,
    build: { scrap: 40, energy: 30 },
    perk: 'Required to decode alien tech and reach the ending.',
  },
};

/* ----- Underground sites (raid missions) -----
   Each is a side-scroller level. `tech` = fragments recoverable.
   `unlockTech` = fragments needed before it appears (gated progression). */
G.data.bases = [
  {
    key: 'siteb', name: 'Site B — Decommissioned Silo',
    biome: 'silo', length: 3200, difficulty: 1,
    unlockTech: 0,
    desc: 'Where they kept you frozen. Old automated turrets still hum in the dark.',
    enemies: ['drone', 'guard'], boss: 'sentinel',
    reward: { scrap: 40, energy: 20 }, tech: 1,
    intro: 'Your cryo-pod cracks open in the silo that imprisoned you. Time to walk out — and take what they hid.',
  },
  {
    key: 'hollow', name: 'The Hollow — Black Site 9',
    biome: 'lab', length: 3800, difficulty: 2,
    unlockTech: 1,
    desc: 'A buried research lab. The science staff left in a hurry. The drones did not.',
    enemies: ['drone', 'guard', 'turret'], boss: 'warden',
    reward: { scrap: 60, energy: 35, food: 20 }, tech: 1,
    intro: 'Black Site 9 ran the experiments. The fragments here were peeled out of you while you slept.',
  },
  {
    key: 'deeprun', name: 'Deeprun — Geothermal Vaults',
    biome: 'cave', length: 4200, difficulty: 3,
    unlockTech: 2,
    desc: 'Magma-lit caverns repurposed into a containment vault. Heavily guarded.',
    enemies: ['guard', 'turret', 'hunter'], boss: 'colossus',
    reward: { scrap: 90, energy: 50, food: 30 }, tech: 1,
    intro: 'Heat shimmers off the rock. Whatever they buried this deep, they really did not want found.',
  },
  {
    key: 'cathedral', name: 'The Cathedral — Origin Vault',
    biome: 'alien', length: 4800, difficulty: 4,
    unlockTech: 3,
    desc: 'Not human-built. The craft itself. The final piece is at its core.',
    enemies: ['hunter', 'turret', 'wisp'], boss: 'overmind',
    reward: { scrap: 140, energy: 90, food: 40 }, tech: 1,
    intro: 'The walls breathe. This is where it all started — and where it ends. Recover the core fragment.',
  },
];

/* Total fragments = sum of base tech. Used for win condition + HUD. */
G.data.totalTech = G.data.bases.reduce((n, b) => n + b.tech, 0);

/* ----- Enemy archetypes for raids ----- */
G.data.enemies = {
  drone: { name: 'Recon Drone', hp: 20, w: 28, h: 22, speed: 1.2, dmg: 8,
           fly: true, fireRate: 0, color: '#7aa6ff', score: 10 },
  guard: { name: 'Security Guard', hp: 35, w: 26, h: 40, speed: 1.0, dmg: 12,
           fly: false, fireRate: 95, color: '#c97f5a', score: 15 },
  turret: { name: 'Wall Turret', hp: 50, w: 30, h: 30, speed: 0, dmg: 14,
            fly: false, fixed: true, fireRate: 70, color: '#ff8c4a', score: 20 },
  hunter: { name: 'Hunter Unit', hp: 60, w: 30, h: 38, speed: 2.0, dmg: 18,
            fly: false, fireRate: 60, color: '#ff5566', score: 30 },
  wisp:   { name: 'Energy Wisp', hp: 30, w: 24, h: 24, speed: 2.4, dmg: 16,
            fly: true, fireRate: 0, color: '#9a6cff', score: 25 },
};

/* ----- Bosses ----- */
G.data.bosses = {
  sentinel: { key: 'sentinel', name: 'SENTINEL', hp: 240, w: 70, h: 80, dmg: 16, fireRate: 50, color: '#ff8c4a' },
  warden:   { key: 'warden', name: 'THE WARDEN', hp: 420, w: 80, h: 96, dmg: 20, fireRate: 42, color: '#ff5566' },
  colossus: { key: 'colossus', name: 'COLOSSUS', hp: 680, w: 110, h: 110, dmg: 24, fireRate: 38, color: '#ffb547' },
  overmind: { key: 'overmind', name: 'OVERMIND', hp: 1000, w: 120, h: 130, dmg: 28, fireRate: 30, color: '#9a6cff' },
};

/* ----- Weapon scaling by Armory level (index = level) ----- */
G.data.weaponByLevel = [
  { dmg: 10, fireRate: 16, bulletSpeed: 10, mag: 12, name: 'Sidearm' },        // L0
  { dmg: 14, fireRate: 14, bulletSpeed: 11, mag: 16, name: 'Service Pistol' }, // L1
  { dmg: 18, fireRate: 11, bulletSpeed: 12, mag: 20, name: 'SMG' },            // L2
  { dmg: 24, fireRate: 9,  bulletSpeed: 13, mag: 26, name: 'Pulse Rifle' },    // L3
  { dmg: 32, fireRate: 8,  bulletSpeed: 14, mag: 32, name: 'Plasma Carbine' }, // L4
  { dmg: 42, fireRate: 6,  bulletSpeed: 16, mag: 40, name: 'Rail Repeater' },  // L5
  { dmg: 56, fireRate: 5,  bulletSpeed: 18, mag: 50, name: 'Alien Disruptor' },// L6
];

/* ----- Tuning ----- */
G.data.tune = {
  basePlayerHP: 100,
  cycleSeconds: 12,     // bunker production tick interval
  startScrap: 60,
  startEnergy: 20,
  startFood: 30,
  gravity: 0.6,
  playerSpeed: 3.2,
  jumpForce: 12,
};
