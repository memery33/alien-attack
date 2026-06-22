/* assets.js — optional image assets with procedural fallback.
   The game renders fully without any images. When a PNG with the expected
   name exists in assets/sprites/, it is used automatically in place of the
   hand-drawn shape. Drop files in to progressively upgrade the art — a
   missing file simply falls back, so partial art sets are fine.

   Naming (see assets/sprites/SPRITES_SPEC.md for sizes + Grok prompts):
     player.png
     enemy-drone.png  enemy-guard.png  enemy-turret.png  enemy-hunter.png  enemy-wisp.png
     boss-sentinel.png  boss-warden.png  boss-colossus.png  boss-overmind.png
     pickup-health.png  pickup-scrap.png  pickup-tech.png
     bg-silo.png  bg-lab.png  bg-cave.png  bg-alien.png            (far parallax, tileable)
     floor-silo.png  floor-lab.png  floor-cave.png  floor-alien.png (tileable strip)
     room-command.png … room-lab.png                               (chamber interiors)
*/
(function () {
  const BASE = 'assets/sprites/';
  const cache = Object.create(null);

  // Lazily request an image the first time it's needed. A missing file 404s
  // once, naturalWidth stays 0, and we fall back forever after.
  function img(name) {
    if (typeof Image === 'undefined') return null; // non-browser (tests)
    let i = cache[name];
    if (i === undefined) {
      i = new Image();
      i.src = BASE + name + '.png';
      cache[name] = i;
    }
    return (i.complete && i.naturalWidth > 0) ? i : null;
  }

  G.assets = {
    has(name) { return !!img(name); },
    image(name) { return img(name); },

    // Draw image `name` into the box (x,y,w,h). If `flip` is true, mirror
    // horizontally (for left-facing actors). Returns false if not loaded so
    // callers can fall back to procedural drawing.
    drawIn(ctx, name, x, y, w, h, flip) {
      const i = img(name);
      if (!i) return false;
      if (flip) {
        ctx.save();
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(i, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(i, x, y, w, h);
      }
      return true;
    },

    // Tile image `name` horizontally across [x, x+w) at height h, scrolled by
    // `scroll` (world px). Returns false if not loaded.
    drawTiled(ctx, name, x, y, w, h, scroll) {
      const i = img(name);
      if (!i) return false;
      const tw = h * (i.naturalWidth / i.naturalHeight); // preserve aspect
      let sx = x - (((scroll % tw) + tw) % tw);
      for (; sx < x + w; sx += tw) ctx.drawImage(i, sx, y, tw, h);
      return true;
    },
  };
})();
