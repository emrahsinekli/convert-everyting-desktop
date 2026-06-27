#!/usr/bin/env node
/*
 * Mac build helper.
 *
 * The `pdf-poppler` npm package ships an OSX poppler build (poppler-0.66) whose
 * binaries reference Homebrew dylibs by absolute path (/usr/local/opt/cairo,
 * /usr/local/Cellar/poppler, ...). Those paths never exist on an end-user's Mac,
 * so PDF -> image conversion fails out of the box.
 *
 * We vendor a self-contained replacement under resources/mac-natives/poppler-0.66
 * (binaries + all non-system dylibs, install names rewritten to
 * @executable_path/../lib and @loader_path). This script drops that vendored copy
 * into node_modules/pdf-poppler/lib/osx so the path pdf-poppler expects keeps
 * working after a fresh `npm install` / `npm ci`.
 *
 * Runs only on macOS; a no-op everywhere else.
 */
const fs = require('fs');
const path = require('path');

if (process.platform !== 'darwin') {
  process.exit(0);
}

const root = path.join(__dirname, '..');
const src = path.join(root, 'resources', 'mac-natives', 'poppler-0.66');
const destParent = path.join(root, 'node_modules', 'pdf-poppler', 'lib', 'osx');
const dest = path.join(destParent, 'poppler-0.66');

if (!fs.existsSync(src)) {
  console.warn('[setup-mac-natives] vendored poppler not found, skipping:', src);
  process.exit(0);
}
if (!fs.existsSync(destParent)) {
  console.warn('[setup-mac-natives] pdf-poppler not installed, skipping');
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

// Ensure binaries are executable.
const binDir = path.join(dest, 'bin');
if (fs.existsSync(binDir)) {
  for (const f of fs.readdirSync(binDir)) {
    try { fs.chmodSync(path.join(binDir, f), 0o755); } catch (_) {}
  }
}

console.log('[setup-mac-natives] installed self-contained poppler into', dest);

// --- Whisper model (too large for git; fetched here, bundled into the .app) ---
const { execSync } = require('child_process');
const modelPath = path.join(root, 'resources', 'models', 'ggml-base.bin');
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
try {
  if (!fs.existsSync(modelPath) || fs.statSync(modelPath).size < 100 * 1024 * 1024) {
    fs.mkdirSync(path.dirname(modelPath), { recursive: true });
    console.log('[setup-mac-natives] downloading Whisper model (ggml-base, ~142MB)…');
    execSync(`curl -fL --retry 3 -o "${modelPath}" "${MODEL_URL}"`, { stdio: 'inherit' });
    console.log('[setup-mac-natives] Whisper model ready');
  }
} catch (e) {
  console.warn('[setup-mac-natives] Whisper model download failed (transcription will be unavailable):', e.message);
}
