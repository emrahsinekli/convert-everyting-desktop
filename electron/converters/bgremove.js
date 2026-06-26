// Local, offline background removal using U^2-Net (u2netp, Apache-2.0) via
// onnxruntime-node. No cloud, no telemetry — runs entirely on-device.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SIZE = 320; // u2netp input size
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

class BackgroundRemover {
  constructor() {
    this.session = null;
    this.ort = null;
  }

  modelPath() {
    // Packaged: resources copied to Resources/resources/models; dev: ./resources/models
    const candidates = [
      path.join(process.resourcesPath || '', 'resources', 'models', 'u2netp.onnx'),
      path.join(process.resourcesPath || '', 'models', 'u2netp.onnx'),
      path.join(__dirname, '..', '..', 'resources', 'models', 'u2netp.onnx'),
    ];
    for (const p of candidates) { if (p && fs.existsSync(p)) return p; }
    return candidates[candidates.length - 1];
  }

  async init() {
    if (this.session) return;
    this.ort = require('onnxruntime-node');
    const mp = this.modelPath();
    if (!fs.existsSync(mp)) throw new Error('Background removal model not found: ' + mp);
    // CPU EP is the most reliable on Apple Silicon (CoreML can hang on some ops)
    this.session = await this.ort.InferenceSession.create(mp, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
  }

  // Returns a PNG buffer of the original image with the background removed (alpha).
  async removeToBuffer(inputPath, options = {}) {
    const { onProgress } = options;
    await this.init();
    if (onProgress) onProgress(10);

    // Preprocess: RGB resized to 320x320 (fill), normalized to CHW float32
    const rgb = await sharp(inputPath, { failOn: 'none' })
      .rotate()
      .removeAlpha()
      .resize(SIZE, SIZE, { fit: 'fill' })
      .raw()
      .toBuffer();
    if (onProgress) onProgress(30);

    const chw = new Float32Array(3 * SIZE * SIZE);
    const plane = SIZE * SIZE;
    for (let i = 0; i < plane; i++) {
      const r = rgb[i * 3] / 255, g = rgb[i * 3 + 1] / 255, b = rgb[i * 3 + 2] / 255;
      chw[i] = (r - MEAN[0]) / STD[0];
      chw[plane + i] = (g - MEAN[1]) / STD[1];
      chw[2 * plane + i] = (b - MEAN[2]) / STD[2];
    }

    const tensor = new this.ort.Tensor('float32', chw, [1, 3, SIZE, SIZE]);
    const feeds = {}; feeds[this.session.inputNames[0]] = tensor;
    if (onProgress) onProgress(45);
    const results = await this.session.run(feeds);
    const out = results[this.session.outputNames[0]];
    const data = out.data; // Float32Array length 320*320 (1x1x320x320)
    if (onProgress) onProgress(70);

    // Min-max normalize mask to 0..255
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < data.length; i++) { if (data[i] < mn) mn = data[i]; if (data[i] > mx) mx = data[i]; }
    const range = (mx - mn) || 1;
    const mask = Buffer.alloc(plane);
    for (let i = 0; i < plane; i++) mask[i] = Math.round(((data[i] - mn) / range) * 255);

    // Decode the original RGBA first — this is the single source of truth for
    // dimensions (after EXIF auto-orient), so the mask and pixels always align.
    const { data: rgba, info } = await sharp(inputPath, { failOn: 'none' })
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const OW = info.width, OH = info.height, channels = info.channels;

    // Upscale the 320 mask to the exact decoded dimensions, feather edges.
    // NOTE: resize/blur may promote the 1-channel mask to 3 channels, so we
    // read back its real channel count and index the luminance channel.
    const { data: maskFull, info: mi } = await sharp(mask, { raw: { width: SIZE, height: SIZE, channels: 1 } })
      .resize(OW, OH, { fit: 'fill' })
      .blur(0.6)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const mc = mi.channels;
    if (onProgress) onProgress(85);

    // Replace the alpha channel with the mask's luminance
    const px = OW * OH;
    for (let i = 0; i < px; i++) rgba[i * channels + (channels - 1)] = maskFull[i * mc];

    const png = await sharp(rgba, { raw: { width: OW, height: OH, channels } })
      .png()
      .toBuffer();
    if (onProgress) onProgress(100);
    return png;
  }

  async removeToFile(inputPath, outputPath, options = {}) {
    const png = await this.removeToBuffer(inputPath, options);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, png);
    return { outputPath, success: true };
  }
}

module.exports = BackgroundRemover;
