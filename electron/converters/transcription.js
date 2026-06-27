const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
// In a packaged app the static binaries live in app.asar.unpacked, not inside
// the asar (you can't spawn from inside an asar) — rewrite the path.
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');

// Offline speech-to-text via a bundled whisper.cpp (whisper-cli) + ggml model.
// Everything ships inside the app — no download, no Python, no network.
class TranscriptionConverter {
  constructor() {
    this.supportedInputFormats = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    this.supportedOutputFormats = ['txt', 'srt', 'vtt', 'json'];
  }

  getWhisperPath() {
    const candidates = [
      path.join(process.resourcesPath || '', 'resources', 'bin', 'whisper-macos', 'bin', 'whisper-cli'),
      path.join(process.resourcesPath || '', 'bin', 'whisper-macos', 'bin', 'whisper-cli'),
      path.join(__dirname, '..', '..', 'resources', 'bin', 'whisper-macos', 'bin', 'whisper-cli'),
    ];
    for (const p of candidates) { if (p && fs.existsSync(p)) return p; }
    return candidates[candidates.length - 1];
  }

  getModelPath() {
    const candidates = [
      path.join(process.resourcesPath || '', 'resources', 'models', 'ggml-base.bin'),
      path.join(process.resourcesPath || '', 'models', 'ggml-base.bin'),
      path.join(__dirname, '..', '..', 'resources', 'models', 'ggml-base.bin'),
    ];
    for (const p of candidates) { if (p && fs.existsSync(p)) return p; }
    return candidates[candidates.length - 1];
  }

  isWhisperInstalled() {
    return fs.existsSync(this.getWhisperPath()) && fs.existsSync(this.getModelPath());
  }

  async convert(inputPath, outputPath, outputFormat, options = {}) {
    const { onProgress, language = 'auto' } = options;
    if (!this.isWhisperInstalled()) throw new Error('WHISPER_NOT_INSTALLED');

    const fmt = (outputFormat || 'txt').toLowerCase();
    const tempWav = path.join(os.tmpdir(), `whisper_input_${Date.now()}.wav`);
    const outBase = path.join(os.tmpdir(), `whisper_out_${Date.now()}`);

    try {
      if (onProgress) onProgress(5);
      await this.convertToWav(inputPath, tempWav);
      if (onProgress) onProgress(30);

      // whisper-cli writes the requested format directly
      const flag = { txt: '-otxt', srt: '-osrt', vtt: '-ovtt', json: '-oj' }[fmt] || '-otxt';
      const ext = { txt: 'txt', srt: 'srt', vtt: 'vtt', json: 'json' }[fmt] || 'txt';
      await this.runWhisper(tempWav, outBase, flag, language, onProgress);

      const produced = `${outBase}.${ext}`;
      if (!fs.existsSync(produced)) throw new Error('Whisper produced no output');

      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.copyFileSync(produced, outputPath);

      if (onProgress) onProgress(100);
      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Transcription failed: ${error.message}`);
    } finally {
      [tempWav, `${outBase}.txt`, `${outBase}.srt`, `${outBase}.vtt`, `${outBase}.json`]
        .forEach((f) => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {} });
    }
  }

  // Convert any audio/video to WAV 16kHz mono for whisper.cpp
  async convertToWav(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const ff = spawn(ffmpegPath, ['-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', outputPath]);
      let stderr = '';
      ff.stderr.on('data', (d) => { stderr += d.toString(); });
      ff.on('close', (code) => code === 0 ? resolve(outputPath) : reject(new Error(`FFmpeg error: ${stderr.slice(-300)}`)));
      ff.on('error', (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
    });
  }

  async runWhisper(wavPath, outBase, formatFlag, language, onProgress) {
    return new Promise((resolve, reject) => {
      const langCode = (language && language !== 'auto') ? language : 'auto';
      const args = [
        '-m', this.getModelPath(),
        '-f', wavPath,
        '-of', outBase,
        formatFlag,
        '-l', langCode,
        '-pp',          // print progress
      ];
      if (onProgress) onProgress(35);
      const whisper = spawn(this.getWhisperPath(), args);
      let stderr = '';
      whisper.stderr.on('data', (data) => {
        stderr += data.toString();
        const m = data.toString().match(/progress\s*=\s*(\d+)%/);
        if (m && onProgress) onProgress(35 + Math.round(parseInt(m[1]) * 0.6));
      });
      whisper.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Whisper error (code ${code}): ${stderr.slice(-400)}`)));
      whisper.on('error', (err) => reject(new Error(`Failed to run Whisper: ${err.message}`)));
    });
  }
}

module.exports = TranscriptionConverter;
