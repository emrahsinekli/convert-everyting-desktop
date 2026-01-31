const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Set ffmpeg paths
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

class AudioConverter {
  constructor() {
    // Comprehensive audio input formats (FFmpeg supports all of these)
    this.supportedInputFormats = [
      // Common audio formats
      'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus',
      // Additional audio formats
      'aiff', 'aif', 'amr', 'alac', 'ape', 'au', 'caf',
      'm4b', 'm4r', 'm4p', 'mid', 'midi', 'mka', 'mp2',
      'oga', 'ra', 'raw', 'rmi', 'snd', 'tta', 'voc',
      'wave', 'wv', '3ga', 'ac3', 'dts', 'aifc', 'mp1',
      // Video formats (for audio extraction)
      'mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv',
      'm2ts', 'mts', 'mpeg', 'mpg', 'vob', 'ts', '3gp',
      'mod', 'qt', 'rm', 'rmvb', 'asf', '3g2', 'f4v', 'ogv'
    ];
    // Output audio formats (all supported with cross-platform compatible codecs)
    this.supportedOutputFormats = [
      'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma',
      'opus', 'aiff', 'ac3', 'amr', 'caf', 'mp2', 'au'
    ];
  }

  async getAudioInfo(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            sampleRate: audioStream.sample_rate,
            channels: audioStream.channels,
            bitrate: audioStream.bit_rate,
            channelLayout: audioStream.channel_layout
          } : null
        });
      });
    });
  }

  async convert(inputPath, outputPath, outputFormat, options = {}) {
    const { onProgress, quality = 'medium', sampleRate, channels, bitrate, conversionType } = options;

    console.log('=== Audio Convert START ===');
    console.log('Input:', inputPath);
    console.log('Output:', outputPath);
    console.log('Format:', outputFormat);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Delete existing output file if exists
    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch (e) {
      console.log('Could not delete existing file:', e.message);
    }

    // Get input info for progress calculation and audio stream check
    let audioInfo;
    try {
      audioInfo = await this.getAudioInfo(inputPath);
    } catch (e) {
      audioInfo = { duration: 0 };
    }
    const totalDuration = audioInfo.duration;

    // Check if input has audio stream
    if (!audioInfo.audio) {
      throw new Error('Input file does not contain an audio stream. Cannot extract audio from a video-only file.');
    }

    return new Promise((resolve, reject) => {
      let completed = false;
      const command = ffmpeg(inputPath);

      // Set audio bitrate based on quality
      const bitrateMap = {
        low: '96k',
        medium: '192k',
        high: '320k'
      };
      const audioBitrate = bitrate || bitrateMap[quality] || '192k';

      // Apply sample rate if specified
      if (sampleRate) {
        command.audioFrequency(sampleRate);
      }

      // Apply channels if specified
      if (channels) {
        command.audioChannels(channels);
      }

      // Build output options based on format
      const outputOpts = ['-y', '-vn']; // Overwrite and no video

      // Set codec and quality based on output format
      // Use codecs available in ffmpeg-static (cross-platform compatible)
      switch (outputFormat) {
        case 'mp3':
          // libmp3lame is included in ffmpeg-static
          outputOpts.push('-c:a', 'libmp3lame');
          outputOpts.push('-b:a', audioBitrate);
          outputOpts.push('-q:a', '2'); // VBR quality
          break;
        case 'aac':
        case 'm4a':
          outputOpts.push('-c:a', 'aac');
          outputOpts.push('-b:a', audioBitrate);
          outputOpts.push('-strict', 'experimental'); // For native AAC encoder
          break;
        case 'ogg':
          outputOpts.push('-c:a', 'libvorbis');
          outputOpts.push('-b:a', audioBitrate);
          break;
        case 'opus':
          outputOpts.push('-c:a', 'libopus');
          outputOpts.push('-b:a', audioBitrate);
          break;
        case 'wav':
          outputOpts.push('-c:a', 'pcm_s16le');
          break;
        case 'flac':
          outputOpts.push('-c:a', 'flac');
          break;
        case 'wma':
          // WMA codec may not be available - use AAC as fallback in ASF container
          outputOpts.push('-c:a', 'aac');
          outputOpts.push('-b:a', audioBitrate);
          break;
        case 'aiff':
        case 'aif':
          outputOpts.push('-c:a', 'pcm_s16be');
          break;
        case 'amr':
          // AMR codec may not be available - try it, but have fallback
          outputOpts.push('-c:a', 'libopencore_amrnb');
          outputOpts.push('-ar', '8000');
          outputOpts.push('-ac', '1');
          break;
        case 'ac3':
          outputOpts.push('-c:a', 'ac3');
          outputOpts.push('-b:a', audioBitrate);
          break;
        case 'mp2':
          // mp2 encoder is usually available
          outputOpts.push('-c:a', 'mp2');
          outputOpts.push('-b:a', audioBitrate);
          break;
        case 'au':
          outputOpts.push('-c:a', 'pcm_mulaw');
          break;
        case 'caf':
          // ALAC may not be available - use pcm instead
          outputOpts.push('-c:a', 'pcm_s16le');
          break;
        default:
          // Default to AAC which is widely supported
          outputOpts.push('-c:a', 'aac');
          outputOpts.push('-b:a', audioBitrate);
      }

      // Set output format explicitly - map to FFmpeg format names
      const formatMap = {
        'm4a': 'ipod',
        'aiff': 'aiff',
        'aif': 'aiff',
        'amr': 'amr',
        'au': 'au',
        'caf': 'caf',
        'wma': 'asf',  // WMA uses ASF container
        'mp3': 'mp3',
        'aac': 'adts', // Raw AAC uses ADTS format
        'ogg': 'ogg',
        'opus': 'ogg', // Opus in Ogg container
        'wav': 'wav',
        'flac': 'flac',
        'ac3': 'ac3',
        'mp2': 'mp2'
      };
      outputOpts.push('-f', formatMap[outputFormat] || outputFormat);

      command
        .outputOptions(outputOpts)
        .on('start', (commandLine) => {
          console.log('FFmpeg command started:', commandLine);
        })
        .on('progress', (progress) => {
          if (onProgress && totalDuration) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / totalDuration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          if (completed) return;
          completed = true;

          console.log('FFmpeg process ended for:', outputPath);

          // Wait for file system to sync
          setTimeout(() => {
            try {
              if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                console.log('=== Audio Convert SUCCESS ===');
                console.log('Output file:', outputPath);
                console.log('File size:', stats.size);
                resolve({ outputPath, success: true });
              } else {
                console.error('=== Audio Convert FAILED ===');
                console.error('Output file not found:', outputPath);
                reject(new Error('Output file was not created'));
              }
            } catch (err) {
              console.error('Error checking output file:', err.message);
              reject(new Error(`Failed to verify output: ${err.message}`));
            }
          }, 500); // Increased delay for Windows file system
        })
        .on('error', (err, stdout, stderr) => {
          if (completed) return;
          completed = true;

          console.error('=== Audio Convert ERROR ===');
          console.error('Error:', err.message);
          if (stderr) console.error('FFmpeg stderr:', stderr);

          reject(new Error(`Audio conversion failed: ${err.message}`));
        });

      // Use output() and run() instead of save() for better control
      command.output(outputPath).run();
    });
  }

  getCodecSettings(format, quality, customBitrate) {
    const qualityPresets = {
      low: { audioBitrate: '96k' },
      medium: { audioBitrate: '192k' },
      high: { audioBitrate: '320k' },
      lossless: { audioBitrate: null }
    };

    // Let FFmpeg choose the best codec for each format automatically
    const formatCodecs = {
      mp3: { audioCodec: null },  // FFmpeg will use default mp3 encoder
      wav: { audioCodec: 'pcm_s16le' },
      flac: { audioCodec: 'flac' },
      aac: { audioCodec: 'aac' },
      ogg: { audioCodec: null },  // FFmpeg will choose
      m4a: { audioCodec: 'aac' }
    };

    const codecSettings = formatCodecs[format] || { audioCodec: null };
    const qualitySettings = { ...qualityPresets[quality] } || { ...qualityPresets.medium };

    // Lossless formats don't need bitrate
    if (format === 'wav' || format === 'flac') {
      qualitySettings.audioBitrate = null;
    }

    if (customBitrate) {
      qualitySettings.audioBitrate = customBitrate;
    }

    return { ...codecSettings, ...qualitySettings };
  }

  timemarkToSeconds(timemark) {
    const parts = timemark.split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
  }

  // Normalize audio volume
  async normalize(inputPath, outputPath, options = {}) {
    const { onProgress, targetLevel = -14 } = options;

    const audioInfo = await this.getAudioInfo(inputPath);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters(`loudnorm=I=${targetLevel}:TP=-1.5:LRA=11`)
        .output(outputPath)
        .on('progress', (progress) => {
          if (onProgress && audioInfo.duration) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / audioInfo.duration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`Audio normalization failed: ${err.message}`));
        })
        .run();
    });
  }

  // Compress audio - reduce bitrate
  async compress(inputPath, outputPath, options = {}) {
    const { onProgress, bitrate = 128 } = options;

    // Normalize paths for Windows
    inputPath = inputPath.replace(/\\/g, '/');
    outputPath = outputPath.replace(/\\/g, '/');

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get input info for progress calculation
    let audioInfo;
    try {
      audioInfo = await this.getAudioInfo(inputPath);
    } catch (e) {
      audioInfo = { duration: 0 };
    }
    const totalDuration = audioInfo.duration;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-y',
          '-vn',
          '-b:a', `${bitrate}k`
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg compress command:', commandLine);
        })
        .on('progress', (progress) => {
          if (onProgress && totalDuration) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / totalDuration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`Audio compression failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  // Trim audio
  async trim(inputPath, outputPath, options = {}) {
    const { onProgress, startTime, endTime } = options;

    // Normalize paths for Windows
    inputPath = inputPath.replace(/\\/g, '/');
    outputPath = outputPath.replace(/\\/g, '/');

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Parse time strings to seconds
    const parseTime = (timeStr) => {
      if (typeof timeStr === 'number') return timeStr;
      const parts = timeStr.split(':').map(parseFloat);
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
      return parseFloat(timeStr) || 0;
    };

    const startSec = parseTime(startTime);
    const endSec = parseTime(endTime);
    const duration = endSec - startSec;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startSec)
        .setDuration(duration)
        .outputOptions(['-y', '-c', 'copy'])
        .on('start', (commandLine) => {
          console.log('FFmpeg trim command:', commandLine);
        })
        .on('progress', (progress) => {
          if (onProgress) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / duration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`Audio trimming failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  // Merge multiple audio files
  async merge(inputPaths, outputPath, options = {}) {
    const { onProgress } = options;

    // Normalize paths for Windows
    inputPaths = inputPaths.map(p => p.replace(/\\/g, '/'));
    outputPath = outputPath.replace(/\\/g, '/');

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      // Add all input files
      inputPaths.forEach(inputPath => {
        command = command.input(inputPath);
      });

      // Create filter complex for concatenation
      const filterInputs = inputPaths.map((_, i) => `[${i}:a]`).join('');
      const filterComplex = `${filterInputs}concat=n=${inputPaths.length}:v=0:a=1[out]`;

      command
        .complexFilter(filterComplex)
        .outputOptions(['-y', '-map', '[out]'])
        .on('start', (commandLine) => {
          console.log('FFmpeg merge command:', commandLine);
        })
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(Math.round(progress.percent));
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`Audio merge failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  // Change audio speed
  async changeSpeed(inputPath, outputPath, speed, options = {}) {
    const { onProgress } = options;

    const audioInfo = await this.getAudioInfo(inputPath);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters(`atempo=${speed}`)
        .output(outputPath)
        .on('progress', (progress) => {
          if (onProgress && audioInfo.duration) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / audioInfo.duration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`Speed change failed: ${err.message}`));
        })
        .run();
    });
  }
}

module.exports = AudioConverter;
