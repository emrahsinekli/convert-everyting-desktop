const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const potrace = require('potrace');

class ImageConverter {
  constructor() {
    // Comprehensive input formats - Sharp can read all of these
    this.supportedInputFormats = [
      // Common formats
      'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif',
      // Advanced formats
      'heic', 'heif', 'avif', 'svg', 'ico',
      // RAW camera formats (requires libraw)
      'raw', 'cr2', 'nef', 'arw', 'dng', 'orf', 'rw2', 'pef', 'srw',
      // Other formats
      'jfif', 'jxl', 'psd', 'tga', 'eps'
    ];
    // Output formats - what we can reliably write
    // SVG added via potrace for raster-to-vector conversion
    this.supportedOutputFormats = [
      'png', 'jpg', 'jpeg', 'webp', 'gif', 'tiff', 'tif',
      'ico', 'avif', 'bmp', 'svg'
    ];
  }

  async getImageInfo(inputPath) {
    try {
      const metadata = await sharp(inputPath).metadata();
      const stats = fs.statSync(inputPath);

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        size: stats.size
      };
    } catch (error) {
      throw new Error(`Failed to get image info: ${error.message}`);
    }
  }

  async convert(inputPath, outputPath, outputFormat, options = {}) {
    const {
      onProgress,
      quality = 80,
      width,
      height,
      fit = 'inside',
      background = { r: 255, g: 255, b: 255, alpha: 1 }
    } = options;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      if (onProgress) onProgress(10);

      let pipeline = sharp(inputPath);

      // Apply resize if specified
      if (width || height) {
        pipeline = pipeline.resize(width, height, {
          fit: fit,
          background: background,
          withoutEnlargement: true
        });
      }

      if (onProgress) onProgress(30);

      // Convert to output format with appropriate options
      switch (outputFormat.toLowerCase()) {
        case 'jpg':
        case 'jpeg':
        case 'jfif':
          pipeline = pipeline.jpeg({ quality: quality, mozjpeg: true });
          break;
        case 'png':
          pipeline = pipeline.png({ quality: quality, compressionLevel: 9 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: quality, lossless: quality === 100 });
          break;
        case 'gif':
          pipeline = pipeline.gif();
          break;
        case 'tiff':
        case 'tif':
          pipeline = pipeline.tiff({ quality: quality, compression: 'lzw' });
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality: quality, effort: 4 });
          break;
        case 'heif':
        case 'heic':
          // HEIC/HEIF encoding requires libheif with HEVC encoder which is not available
          // on most systems due to licensing issues
          throw new Error('HEIC/HEIF formatına dönüştürme desteklenmiyor. Lütfen AVIF, WEBP veya JPG formatını kullanın.');
        case 'svg':
          // Raster to vector conversion using potrace
          await this.convertToSvg(inputPath, outputPath, options);
          if (onProgress) onProgress(100);
          return { outputPath, success: true };
        case 'jxl':
          // JPEG XL - experimental in Sharp
          pipeline = pipeline.jpeg({ quality: quality }); // Fallback to JPEG
          break;
        case 'tga':
          // TGA - convert to PNG as raw format
          pipeline = pipeline.raw();
          break;
        case 'bmp':
          // BMP - use raw output with custom header
          pipeline = pipeline.png(); // Fallback to PNG, rename handles extension
          break;
        case 'ico':
          // For ICO, resize to common icon sizes
          await this.createIco(inputPath, outputPath, options);
          if (onProgress) onProgress(100);
          return { outputPath, success: true };
        case 'icns':
          // For ICNS (macOS), create multi-size icon
          await this.createIcns(inputPath, outputPath, options);
          if (onProgress) onProgress(100);
          return { outputPath, success: true };
        default:
          // Try to let Sharp handle it automatically
          pipeline = pipeline.toFormat(outputFormat, { quality: quality });
      }

      if (onProgress) onProgress(60);

      // Save the output
      await pipeline.toFile(outputPath);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Image conversion failed: ${error.message}`);
    }
  }

  // Create ICO file (multi-size icon)
  async createIco(inputPath, outputPath, options = {}) {
    // Use provided sizes or default to common icon sizes
    const sizes = options.sizes && options.sizes.length > 0
      ? options.sizes.sort((a, b) => a - b)
      : [16, 32, 48, 64, 128, 256];
    const buffers = [];

    for (const size of sizes) {
      const buffer = await sharp(inputPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      buffers.push({ size, buffer });
    }

    // Simple ICO file creation
    const icoBuffer = this.createIcoBuffer(buffers);
    fs.writeFileSync(outputPath, icoBuffer);

    return { outputPath, success: true };
  }

  createIcoBuffer(images) {
    // ICO file header
    const headerSize = 6;
    const dirEntrySize = 16;
    const numImages = images.length;

    // Calculate total size
    let dataOffset = headerSize + (dirEntrySize * numImages);
    let totalSize = dataOffset;
    for (const img of images) {
      totalSize += img.buffer.length;
    }

    const buffer = Buffer.alloc(totalSize);

    // Write header
    buffer.writeUInt16LE(0, 0); // Reserved
    buffer.writeUInt16LE(1, 2); // Type: 1 = ICO
    buffer.writeUInt16LE(numImages, 4); // Number of images

    // Write directory entries and image data
    let currentOffset = dataOffset;
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const entryOffset = headerSize + (i * dirEntrySize);

      // Write directory entry
      buffer.writeUInt8(img.size < 256 ? img.size : 0, entryOffset); // Width
      buffer.writeUInt8(img.size < 256 ? img.size : 0, entryOffset + 1); // Height
      buffer.writeUInt8(0, entryOffset + 2); // Color palette
      buffer.writeUInt8(0, entryOffset + 3); // Reserved
      buffer.writeUInt16LE(1, entryOffset + 4); // Color planes
      buffer.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
      buffer.writeUInt32LE(img.buffer.length, entryOffset + 8); // Image size
      buffer.writeUInt32LE(currentOffset, entryOffset + 12); // Image offset

      // Write image data
      img.buffer.copy(buffer, currentOffset);
      currentOffset += img.buffer.length;
    }

    return buffer;
  }

  // Create ICNS file (macOS multi-size icon)
  async createIcns(inputPath, outputPath, options = {}) {
    // Use provided sizes or default to common macOS icon sizes
    const sizes = options.sizes && options.sizes.length > 0
      ? options.sizes.sort((a, b) => a - b)
      : [16, 32, 64, 128, 256, 512, 1024];

    // ICNS type mappings for different sizes
    const icnsTypes = {
      16: 'icp4',   // 16x16
      32: 'icp5',   // 32x32
      64: 'icp6',   // 64x64
      128: 'ic07',  // 128x128
      256: 'ic08',  // 256x256
      512: 'ic09',  // 512x512
      1024: 'ic10'  // 1024x1024
    };

    const images = [];

    for (const size of sizes) {
      if (icnsTypes[size]) {
        const buffer = await sharp(inputPath)
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        images.push({ size, type: icnsTypes[size], buffer });
      }
    }

    // Create ICNS file
    const icnsBuffer = this.createIcnsBuffer(images);
    fs.writeFileSync(outputPath, icnsBuffer);

    return { outputPath, success: true };
  }

  createIcnsBuffer(images) {
    // ICNS file format:
    // Header: 'icns' (4 bytes) + total file size (4 bytes)
    // For each image: type (4 bytes) + size including header (4 bytes) + PNG data

    // Calculate total size
    let totalSize = 8; // Header size
    for (const img of images) {
      totalSize += 8 + img.buffer.length; // 8 bytes for type+size header per image
    }

    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    // Write ICNS header
    buffer.write('icns', offset);
    offset += 4;
    buffer.writeUInt32BE(totalSize, offset);
    offset += 4;

    // Write each image
    for (const img of images) {
      // Write type (4 bytes)
      buffer.write(img.type, offset);
      offset += 4;
      // Write size (4 bytes) - includes the 8-byte header
      buffer.writeUInt32BE(8 + img.buffer.length, offset);
      offset += 4;
      // Write PNG data
      img.buffer.copy(buffer, offset);
      offset += img.buffer.length;
    }

    return buffer;
  }

  // Convert raster image to SVG using potrace
  async convertToSvg(inputPath, outputPath, options = {}) {
    const { onProgress, threshold = 128, color = '#000000', background = 'transparent' } = options;

    return new Promise(async (resolve, reject) => {
      try {
        if (onProgress) onProgress(20);

        // First convert to PNG for potrace (it works best with PNG)
        const tempPngPath = outputPath + '.temp.png';

        // Convert to grayscale PNG for better tracing
        await sharp(inputPath)
          .grayscale()
          .png()
          .toFile(tempPngPath);

        if (onProgress) onProgress(50);

        // Use potrace to convert to SVG
        potrace.trace(tempPngPath, {
          threshold: threshold,
          color: color,
          background: background === 'transparent' ? 'transparent' : background,
          optTolerance: 0.2,
          turdSize: 2,
          turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY
        }, (err, svg) => {
          // Clean up temp file
          try {
            if (fs.existsSync(tempPngPath)) {
              fs.unlinkSync(tempPngPath);
            }
          } catch (e) {
            console.log('Could not delete temp file:', e.message);
          }

          if (err) {
            reject(new Error(`SVG conversion failed: ${err.message}`));
            return;
          }

          // Write SVG file
          fs.writeFileSync(outputPath, svg);

          if (onProgress) onProgress(100);
          resolve({ outputPath, success: true });
        });
      } catch (error) {
        reject(new Error(`SVG conversion failed: ${error.message}`));
      }
    });
  }

  // Batch convert multiple images
  async batchConvert(inputPaths, outputDir, outputFormat, options = {}) {
    const { onProgress } = options;
    const results = [];

    for (let i = 0; i < inputPaths.length; i++) {
      const inputPath = inputPaths[i];
      const outputName = path.basename(inputPath, path.extname(inputPath)) + '.' + outputFormat;
      const outputPath = path.join(outputDir, outputName);

      try {
        const result = await this.convert(inputPath, outputPath, outputFormat, {
          ...options,
          onProgress: null
        });
        results.push({ inputPath, ...result });
      } catch (error) {
        results.push({ inputPath, success: false, error: error.message });
      }

      if (onProgress) {
        onProgress(Math.round(((i + 1) / inputPaths.length) * 100));
      }
    }

    return results;
  }

  // Resize image
  async resize(inputPath, outputPath, width, height, options = {}) {
    const { onProgress, fit = 'inside', background } = options;

    try {
      if (onProgress) onProgress(20);

      const outputFormat = path.extname(outputPath).slice(1).toLowerCase();

      await this.convert(inputPath, outputPath, outputFormat, {
        ...options,
        width,
        height,
        fit,
        background,
        onProgress: (p) => onProgress && onProgress(20 + (p * 0.8))
      });

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Image resize failed: ${error.message}`);
    }
  }

  // Compress image
  async compress(inputPath, outputPath, options = {}) {
    const { onProgress, targetSizeKB, quality = 80 } = options;

    try {
      if (onProgress) onProgress(10);

      const inputInfo = await this.getImageInfo(inputPath);
      const outputFormat = path.extname(outputPath).slice(1).toLowerCase() || inputInfo.format;

      if (targetSizeKB) {
        // Binary search for optimal quality
        let minQuality = 10;
        let maxQuality = 100;
        let bestQuality = quality;
        let attempts = 0;

        while (maxQuality - minQuality > 5 && attempts < 10) {
          const testQuality = Math.round((minQuality + maxQuality) / 2);
          const tempPath = outputPath + '.temp';

          await this.convert(inputPath, tempPath, outputFormat, { quality: testQuality });
          const stats = fs.statSync(tempPath);
          const sizeKB = stats.size / 1024;

          if (sizeKB > targetSizeKB) {
            maxQuality = testQuality;
          } else {
            minQuality = testQuality;
            bestQuality = testQuality;
          }

          fs.unlinkSync(tempPath);
          attempts++;

          if (onProgress) onProgress(10 + (attempts * 8));
        }

        await this.convert(inputPath, outputPath, outputFormat, { quality: bestQuality });
      } else {
        await this.convert(inputPath, outputPath, outputFormat, { quality });
      }

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Image compression failed: ${error.message}`);
    }
  }

  // Rotate image
  async rotate(inputPath, outputPath, angle, options = {}) {
    const { onProgress, background = { r: 255, g: 255, b: 255, alpha: 1 } } = options;

    try {
      if (onProgress) onProgress(20);

      await sharp(inputPath)
        .rotate(angle, { background })
        .toFile(outputPath);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Image rotation failed: ${error.message}`);
    }
  }

  // Crop image
  async crop(inputPath, outputPath, region, options = {}) {
    const { onProgress } = options;
    const { left, top, width, height } = region;

    try {
      if (onProgress) onProgress(20);

      await sharp(inputPath)
        .extract({ left, top, width, height })
        .toFile(outputPath);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Image crop failed: ${error.message}`);
    }
  }

  // Add watermark
  async addWatermark(inputPath, watermarkPath, outputPath, options = {}) {
    const { onProgress, position = 'southeast', opacity = 0.5 } = options;

    try {
      if (onProgress) onProgress(20);

      const inputInfo = await this.getImageInfo(inputPath);
      const watermarkInfo = await this.getImageInfo(watermarkPath);

      // Scale watermark to 20% of input image width
      const watermarkWidth = Math.round(inputInfo.width * 0.2);
      const watermarkHeight = Math.round((watermarkWidth / watermarkInfo.width) * watermarkInfo.height);

      const watermark = await sharp(watermarkPath)
        .resize(watermarkWidth, watermarkHeight)
        .ensureAlpha(opacity)
        .toBuffer();

      // Calculate position
      const gravity = position;

      if (onProgress) onProgress(50);

      await sharp(inputPath)
        .composite([{
          input: watermark,
          gravity: gravity
        }])
        .toFile(outputPath);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Watermark failed: ${error.message}`);
    }
  }

  // Professional watermark with full options
  async watermark(inputPath, outputPath, options = {}) {
    const { onProgress } = options;

    try {
      if (onProgress) onProgress(10);

      const inputImage = sharp(inputPath);
      const metadata = await inputImage.metadata();
      const imgWidth = metadata.width;
      const imgHeight = metadata.height;

      // Calculate position
      const getPosition = (pos, marginX, marginY, customX, customY, wmWidth, wmHeight) => {
        const mx = marginX || 20;
        const my = marginY || 20;
        switch (pos) {
          case 'top-left': return { left: mx, top: my };
          case 'top-center': return { left: Math.round((imgWidth - wmWidth) / 2), top: my };
          case 'top-right': return { left: imgWidth - wmWidth - mx, top: my };
          case 'middle-left': return { left: mx, top: Math.round((imgHeight - wmHeight) / 2) };
          case 'center': return { left: Math.round((imgWidth - wmWidth) / 2), top: Math.round((imgHeight - wmHeight) / 2) };
          case 'middle-right': return { left: imgWidth - wmWidth - mx, top: Math.round((imgHeight - wmHeight) / 2) };
          case 'bottom-left': return { left: mx, top: imgHeight - wmHeight - my };
          case 'bottom-center': return { left: Math.round((imgWidth - wmWidth) / 2), top: imgHeight - wmHeight - my };
          case 'bottom-right': return { left: imgWidth - wmWidth - mx, top: imgHeight - wmHeight - my };
          case 'custom': return { left: Math.round(imgWidth * (customX || 50) / 100), top: Math.round(imgHeight * (customY || 50) / 100) };
          default: return { left: imgWidth - wmWidth - mx, top: imgHeight - wmHeight - my };
        }
      };

      const composites = [];
      const opacity = (options.opacity || 50) / 100;

      if (options.type === 'text') {
        // Create text watermark using SVG
        const fontSize = options.fontSize || 48;
        const fontColor = options.fontColor || '#ffffff';
        const text = options.text || 'Watermark';
        const fontWeight = options.fontBold ? 'bold' : 'normal';
        const fontStyle = options.fontItalic ? 'italic' : 'normal';
        const fontFamily = options.fontFamily || 'Arial';

        // Estimate text dimensions
        const textWidth = text.length * fontSize * 0.6;
        const textHeight = fontSize * 1.5;

        let svgText = `
          <svg width="${textWidth}" height="${textHeight}">
            <style>
              .watermark {
                font-family: ${fontFamily}, sans-serif;
                font-size: ${fontSize}px;
                font-weight: ${fontWeight};
                font-style: ${fontStyle};
                fill: ${fontColor};
                opacity: ${opacity};
              }
            </style>`;

        if (options.textShadow) {
          svgText += `
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="${options.shadowColor || '#000000'}" flood-opacity="0.5"/>
              </filter>
            </defs>
            <text x="0" y="${fontSize}" class="watermark" filter="url(#shadow)">${text}</text>`;
        } else {
          svgText += `<text x="0" y="${fontSize}" class="watermark">${text}</text>`;
        }
        svgText += '</svg>';

        const svgBuffer = Buffer.from(svgText);

        if (options.tileMode) {
          // Tile watermark
          const spacingX = options.tileSpacingX || 100;
          const spacingY = options.tileSpacingY || 100;

          for (let y = spacingY; y < imgHeight; y += spacingY) {
            for (let x = spacingX; x < imgWidth; x += spacingX) {
              composites.push({
                input: svgBuffer,
                left: Math.round(x - textWidth / 2),
                top: Math.round(y - textHeight / 2)
              });
            }
          }
        } else {
          const pos = getPosition(options.position, options.marginX, options.marginY, options.customX, options.customY, textWidth, textHeight);
          composites.push({
            input: svgBuffer,
            left: Math.max(0, Math.round(pos.left)),
            top: Math.max(0, Math.round(pos.top))
          });
        }
      } else if (options.type === 'image' && options.watermarkImagePath) {
        // Image watermark
        const wmScale = (options.watermarkScale || 20) / 100;
        const wmWidth = Math.round(imgWidth * wmScale);

        let wmBuffer = await sharp(options.watermarkImagePath)
          .resize(wmWidth)
          .ensureAlpha()
          .modulate({ brightness: 1, saturation: 1 })
          .composite([{
            input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: 'dest-in'
          }])
          .toBuffer();

        const wmMetadata = await sharp(wmBuffer).metadata();
        const wmHeight = wmMetadata.height;

        if (options.tileMode) {
          const spacingX = options.tileSpacingX || 100;
          const spacingY = options.tileSpacingY || 100;

          for (let y = spacingY; y < imgHeight; y += spacingY) {
            for (let x = spacingX; x < imgWidth; x += spacingX) {
              composites.push({
                input: wmBuffer,
                left: Math.round(x - wmWidth / 2),
                top: Math.round(y - wmHeight / 2)
              });
            }
          }
        } else {
          const pos = getPosition(options.position, options.marginX, options.marginY, options.customX, options.customY, wmWidth, wmHeight);
          composites.push({
            input: wmBuffer,
            left: Math.max(0, Math.round(pos.left)),
            top: Math.max(0, Math.round(pos.top))
          });
        }
      }

      if (onProgress) onProgress(50);

      if (composites.length > 0) {
        await inputImage
          .composite(composites)
          .toFile(outputPath);
      } else {
        await inputImage.toFile(outputPath);
      }

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Image watermark failed: ${error.message}`);
    }
  }

  // ============ UNIFIED EDIT PIPELINE ============
  // Applies a full declarative "edit recipe" with sharp, in a fixed order so
  // the renderer's live preview and this export stay in sync.
  //
  // recipe = {
  //   rotate, flipH, flipV,                          // geometry
  //   crop: { left, top, width, height },            // in transformed-image px
  //   resize: { width, height, fit },
  //   brightness, contrast, saturation, hue,         // adjustments
  //   temperature, blur, sharpen, grayscale, invert, sepia,
  //   background,                                     // flatten color for opaque formats
  //   format, quality, stripMetadata, compositeOverlayPng, compositeMaskPng
  // }
  async applyEdit(inputPath, outputPath, recipe = {}, options = {}) {
    const { onProgress } = options;
    try {
      if (onProgress) onProgress(5);

      const bg = recipe.background || { r: 255, g: 255, b: 255, alpha: 1 };
      let img = sharp(inputPath, { failOn: 'none', animated: false });

      // 1) Rotation (90° steps and/or fine straighten combined into one angle)
      const angle = Number(recipe.rotate) || 0;
      if (angle % 360 !== 0) {
        img = img.rotate(angle, { background: bg });
      }

      // 2) Flip / flop
      if (recipe.flipV) img = img.flip();   // vertical (top-bottom)
      if (recipe.flipH) img = img.flop();   // horizontal (left-right)

      // We must materialize before extract if geometry changed, so crop coords
      // (which the UI computes in the transformed-image space) are valid.
      if ((angle % 360 !== 0 || recipe.flipV || recipe.flipH) && recipe.crop) {
        img = sharp(await img.toBuffer(), { failOn: 'none' });
      }

      // 3) Crop (coordinates already in the transformed image's pixel space)
      if (recipe.crop) {
        const meta = await img.metadata();
        let { left, top, width, height } = recipe.crop;
        left = Math.max(0, Math.round(left));
        top = Math.max(0, Math.round(top));
        width = Math.round(width);
        height = Math.round(height);
        // Clamp to bounds to avoid sharp "bad extract area" errors
        width = Math.min(width, (meta.width || width) - left);
        height = Math.min(height, (meta.height || height) - top);
        if (width > 0 && height > 0) {
          img = img.extract({ left, top, width, height });
        }
      }
      if (onProgress) onProgress(35);

      // 4) Resize
      if (recipe.resize && (recipe.resize.width || recipe.resize.height)) {
        img = img.resize({
          width: recipe.resize.width || null,
          height: recipe.resize.height || null,
          fit: recipe.resize.fit || 'inside',
          withoutEnlargement: recipe.resize.allowUpscale ? false : false,
          background: bg
        });
      }

      // 5) Adjustments (order chosen to mirror typical CSS-filter preview)
      const contrast = recipe.contrast == null ? 1 : recipe.contrast;
      if (contrast !== 1) {
        img = img.linear(contrast, 128 * (1 - contrast));
      }

      // Temperature: warm (>0) boosts red, cools blue; cool (<0) the reverse
      const temp = Number(recipe.temperature) || 0; // -100..100
      if (temp !== 0) {
        const t = temp / 100;
        img = img.linear([1 + 0.25 * t, 1, 1 - 0.25 * t], [0, 0, 0]);
      }

      const modulate = {};
      if (recipe.brightness != null && recipe.brightness !== 1) modulate.brightness = recipe.brightness;
      if (recipe.saturation != null && recipe.saturation !== 1) modulate.saturation = recipe.saturation;
      if (recipe.hue) modulate.hue = recipe.hue;
      if (Object.keys(modulate).length) img = img.modulate(modulate);

      if (recipe.sepia) {
        img = img.recomb([
          [0.393, 0.769, 0.189],
          [0.349, 0.686, 0.168],
          [0.272, 0.534, 0.131]
        ]);
      }
      if (recipe.grayscale) img = img.grayscale();
      if (recipe.invert) img = img.negate({ alpha: false });
      if (recipe.blur && recipe.blur > 0) img = img.blur(Math.max(0.3, recipe.blur));
      if (recipe.sharpen) img = img.sharpen();
      if (onProgress) onProgress(55);

      // 6) Composite overlays (annotations PNG / background-removal mask)
      if (recipe.compositeMaskPng) {
        // Apply an alpha mask (e.g. from background removal) as dest-in
        img = sharp(await img.ensureAlpha().toBuffer(), { failOn: 'none' })
          .composite([{ input: recipe.compositeMaskPng, blend: 'dest-in' }]);
      }
      if (recipe.compositeOverlayPng) {
        img = img.composite([{ input: recipe.compositeOverlayPng, left: 0, top: 0 }]);
      }
      if (onProgress) onProgress(70);

      // 6b) Frame: rounded corners, padding, border (Frame tool)
      if (recipe.rounded && recipe.rounded > 0) {
        img = sharp(await img.ensureAlpha().toBuffer(), { failOn: 'none' });
        const m = await img.metadata();
        const rr = Math.min(recipe.rounded, Math.floor(Math.min(m.width, m.height) / 2));
        const mask = Buffer.from(`<svg width="${m.width}" height="${m.height}"><rect x="0" y="0" width="${m.width}" height="${m.height}" rx="${rr}" ry="${rr}"/></svg>`);
        img = img.composite([{ input: mask, blend: 'dest-in' }]);
      }
      if ((recipe.padding && recipe.padding > 0) || (recipe.border && recipe.border > 0)) {
        img = sharp(await img.toBuffer(), { failOn: 'none' });
        const pad = Math.max(0, Math.round(recipe.padding || 0));
        if (pad > 0) {
          const padColor = recipe.paddingColor || { r: 255, g: 255, b: 255, alpha: 1 };
          img = sharp(await img.extend({ top: pad, bottom: pad, left: pad, right: pad, background: padColor }).toBuffer(), { failOn: 'none' });
        }
        const bw = Math.max(0, Math.round(recipe.border || 0));
        if (bw > 0) {
          const bColor = recipe.borderColor || { r: 20, g: 20, b: 20, alpha: 1 };
          img = sharp(await img.extend({ top: bw, bottom: bw, left: bw, right: bw, background: bColor }).toBuffer(), { failOn: 'none' });
        }
      }

      // 6c) Output scale (Retina @2x / @3x)
      if (recipe.scale && recipe.scale !== 1) {
        const m = await img.metadata();
        img = img.resize({ width: Math.round(m.width * recipe.scale), height: Math.round(m.height * recipe.scale), fit: 'fill', kernel: 'lanczos3' });
      }

      // 7) Output format + quality + metadata
      const fmt = (recipe.format || path.extname(outputPath).slice(1) || 'png').toLowerCase();
      const q = recipe.quality || 90;
      const opaque = ['jpeg', 'jpg'].includes(fmt);
      if (opaque) img = img.flatten({ background: bg });

      switch (fmt) {
        case 'jpg':
        case 'jpeg': img = img.jpeg({ quality: q, mozjpeg: true }); break;
        case 'png': img = img.png({ quality: q, compressionLevel: 9 }); break;
        case 'webp': img = img.webp({ quality: q }); break;
        case 'avif': img = img.avif({ quality: q }); break;
        case 'tiff':
        case 'tif': img = img.tiff({ quality: q }); break;
        case 'gif': img = img.gif(); break;
        case 'bmp': /* sharp has no bmp encoder; fall back to png */ img = img.png(); break;
        default: break;
      }

      if (recipe.stripMetadata === false) img = img.keepMetadata();

      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const info = await img.toFile(outputPath);
      if (onProgress) onProgress(100);
      return { outputPath, success: true, width: info.width, height: info.height, size: info.size };
    } catch (error) {
      throw new Error(`Image edit failed: ${error.message}`);
    }
  }
}

module.exports = ImageConverter;
