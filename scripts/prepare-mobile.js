/**
 * Mobile Web Asset Bundler for Capacitor / Android
 * Copies frontend assets (index.html, src/, spessasynth_*.js, libraries) to www/
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.resolve(rootDir, 'www');

// Ensure www/ exists and is clean
if (fs.existsSync(wwwDir)) {
    fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

function copyFile(srcRel, destRel) {
    const srcPath = path.join(rootDir, srcRel);
    const destPath = path.join(wwwDir, destRel || srcRel);
    if (fs.existsSync(srcPath)) {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        console.log(`[Mobile Pack] Copied file: ${srcRel}`);
    }
}

function copyDir(srcRel, destRel) {
    const srcPath = path.join(rootDir, srcRel);
    const destPath = path.join(wwwDir, destRel || srcRel);
    if (fs.existsSync(srcPath)) {
        fs.cpSync(srcPath, destPath, { recursive: true });
        console.log(`[Mobile Pack] Copied directory: ${srcRel}`);
    }
}

console.log('[Mobile Pack] Preparing mobile assets for Android build...');

// Copy root frontend files
copyFile('index.html');
copyFile('webaudio-tinysynth.js');
copyFile('jsmediatags.min.js');
copyFile('peer.min.js');
copyFile('spessasynth_core.js');
copyFile('spessasynth_lib.js');
copyFile('spessasynth_processor.js');

// Copy src directory (includes platform/, sync/, ui/)
copyDir('src');

console.log('[Mobile Pack] Successfully generated www/ directory for Android / Capacitor.');
