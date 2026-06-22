/* build-web.js — assemble the static web app into ./www for Capacitor.
   No dependencies: just copies the runtime files (skips git, tools, node
   modules, native projects). Run: node tools/build-web.js  (or npm run build:web) */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

// Files/dirs that make up the shippable web app.
const INCLUDE = ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'assets'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let count = 0;
function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) copy(path.join(src, name), path.join(dst, name));
  } else {
    fs.copyFileSync(src, dst);
    count++;
  }
}

for (const item of INCLUDE) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) copy(src, path.join(out, item));
}

console.log(`build:web → www/ (${count} files)`);
