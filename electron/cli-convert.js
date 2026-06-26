#!/usr/bin/env node
/*
 * Headless converter for Finder Quick Actions / "Open With".
 * Invoked as:  ELECTRON_RUN_AS_NODE=1 <electron-bin> cli-convert.js <format> <file...>
 * Converts each image file next to the original and prints the outputs.
 * Runs entirely offline using the bundled sharp — no GUI, no network.
 */
const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const format = (args[0] || 'jpeg').toLowerCase();
  const files = args.slice(1);
  if (!files.length) { console.error('no files'); process.exit(1); }

  const sharp = require('sharp');
  const outExt = format === 'jpg' ? 'jpg' : format;
  const fmt = format === 'jpg' ? 'jpeg' : format;

  for (const f of files) {
    try {
      if (!fs.existsSync(f)) continue;
      const dir = path.dirname(f);
      const base = path.basename(f, path.extname(f));
      let out = path.join(dir, `${base}.${outExt}`);
      // avoid overwriting the source if same ext
      if (path.resolve(out) === path.resolve(f)) out = path.join(dir, `${base}-converted.${outExt}`);

      let pipe = sharp(f, { failOn: 'none' }).rotate();
      if (fmt === 'jpeg') pipe = pipe.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: 92, mozjpeg: true });
      else if (fmt === 'png') pipe = pipe.png({ compressionLevel: 9 });
      else if (fmt === 'webp') pipe = pipe.webp({ quality: 90 });
      else if (fmt === 'avif') pipe = pipe.avif({ quality: 60 });
      else if (fmt === 'tiff') pipe = pipe.tiff();
      await pipe.toFile(out);
      console.log('OK', out);
    } catch (e) {
      console.error('FAIL', f, e.message);
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
