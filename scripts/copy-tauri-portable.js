const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version || '2.3.6';

const candidatePaths = [
  path.join(rootDir, 'src-tauri', 'target', 'release', 'macdrop.exe'),
  path.join(rootDir, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'macdrop.exe'),
  path.join(rootDir, 'src-tauri', 'target', 'x86_64-pc-windows-gnu', 'release', 'macdrop.exe'),
  path.join(rootDir, 'src-tauri', 'target', 'release', 'macdrop')
];

let sourceExe = null;
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    sourceExe = p;
    break;
  }
}

const releaseDir = path.join(rootDir, 'release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

if (!sourceExe) {
  console.warn('[Portable] No compiled macdrop binary found in src-tauri/target/release. Run tauri build first.');
  process.exit(0);
}

const isExe = sourceExe.endsWith('.exe');
const targetVersioned = path.join(releaseDir, isExe ? `MacDrop-${version}-portable.exe` : `MacDrop-${version}-portable`);
const targetGeneric = path.join(releaseDir, isExe ? 'MacDrop-portable.exe' : 'MacDrop-portable');

fs.copyFileSync(sourceExe, targetVersioned);
fs.copyFileSync(sourceExe, targetGeneric);

const stats = fs.statSync(targetVersioned);
const mb = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`[Portable Build] Successfully created:`);
console.log(`  - ${path.relative(rootDir, targetVersioned)} (${mb} MB)`);
console.log(`  - ${path.relative(rootDir, targetGeneric)} (${mb} MB)`);

// Also copy NSIS installer to release/ if present
const nsisDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
if (fs.existsSync(nsisDir)) {
  const files = fs.readdirSync(nsisDir).filter((f) => f.endsWith('.exe'));
  for (const f of files) {
    const src = path.join(nsisDir, f);
    const dest = path.join(releaseDir, f);
    fs.copyFileSync(src, dest);
    console.log(`  - ${path.relative(rootDir, dest)} (NSIS Installer)`);
  }
}
