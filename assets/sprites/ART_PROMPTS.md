# SUBSTRATA — Copy-Paste Art Prompts

Each block below is a **complete, self-contained prompt** — the style is baked
in, so just copy one block, paste it into your image generator, and save the
result as the **exact filename** shown into `assets/sprites/`.

### How to use
1. Pick a block, copy everything in the `> prompt` line(s).
2. Generate. If your tool supports it, paste the **Negative** line too.
3. Save as the **filename** in `assets/sprites/`, commit + push → it's live.
4. **Consistency tip:** generate the whole set in **one session and reuse the
   same seed** so the style matches. Do `player` first and treat it as the
   look-reference for everything else.

**Aspect ratios:** Midjourney → add `--ar W:H`. DALL·E/Grok → say "aspect ratio
W:H". SDXL → set the width/height. Off-ratio art gets squashed in-game, so match
it.

**Universal style string** (already inside each prompt, here for reference):
> gritty sci-fi video-game art, 2D side view, clean cel-shaded with crisp edges
> and dramatic rim lighting, dark moody underground palette of near-black blue
> (#05070d) with neon cyan (#36e0d8) and violet (#9a6cff) accents plus hazard
> amber (#ffb547) and danger red (#ff5566), high contrast, glowing highlights,
> subtle grime, cohesive game art

**Universal negative** (for characters/props):
> Negative: photo, realistic photograph, 3D render, blurry, low contrast, text,
> watermark, signature, multiple subjects, ground shadow, drop shadow, frame,
> border, white background, cropped limbs

---

## PRIORITY 1 — Player + Enemies (biggest visual impact)

### `player.png` · ar 26:44
> A lone armored survivor in a sealed exo-suit standing in a ready stance, glowing
> cyan visor, battered hull-plating, a compact sidearm in hand, full body, facing
> right, side view, idle pose, centered, transparent background. Gritty sci-fi
> video-game art, clean cel-shaded with crisp edges and dramatic cyan rim
> lighting, dark moody palette with neon cyan and violet accents, high contrast,
> glowing highlights, subtle grime.
> Negative: photo, 3D render, blurry, text, watermark, multiple subjects, ground
> shadow, white background, cropped limbs.

### `enemy-drone.png` · ar 28:22
> Small hovering recon saucer-drone with a single glowing cyan eye-lens, sleek
> dark metal hull, faint thruster glow underneath, full body, facing right, side
> view, centered, transparent background. Gritty sci-fi cel-shaded game art, crisp
> edges, cyan rim light, dark moody palette, high contrast, glowing highlights.
> Negative: photo, 3D render, blurry, text, watermark, ground shadow, white
> background.

### `enemy-guard.png` · ar 26:40
> Human security guard in heavy riot armor holding a stun rifle, orange-tan
> plating, dark tactical visor, alert stance, full body, facing right, side view,
> centered, transparent background. Gritty sci-fi cel-shaded game art, crisp
> edges, amber rim light, dark moody palette with hazard amber accents, high
> contrast, subtle grime.
> Negative: photo, 3D render, blurry, text, watermark, multiple subjects, ground
> shadow, white background, cropped limbs.

### `enemy-turret.png` · ar 30:30
> Wall-mounted automated gun turret, armored angular housing, a single glowing
> amber barrel and red targeting eye, mechanical and menacing, facing right, side
> view, centered, transparent background. Gritty sci-fi cel-shaded game art, crisp
> edges, amber and red glow, dark moody palette, high contrast.
> Negative: photo, 3D render, blurry, text, watermark, ground shadow, white
> background, wall, room.

### `enemy-hunter.png` · ar 30:38
> Agile bipedal hunter-killer robot, lean predatory frame, glowing red sensor eye,
> clawed digitigrade legs, crouched ready-to-pounce pose, full body, facing right,
> side view, centered, transparent background. Gritty sci-fi cel-shaded game art,
> crisp edges, red rim light, dark moody palette with danger red accents, high
> contrast.
> Negative: photo, 3D render, blurry, text, watermark, multiple subjects, ground
> shadow, white background, cropped limbs.

### `enemy-wisp.png` · ar 24:24
> Floating ball of violet alien energy with crackling electric tendrils and a
> semi-translucent glowing core, ethereal and unstable, centered, transparent
> background. Gritty sci-fi cel-shaded game art, crisp edges, intense violet glow
> and bloom, dark moody palette, high contrast.
> Negative: photo, 3D render, blurry, text, watermark, ground shadow, white
> background, creature, face.

---

## PRIORITY 2 — Pickups (quick, high value · ar 1:1)

### `pickup-health.png`
> A glowing green medical stim canister marked with a white cross, soft healing
> halo, small game item icon, centered, transparent background. Cel-shaded sci-fi
> game art, crisp edges, green glow, high contrast.
> Negative: photo, 3D render, blurry, text, watermark, ground shadow, white
> background.

### `pickup-scrap.png`
> A chunk of salvaged metal scrap with bolts and torn plating, tan-bronze, faint
> metallic glint, small game item icon, centered, transparent background.
> Cel-shaded sci-fi game art, crisp edges, warm rim light, high contrast.
> Negative: photo, 3D render, blurry, text, watermark, ground shadow, white
> background.

### `pickup-tech.png`
> A floating faceted violet alien-tech crystal shard glowing from within, arcane
> energy, small game item icon, centered, transparent background. Cel-shaded
> sci-fi game art, crisp edges, violet glow and bloom, high contrast.
> Negative: photo, 3D render, blurry, text, watermark, ground shadow, white
> background.

---

## PRIORITY 3 — Bosses (big set-pieces, menacing)

### `boss-sentinel.png` · ar 70:80
> Hulking guardian mech "Sentinel" with a glowing amber power core in its chest,
> heavy armored shoulders, imposing and intimidating, full body, facing right,
> side view, centered, transparent background. Gritty sci-fi cel-shaded game art,
> crisp edges, amber rim light, dark moody palette, high contrast, dramatic.
> Negative: photo, 3D render, blurry, text, watermark, multiple subjects, ground
> shadow, white background, cropped limbs.

### `boss-warden.png` · ar 80:96
> Towering warden war-machine "The Warden" with glowing red optics and massive
> riot-shield arms, brutal and oppressive, full body, facing right, side view,
> centered, transparent background. Gritty sci-fi cel-shaded game art, crisp
> edges, red rim light, dark moody palette with danger red accents, high contrast.
> Negative: photo, 3D render, blurry, text, watermark, multiple subjects, ground
> shadow, white background, cropped limbs.

### `boss-colossus.png` · ar 110:110
> A massive armored siege-walker "Colossus" with glowing amber seams between thick
> armor plates, colossal and earth-shaking, full body, facing right, side view,
> centered, transparent background. Gritty sci-fi cel-shaded game art, crisp
> edges, amber glow, dark moody palette, high contrast, epic scale.
> Negative: photo, 3D render, blurry, text, watermark, multiple subjects, ground
> shadow, white background, cropped limbs.

### `boss-overmind.png` · ar 120:130
> Alien "Overmind" — a floating biomechanical brain-core fused with metal,
> pulsing violet glow, a single great eye in the center, organic ribbing meets
> machinery, otherworldly and terrifying, facing right, side view, centered,
> transparent background. Gritty sci-fi cel-shaded game art, crisp edges, violet
> bioluminescent glow, dark moody palette, high contrast.
> Negative: photo, 3D render, blurry, text, watermark, ground shadow, white
> background.

---

## PRIORITY 4 — Biome backgrounds (far parallax, **must tile horizontally** · ar 2:1, 1024×512)

> **Add to each:** "seamless horizontally tileable texture, left edge continues
> into right edge, no characters, no creatures, wide establishing background."

### `bg-silo.png`
> Cold industrial missile-silo interior depths, blue-grey steel, pipes and
> gantries receding into darkness, distant amber warning lights, atmospheric haze,
> seamless horizontally tileable, no characters. Gritty sci-fi cel-shaded game
> background art, dark moody palette, high contrast, glowing accents.

### `bg-lab.png`
> Abandoned underground research lab, clinical teal lighting, broken monitors and
> shattered containment tanks, cables hanging, eerie, seamless horizontally
> tileable, no characters. Gritty sci-fi cel-shaded game background art, dark moody
> palette, high contrast.

### `bg-cave.png`
> Magma-lit geothermal cavern, glowing orange molten rock veins, jagged stone
> walls, rising heat haze, seamless horizontally tileable, no characters. Gritty
> sci-fi cel-shaded game background art, dark palette with hot amber glow, high
> contrast.

### `bg-alien.png`
> Organic alien vault interior, violet bioluminescent walls, ribbed living
> architecture, pulsing pods, otherworldly, seamless horizontally tileable, no
> characters. Gritty sci-fi cel-shaded game background art, dark palette with
> violet glow, high contrast.

---

## PRIORITY 5 — Biome floor strips (**must tile horizontally** · ar 8:3, 256×96)

> **Add to each:** "top surface of ground seen from the side, thin glowing lit top
> edge, seamless horizontally tileable strip, no characters."

- `floor-silo.png` → riveted steel grating walkway, blue-grey, worn metal.
- `floor-lab.png` → clean white lab floor tiles with thin seams, faint reflections.
- `floor-cave.png` → cracked dark rock with glowing orange magma in the cracks.
- `floor-alien.png` → organic violet chitin plating, slick bioluminescent edges.

> Example full prompt — `floor-cave.png`: "Cracked dark volcanic rock ground with
> glowing orange magma seeping through the cracks, top surface seen from the side
> with a thin hot lit top edge, seamless horizontally tileable strip, no
> characters. Cel-shaded sci-fi game art, dark palette with hot amber glow, high
> contrast."

---

## PRIORITY 6 — Bunker room interiors (opaque, **no crew figures** · ar 4:3, 320×240)

> **Add to each:** "interior scene viewed head-on, no people, no crew, opaque
> background, game room art."

- `room-command.png` → Command center with a glowing cyan holographic map table, wall monitors and control consoles.
- `room-bunks.png` → Crew quarters with stacked bunk beds, lockers, dim violet lighting, lived-in clutter.
- `room-generator.png` → Fusion generator room with a glowing yellow reactor core, thick cabling, hazard warning signage.
- `room-kitchen.png` → Hydroponics kitchen with green plant racks under purple grow-lights, a metal prep counter.
- `room-workshop.png` → Salvage workshop with workbenches, scattered tools, piles of scrap metal, sparks.
- `room-armory.png` → Armory with weapon racks, stacked ammo crates, red accent lighting.
- `room-medbay.png` → Med bay with medical pods, a green cross sign, monitors, clean sterile surfaces.
- `room-lab.png` → Research lab with a glowing violet alien fragment in a containment field, analysis equipment.

> Example full prompt — `room-command.png`: "Underground bunker command center
> interior viewed head-on, a glowing cyan holographic map table in the middle,
> wall-mounted monitors and control consoles, no people, opaque background. Gritty
> sci-fi cel-shaded game art, dark moody palette with cyan glow, high contrast,
> subtle grime."

---

### Recommended order
1. `player` → set the style. 2. The five `enemy-*`. 3. The three `pickup-*`.
4. Bosses. 5. Backgrounds + floors (test tiling!). 6. Rooms.

Save → commit → push → it appears in-game on next load. Or send the PNGs to me
and I'll commit them for you.
