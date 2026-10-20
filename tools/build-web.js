const fs = require('fs');
const path = require('path');

// Builds the static web version served by GitHub Pages into docs/.
// The desktop (Electron) app keeps running straight from the project root.
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs');
const LANDING = path.join(__dirname, 'landing.html');
const APP_DIR = path.join(outDir, 'app');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.mkdirSync(APP_DIR, { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(APP_DIR, 'index.html'));
for (const dir of ['css', 'js', 'data']) {
  const dest = path.join(APP_DIR, dir);
  fs.rmSync(dest, { recursive: true, force: true });
  copyDir(path.join(root, dir), dest);
}
fs.copyFileSync(LANDING, path.join(outDir, 'index.html'));

let count = 0;
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else count += 1;
  }
})(outDir);
console.log(`Web build ready in docs/ (${count} files, app at /app/index.html)`);
