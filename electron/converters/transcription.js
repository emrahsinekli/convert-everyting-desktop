const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpegPath = require('ffmpeg-static');

class TranscriptionConverter {
  constructor() {
    this.supportedInputFormats = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    this.supportedOutputFormats = ['txt', 'srt', 'vtt', 'json'];

    // Paths
    this.appDir = path.join(os.homedir(), '.convert-everything');
    this.binDir = path.join(this.appDir, 'bin');
    this.modelsDir = path.join(this.appDir, 'models');

    // Platform-specific executable name
    this.isWindows = process.platform === 'win32';
    this.whisperExeName = this.isWindows ? 'main.exe' : 'main';
  }

  // Check if whisper.cpp is installed
  isWhisperInstalled() {
    const whisperExe = path.join(this.binDir, this.whisperExeName);
    const whisperModel = path.join(this.modelsDir, 'ggml-base.bin');
    return fs.existsSync(whisperExe) && fs.existsSync(whisperModel);
  }

  getWhisperPath() {
    return path.join(this.binDir, this.whisperExeName);
  }

  getModelPath() {
    return path.join(this.modelsDir, 'ggml-base.bin');
  }

  async convert(inputPath, outputPath, outputFormat, options = {}) {
    const { onProgress, language = 'auto' } = options;

    // Check if Whisper is available
    if (!this.isWhisperInstalled()) {
      throw new Error('WHISPER_NOT_INSTALLED');
    }

    try {
      if (onProgress) onProgress(5);

      // Step 1: Convert input to WAV (whisper.cpp requires WAV 16kHz)
      const tempWav = path.join(os.tmpdir(), `whisper_input_${Date.now()}.wav`);

      if (onProgress) onProgress(10);

      await this.convertToWav(inputPath, tempWav, onProgress);

      if (onProgress) onProgress(30);

      // Step 2: Run whisper.cpp
      const transcription = await this.runWhisperCpp(tempWav, language, onProgress);

      // Clean up temp file
      if (fs.existsSync(tempWav)) {
        fs.unlinkSync(tempWav);
      }

      if (onProgress) onProgress(90);

      // Step 3: Format output
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      let output;
      switch (outputFormat.toLowerCase()) {
        case 'srt':
          output = this.formatAsSRT(transcription);
          break;
        case 'vtt':
          output = this.formatAsVTT(transcription);
          break;
        case 'json':
          output = JSON.stringify(transcription, null, 2);
          break;
        case 'txt':
        default:
          output = transcription.text || '';
          break;
      }

      fs.writeFileSync(outputPath, output, 'utf-8');

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  // Convert any audio/video to WAV 16kHz for whisper.cpp
  async convertToWav(inputPath, outputPath, onProgress) {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-ar', '16000',     // 16kHz sample rate
        '-ac', '1',         // Mono
        '-c:a', 'pcm_s16le', // 16-bit PCM
        '-y',               // Overwrite
        outputPath
      ];

      const ffmpeg = spawn(ffmpegPath, args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg error: ${stderr}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg spawn error: ${err.message}`));
      });
    });
  }

  // Run whisper.cpp
  async runWhisperCpp(wavPath, language, onProgress) {
    return new Promise((resolve, reject) => {
      const whisperExe = this.getWhisperPath();
      const modelPath = this.getModelPath();

      // Determine language setting
      const langCode = (language && language !== 'auto') ? language : 'auto';

      const args = [
        '-m', modelPath,
        '-f', wavPath,
        '-oj',           // Output JSON
        '-l', langCode,  // Language: 'auto' for auto-detect, or specific code like 'tr', 'en'
        '--print-progress'
      ];

      if (onProgress) onProgress(35);

      const whisper = spawn(whisperExe, args);

      let stdout = '';
      let stderr = '';

      whisper.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      whisper.stderr.on('data', (data) => {
        stderr += data.toString();
        // Parse progress
        const match = stderr.match(/progress = (\d+)%/);
        if (match && onProgress) {
          const progress = parseInt(match[1]);
          onProgress(35 + Math.round(progress * 0.5));
        }
      });

      whisper.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const result = JSON.parse(stdout);
            // Convert whisper.cpp format to our format
            const transcription = {
              text: result.transcription ? result.transcription.map(s => s.text).join(' ').trim() : '',
              segments: result.transcription ? result.transcription.map((s, i) => ({
                id: i,
                start: s.timestamps?.from ? this.parseTimestamp(s.timestamps.from) : i * 5,
                end: s.timestamps?.to ? this.parseTimestamp(s.timestamps.to) : (i + 1) * 5,
                text: s.text || ''
              })) : []
            };
            resolve(transcription);
          } catch (e) {
            // If JSON parse fails, try to extract text
            const textMatch = stdout.match(/\[.*?\]\s*(.*)/g);
            if (textMatch) {
              const text = textMatch.map(line => line.replace(/\[.*?\]\s*/, '')).join(' ').trim();
              resolve({ text, segments: [] });
            } else {
              reject(new Error('Failed to parse transcription output'));
            }
          }
        } else {
          reject(new Error(`Whisper error (code ${code}): ${stderr || 'No output'}`));
        }
      });

      whisper.on('error', (err) => {
        reject(new Error(`Failed to run Whisper: ${err.message}`));
      });
    });
  }

  // Parse timestamp string "HH:MM:SS.mmm" to seconds
  parseTimestamp(ts) {
    const match = ts.match(/(\d+):(\d+):(\d+)\.(\d+)/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      const ms = parseInt(match[4]);
      return hours * 3600 + minutes * 60 + seconds + ms / 1000;
    }
    return 0;
  }

  formatAsSRT(transcription) {
    if (!transcription.segments) {
      return `1\n00:00:00,000 --> 00:00:05,000\n${transcription.text || transcription}\n`;
    }

    return transcription.segments.map((segment, index) => {
      const startTime = this.formatSRTTime(segment.start);
      const endTime = this.formatSRTTime(segment.end);
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n`;
    }).join('\n');
  }

  formatAsVTT(transcription) {
    let vtt = 'WEBVTT\n\n';

    if (!transcription.segments) {
      vtt += `00:00:00.000 --> 00:00:05.000\n${transcription.text || transcription}\n`;
      return vtt;
    }

    vtt += transcription.segments.map((segment) => {
      const startTime = this.formatVTTTime(segment.start);
      const endTime = this.formatVTTTime(segment.end);
      return `${startTime} --> ${endTime}\n${segment.text.trim()}\n`;
    }).join('\n');

    return vtt;
  }

  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  formatVTTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

}

module.exports = TranscriptionConverter;
