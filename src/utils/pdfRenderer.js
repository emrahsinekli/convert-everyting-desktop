// PDF to Image renderer using pdfjs-dist
// This runs in the renderer process and uses HTML5 Canvas for cross-platform support

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Use local worker file from public folder (copied from node_modules)
// This avoids CORS/network issues when loading worker from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

/**
 * Convert base64 string to Uint8Array for pdfjs-dist
 */
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Get path separator based on platform
 */
function getPathSeparator() {
  return window.electronAPI?.isWindows ? '\\' : '/';
}

/**
 * Convert PDF to images using pdfjs-dist
 * Works on all platforms (Windows, macOS, Linux) without external dependencies
 */
export async function convertPdfToImages(pdfPath, outputDir, options = {}) {
  const { format = 'png', quality = 90, scale = 2, onProgress } = options;

  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  try {
    // Read PDF file as buffer (returns { success, data: base64string })
    const response = await window.electronAPI.readFileAsBuffer(pdfPath);

    if (!response.success) {
      throw new Error('Failed to read PDF file');
    }

    // Convert base64 to Uint8Array for pdfjs-dist
    const pdfData = base64ToUint8Array(response.data);

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;

    if (onProgress) onProgress(10);

    const outputPaths = [];
    const baseName = pdfPath.split(/[\\/]/).pop().replace('.pdf', '');
    const ext = (format === 'jpg' || format === 'jpeg') ? 'jpg' : 'png';

    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Render each page
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);

      // Get page dimensions with scale
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Clear canvas with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render page to canvas
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      await page.render(renderContext).promise;

      // Convert canvas to data URL
      const mimeType = ext === 'jpg' ? 'image/jpeg' : 'image/png';
      const qualityValue = ext === 'jpg' ? quality / 100 : undefined;
      const imageData = canvas.toDataURL(mimeType, qualityValue);

      // Save image via IPC (use correct path separator for platform)
      const sep = getPathSeparator();
      const outputPath = `${outputDir}${sep}${baseName}-${i}.${ext}`;
      const saveResult = await window.electronAPI.savePdfPageImage({
        imageData,
        outputPath,
        format: ext
      });

      if (saveResult.success) {
        outputPaths.push(outputPath);
      } else {
        console.error(`Failed to save page ${i}:`, saveResult.error);
      }

      if (onProgress) {
        onProgress(10 + Math.round((i / pageCount) * 85));
      }
    }

    if (onProgress) onProgress(100);

    return {
      success: true,
      outputDir,
      outputPaths,
      pageCount
    };
  } catch (error) {
    console.error('PDF to images conversion error:', error);
    throw error;
  }
}

/**
 * Render a single PDF page to canvas
 */
export async function renderPdfPageToCanvas(pdfPath, pageNum, canvas, scale = 2) {
  const response = await window.electronAPI.readFileAsBuffer(pdfPath);

  if (!response.success) {
    throw new Error('Failed to read PDF file');
  }

  const pdfData = base64ToUint8Array(response.data);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;

  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport: viewport
  }).promise;

  return { width: viewport.width, height: viewport.height };
}
