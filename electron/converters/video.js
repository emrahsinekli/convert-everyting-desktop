const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Set ffmpeg paths (packaged: binaries are in app.asar.unpacked, not the asar)
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const ffprobePath = require('ffprobe-static').path.replace('app.asar', 'app.asar.unpacked');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

class VideoConverter {
  constructor() {
    // Comprehensive video input formats (FFmpeg supports all of these)
    this.supportedInputFormats = [
      // Common formats
      'mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv', 'm4v', '3gp',
      // Professional/Broadcast formats
      'm2ts', 'mts', 'mpeg', 'mpg', 'vob', 'ts', 'mxf',
      // Additional formats
      'mod', 'qt', 'rm', 'rmvb', 'asf', '3g2', 'mpv', 'wtv',
      'divx', 'xvid', 'm1v', 'f4p', 'f4v', 'ogv', 'dv', 'swf',
      // Other
      '3gpp', 'dvr-ms'
    ];
    // Output formats (all supported)
    this.supportedOutputFormats = [
      'mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv', 'gif',
      'm4v', '3gp', 'mpeg', 'mpg', 'ts', 'ogv'
    ];
  }

  async getVideoInfo(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          video: videoStream ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: eval(videoStream.r_frame_rate),
            bitrate: videoStream.bit_rate
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            sampleRate: audioStream.sample_rate,
            channels: audioStream.channels,
            bitrate: audioStream.bit_rate
          } : null
        });
      });
    });
  }

  async convert(inputPath, outputPath, outputFormat, options = {}) {
    const { onProgress, quality = 'medium', resolution, fps, codec } = options;

    // Log input parameters
    console.log('=== Video Convert START ===');
    console.log('Input:', inputPath);
    console.log('Output:', outputPath);
    console.log('Format:', outputFormat);

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Delete existing output file if exists
    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
        console.log('Deleted existing file:', outputPath);
      }
    } catch (e) {
      console.log('Could not delete existing file:', e.message);
    }

    // Get input video info for progress calculation
    let videoInfo;
    try {
      videoInfo = await this.getVideoInfo(inputPath);
    } catch (e) {
      console.error('Could not get video info:', e.message);
      videoInfo = { duration: 0 };
    }
    const totalDuration = videoInfo.duration;

    return new Promise((resolve, reject) => {
      let completed = false;

      const command = ffmpeg(inputPath);

      // Set output codec based on format
      const codecSettings = this.getCodecSettings(outputFormat, quality, codec);
      if (codecSettings.videoCodec) {
        command.videoCodec(codecSettings.videoCodec);
      }
      if (codecSettings.audioCodec) {
        command.audioCodec(codecSettings.audioCodec);
      }

      // Apply quality settings
      if (codecSettings.videoBitrate) {
        command.videoBitrate(codecSettings.videoBitrate);
      }
      if (codecSettings.audioBitrate) {
        command.audioBitrate(codecSettings.audioBitrate);
      }

      // Apply resolution if specified
      if (resolution) {
        command.size(resolution);
      }

      // Apply FPS if specified
      if (fps) {
        command.fps(fps);
      }

      // Special handling for GIF
      if (outputFormat === 'gif') {
        command
          .outputOptions([
            '-vf', 'fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
            '-loop', '0'
          ])
          .noAudio();
      }

      // Map output format to FFmpeg format name
      const formatMap = {
        'mp4': 'mp4',
        'avi': 'avi',
        'mkv': 'matroska',
        'mov': 'mov',
        'webm': 'webm',
        'wmv': 'asf',
        'flv': 'flv',
        'm4v': 'mp4',
        '3gp': 'mp4',
        'mpeg': 'mpeg',
        'mpg': 'mpeg',
        'ts': 'mpegts',
        'ogv': 'ogg',
        'gif': 'gif'
      };
      const ffmpegFormat = formatMap[outputFormat] || outputFormat;

      // Add format-specific options
      const outputOpts = ['-y']; // Overwrite output file

      // Add pixel format for better compatibility
      if (outputFormat !== 'gif') {
        outputOpts.push('-pix_fmt', 'yuv420p');
      }

      // Add preset for faster encoding with libx264
      if (codecSettings.videoCodec === 'libx264') {
        outputOpts.push('-preset', 'medium');
      }

      command
        .outputOptions(outputOpts)
        .outputFormat(ffmpegFormat)
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
                console.log('=== Video Convert SUCCESS ===');
                console.log('Output file:', outputPath);
                console.log('File size:', stats.size);
                resolve({ outputPath, success: true });
              } else {
                console.error('=== Video Convert FAILED ===');
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

          console.error('=== Video Convert ERROR ===');
          console.error('Error:', err.message);
          if (stderr) console.error('FFmpeg stderr:', stderr);

          const errorDetail = stderr ? `\nFFmpeg: ${stderr.split('\n').slice(-5).join('\n')}` : '';
          reject(new Error(`Video conversion failed: ${err.message}${errorDetail}`));
        });

      // Use output() and run() instead of save() for better control
      command.output(outputPath).run();
    });
  }

  getCodecSettings(format, quality, customCodec) {
    const qualityPresets = {
      low: { videoBitrate: '500k', audioBitrate: '96k' },
      medium: { videoBitrate: '1500k', audioBitrate: '128k' },
      high: { videoBitrate: '4000k', audioBitrate: '192k' },
      ultra: { videoBitrate: '8000k', audioBitrate: '320k' }
    };

    // Use codecs that are available in ffmpeg-static (cross-platform compatible)
    // Avoid codecs that may not be present: wmv2, wmav2, mp3, libtheora, h263, msmpeg4v3
    const formatCodecs = {
      mp4: { videoCodec: 'libx264', audioCodec: 'aac' },
      webm: { videoCodec: 'libvpx', audioCodec: 'libvorbis' },
      avi: { videoCodec: 'mpeg4', audioCodec: 'aac' },
      mkv: { videoCodec: 'libx264', audioCodec: 'aac' },
      mov: { videoCodec: 'libx264', audioCodec: 'aac' },
      wmv: { videoCodec: 'mpeg4', audioCodec: 'aac' },  // Use mpeg4 codec in ASF container (WMV compatible)
      flv: { videoCodec: 'libx264', audioCodec: 'aac' },
      m4v: { videoCodec: 'libx264', audioCodec: 'aac' },
      '3gp': { videoCodec: 'libx264', audioCodec: 'aac' },
      mpeg: { videoCodec: 'mpeg2video', audioCodec: 'mp2' },  // MPEG uses mp2 audio
      mpg: { videoCodec: 'mpeg2video', audioCodec: 'mp2' },   // MPEG uses mp2 audio
      ts: { videoCodec: 'libx264', audioCodec: 'aac' },
      ogv: { videoCodec: 'libvpx', audioCodec: 'libvorbis' },
      gif: { videoCodec: null, audioCodec: null }
    };

    const codecSettings = { ...formatCodecs[format] } || { ...formatCodecs.mp4 };
    const qualitySettings = { ...qualityPresets[quality] } || { ...qualityPresets.medium };

    if (customCodec) {
      codecSettings.videoCodec = customCodec;
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

  // Compress video
  async compress(inputPath, outputPath, targetSizeMB, options = {}) {
    const { onProgress } = options;

    const videoInfo = await this.getVideoInfo(inputPath);
    const targetBitrate = Math.floor((targetSizeMB * 8192) / videoInfo.duration);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoBitrate(`${targetBitrate}k`)
        .audioBitrate('128k')
        .output(outputPath)
        .on('progress', (progress) => {
          if (onProgress && videoInfo.duration) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / videoInfo.duration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`Video compression failed: ${err.message}`));
        })
        .run();
    });
  }

  // Extract frames from video
  async extractFrames(inputPath, outputDir, options = {}) {
    const { fps = 1, format = 'png' } = options;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([`-vf`, `fps=${fps}`])
        .output(path.join(outputDir, `frame_%04d.${format}`))
        .on('end', () => {
          const frames = fs.readdirSync(outputDir)
            .filter(f => f.startsWith('frame_'))
            .map(f => path.join(outputDir, f));
          resolve({ frames, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`Frame extraction failed: ${err.message}`));
        })
        .run();
    });
  }

  // Trim video
  async trim(inputPath, outputPath, startTime, endTime, options = {}) {
    const { onProgress } = options;
    const duration = endTime - startTime;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(outputPath)
        .outputOptions(['-c', 'copy'])
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
        .on('error', (err) => {
          reject(new Error(`Video trimming failed: ${err.message}`));
        })
        .run();
    });
  }

  // Crop video
  async crop(inputPath, outputPath, region, options = {}) {
    const { onProgress } = options;
    const { width, height, x = 0, y = 0 } = region;

    const videoInfo = await this.getVideoInfo(inputPath);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(`crop=${width}:${height}:${x}:${y}`)
        .output(outputPath)
        .outputOptions(['-y'])
        .on('progress', (progress) => {
          if (onProgress && videoInfo.duration) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / videoInfo.duration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`Video cropping failed: ${err.message}`));
        })
        .run();
    });
  }

  // Rotate video
  async rotate(inputPath, outputPath, angle, options = {}) {
    const { onProgress } = options;

    const videoInfo = await this.getVideoInfo(inputPath);

    // FFmpeg transpose values: 0=90CounterCW+Vflip, 1=90CW, 2=90CounterCW, 3=90CW+Vflip
    let filter;
    switch (angle) {
      case 90:
        filter = 'transpose=1';
        break;
      case 180:
        filter = 'transpose=1,transpose=1';
        break;
      case 270:
        filter = 'transpose=2';
        break;
      default:
        filter = null;
    }

    if (!filter) {
      // No rotation needed, just copy
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions(['-c', 'copy', '-y'])
          .output(outputPath)
          .on('end', () => resolve({ outputPath, success: true }))
          .on('error', (err) => reject(new Error(`Video copy failed: ${err.message}`)))
          .run();
      });
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filter)
        .output(outputPath)
        .outputOptions(['-y'])
        .on('progress', (progress) => {
          if (onProgress && videoInfo.duration) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / videoInfo.duration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`Video rotation failed: ${err.message}`));
        })
        .run();
    });
  }

  // Flip video
  async flip(inputPath, outputPath, flipOptions, options = {}) {
    const { onProgress } = options;
    const { horizontal, vertical } = flipOptions;

    const videoInfo = await this.getVideoInfo(inputPath);

    let filters = [];
    if (horizontal) filters.push('hflip');
    if (vertical) filters.push('vflip');

    if (filters.length === 0) {
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions(['-c', 'copy', '-y'])
          .output(outputPath)
          .on('end', () => resolve({ outputPath, success: true }))
          .on('error', (err) => reject(new Error(`Video copy failed: ${err.message}`)))
          .run();
      });
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filters.join(','))
        .output(outputPath)
        .outputOptions(['-y'])
        .on('progress', (progress) => {
          if (onProgress && videoInfo.duration) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / videoInfo.duration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`Video flip failed: ${err.message}`));
        })
        .run();
    });
  }

  // Add watermark to video
  async watermark(inputPath, outputPath, options = {}) {
    const { onProgress } = options;
    const videoInfo = await this.getVideoInfo(inputPath);

    // Calculate position based on options
    const getPosition = (pos, marginX, marginY, customX, customY) => {
      const mx = marginX || 20;
      const my = marginY || 20;
      switch (pos) {
        case 'top-left': return { x: mx, y: my };
        case 'top-center': return { x: '(w-text_w)/2', y: my };
        case 'top-right': return { x: `w-text_w-${mx}`, y: my };
        case 'middle-left': return { x: mx, y: '(h-text_h)/2' };
        case 'center': return { x: '(w-text_w)/2', y: '(h-text_h)/2' };
        case 'middle-right': return { x: `w-text_w-${mx}`, y: '(h-text_h)/2' };
        case 'bottom-left': return { x: mx, y: `h-text_h-${my}` };
        case 'bottom-center': return { x: '(w-text_w)/2', y: `h-text_h-${my}` };
        case 'bottom-right': return { x: `w-text_w-${mx}`, y: `h-text_h-${my}` };
        case 'custom': return { x: `w*${(customX || 50)/100}`, y: `h*${(customY || 50)/100}` };
        default: return { x: `w-text_w-${mx}`, y: `h-text_h-${my}` };
      }
    };

    const getOverlayPosition = (pos, marginX, marginY, customX, customY) => {
      const mx = marginX || 20;
      const my = marginY || 20;
      switch (pos) {
        case 'top-left': return { x: mx, y: my };
        case 'top-center': return { x: '(main_w-overlay_w)/2', y: my };
        case 'top-right': return { x: `main_w-overlay_w-${mx}`, y: my };
        case 'middle-left': return { x: mx, y: '(main_h-overlay_h)/2' };
        case 'center': return { x: '(main_w-overlay_w)/2', y: '(main_h-overlay_h)/2' };
        case 'middle-right': return { x: `main_w-overlay_w-${mx}`, y: '(main_h-overlay_h)/2' };
        case 'bottom-left': return { x: mx, y: `main_h-overlay_h-${my}` };
        case 'bottom-center': return { x: '(main_w-overlay_w)/2', y: `main_h-overlay_h-${my}` };
        case 'bottom-right': return { x: `main_w-overlay_w-${mx}`, y: `main_h-overlay_h-${my}` };
        case 'custom': return { x: `main_w*${(customX || 50)/100}`, y: `main_h*${(customY || 50)/100}` };
        default: return { x: `main_w-overlay_w-${mx}`, y: `main_h-overlay_h-${my}` };
      }
    };

    return new Promise((resolve, reject) => {
      let cmd = ffmpeg(inputPath);

      if (options.type === 'text') {
        const fontColor = (options.fontColor || '#ffffff').replace('#', '0x');
        const alpha = (options.opacity || 50) / 100;
        const fontSize = options.fontSize || 48;
        const text = (options.text || 'Watermark').replace(/'/g, "\\'").replace(/:/g, '\\:');

        // Tile mode - repeat watermark across entire video
        if (options.tileMode) {
          const spacingX = options.tileSpacingX || 150;
          const spacingY = options.tileSpacingY || 150;
          const rotation = options.rotation || 0;

          // Create multiple drawtext filters for tiled effect
          // Calculate grid based on typical video dimensions
          const filters = [];
          const cols = Math.ceil(1920 / spacingX) + 1;
          const rows = Math.ceil(1080 / spacingY) + 1;

          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              const x = col * spacingX;
              const y = row * spacingY;

              let drawtext = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}@${alpha}:x=${x}:y=${y}`;
              if (options.fontBold) drawtext += ':font=Arial Bold';
              if (options.textShadow) {
                const shadowColor = (options.shadowColor || '#000000').replace('#', '0x');
                drawtext += `:shadowcolor=${shadowColor}@0.5:shadowx=2:shadowy=2`;
              }
              filters.push(drawtext);
            }
          }

          cmd.videoFilters(filters);
        } else {
          // Single watermark at position
          const pos = getPosition(options.position, options.marginX, options.marginY, options.customX, options.customY);
          let drawtext = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}@${alpha}:x=${pos.x}:y=${pos.y}`;

          if (options.fontBold) drawtext += ':font=Arial Bold';
          if (options.textShadow) {
            const shadowColor = (options.shadowColor || '#000000').replace('#', '0x');
            drawtext += `:shadowcolor=${shadowColor}@0.5:shadowx=2:shadowy=2`;
          }

          cmd.videoFilters(drawtext);
        }
      } else if (options.type === 'image' && options.watermarkImagePath) {
        const alpha = (options.opacity || 50) / 100;
        const scale = (options.watermarkScale || 20) / 100;

        if (options.tileMode) {
          // Tile mode for image watermark
          const spacingX = options.tileSpacingX || 150;
          const spacingY = options.tileSpacingY || 150;

          // Create a tiled pattern using tile filter
          cmd.input(options.watermarkImagePath)
            .complexFilter([
              // Scale watermark
              `[1:v]scale=iw*${scale}:ih*${scale},format=rgba,colorchannelmixer=aa=${alpha}[wm]`,
              // Create tile pattern - pad each tile with spacing, then tile
              `[wm]pad=${spacingX}:${spacingY}:0:0:color=0x00000000[padded]`,
              // Tile it to cover the video
              `[padded]tile=ceil(iw/${spacingX})+2xceil(ih/${spacingY})+2[tiled]`,
              // Overlay on video
              `[0:v][tiled]overlay=0:0:shortest=1[out]`
            ], 'out');
        } else {
          // Single watermark at position
          const pos = getOverlayPosition(options.position, options.marginX, options.marginY, options.customX, options.customY);

          cmd.input(options.watermarkImagePath)
            .complexFilter([
              `[1:v]scale=iw*${scale}:ih*${scale},format=rgba,colorchannelmixer=aa=${alpha}[wm]`,
              `[0:v][wm]overlay=${pos.x}:${pos.y}[out]`
            ], 'out');
        }
      }

      cmd
        .outputOptions(['-y', '-c:a', 'copy'])
        .output(outputPath)
        .on('progress', (progress) => {
          if (onProgress && videoInfo.duration) {
            const currentTime = progress.timemark ? this.timemarkToSeconds(progress.timemark) : 0;
            const percent = Math.min(100, Math.round((currentTime / videoInfo.duration) * 100));
            onProgress(percent);
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`Video watermark failed: ${err.message}`));
        })
        .run();
    });
  }

  // Convert video to GIF
  async toGif(inputPath, outputPath, options = {}) {
    const { onProgress, startTime = 0, duration = 5, fps = 10, width = 480 } = options;

    // Parse startTime if it's a string
    let startSec = startTime;
    if (typeof startTime === 'string') {
      const parts = startTime.split(':').map(parseFloat);
      if (parts.length === 3) {
        startSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        startSec = parts[0] * 60 + parts[1];
      } else {
        startSec = parseFloat(startTime) || 0;
      }
    }

    // Normalize paths for Windows
    inputPath = inputPath.replace(/\\/g, '/');
    outputPath = outputPath.replace(/\\/g, '/');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startSec)
        .setDuration(duration)
        .outputOptions([
          '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
          '-loop', '0',
          '-y'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg toGif command:', commandLine);
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
        .on('error', (err) => {
          reject(new Error(`Video to GIF failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  // Create GIF from multiple images
  async imagesToGif(inputPaths, outputPath, options = {}) {
    const { onProgress, fps = 10, width = 480, delay = 100 } = options;

    // Normalize paths for Windows
    inputPaths = inputPaths.map(p => p.replace(/\\/g, '/'));
    outputPath = outputPath.replace(/\\/g, '/');

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create a temporary file list for FFmpeg
    const tempListPath = path.join(outputDir, `temp_list_${Date.now()}.txt`);
    const fileContent = inputPaths.map(p => `file '${p}'\nduration ${delay / 1000}`).join('\n');
    fs.writeFileSync(tempListPath, fileContent);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(tempListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
          '-loop', '0',
          '-y'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg imagesToGif command:', commandLine);
        })
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(Math.round(progress.percent));
          }
        })
        .on('end', () => {
          // Clean up temp file
          try { fs.unlinkSync(tempListPath); } catch (e) {}
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          // Clean up temp file
          try { fs.unlinkSync(tempListPath); } catch (e) {}
          reject(new Error(`Images to GIF failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  // Compress GIF by reducing colors
  async compressGif(inputPath, outputPath, options = {}) {
    const { onProgress, colors = 256 } = options;

    // Normalize paths for Windows
    inputPath = inputPath.replace(/\\/g, '/');
    outputPath = outputPath.replace(/\\/g, '/');

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', `split[s0][s1];[s0]palettegen=max_colors=${colors}[p];[s1][p]paletteuse`,
          '-loop', '0',
          '-y'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg compressGif command:', commandLine);
        })
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(Math.round(progress.percent));
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`GIF compression failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  // Convert GIF to video
  async gifToVideo(inputPath, outputPath, options = {}) {
    const { onProgress } = options;

    // Normalize paths for Windows
    inputPath = inputPath.replace(/\\/g, '/');
    outputPath = outputPath.replace(/\\/g, '/');

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-movflags', 'faststart',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-y'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg gifToVideo command:', commandLine);
        })
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(Math.round(progress.percent));
          }
        })
        .on('end', () => {
          resolve({ outputPath, success: true });
        })
        .on('error', (err) => {
          reject(new Error(`GIF to video failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }
}

module.exports = VideoConverter;
