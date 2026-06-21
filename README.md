# SUBSTRATA — Alien Tech Recovery

A side-scrolling shooter **+** Fallout-Shelter-style base-builder. You wake from
cryogenic suspension in an abandoned underground complex — frozen by the very
program you once served — and set out to recover every fragment of **alien
technology** they buried, and the truth they froze you to hide.

Built as a **mobile-first web game** (HTML5 Canvas + vanilla JS, zero
dependencies, no build step). It installs to an iPhone Home Screen as a PWA and
plays full-screen with on-screen touch controls.

## The loop

1. **The Bunker** (hub) — build and upgrade rooms (Generator, Kitchen, Workshop,
   Bunks, Armory, Med Bay, Research Lab). Assign crew to rooms to generate
   Scrap / Energy / Rations each cycle.
2. **Raids** (side-scroller) — tap the **Surface Hatch** to pick an underground
   black site. Run the level, shoot security drones/guards/turrets, grab salvage,
   defeat the site **Guardian** boss, and recover an **alien fragment**.
3. **Research** — decode recovered fragments in the **Research Lab** for bonuses.
   Recover *and* decode all fragments to reach the ending.

Progress saves automatically to the device (localStorage).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `A`/`D` or `←`/`→` | on-screen ◀ ▶ |
| Jump | `W` / `Space` / `↑` | ⤒ button |
| Shoot | `J` or click | ✸ button |
| Interact / confirm | `E` / `Enter` | tap |
| Pause | `Esc` / `P` | `II` button |

In the bunker, **tap a room** to manage it and the **hatch** to raid. Raids play
best in **landscape**.

## Run it

It's a static site — no install needed.

```bash
# from the project root, any static server works:
python3 -m http.server 8080
# then open http://localhost:8080
```

You can also just open `index.html` directly in a browser. (Offline PWA caching
only activates when served over http/https, not `file://`.)

## Play on your iPhone

This is a **PWA**, so it runs on iPhone today without the App Store:

1. Host the folder somewhere your phone can reach it over HTTPS. Easiest options:
   - Push this repo and enable **GitHub Pages**, **Netlify**, or **Vercel** (drag-and-drop the folder), **or**
   - On the same Wi-Fi, run `python3 -m http.server 8080` and visit your
     computer's local IP from Safari (note: some PWA features want HTTPS).
2. Open the URL in **Safari** on the iPhone.
3. Tap **Share → Add to Home Screen**.
4. Launch it from the Home Screen — it runs full-screen like a native app, with
   touch controls, and works offline.

### Want a real App Store app later?

A native build requires a **Mac with Xcode** (and an Apple Developer account,
~$99/yr) — it can't be compiled in this cloud Linux environment. When you have a
Mac, the fastest path is to wrap this exact web game with **[Capacitor](https://capacitorjs.com/)**:

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init SUBSTRATA com.yourname.substrata --web-dir .
npx cap add ios
npx cap open ios   # builds/runs in Xcode
```

That produces an installable/submittable iOS app from the same codebase.

## Project layout

```
index.html        markup, HUD, touch controls, PWA tags
manifest.json     PWA manifest (Home Screen install)
sw.js             service worker (offline cache)
css/style.css     UI + responsive/mobile layout
js/util.js        helpers + namespace
js/data.js        rooms, sites, enemies, bosses, weapons, tuning
js/save.js        save/load + derived stats
js/audio.js       procedural WebAudio sfx (no audio files)
js/input.js       keyboard / mouse / touch buttons
js/entities.js    player, enemies, boss, bullets, pickups, particles
js/story.js       title, cryo-awakening intro, endings, panel helpers
js/base.js        the Bunker hub (build/upgrade/assign)
js/mission.js     the side-scrolling raid (terrain, spawns, boss, win/lose)
js/main.js        orchestrator: state, screens, loop, responsive canvas
assets/           generated app icons
tools/            icon generator + headless smoke test
```

## Dev

```bash
node tools/gen-icons.js      # regenerate app icons
node tools/headless-test.js  # run the smoke test (drives a full play sequence)
```
