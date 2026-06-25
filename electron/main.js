const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

// Converters
const VideoConverter = require('./converters/video');
const AudioConverter = require('./converters/audio');
const ImageConverter = require('./converters/image');
const DocumentConverter = require('./converters/document');
const TranscriptionConverter = require('./converters/transcription');
const ArchiveConverter = require('./converters/archive');
const TextToSpeechConverter = require('./converters/tts');
const DependencyManager = require('./utils/dependencyManager');
const LicenseManager = require('./license');

const store = new Store();
let mainWindow;
let dependencyManager;
let licenseManager;

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Initialize converters
const converters = {
  video: new VideoConverter(),
  audio: new AudioConverter(),
  image: new ImageConverter(),
  document: new DocumentConverter(),
  transcription: new TranscriptionConverter(),
  archive: new ArchiveConverter(),
  tts: new TextToSpeechConverter()
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin' ? false : true,
    backgroundColor: '#1a1a2e',
    show: false
  });

  // Load the app
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../build/index.html')}`;
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.ELECTRON_START_URL) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Register custom protocol for local files
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
    callback({ path: filePath });
  });

  // Initialize dependency manager
  dependencyManager = new DependencyManager();

  // Initialize License Manager (Polar-backed)
  licenseManager = new LicenseManager();

  createWindow();

  // Setup auto-updater events
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============ IPC HANDLERS ============

// ============ LICENSE HANDLERS ============

// Check license status (local + online verification)
ipcMain.handle('license:check', async () => {
  const localResult = licenseManager.loadLicense();
  if (!localResult.valid) {
    return localResult;
  }
  // Periodically verify online against Polar
  try {
    const onlineResult = await licenseManager.verifyLicenseOnline(localResult.key, localResult.activationId);
    if (!onlineResult.valid && !onlineResult.offline) {
      // License revoked, deactivated or moved - remove local
      licenseManager.removeLicense();
      return { valid: false, error: onlineResult.error };
    }
  } catch (e) {
    // Offline - trust local license
  }
  return localResult;
});

// Activate license (via Polar License Keys API)
ipcMain.handle('license:activate', async (event, key) => {
  return licenseManager.activateLicenseOnline(key);
});

// Get license info
ipcMain.handle('license:getInfo', async () => {
  return licenseManager.getLicenseInfo();
});

// Remove license (deactivate seat on Polar, then delete local)
ipcMain.handle('license:remove', async () => {
  await licenseManager.deactivateLicenseOnline();
  return licenseManager.removeLicense();
});

// ============ FREE TRIAL HANDLERS ============

const TRIAL_DAYS = 3;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

// Trial status. The trial clock starts on first launch and is stored in
// electron-store (userData). Returns how many days are left and whether it
// has expired. A valid Polar license always supersedes the trial.
ipcMain.handle('trial:get', () => {
  let start = store.get('trialStartedAt');
  if (!start) {
    start = Date.now();
    store.set('trialStartedAt', start);
  }
  const elapsed = Date.now() - start;
  const remaining = Math.max(0, TRIAL_MS - elapsed);
  return {
    startedAt: start,
    totalDays: TRIAL_DAYS,
    daysLeft: Math.ceil(remaining / (24 * 60 * 60 * 1000)),
    msLeft: remaining,
    expired: elapsed >= TRIAL_MS
  };
});

// Open an external URL in the user's default browser (e.g. Polar checkout)
ipcMain.handle('shell:openExternal', async (event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Invalid URL' };
});

// ============ SYSTEM INFO HANDLERS ============
const os = require('os');
const crypto = require('crypto');

// Get system info
ipcMain.handle('system:getInfo', async () => {
  const platform = process.platform;
  let platformName = 'Unknown';

  if (platform === 'win32') platformName = 'Windows';
  else if (platform === 'darwin') platformName = 'macOS';
  else if (platform === 'linux') platformName = 'Linux';

  return {
    platform: platformName,
    osVersion: os.release(),
    arch: process.arch,
    hostname: os.hostname(),
    username: os.userInfo().username,
    screenResolution: 'N/A', // Renderer'dan alınacak
    language: app.getLocale(),
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB'
  };
});

// Get unique machine ID
ipcMain.handle('system:getMachineId', async () => {
  const machineInfo = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || ''}-${os.totalmem()}`;
  const hash = crypto.createHash('sha256').update(machineInfo).digest('hex');
  return hash.substring(0, 16).toUpperCase();
});

// ============ FILE DIALOG HANDLERS ============

// File dialog handlers
ipcMain.handle('dialog:openFile', async (event, options) => {
  const defaultFilters = [
    { name: 'All Files', extensions: ['*'] },
    { name: 'Video', extensions: ['mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv'] },
    { name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'] },
    { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'] },
    { name: 'Document', extensions: ['pdf', 'docx', 'doc', 'txt', 'html', 'md'] }
  ];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: options?.properties || ['openFile', 'multiSelections'],
    filters: options?.filters || defaultFilters,
    defaultPath: options?.defaultPath
  });
  return result;
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options?.defaultPath,
    filters: options?.filters || [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result;
});

// Get file info
// Read file as base64 for renderer process
ipcMain.handle('file:readAsBuffer', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { success: true, data: data.toString('base64') };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:getInfo', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase().slice(1);

    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      extension: ext,
      type: getFileType(ext),
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    throw new Error(`Failed to get file info: ${error.message}`);
  }
});

// Merge images to single PDF
ipcMain.handle('convert:mergeImagesToPdf', async (event, { files, outputPath }) => {
  try {
    const result = await converters.document.imagesToPdf(files, outputPath, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Merge images to PDF error:', error);
    return { success: false, error: error.message };
  }
});

// Merge multiple PDFs
ipcMain.handle('pdf:merge', async (event, { files, outputPath, pageOrder }) => {
  try {
    const result = await converters.document.mergePdfs(files, outputPath, {
      pageOrder,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('PDF merge error:', error);
    return { success: false, error: error.message };
  }
});

// Split PDF into pages
ipcMain.handle('pdf:split', async (event, { inputPath, outputDir, pageRange }) => {
  try {
    const result = await converters.document.splitPdf(inputPath, outputDir, {
      pageRange,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPaths: result.outputPaths };
  } catch (error) {
    console.error('PDF split error:', error);
    return { success: false, error: error.message };
  }
});

// Add watermark to PDF
ipcMain.handle('pdf:watermark', async (event, { inputPath, outputPath, options }) => {
  try {
    const result = await converters.document.addWatermark(inputPath, outputPath, {
      ...options,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('PDF watermark error:', error);
    return { success: false, error: error.message };
  }
});

// Professional PDF Watermark
ipcMain.handle('pdf:watermarkPro', async (event, params) => {
  try {
    const result = await converters.document.watermarkPro(params.inputPath, params.outputPath, {
      type: params.type,
      text: params.text,
      fontFamily: params.fontFamily,
      fontSize: params.fontSize,
      fontColor: params.fontColor,
      fontBold: params.fontBold,
      fontItalic: params.fontItalic,
      textShadow: params.textShadow,
      shadowColor: params.shadowColor,
      watermarkImagePath: params.watermarkImagePath,
      watermarkScale: params.watermarkScale,
      opacity: params.opacity,
      position: params.position,
      customX: params.customX,
      customY: params.customY,
      rotation: params.rotation,
      marginX: params.marginX,
      marginY: params.marginY,
      tileMode: params.tileMode,
      tileSpacingX: params.tileSpacingX,
      tileSpacingY: params.tileSpacingY,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('PDF watermark pro error:', error);
    return { success: false, error: error.message };
  }
});

// Compress PDF
ipcMain.handle('pdf:compress', async (event, { inputPath, outputPath, quality }) => {
  try {
    const result = await converters.document.compressPdf(inputPath, outputPath, {
      quality,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('PDF compress error:', error);
    return { success: false, error: error.message };
  }
});

// Protect PDF with password
ipcMain.handle('pdf:protect', async (event, { inputPath, outputPath, password }) => {
  try {
    const result = await converters.document.protectPdf(inputPath, outputPath, {
      password,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('PDF protect error:', error);
    return { success: false, error: error.message };
  }
});

// Unlock PDF
ipcMain.handle('pdf:unlock', async (event, { inputPath, outputPath, password }) => {
  try {
    const result = await converters.document.unlockPdf(inputPath, outputPath, {
      password,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('PDF unlock error:', error);
    return { success: false, error: error.message };
  }
});

// Rotate PDF pages
ipcMain.handle('pdf:rotate', async (event, { inputPath, outputPath, angle }) => {
  try {
    const result = await converters.document.rotatePdf(inputPath, outputPath, {
      angle,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('PDF rotate error:', error);
    return { success: false, error: error.message };
  }
});

// Remove pages from PDF
ipcMain.handle('pdf:removePages', async (event, { inputPath, outputPath, pages }) => {
  try {
    const result = await converters.document.removePagesPdf(inputPath, outputPath, {
      pages,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('PDF remove pages error:', error);
    return { success: false, error: error.message };
  }
});

// Extract images from PDF
ipcMain.handle('pdf:extractImages', async (event, { inputPath, outputDir }) => {
  try {
    const result = await converters.document.extractImagesPdf(inputPath, outputDir, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, imageCount: result.imageCount };
  } catch (error) {
    console.error('PDF extract images error:', error);
    return { success: false, error: error.message };
  }
});

// Extract pages from PDF
ipcMain.handle('pdf:extractPages', async (event, { inputPath, outputPath, pages }) => {
  try {
    const result = await converters.document.extractPagesPdf(inputPath, outputPath, pages, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('PDF extract pages error:', error);
    return { success: false, error: error.message };
  }
});

// PDF to Images (JPG/PNG)
ipcMain.handle('pdf:toImages', async (event, { inputPath, outputDir, format, quality }) => {
  try {
    const result = await converters.document.pdfToImages(inputPath, outputDir, {
      format,
      quality,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputDir: result.outputDir, pageCount: result.pageCount };
  } catch (error) {
    console.error('PDF to images error:', error);
    return { success: false, error: error.message };
  }
});

// Save PDF page image rendered by frontend (cross-platform fallback)
ipcMain.handle('pdf:savePageImage', async (event, { imageData, outputPath, format }) => {
  try {
    // imageData is base64 data URL
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Use sharp to save with proper format and quality
    const sharp = require('sharp');

    if (format === 'jpg' || format === 'jpeg') {
      await sharp(buffer).jpeg({ quality: 90 }).toFile(outputPath);
    } else {
      await sharp(buffer).png().toFile(outputPath);
    }

    return { success: true, outputPath };
  } catch (error) {
    console.error('Save PDF page image error:', error);
    return { success: false, error: error.message };
  }
});

// Images to PDF
ipcMain.handle('pdf:fromImages', async (event, { files, outputPath }) => {
  try {
    const result = await converters.document.imagesToPdf(files, outputPath, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Images to PDF error:', error);
    return { success: false, error: error.message };
  }
});

// HTML to PDF
ipcMain.handle('pdf:fromHtml', async (event, { inputPath, outputPath, html }) => {
  try {
    let htmlFilePath = inputPath;

    // If raw HTML content is provided instead of a file path, write to temp file
    if (html && !inputPath) {
      const tempDir = app.getPath('temp');
      htmlFilePath = path.join(tempDir, `convert-temp-${Date.now()}.html`);
      const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
h1,h2,h3,h4,h5,h6 { margin-top: 1em; }
pre { background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; }
code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 16px; color: #555; }
hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
</style></head><body>${html}</body></html>`;
      fs.writeFileSync(htmlFilePath, fullHtml, 'utf-8');
    }

    const result = await converters.document.htmlToPdf(htmlFilePath, outputPath, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });

    // Clean up temp file if we created one
    if (html && !inputPath) {
      try { fs.unlinkSync(htmlFilePath); } catch (e) {}
    }

    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('HTML to PDF error:', error);
    return { success: false, error: error.message };
  }
});

// ============ VIDEO TOOLS ============

// Compress Video
ipcMain.handle('video:compress', async (event, { inputPath, outputPath, targetSizeMB, quality }) => {
  try {
    const result = await converters.video.compress(inputPath, outputPath, targetSizeMB, {
      quality,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Video compress error:', error);
    return { success: false, error: error.message };
  }
});

// Trim Video
ipcMain.handle('video:trim', async (event, { inputPath, outputPath, startTime, endTime }) => {
  try {
    const result = await converters.video.trim(inputPath, outputPath, startTime, endTime, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Video trim error:', error);
    return { success: false, error: error.message };
  }
});

// Crop Video
ipcMain.handle('video:crop', async (event, { inputPath, outputPath, width, height, x, y }) => {
  try {
    const result = await converters.video.crop(inputPath, outputPath, { width, height, x: x || 0, y: y || 0 }, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Video crop error:', error);
    return { success: false, error: error.message };
  }
});

// Rotate Video
ipcMain.handle('video:rotate', async (event, { inputPath, outputPath, angle }) => {
  try {
    const result = await converters.video.rotate(inputPath, outputPath, angle, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Video rotate error:', error);
    return { success: false, error: error.message };
  }
});

// Flip Video
ipcMain.handle('video:flip', async (event, { inputPath, outputPath, horizontal, vertical }) => {
  try {
    const result = await converters.video.flip(inputPath, outputPath, { horizontal, vertical }, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Video flip error:', error);
    return { success: false, error: error.message };
  }
});

// Video Watermark
ipcMain.handle('video:watermark', async (event, params) => {
  try {
    const result = await converters.video.watermark(params.inputPath, params.outputPath, {
      type: params.type,
      text: params.text,
      fontFamily: params.fontFamily,
      fontSize: params.fontSize,
      fontColor: params.fontColor,
      fontBold: params.fontBold,
      fontItalic: params.fontItalic,
      textShadow: params.textShadow,
      shadowColor: params.shadowColor,
      watermarkImagePath: params.watermarkImagePath,
      watermarkScale: params.watermarkScale,
      opacity: params.opacity,
      position: params.position,
      customX: params.customX,
      customY: params.customY,
      rotation: params.rotation,
      marginX: params.marginX,
      marginY: params.marginY,
      tileMode: params.tileMode,
      tileSpacingX: params.tileSpacingX,
      tileSpacingY: params.tileSpacingY,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Video watermark error:', error);
    return { success: false, error: error.message };
  }
});

// Video to GIF
ipcMain.handle('video:toGif', async (event, { inputPath, outputPath, startTime, duration, fps, width }) => {
  try {
    const result = await converters.video.toGif(inputPath, outputPath, {
      startTime: startTime || 0,
      duration: duration || 5,
      fps: fps || 10,
      width: width || 480,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Video to GIF error:', error);
    return { success: false, error: error.message };
  }
});

// ============ IMAGE TOOLS ============

// Resize Image
ipcMain.handle('image:resize', async (event, { inputPath, outputPath, width, height, fit }) => {
  try {
    const result = await converters.image.resize(inputPath, outputPath, width, height, {
      fit: fit || 'inside',
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Image resize error:', error);
    return { success: false, error: error.message };
  }
});

// Compress Image
ipcMain.handle('image:compress', async (event, { inputPath, outputPath, quality, targetSizeKB }) => {
  try {
    const result = await converters.image.compress(inputPath, outputPath, {
      quality,
      targetSizeKB,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Image compress error:', error);
    return { success: false, error: error.message };
  }
});

// Crop Image
ipcMain.handle('image:crop', async (event, { inputPath, outputPath, left, top, width, height }) => {
  try {
    const result = await converters.image.crop(inputPath, outputPath, { left, top, width, height }, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Image crop error:', error);
    return { success: false, error: error.message };
  }
});

// Rotate Image
ipcMain.handle('image:rotate', async (event, { inputPath, outputPath, angle }) => {
  try {
    const result = await converters.image.rotate(inputPath, outputPath, angle, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Image rotate error:', error);
    return { success: false, error: error.message };
  }
});

// Unified image edit pipeline (live editor export)
ipcMain.handle('image:applyEdit', async (event, { inputPath, outputPath, recipe }) => {
  try {
    const result = await converters.image.applyEdit(inputPath, outputPath, recipe || {}, {
      onProgress: (progress) => {
        if (mainWindow) mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, ...result };
  } catch (error) {
    console.error('Image applyEdit error:', error);
    return { success: false, error: error.message };
  }
});

// Read image as a data URL for the renderer preview (handles HEIC/TIFF/etc via sharp)
ipcMain.handle('image:getPreview', async (event, { inputPath, maxDim = 2400 }) => {
  try {
    const sh = require('sharp');
    const meta = await sh(inputPath, { failOn: 'none' }).metadata();
    const buf = await sh(inputPath, { failOn: 'none' })
      .rotate() // auto-orient via EXIF
      .resize({ width: Math.min(maxDim, meta.width || maxDim), height: Math.min(maxDim, meta.height || maxDim), fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return {
      success: true,
      dataUrl: `data:image/png;base64,${buf.toString('base64')}`,
      naturalWidth: meta.width,
      naturalHeight: meta.height,
      format: meta.format
    };
  } catch (error) {
    console.error('Image getPreview error:', error);
    return { success: false, error: error.message };
  }
});

// Image Watermark
ipcMain.handle('image:watermark', async (event, params) => {
  try {
    const result = await converters.image.watermark(params.inputPath, params.outputPath, {
      type: params.type,
      text: params.text,
      fontFamily: params.fontFamily,
      fontSize: params.fontSize,
      fontColor: params.fontColor,
      fontBold: params.fontBold,
      fontItalic: params.fontItalic,
      textShadow: params.textShadow,
      shadowColor: params.shadowColor,
      watermarkImagePath: params.watermarkImagePath,
      watermarkScale: params.watermarkScale,
      opacity: params.opacity,
      position: params.position,
      customX: params.customX,
      customY: params.customY,
      rotation: params.rotation,
      marginX: params.marginX,
      marginY: params.marginY,
      tileMode: params.tileMode,
      tileSpacingX: params.tileSpacingX,
      tileSpacingY: params.tileSpacingY,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Image watermark error:', error);
    return { success: false, error: error.message };
  }
});

// Icon Converter - creates separate files for each size
ipcMain.handle('image:convertIcon', async (event, { inputPath, outputDir, outputFormat, sizes }) => {
  try {
    const sharp = require('sharp');
    const createdFiles = [];

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get base name from input file
    const baseName = path.basename(inputPath, path.extname(inputPath));

    for (const size of sizes) {
      const fileName = `${baseName}-${size}.${outputFormat}`;
      const outputPath = path.join(outputDir, fileName);

      // Resize image to the specified size
      const resizedBuffer = await sharp(inputPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      if (outputFormat === 'ico') {
        // Create single-size ICO file
        const icoBuffer = createSingleSizeIco(resizedBuffer, size);
        fs.writeFileSync(outputPath, icoBuffer);
      } else if (outputFormat === 'icns') {
        // Create single-size ICNS file
        const icnsBuffer = createSingleSizeIcns(resizedBuffer, size);
        fs.writeFileSync(outputPath, icnsBuffer);
      } else {
        // Just save as PNG
        fs.writeFileSync(outputPath, resizedBuffer);
      }

      createdFiles.push(fileName);
    }

    return { success: true, fileCount: createdFiles.length, files: createdFiles };
  } catch (error) {
    console.error('Icon convert error:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to create single-size ICO
function createSingleSizeIco(pngBuffer, size) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffset = headerSize + dirEntrySize;
  const totalSize = dataOffset + pngBuffer.length;

  const buffer = Buffer.alloc(totalSize);

  // Write header
  buffer.writeUInt16LE(0, 0); // Reserved
  buffer.writeUInt16LE(1, 2); // Type: 1 = ICO
  buffer.writeUInt16LE(1, 4); // Number of images

  // Write directory entry
  buffer.writeUInt8(size < 256 ? size : 0, headerSize); // Width
  buffer.writeUInt8(size < 256 ? size : 0, headerSize + 1); // Height
  buffer.writeUInt8(0, headerSize + 2); // Color palette
  buffer.writeUInt8(0, headerSize + 3); // Reserved
  buffer.writeUInt16LE(1, headerSize + 4); // Color planes
  buffer.writeUInt16LE(32, headerSize + 6); // Bits per pixel
  buffer.writeUInt32LE(pngBuffer.length, headerSize + 8); // Image size
  buffer.writeUInt32LE(dataOffset, headerSize + 12); // Image offset

  // Write image data
  pngBuffer.copy(buffer, dataOffset);

  return buffer;
}

// Helper function to create single-size ICNS
function createSingleSizeIcns(pngBuffer, size) {
  const icnsTypes = {
    16: 'icp4',
    32: 'icp5',
    64: 'icp6',
    128: 'ic07',
    256: 'ic08',
    512: 'ic09',
    1024: 'ic10'
  };

  const type = icnsTypes[size] || 'ic08';
  const totalSize = 8 + 8 + pngBuffer.length; // header + image header + data

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // Write ICNS header
  buffer.write('icns', offset);
  offset += 4;
  buffer.writeUInt32BE(totalSize, offset);
  offset += 4;

  // Write image type and size
  buffer.write(type, offset);
  offset += 4;
  buffer.writeUInt32BE(8 + pngBuffer.length, offset);
  offset += 4;

  // Write PNG data
  pngBuffer.copy(buffer, offset);

  return buffer;
}

// ============ GIF TOOLS ============

// Images to GIF
ipcMain.handle('gif:fromImages', async (event, { files, outputPath, fps, width, delay }) => {
  try {
    const result = await converters.video.imagesToGif(files, outputPath, {
      fps: fps || 10,
      width: width || 480,
      delay: delay || 100,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Images to GIF error:', error);
    return { success: false, error: error.message };
  }
});

// Compress GIF
ipcMain.handle('gif:compress', async (event, { inputPath, outputPath, colors, quality }) => {
  try {
    const result = await converters.video.compressGif(inputPath, outputPath, {
      colors: colors || 256,
      quality: quality || 80,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('GIF compress error:', error);
    return { success: false, error: error.message };
  }
});

// GIF to Video
ipcMain.handle('gif:toVideo', async (event, { inputPath, outputPath }) => {
  try {
    const result = await converters.video.gifToVideo(inputPath, outputPath, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('GIF to video error:', error);
    return { success: false, error: error.message };
  }
});

// ============ AUDIO TOOLS ============

// Compress Audio
ipcMain.handle('audio:compress', async (event, { inputPath, outputPath, bitrate }) => {
  try {
    const result = await converters.audio.compress(inputPath, outputPath, {
      bitrate: bitrate || 128,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Audio compress error:', error);
    return { success: false, error: error.message };
  }
});

// Trim Audio
ipcMain.handle('audio:trim', async (event, { inputPath, outputPath, startTime, endTime }) => {
  try {
    const result = await converters.audio.trim(inputPath, outputPath, {
      startTime,
      endTime,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Audio trim error:', error);
    return { success: false, error: error.message };
  }
});

// Merge Audio
ipcMain.handle('audio:merge', async (event, { files, outputPath }) => {
  try {
    const result = await converters.audio.merge(files, outputPath, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Audio merge error:', error);
    return { success: false, error: error.message };
  }
});

// ============ ARCHIVE TOOLS ============

// Create archive
ipcMain.handle('archive:create', async (event, { files, outputPath, format, level }) => {
  try {
    const result = await converters.archive.createArchive(files, outputPath, {
      format: format || 'zip',
      level: level || 'normal',
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Archive create error:', error);
    return { success: false, error: error.message };
  }
});

// Extract archive
ipcMain.handle('archive:extract', async (event, { inputPath, outputDir }) => {
  try {
    const result = await converters.archive.extractArchive(inputPath, outputDir, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputDir: result.outputDir };
  } catch (error) {
    console.error('Archive extract error:', error);
    return { success: false, error: error.message };
  }
});

// ============ EBOOK TOOLS ============

// Convert ebook
ipcMain.handle('ebook:convert', async (event, { inputPath, outputPath, outputFormat }) => {
  try {
    // For ebook conversion, we use the document converter for basic formats
    // Full EPUB/MOBI conversion would require calibre or similar
    const result = await converters.document.convert(inputPath, outputPath, outputFormat, {
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('Ebook convert error:', error);
    return { success: false, error: error.message };
  }
});

// Get image thumbnail as base64
ipcMain.handle('file:getThumbnail', async (event, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];

    if (!imageExts.includes(ext)) {
      return null;
    }

    const data = fs.readFileSync(filePath);
    const base64 = data.toString('base64');
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Thumbnail error:', error);
    return null;
  }
});

// Core conversion function (used by both single and batch conversion)
async function performConversion(inputPath, outputPath, outputFormat, options, sendProgress = true) {
  const inputExt = path.extname(inputPath).toLowerCase().slice(1);
  const inputType = getFileType(inputExt);
  const outputType = getFileType(outputFormat);

  // Determine which converter to use
  let converter;
  let conversionType;

  if (inputType === 'video' || outputType === 'video') {
    if (outputFormat === 'txt' || outputFormat === 'srt' || outputFormat === 'vtt') {
      converter = converters.transcription;
      conversionType = 'transcription';
    } else if (outputType === 'audio') {
      converter = converters.audio;
      conversionType = 'extract-audio';
    } else {
      converter = converters.video;
      conversionType = 'video';
    }
  } else if (inputType === 'audio') {
    if (outputFormat === 'txt' || outputFormat === 'srt' || outputFormat === 'vtt') {
      converter = converters.transcription;
      conversionType = 'transcription';
    } else {
      converter = converters.audio;
      conversionType = 'audio';
    }
  } else if (inputType === 'image') {
    if (outputFormat === 'pdf') {
      converter = converters.document;
      conversionType = 'image-to-pdf';
    } else {
      converter = converters.image;
      conversionType = 'image';
    }
  } else if (inputType === 'document') {
    // Check if converting PDF to image format
    const imageFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'];
    if (inputExt === 'pdf' && imageFormats.includes(outputFormat.toLowerCase())) {
      // Use pdfToImages for PDF to image conversion
      const outputDir = path.dirname(outputPath);
      const result = await converters.document.pdfToImages(inputPath, outputDir, {
        format: outputFormat,
        quality: options?.quality || 90,
        onProgress: sendProgress ? (progress) => {
          mainWindow.webContents.send('convert:progress', { progress });
        } : null
      });
      // Return the first output file or the directory
      const firstOutput = result.outputPaths && result.outputPaths.length > 0 ? result.outputPaths[0] : outputDir;
      return { success: true, outputPath: firstOutput, outputDir: result.outputDir, outputPaths: result.outputPaths };
    }
    converter = converters.document;
    conversionType = 'document';
  } else {
    throw new Error(`Unsupported conversion: ${inputExt} to ${outputFormat}`);
  }

  // Send progress updates
  const progressCallback = sendProgress ? (progress) => {
    mainWindow.webContents.send('convert:progress', { progress });
  } : null;

  // Start conversion
  const result = await converter.convert(inputPath, outputPath, outputFormat, {
    ...options,
    onProgress: progressCallback,
    conversionType
  });

  return { success: true, outputPath: result.outputPath };
}

// Conversion handlers
ipcMain.handle('convert:start', async (event, params) => {
  try {
    const { inputPath, outputPath, outputFormat, type, sizes, ...restOptions } = params;

    // Build options object including type-specific parameters
    const options = {
      ...restOptions,
      ...(sizes && { sizes })
    };

    return await performConversion(inputPath, outputPath, outputFormat, options, true);
  } catch (error) {
    console.error('Conversion error:', error);
    return { success: false, error: error.message };
  }
});

// Batch conversion
ipcMain.handle('convert:batch', async (event, { files, outputDir, outputFormat, options }) => {
  console.log('============================================');
  console.log('BATCH CONVERSION STARTED');
  console.log('Files:', files.length);
  console.log('Output dir:', outputDir);
  console.log('Format:', outputFormat);
  console.log('============================================');

  const results = [];
  const usedNames = new Set(); // Track used output names to avoid collisions

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let baseName = path.basename(file, path.extname(file))
      .replace(/[()[\]{}]/g, '')
      .replace(/\s+/g, '_');

    // Ensure unique output name - add index if name already used
    let outputName = baseName + '_converted.' + outputFormat;
    let counter = 1;
    while (usedNames.has(outputName.toLowerCase())) {
      outputName = `${baseName}_converted_${counter}.${outputFormat}`;
      counter++;
    }
    usedNames.add(outputName.toLowerCase());

    const outputPath = path.join(outputDir, outputName);

    console.log('--------------------------------------------');
    console.log(`BATCH [${i + 1}/${files.length}]`);
    console.log('Input:', file);
    console.log('Output:', outputPath);

    mainWindow.webContents.send('convert:batchProgress', {
      current: i + 1,
      total: files.length,
      file: path.basename(file)
    });

    try {
      const result = await performConversion(file, outputPath, outputFormat, options, false);

      // Verify file was created
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`BATCH [${i + 1}/${files.length}] SUCCESS - Size: ${stats.size} bytes`);
        results.push({ file, ...result });
      } else {
        console.error(`BATCH [${i + 1}/${files.length}] FAILED - Output file not found`);
        results.push({ file, success: false, error: 'Output file was not created' });
      }

      // Small delay between conversions to let file system sync
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`BATCH [${i + 1}/${files.length}] ERROR:`, error.message);
      results.push({ file, success: false, error: error.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log('============================================');
  console.log(`BATCH CONVERSION COMPLETE: ${successCount}/${results.length} succeeded`);
  console.log('============================================');

  return results;
});

// Get supported formats
ipcMain.handle('formats:getSupported', async (event, inputFormat) => {
  const inputType = getFileType(inputFormat);
  return getSupportedOutputFormats(inputType, inputFormat);
});

// Get all supported formats - all formats with cross-platform compatible codecs
ipcMain.handle('formats:getAll', async () => {
  return {
    video: [
      // All supported video output formats
      'mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv', 'gif',
      'm4v', '3gp', 'mpeg', 'mpg', 'ts', 'ogv'
    ],
    audio: [
      // All supported audio output formats
      'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma',
      'opus', 'aiff', 'ac3', 'amr', 'caf', 'mp2', 'au'
    ],
    image: [
      // Common formats
      'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif',
      // Extended formats (SVG via potrace for raster-to-vector)
      'ico', 'avif', 'svg'
    ],
    document: [
      'pdf', 'docx', 'doc', 'txt', 'html', 'htm', 'md',
      'rtf', 'odt', 'epub', 'mobi', 'azw3'
    ],
    transcription: ['txt', 'srt', 'vtt']
  };
});

// Dependency management
ipcMain.handle('deps:check', async () => {
  return await dependencyManager.checkDependencies();
});

ipcMain.handle('deps:install', async (event, depName) => {
  const progressCallback = (progress, status) => {
    mainWindow.webContents.send('deps:progress', { progress, status });
  };
  return await dependencyManager.installDependency(depName, progressCallback);
});

// Settings
ipcMain.handle('settings:get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('settings:set', (event, key, value) => {
  store.set(key, value);
  return true;
});

// Shell operations
ipcMain.handle('shell:openPath', async (event, filePath) => {
  return await shell.openPath(filePath);
});

ipcMain.handle('shell:showItemInFolder', (event, filePath) => {
  shell.showItemInFolder(filePath);
  return true;
});

// ============ AUTO-UPDATER ============

function setupAutoUpdater() {
  // Update available
  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    }
  });

  // No update available
  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:update-not-available', {
        version: info.version
      });
    }
  });

  // Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:download-progress', {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total
      });
    }
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:update-downloaded', {
        version: info.version
      });
    }
  });

  // Error
  autoUpdater.on('error', (error) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:error', {
        message: error.message
      });
    }
  });
}

// Check for updates
ipcMain.handle('updater:checkForUpdates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Download update
ipcMain.handle('updater:downloadUpdate', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Install update (quit and install)
ipcMain.handle('updater:quitAndInstall', () => {
  autoUpdater.quitAndInstall(false, true);
});

// Get current app version
ipcMain.handle('updater:getVersion', () => {
  return app.getVersion();
});

// ============ HELPER FUNCTIONS ============

function getFileType(extension) {
  const ext = extension.toLowerCase();

  const videoFormats = [
    'mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv', 'm4v', '3gp',
    'm2ts', 'mts', 'mpeg', 'mpg', 'vob', 'ts', 'mxf', 'mod', 'qt',
    'rm', 'rmvb', 'asf', '3g2', 'mpv', 'wtv', 'divx', 'xvid',
    'm1v', 'f4p', 'f4v', 'ogv', 'dv', 'swf', '3gpp', 'dvr-ms'
  ];
  const audioFormats = [
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus',
    'aiff', 'aif', 'amr', 'alac', 'ape', 'au', 'caf', 'm4b',
    'm4r', 'm4p', 'mid', 'midi', 'mka', 'mp2', 'oga', 'ra',
    'raw', 'rmi', 'snd', 'tta', 'voc', 'wave', 'wv', '3ga',
    'ac3', 'dts', 'aifc', 'mp1'
  ];
  const imageFormats = [
    'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif',
    'ico', 'svg', 'heic', 'heif', 'avif', 'raw', 'cr2', 'nef',
    'arw', 'dng', 'psd', 'jfif', 'jxl'
  ];
  const documentFormats = [
    'pdf', 'docx', 'doc', 'txt', 'html', 'htm', 'md', 'rtf',
    'odt', 'xlsx', 'xls', 'pptx', 'ppt', 'epub', 'mobi', 'azw3'
  ];

  if (videoFormats.includes(ext)) return 'video';
  if (audioFormats.includes(ext)) return 'audio';
  if (imageFormats.includes(ext)) return 'image';
  if (documentFormats.includes(ext)) return 'document';

  return 'unknown';
}

function getSupportedOutputFormats(inputType, inputFormat) {
  // All supported formats with cross-platform compatible codecs
  const formats = {
    video: {
      video: [
        'mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv', 'gif',
        'm4v', '3gp', 'mpeg', 'mpg', 'ts', 'ogv'
      ],
      audio: [
        'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma',
        'opus', 'aiff', 'ac3', 'amr', 'caf', 'mp2', 'au'
      ],
      transcription: ['txt', 'srt', 'vtt']
    },
    audio: {
      audio: [
        'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma',
        'opus', 'aiff', 'ac3', 'amr', 'caf', 'mp2', 'au'
      ],
      transcription: ['txt', 'srt', 'vtt']
    },
    image: {
      image: [
        'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif',
        'ico', 'avif', 'svg'
      ],
      document: ['pdf']
    },
    document: {
      document: ['pdf', 'docx', 'txt', 'html', 'md', 'rtf'],
      image: ['jpg', 'png'] // PDF to image
    }
  };

  return formats[inputType] || {};
}

// ==================== TTS (Text-to-Speech) ====================

ipcMain.handle('tts:getVoices', async () => {
  try {
    return {
      success: true,
      voices: converters.tts.getVoices(),
      voicesByLanguage: converters.tts.getVoicesByLanguage()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tts:convert', async (event, { text, outputPath, voice, rate, pitch, volume }) => {
  try {
    const result = await converters.tts.convert(text, outputPath, {
      voice,
      rate,
      pitch,
      volume,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    console.error('TTS error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tts:convertFile', async (event, { inputPath, outputPath, voice, rate, pitch, volume }) => {
  try {
    const result = await converters.tts.convertFile(inputPath, outputPath, {
      voice,
      rate,
      pitch,
      volume,
      onProgress: (progress) => {
        mainWindow.webContents.send('convert:progress', { progress });
      }
    });
    return { success: true, outputPath: result.outputPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
