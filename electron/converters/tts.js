const { execFile, execFileSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Text-to-Speech using the built-in macOS `say` engine — fully offline, no
// model to bundle. Voices the user has installed (System Settings ▸ Accessibility
// ▸ Spoken Content ▸ System Voices) are listed automatically.
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');

class TextToSpeechConverter {
  constructor() {
    this.supportedInputFormats = ['txt'];
    this.supportedOutputFormats = ['mp3', 'wav', 'm4a', 'aac'];
    this._voiceCache = null;
  }

  // Parse `say -v "?"` -> [{ id, name, language, langCode }]
  getVoices() {
    if (this._voiceCache) return this._voiceCache;
    let out = '';
    try { out = execFileSync('say', ['-v', '?'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); }
    catch (e) { return []; }
    const voices = [];
    for (const line of out.split('\n')) {
      // "Alex                en_US    # Most people recognize me by my voice."
      const m = line.match(/^(.+?)\s+([a-z]{2}(?:[-_][A-Z]{2})?)\s*#?(.*)$/);
      if (!m) continue;
      const name = m[1].trim();
      const locale = m[2].replace('-', '_');
      if (!name) continue;
      voices.push({ id: name, name, language: locale, langCode: locale.split('_')[0], sample: (m[3] || '').trim() });
    }
    this._voiceCache = voices;
    return voices;
  }

  getVoicesByLanguage() {
    const groups = {};
    for (const v of this.getVoices()) {
      (groups[v.langCode] = groups[v.langCode] || []).push(v);
    }
    return groups;
  }

  getLanguages() {
    const seen = {};
    return this.getVoices().reduce((acc, v) => {
      if (!seen[v.langCode]) { seen[v.langCode] = true; acc.push({ id: v.langCode, name: v.language }); }
      return acc;
    }, []);
  }

  readTextFile(inputPath) {
    const text = fs.readFileSync(inputPath, 'utf-8');
    if (!text || text.trim().length === 0) throw new Error('Input file is empty');
    return text;
  }

  // text -> spoken audio file (mp3/wav/m4a/aac)
  async convert(text, outputPath, options = {}) {
    const { voice, rate, onProgress } = options;
    if (!text || !text.trim()) throw new Error('No text to speak');

    const stamp = Date.now();
    const tmpTxt = path.join(os.tmpdir(), `tts_${stamp}.txt`);
    const tmpAiff = path.join(os.tmpdir(), `tts_${stamp}.aiff`);
    fs.writeFileSync(tmpTxt, text, 'utf-8');
    if (onProgress) onProgress(15);

    try {
      // 1) say -> AIFF
      const sayArgs = [];
      if (voice) sayArgs.push('-v', voice);
      if (rate && Number(rate) > 0) sayArgs.push('-r', String(Math.round(Number(rate))));
      sayArgs.push('-o', tmpAiff, '-f', tmpTxt);
      await new Promise((resolve, reject) => {
        execFile('say', sayArgs, (err) => err ? reject(new Error(`say failed: ${err.message}`)) : resolve());
      });
      if (onProgress) onProgress(60);

      // 2) AIFF -> requested format via ffmpeg
      const fmt = (path.extname(outputPath).slice(1) || 'mp3').toLowerCase();
      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const args = ['-y', '-i', tmpAiff];
      if (fmt === 'mp3') args.push('-codec:a', 'libmp3lame', '-q:a', '2');
      else if (fmt === 'm4a' || fmt === 'aac') args.push('-codec:a', 'aac', '-b:a', '192k');
      args.push(outputPath);
      await new Promise((resolve, reject) => {
        const ff = spawn(ffmpegPath, args);
        let err = '';
        ff.stderr.on('data', (d) => { err += d.toString(); });
        ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.slice(-200)}`)));
        ff.on('error', (e) => reject(e));
      });
      if (onProgress) onProgress(100);
      return { outputPath, success: true };
    } finally {
      [tmpTxt, tmpAiff].forEach((f) => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {} });
    }
  }

  async convertFile(inputPath, outputPath, options = {}) {
    return this.convert(this.readTextFile(inputPath), outputPath, options);
  }
}

module.exports = TextToSpeechConverter;
