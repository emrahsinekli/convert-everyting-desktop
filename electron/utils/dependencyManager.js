const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { createWriteStream } = require('fs');
const AdmZip = require('adm-zip');

class DependencyManager {
  constructor() {
    this.appDir = path.join(os.homedir(), '.convert-everything');
    this.binDir = path.join(this.appDir, 'bin');
    this.modelsDir = path.join(this.appDir, 'models');
    this.platform = process.platform;
    this.isWindows = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';

    // Ensure directories exist
    if (!fs.existsSync(this.appDir)) {
      fs.mkdirSync(this.appDir, { recursive: true });
    }
    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }

    // NOTE: Whisper (speech-to-text) is now BUNDLED inside the app
    // (resources/bin/whisper-macos + resources/models/ggml-base.bin) and signed
    // with the app. The old download-on-demand flow was removed.

    this.dependencies = {
      ffmpeg: {
        name: 'FFmpeg',
        description: 'Video and audio processing',
        required: true
      },
      whisper: {
        name: 'Whisper AI',
        description: 'AI-powered speech recognition (offline, no Python required)',
        required: false
      }
    };
  }

  async checkDependencies() {
    const results = {};

    // FFmpeg is bundled
    results.ffmpeg = {
      ...this.dependencies.ffmpeg,
      installed: true,
      bundled: true
    };

    // Whisper is bundled with the app
    results.whisper = {
      ...this.dependencies.whisper,
      installed: true,
      bundled: true
    };

    return results;
  }

  isWhisperReady() { return true; }

  async installDependency(depName, onProgress) {
    if (depName === 'whisper') {
      // Bundled — nothing to download
      return { success: true, alreadyInstalled: true, message: 'Whisper is bundled with the app' };
    }
    return { success: false, message: 'Unknown dependency' };
  }

  // Download file with progress
  async downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const makeRequest = (reqUrl) => {
        const protocol = reqUrl.startsWith('https') ? https : require('http');

        protocol.get(reqUrl, {
          headers: { 'User-Agent': 'ConvertEverything/1.0' }
        }, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            makeRequest(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: HTTP ${response.statusCode}`));
            return;
          }

          const totalBytes = parseInt(response.headers['content-length'], 10);
          let downloadedBytes = 0;

          const file = createWriteStream(destPath);

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (onProgress && totalBytes) {
              const percent = Math.round((downloadedBytes / totalBytes) * 100);
              onProgress(percent);
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve(destPath);
          });

          file.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        }).on('error', (err) => {
          reject(err);
        });
      };

      makeRequest(url);
    });
  }

  async installWhisperCpp(onProgress) {
    try {
      if (onProgress) onProgress(5, 'Downloading Whisper AI...');

      // Step 1: Download whisper.cpp binary
      const zipPath = path.join(this.appDir, 'whisper-bin.zip');

      if (onProgress) onProgress(10, 'Downloading Whisper program...');

      await this.downloadFile(this.whisperCppUrl, zipPath, (percent) => {
        if (onProgress) onProgress(10 + Math.round(percent * 0.3), `Downloading program... ${percent}%`);
      });

      // Step 2: Extract zip
      if (onProgress) onProgress(45, 'Extracting files...');

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(this.binDir, true);

      // Clean up zip
      fs.unlinkSync(zipPath);

      // Step 3: Download model
      if (onProgress) onProgress(50, 'Downloading AI model (142 MB)...');

      const modelPath = path.join(this.modelsDir, 'ggml-base.bin');

      await this.downloadFile(this.whisperModelUrl, modelPath, (percent) => {
        if (onProgress) onProgress(50 + Math.round(percent * 0.45), `Downloading model... ${percent}%`);
      });

      // Verify installation
      const whisperExe = path.join(this.binDir, this.whisperExeName);
      if (fs.existsSync(whisperExe) && fs.existsSync(modelPath)) {
        if (onProgress) onProgress(100, 'Whisper AI kuruldu!');
        return {
          success: true,
          message: 'Whisper AI installed successfully! You can now transcribe audio and video files.'
        };
      } else {
        throw new Error('Files could not be verified');
      }
    } catch (error) {
      console.error('Whisper installation error:', error);
      return {
        success: false,
        message: `Installation error: ${error.message}`
      };
    }
  }

  // Get system info for debugging
  getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      homeDir: os.homedir(),
      appDir: this.appDir
    };
  }
}

module.exports = DependencyManager;
