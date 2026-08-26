#!/usr/bin/env node
/**
 * Locale integrity check.
 *
 * Guards against the two ways a translation silently rots:
 *  - a key exists in en but is missing in another locale (renders English)
 *  - a key exists in a locale but not in en (dead string, usually a typo)
 * It also flags values left identical to English, which is how a "finished"
 * translation turns out to be half copy-paste.
 *
 * Run: node scripts/check-locales.js
 */
const fs = require('fs');
const path = require('path');

const LOCALE_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');

// The locale files are ES modules; read them as text and evaluate the object.
function loadLocale(code) {
  const file = path.join(LOCALE_DIR, `${code}.js`);
  const source = fs.readFileSync(file, 'utf8').replace(/^\s*export\s+default\s*/m, 'module.exports = ');
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', source)(module, module.exports);
  return module.exports;
}

function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

// Strings that are legitimately identical across languages (brand names,
// format names, units) - not evidence of an untranslated value.
const IDENTICAL_ALLOWED = /^(Convert Everything|PRO|OK|PDF|GIF|MP3|FLAC|kbps|AI|HTML|CSS|JSON|XML|YAML|CSV|Markdown|SVG|ICO|URL|Base64|Hex|RGB|HSL|Unicode|SRT|VTT|Whisper|FFmpeg|E-?mail|Pro|Help|Privacy|Offline|Video|Audio|Markdown-converter|\d+|[\d\s.,%×/-]+)$/i;

const en = flatten(loadLocale('en'));
const codes = fs.readdirSync(LOCALE_DIR)
  .filter(f => f.endsWith('.js'))
  .map(f => path.basename(f, '.js'))
  .filter(c => c !== 'en');

let failed = false;

for (const code of codes) {
  const locale = flatten(loadLocale(code));
  const missing = Object.keys(en).filter(k => !(k in locale));
  const extra = Object.keys(locale).filter(k => !(k in en));
  const untranslated = Object.keys(locale).filter(k =>
    k in en &&
    typeof locale[k] === 'string' &&
    locale[k] === en[k] &&
    !IDENTICAL_ALLOWED.test(locale[k].trim())
  );

  console.log(`\n[${code}] ${Object.keys(locale).length} keys (en: ${Object.keys(en).length})`);
  if (missing.length) {
    failed = true;
    console.log(`  MISSING (${missing.length}):`);
    missing.forEach(k => console.log(`    - ${k}`));
  }
  if (extra.length) {
    failed = true;
    console.log(`  NOT IN en (${extra.length}):`);
    extra.forEach(k => console.log(`    - ${k}`));
  }
  if (untranslated.length) {
    failed = true;
    console.log(`  IDENTICAL TO ENGLISH (${untranslated.length}):`);
    untranslated.forEach(k => console.log(`    - ${k} = ${JSON.stringify(locale[k])}`));
  }
  if (!missing.length && !extra.length && !untranslated.length) console.log('  OK');
}

process.exit(failed ? 1 : 0);
