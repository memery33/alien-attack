# SUBSTRATA — Art Asset Spec (for Grok / any image generator)

Drop finished PNGs into **`assets/sprites/`** using the **exact filenames** below.
The game auto-detects each file and replaces the placeholder art live — missing
files just fall back to the built-in shapes, so you can add art a few pieces at a
time. (Until a file exists you'll see a harmless `404` for it in the console.)

---

## GLOBAL STYLE — paste this at the top of every prompt

> Gritty sci-fi video-game art, **2D side-view**, clean cel-shaded style with
> crisp edges and dramatic rim lighting. Dark, moody underground palette:
> near-black blues (#05070d, #0f1828) with neon **cyan #36e0d8** and **violet
> #9a6cff** accents, plus warm hazard **amber #ffb547** and danger **red
> #ff5566**. High contrast, glowing highlights, subtle grime. Cohesive across all
> assets so they look like one game.

**Rules**
- **Characters, enemies, bosses, pickups:** fully **transparent background**,
  single subject centered, **facing RIGHT**, full body, idle pose, tight crop
  with a few px of transparent margin. **No ground shadow** (the game adds one).
- **Backgrounds & floors:** opaque, and **horizontally seamless/tileable** (left
  edge must continue into the right edge). No characters.
- **Rooms:** opaque interior, **no crew figures** (the game draws crew on top).
- Keep the **aspect ratio** listed (the game stretches to a box of that ratio —
  off-ratio art will look squashed). Export at the suggested px or larger.

---

## 1) Player — `player.png`
Ratio **26:44** (tall). Suggested **156×264 px**.
> A lone armored survivor in a sealed exo-suit, glowing cyan visor, sidearm in
> hand, battered hull-plating, facing right, ready stance. Transparent bg.

## 2) Enemies
| File | Ratio | Suggested px | Prompt |
|---|---|---|---|
| `enemy-drone.png` | 28:22 (wide) | 168×132 | Small hovering recon saucer-drone, single cyan eye-lens, sleek metal, faint thruster glow. |
| `enemy-guard.png` | 26:40 | 156×240 | Human security guard in riot armor with a stun rifle, orange-tan plating, visor. |
| `enemy-turret.png` | 30:30 | 180×180 | Wall-mounted automated gun turret, armored housing, glowing amber barrel. |
| `enemy-hunter.png` | 30:38 | 180×228 | Agile bipedal hunter-killer robot, red sensor eye, clawed legs, predatory. |
| `enemy-wisp.png` | 24:24 | 144×144 | Floating ball of violet alien energy, crackling tendrils, semi-translucent core. |

## 3) Bosses (big, menacing)
| File | Ratio | Suggested px | Prompt |
|---|---|---|---|
| `boss-sentinel.png` | 70:80 | 280×320 | Hulking guardian mech "SENTINEL", amber core, heavy shoulders, intimidating. |
| `boss-warden.png` | 80:96 | 320×384 | Towering warden war-machine "THE WARDEN", red optics, riot-shield arms. |
| `boss-colossus.png` | 110:110 | 440×440 | Massive armored "COLOSSUS" siege-walker, glowing amber seams, colossal. |
| `boss-overmind.png` | 120:130 | 480×520 | Alien "OVERMIND" — floating biomechanical brain-core, violet glow, eye in center, organic + metal. |

## 4) Pickups (1:1, suggested 96×96)
| File | Prompt |
|---|---|
| `pickup-health.png` | Glowing green medical stim canister with a cross, soft halo. |
| `pickup-scrap.png` | Chunk of salvaged metal scrap / bolts, tan-bronze, faint glint. |
| `pickup-tech.png` | Floating violet alien tech fragment, faceted crystal shard, glowing. |

## 5) Biome backgrounds — far parallax, **tileable**, suggested **1024×512**
| File | Prompt |
|---|---|
| `bg-silo.png` | Cold industrial missile-silo interior depths, blue-grey, pipes & gantries, distant amber lights. Seamless. |
| `bg-lab.png` | Abandoned underground research lab, clinical teal, broken screens & containment tanks. Seamless. |
| `bg-cave.png` | Magma-lit geothermal cavern, glowing orange rock, jagged stone, heat haze. Seamless. |
| `bg-alien.png` | Organic alien vault interior, violet bioluminescent walls, ribbed living architecture. Seamless. |

## 6) Biome floors — **tileable strip**, suggested **256×96**
Top surface of the ground; include a thin lit top edge. Seamless left↔right.
`floor-silo.png` (riveted steel grating) · `floor-lab.png` (white lab tile) ·
`floor-cave.png` (cracked magma rock) · `floor-alien.png` (organic violet chitin).

## 7) Bunker rooms — interior art, ratio **~4:3**, suggested **320×240**, opaque, no crew
| File | Prompt |
|---|---|
| `room-command.png` | Command center: cyan holographic map table & monitors, control consoles. |
| `room-bunks.png` | Crew bunks: stacked beds, lockers, dim violet lighting, lived-in. |
| `room-generator.png` | Fusion generator: glowing yellow reactor core, cabling, warning signage. |
| `room-kitchen.png` | Hydroponics & kitchen: green plant racks under grow-lights, prep counter. |
| `room-workshop.png` | Salvage workshop: workbenches, tools, piles of scrap, sparks. |
| `room-armory.png` | Armory: weapon racks, ammo crates, red accent lighting. |
| `room-medbay.png` | Med bay: medical pods, green cross, monitors, sterile. |
| `room-lab.png` | Research lab: alien fragment in a violet containment field, analysis rigs. |

---

### Workflow
1. Generate a file, name it exactly as above, save into `assets/sprites/`.
2. Commit + push — it deploys and appears in-game on next load.
3. Add the rest over time; order doesn't matter. Start with `player.png` and the
   five `enemy-*` for the biggest immediate impact.
