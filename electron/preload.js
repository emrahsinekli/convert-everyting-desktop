const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // License operations
  checkLicense: () => ipcRenderer.invoke('license:check'),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
  getLicenseInfo: () => ipcRenderer.invoke('license:getInfo'),
  removeLicense: () => ipcRenderer.invoke('license:remove'),

  // Free trial + external links
  getTrialStatus: () => ipcRenderer.invoke('trial:get'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Dialog operations
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // File operations
  getFileInfo: (filePath) => ipcRenderer.invoke('file:getInfo', filePath),
  getThumbnail: (filePath) => ipcRenderer.invoke('file:getThumbnail', filePath),
  readFileAsBuffer: (filePath) => ipcRenderer.invoke('file:readAsBuffer', filePath),

  // Conversion operations
  startConversion: (params) => ipcRenderer.invoke('convert:start', params),
  batchConvert: (params) => ipcRenderer.invoke('convert:batch', params),
  mergeImagesToPdf: (params) => ipcRenderer.invoke('convert:mergeImagesToPdf', params),

  // PDF operations
  mergePdfs: (params) => ipcRenderer.invoke('pdf:merge', params),
  splitPdf: (params) => ipcRenderer.invoke('pdf:split', params),
  addWatermark: (params) => ipcRenderer.invoke('pdf:watermark', params),
  watermarkPdf: (params) => ipcRenderer.invoke('pdf:watermarkPro', params),
  compressPdf: (params) => ipcRenderer.invoke('pdf:compress', params),
  protectPdf: (params) => ipcRenderer.invoke('pdf:protect', params),
  unlockPdf: (params) => ipcRenderer.invoke('pdf:unlock', params),
  rotatePdf: (params) => ipcRenderer.invoke('pdf:rotate', params),
  removePagesPdf: (params) => ipcRenderer.invoke('pdf:removePages', params),
  extractImagesPdf: (params) => ipcRenderer.invoke('pdf:extractImages', params),
  extractPagesPdf: (params) => ipcRenderer.invoke('pdf:extractPages', params),
  pdfToImages: (params) => ipcRenderer.invoke('pdf:toImages', params),
  imagesToPdf: (params) => ipcRenderer.invoke('pdf:fromImages', params),
  htmlToPdf: (params) => ipcRenderer.invoke('pdf:fromHtml', params),

  // Video tools
  compressVideo: (params) => ipcRenderer.invoke('video:compress', params),
  trimVideo: (params) => ipcRenderer.invoke('video:trim', params),
  cropVideo: (params) => ipcRenderer.invoke('video:crop', params),
  rotateVideo: (params) => ipcRenderer.invoke('video:rotate', params),
  flipVideo: (params) => ipcRenderer.invoke('video:flip', params),
  watermarkVideo: (params) => ipcRenderer.invoke('video:watermark', params),
  videoToGif: (params) => ipcRenderer.invoke('video:toGif', params),

  // Image tools
  applyImageEdit: (params) => ipcRenderer.invoke('image:applyEdit', params),
  getImagePreview: (params) => ipcRenderer.invoke('image:getPreview', params),
  resizeImage: (params) => ipcRenderer.invoke('image:resize', params),
  compressImage: (params) => ipcRenderer.invoke('image:compress', params),
  cropImage: (params) => ipcRenderer.invoke('image:crop', params),
  rotateImage: (params) => ipcRenderer.invoke('image:rotate', params),
  watermarkImage: (params) => ipcRenderer.invoke('image:watermark', params),
  convertIcon: (params) => ipcRenderer.invoke('image:convertIcon', params),

  // Audio tools
  compressAudio: (params) => ipcRenderer.invoke('audio:compress', params),
  trimAudio: (params) => ipcRenderer.invoke('audio:trim', params),
  mergeAudio: (params) => ipcRenderer.invoke('audio:merge', params),

  // GIF tools
  imagesToGif: (params) => ipcRenderer.invoke('gif:fromImages', params),
  compressGif: (params) => ipcRenderer.invoke('gif:compress', params),
  gifToVideo: (params) => ipcRenderer.invoke('gif:toVideo', params),

  // Archive tools
  createArchive: (params) => ipcRenderer.invoke('archive:create', params),
  extractArchive: (params) => ipcRenderer.invoke('archive:extract', params),

  // Ebook tools
  convertEbook: (params) => ipcRenderer.invoke('ebook:convert', params),

  // Text-to-Speech tools
  ttsGetVoices: () => ipcRenderer.invoke('tts:getVoices'),
  ttsConvert: (params) => ipcRenderer.invoke('tts:convert', params),
  ttsConvertFile: (params) => ipcRenderer.invoke('tts:convertFile', params),

  onProgress: (callback) => {
    ipcRenderer.on('convert:progress', (event, data) => callback(data));
  },
  onBatchProgress: (callback) => {
    ipcRenderer.on('convert:batchProgress', (event, data) => callback(data));
  },
  removeProgressListeners: () => {
    ipcRenderer.removeAllListeners('convert:progress');
    ipcRenderer.removeAllListeners('convert:batchProgress');
  },

  // Format operations
  getSupportedFormats: (inputFormat) => ipcRenderer.invoke('formats:getSupported', inputFormat),
  getAllFormats: () => ipcRenderer.invoke('formats:getAll'),

  // Dependency operations
  checkDependencies: () => ipcRenderer.invoke('deps:check'),
  installDependency: (depName) => ipcRenderer.invoke('deps:install', depName),
  onDependencyProgress: (callback) => {
    ipcRenderer.on('deps:progress', (event, data) => callback(data));
  },
  removeDependencyListeners: () => {
    ipcRenderer.removeAllListeners('deps:progress');
  },

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Shell operations
  openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),

  // Platform info
  platform: process.platform,
  arch: process.arch,
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',

  // System info (for license)
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  getMachineId: () => ipcRenderer.invoke('system:getMachineId'),

  // Save rendered PDF page image (from renderer)
  savePdfPageImage: (params) => ipcRenderer.invoke('pdf:savePageImage', params),

  // Request PDF to images conversion via renderer (cross-platform)
  onPdfToImagesRequest: (callback) => {
    ipcRenderer.on('pdf:renderRequest', (event, data) => callback(data));
  },
  sendPdfRenderResult: (result) => ipcRenderer.send('pdf:renderResult', result),

  // Auto-updater operations
  checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
  downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
  getAppVersion: () => ipcRenderer.invoke('updater:getVersion'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('updater:update-available', (event, data) => callback(data));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('updater:update-not-available', (event, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('updater:download-progress', (event, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('updater:update-downloaded', (event, data) => callback(data));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('updater:error', (event, data) => callback(data));
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('updater:update-available');
    ipcRenderer.removeAllListeners('updater:update-not-available');
    ipcRenderer.removeAllListeners('updater:download-progress');
    ipcRenderer.removeAllListeners('updater:update-downloaded');
    ipcRenderer.removeAllListeners('updater:error');
  }
});
