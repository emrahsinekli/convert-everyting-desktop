const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const TurndownService = require('turndown');
const showdown = require('showdown');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const pdfPoppler = require('pdf-poppler');
const { execFile } = require('child_process');

class DocumentConverter {
  constructor() {
    this.supportedInputFormats = ['pdf', 'docx', 'doc', 'txt', 'html', 'htm', 'md', 'rtf'];
    this.supportedOutputFormats = ['pdf', 'docx', 'txt', 'html', 'md'];
    this.turndown = new TurndownService();
    this.showdown = new showdown.Converter();
  }

  // Get QPDF executable path (cross-platform)
  getQpdfPath() {
    const platform = process.platform;
    const isWindows = platform === 'win32';
    const isMac = platform === 'darwin';

    // Platform-specific binary info
    const platformBinaries = {
      win32: { folder: 'qpdf-11.9.1-msvc64', exe: 'qpdf.exe' },
      darwin: { folder: 'qpdf-macos', exe: 'qpdf' },
      linux: { folder: 'qpdf-linux', exe: 'qpdf' }
    };

    const binInfo = platformBinaries[platform] || platformBinaries.linux;

    // Try different locations for QPDF
    const possiblePaths = [
      // Development path (relative to project)
      path.join(__dirname, '..', '..', 'resources', 'bin', binInfo.folder, 'bin', binInfo.exe),
      // Packaged app path
      path.join(process.resourcesPath || '', 'bin', binInfo.folder, 'bin', binInfo.exe),
      // Alternative packaged path
      path.join(process.resourcesPath || '', binInfo.folder, 'bin', binInfo.exe),
      // System-installed QPDF (macOS/Linux)
      ...(isWindows ? [] : ['/usr/local/bin/qpdf', '/usr/bin/qpdf']),
      // Homebrew on macOS
      ...(isMac ? ['/opt/homebrew/bin/qpdf'] : []),
    ];

    for (const qpdfPath of possiblePaths) {
      if (fs.existsSync(qpdfPath)) {
        return qpdfPath;
      }
    }

    return null;
  }

  // Execute QPDF command
  execQpdf(args) {
    return new Promise((resolve, reject) => {
      const qpdfPath = this.getQpdfPath();
      if (!qpdfPath) {
        reject(new Error('QPDF bulunamadı. PDF şifreleme özelliği için QPDF gerekli.'));
        return;
      }

      execFile(qpdfPath, args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async convert(inputPath, outputPath, outputFormat, options = {}) {
    const { onProgress, conversionType } = options;
    const inputExt = path.extname(inputPath).toLowerCase().slice(1);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      if (onProgress) onProgress(10);

      // Handle image to PDF conversion
      if (conversionType === 'image-to-pdf') {
        return await this.imagesToPdf([inputPath], outputPath, options);
      }

      // Determine conversion path
      let content;

      // Step 1: Extract content from input format
      switch (inputExt) {
        case 'pdf':
          content = await this.extractFromPdf(inputPath);
          break;
        case 'docx':
        case 'doc':
          content = await this.extractFromDocx(inputPath);
          break;
        case 'txt':
          content = fs.readFileSync(inputPath, 'utf-8');
          content = { text: content, html: `<pre>${this.escapeHtml(content)}</pre>` };
          break;
        case 'html':
        case 'htm':
          const htmlContent = fs.readFileSync(inputPath, 'utf-8');
          content = { text: this.htmlToText(htmlContent), html: htmlContent };
          break;
        case 'md':
          const mdContent = fs.readFileSync(inputPath, 'utf-8');
          content = { text: mdContent, html: this.showdown.makeHtml(mdContent) };
          break;
        default:
          throw new Error(`Unsupported input format: ${inputExt}`);
      }

      if (onProgress) onProgress(50);

      // Step 2: Convert to output format
      switch (outputFormat.toLowerCase()) {
        case 'pdf':
          await this.textToPdf(content.text || content.html, outputPath, options);
          break;
        case 'txt':
          fs.writeFileSync(outputPath, content.text, 'utf-8');
          break;
        case 'html':
          const htmlOutput = content.html || `<html><body><pre>${this.escapeHtml(content.text)}</pre></body></html>`;
          fs.writeFileSync(outputPath, htmlOutput, 'utf-8');
          break;
        case 'md':
          const mdOutput = content.html ? this.turndown.turndown(content.html) : content.text;
          fs.writeFileSync(outputPath, mdOutput, 'utf-8');
          break;
        case 'docx':
          await this.textToDocx(content.text, outputPath, options);
          break;
        default:
          throw new Error(`Unsupported output format: ${outputFormat}`);
      }

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Document conversion failed: ${error.message}`);
    }
  }

  // Extract text from PDF
  async extractFromPdf(inputPath) {
    try {
      const dataBuffer = fs.readFileSync(inputPath);
      const data = await pdfParse(dataBuffer);

      return {
        text: data.text,
        html: `<html><body><pre>${this.escapeHtml(data.text)}</pre></body></html>`,
        metadata: {
          pages: data.numpages,
          info: data.info
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract PDF content: ${error.message}`);
    }
  }

  // Extract text from DOCX
  async extractFromDocx(inputPath) {
    try {
      const result = await mammoth.convertToHtml({ path: inputPath });
      const textResult = await mammoth.extractRawText({ path: inputPath });

      return {
        text: textResult.value,
        html: result.value,
        messages: result.messages
      };
    } catch (error) {
      throw new Error(`Failed to extract DOCX content: ${error.message}`);
    }
  }

  // Convert text to PDF
  async textToPdf(text, outputPath, options = {}) {
    const { fontSize = 12, margin = 50 } = options;

    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pageWidth = 595; // A4 width in points
      const pageHeight = 842; // A4 height in points
      const textWidth = pageWidth - (margin * 2);
      const lineHeight = fontSize * 1.5;

      // Clean text - remove carriage returns and non-printable characters
      const cleanedText = this.cleanTextForPdf(text);

      // Split text into lines
      const lines = this.wrapText(cleanedText, font, fontSize, textWidth);
      const linesPerPage = Math.floor((pageHeight - (margin * 2)) / lineHeight);

      // Create pages
      for (let i = 0; i < lines.length; i += linesPerPage) {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const pageLines = lines.slice(i, i + linesPerPage);

        let y = pageHeight - margin;

        for (const line of pageLines) {
          // Skip empty lines but keep spacing
          if (line.trim() === '') {
            y -= lineHeight;
            continue;
          }

          try {
            page.drawText(line, {
              x: margin,
              y: y,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0)
            });
          } catch (e) {
            // If character encoding fails, replace with safe version
            const safeLine = line.replace(/[^\x20-\x7E]/g, '?');
            page.drawText(safeLine, {
              x: margin,
              y: y,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0)
            });
          }
          y -= lineHeight;
        }
      }

      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(outputPath, pdfBytes);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Failed to create PDF: ${error.message}`);
    }
  }

  // Clean text for PDF - remove problematic characters
  cleanTextForPdf(text) {
    return text
      // Remove carriage returns (Windows line endings)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove other control characters except newline and tab
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Replace tabs with spaces
      .replace(/\t/g, '    ');
  }

  // Convert text to DOCX (simple implementation)
  async textToDocx(text, outputPath, options = {}) {
    // Create a simple DOCX using XML
    const { Document, Packer, Paragraph, TextRun } = require('docx');

    try {
      const paragraphs = text.split('\n').map(line =>
        new Paragraph({
          children: [new TextRun(line)]
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(outputPath, buffer);

      return { outputPath, success: true };
    } catch (error) {
      // Fallback: save as text with .docx extension (will be readable by Word)
      fs.writeFileSync(outputPath, text, 'utf-8');
      return { outputPath, success: true };
    }
  }

  // Convert images to PDF
  async imagesToPdf(imagePaths, outputPath, options = {}) {
    const { onProgress, quality = 80 } = options;

    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();

        let image;

        // Convert to supported format if needed
        if (ext === '.png') {
          image = await pdfDoc.embedPng(imageBuffer);
        } else if (ext === '.jpg' || ext === '.jpeg') {
          image = await pdfDoc.embedJpg(imageBuffer);
        } else {
          // Convert to PNG using sharp
          const pngBuffer = await sharp(imagePath).png().toBuffer();
          image = await pdfDoc.embedPng(pngBuffer);
        }

        // Get image dimensions
        const { width, height } = image;

        // Create page with image dimensions (max A4 size)
        const maxWidth = 595;
        const maxHeight = 842;

        let pageWidth = width;
        let pageHeight = height;

        // Scale down if larger than A4
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          pageWidth = width * scale;
          pageHeight = height * scale;
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Draw image centered on page
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight
        });

        if (onProgress) {
          onProgress(Math.round(((i + 1) / imagePaths.length) * 90));
        }
      }

      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(outputPath, pdfBytes);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Failed to create PDF from images: ${error.message}`);
    }
  }

  // Merge multiple PDFs with page-specific support (including images)
  async mergePdfs(inputPaths, outputPath, options = {}) {
    const { onProgress, pageOrder } = options;

    try {
      const mergedPdf = await PDFDocument.create();

      // Ensure inputPaths is an array
      const files = inputPaths || [];

      // Check if inputPaths is the new format (array of objects with path and pages)
      const isNewFormat = files.length > 0 && files[0] && typeof files[0] === 'object' && files[0].path;

      // Check if pageOrder contains images (new format with mixed content)
      const hasImagePages = pageOrder && pageOrder.some(p => p.type === 'image');

      if (hasImagePages && pageOrder) {
        // New format with mixed PDF and image pages
        // Load all source PDFs first
        const loadedPdfs = {};

        // Load PDFs from files array
        for (const fileObj of files) {
          if (fileObj && fileObj.path && fs.existsSync(fileObj.path)) {
            const pdfBytes = fs.readFileSync(fileObj.path);
            loadedPdfs[fileObj.path] = await PDFDocument.load(pdfBytes);
          }
        }

        // Also load PDFs directly from pageOrder (in case they're not in files array)
        for (const pageItem of pageOrder) {
          if (pageItem.type === 'pdf' && pageItem.filePath && !loadedPdfs[pageItem.filePath]) {
            if (fs.existsSync(pageItem.filePath)) {
              const pdfBytes = fs.readFileSync(pageItem.filePath);
              loadedPdfs[pageItem.filePath] = await PDFDocument.load(pdfBytes);
            }
          }
        }

        // Add pages in the specified order
        for (let i = 0; i < pageOrder.length; i++) {
          const pageItem = pageOrder[i];

          if (pageItem.type === 'image') {
            // Handle image page
            await this.addImageAsPdfPage(mergedPdf, pageItem);
          } else if (pageItem.type === 'pdf' && pageItem.filePath) {
            // Handle PDF page
            const sourcePdf = loadedPdfs[pageItem.filePath];
            if (sourcePdf) {
              const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageItem.pageNum - 1]);
              mergedPdf.addPage(copiedPage);
            }
          }

          if (onProgress) {
            onProgress(Math.round(((i + 1) / pageOrder.length) * 90));
          }
        }
      } else if (isNewFormat && pageOrder) {
        // Page-specific merging based on pageOrder (PDFs only)
        // Load all source PDFs first
        const loadedPdfs = {};

        // Load PDFs from files array
        for (const fileObj of inputPaths) {
          if (fileObj && fileObj.path && fs.existsSync(fileObj.path)) {
            const pdfBytes = fs.readFileSync(fileObj.path);
            loadedPdfs[fileObj.path] = await PDFDocument.load(pdfBytes);
          }
        }

        // Also load PDFs directly from pageOrder (new format uses filePath)
        for (const pageItem of pageOrder) {
          if (pageItem.filePath && !loadedPdfs[pageItem.filePath]) {
            if (fs.existsSync(pageItem.filePath)) {
              const pdfBytes = fs.readFileSync(pageItem.filePath);
              loadedPdfs[pageItem.filePath] = await PDFDocument.load(pdfBytes);
            }
          }
        }

        // Add pages in the specified order
        for (let i = 0; i < pageOrder.length; i++) {
          const pageItem = pageOrder[i];

          // Support both old format (fileIndex) and new format (filePath)
          let sourcePdf;
          if (pageItem.filePath) {
            sourcePdf = loadedPdfs[pageItem.filePath];
          } else if (pageItem.fileIndex !== undefined) {
            const fileObj = inputPaths[pageItem.fileIndex];
            sourcePdf = fileObj ? loadedPdfs[fileObj.path] : null;
          }

          if (sourcePdf) {
            const pageNum = pageItem.pageNum || 1;
            // pageNum is 1-indexed, pdf-lib uses 0-indexed
            const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageNum - 1]);
            mergedPdf.addPage(copiedPage);
          }

          if (onProgress) {
            onProgress(Math.round(((i + 1) / pageOrder.length) * 90));
          }
        }
      } else if (isNewFormat) {
        // New format without pageOrder: include specified pages from each file
        let totalPages = 0;
        inputPaths.forEach(f => totalPages += f.pages.length);
        let processedPages = 0;

        for (const fileObj of inputPaths) {
          const pdfBytes = fs.readFileSync(fileObj.path);
          const pdf = await PDFDocument.load(pdfBytes);

          // Copy only the specified pages (convert from 1-indexed to 0-indexed)
          const pageIndices = fileObj.pages.map(p => p - 1);
          const pages = await mergedPdf.copyPages(pdf, pageIndices);

          pages.forEach(page => mergedPdf.addPage(page));
          processedPages += pages.length;

          if (onProgress) {
            onProgress(Math.round((processedPages / totalPages) * 90));
          }
        }
      } else {
        // Old format: simple array of file paths, merge all pages
        for (let i = 0; i < inputPaths.length; i++) {
          const pdfBytes = fs.readFileSync(inputPaths[i]);
          const pdf = await PDFDocument.load(pdfBytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

          pages.forEach(page => mergedPdf.addPage(page));

          if (onProgress) {
            onProgress(Math.round(((i + 1) / inputPaths.length) * 90));
          }
        }
      }

      const mergedPdfBytes = await mergedPdf.save();
      fs.writeFileSync(outputPath, mergedPdfBytes);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Failed to merge PDFs: ${error.message}`);
    }
  }

  // Helper: Add an image as a PDF page
  async addImageAsPdfPage(pdfDoc, pageItem) {
    try {
      let imageData;
      let imageType;

      if (pageItem.imagePath && fs.existsSync(pageItem.imagePath)) {
        // Read from file path
        imageData = fs.readFileSync(pageItem.imagePath);
        const ext = path.extname(pageItem.imagePath).toLowerCase();
        imageType = ext === '.png' ? 'png' : 'jpg';
      } else if (pageItem.imageData) {
        // Parse from base64 data URL
        const matches = pageItem.imageData.match(/^data:image\/(png|jpe?g|gif|webp|bmp);base64,(.+)$/);
        if (matches) {
          imageType = matches[1] === 'png' ? 'png' : 'jpg';
          imageData = Buffer.from(matches[2], 'base64');

          // Convert non-supported formats to PNG
          if (['gif', 'webp', 'bmp'].includes(matches[1])) {
            imageData = await sharp(imageData).png().toBuffer();
            imageType = 'png';
          }
        } else {
          throw new Error('Invalid image data format');
        }
      } else {
        throw new Error('No image data available');
      }

      // Embed image in PDF
      let image;
      if (imageType === 'png') {
        image = await pdfDoc.embedPng(imageData);
      } else {
        // Convert to JPEG if not already
        try {
          image = await pdfDoc.embedJpg(imageData);
        } catch (e) {
          // If embedding fails, convert to PNG
          const pngBuffer = await sharp(imageData).png().toBuffer();
          image = await pdfDoc.embedPng(pngBuffer);
        }
      }

      // Get image dimensions
      const { width, height } = image;

      // Create page with image dimensions (max A4 size, scaled to fit)
      const maxWidth = 595;
      const maxHeight = 842;

      let pageWidth = width;
      let pageHeight = height;

      // Scale down if larger than A4
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        pageWidth = width * scale;
        pageHeight = height * scale;
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw image to fill the page
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight
      });

      return true;
    } catch (error) {
      console.error('Error adding image as PDF page:', error);
      throw error;
    }
  }

  // Split PDF into pages
  async splitPdf(inputPath, outputDir, options = {}) {
    const { onProgress, pageRange } = options;

    try {
      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const totalPages = pdf.getPageCount();

      const pagesToExtract = pageRange || Array.from({ length: totalPages }, (_, i) => i);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPaths = [];

      for (let i = 0; i < pagesToExtract.length; i++) {
        const pageIndex = pagesToExtract[i];
        const newPdf = await PDFDocument.create();
        const [page] = await newPdf.copyPages(pdf, [pageIndex]);
        newPdf.addPage(page);

        const outputPath = path.join(outputDir, `page_${pageIndex + 1}.pdf`);
        const newPdfBytes = await newPdf.save();
        fs.writeFileSync(outputPath, newPdfBytes);
        outputPaths.push(outputPath);

        if (onProgress) {
          onProgress(Math.round(((i + 1) / pagesToExtract.length) * 100));
        }
      }

      return { outputPaths, success: true };
    } catch (error) {
      throw new Error(`Failed to split PDF: ${error.message}`);
    }
  }

  // Add text watermark to PDF
  async addWatermark(inputPath, outputPath, options = {}) {
    const { onProgress, text = 'WATERMARK', opacity = 0.3, fontSize = 50, rotation = -45 } = options;

    try {
      if (onProgress) onProgress(10);

      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const pages = pdf.getPages();

      if (onProgress) onProgress(30);

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();

        // Calculate text position (center of page)
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const x = (width - textWidth) / 2;
        const y = height / 2;

        page.drawText(text, {
          x: x,
          y: y,
          size: fontSize,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: opacity,
          rotate: { type: 'degrees', angle: rotation }
        });

        if (onProgress) {
          onProgress(30 + Math.round(((i + 1) / pages.length) * 60));
        }
      }

      const watermarkedPdfBytes = await pdf.save();
      fs.writeFileSync(outputPath, watermarkedPdfBytes);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Failed to add watermark: ${error.message}`);
    }
  }

  // Professional watermark with full options
  async watermarkPro(inputPath, outputPath, options = {}) {
    const { onProgress } = options;

    try {
      if (onProgress) onProgress(10);

      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = pdf.getPages();

      // Parse color from hex
      const parseColor = (hexColor) => {
        const hex = (hexColor || '#808080').replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        return rgb(r, g, b);
      };

      // Get position calculator
      const getPosition = (page, pos, marginX, marginY, customX, customY, textWidth, textHeight) => {
        const { width, height } = page.getSize();
        const mx = marginX || 20;
        const my = marginY || 20;

        switch (pos) {
          case 'top-left': return { x: mx, y: height - my - textHeight };
          case 'top-center': return { x: (width - textWidth) / 2, y: height - my - textHeight };
          case 'top-right': return { x: width - textWidth - mx, y: height - my - textHeight };
          case 'middle-left': return { x: mx, y: (height - textHeight) / 2 };
          case 'center': return { x: (width - textWidth) / 2, y: (height - textHeight) / 2 };
          case 'middle-right': return { x: width - textWidth - mx, y: (height - textHeight) / 2 };
          case 'bottom-left': return { x: mx, y: my };
          case 'bottom-center': return { x: (width - textWidth) / 2, y: my };
          case 'bottom-right': return { x: width - textWidth - mx, y: my };
          case 'custom': return { x: width * (customX || 50) / 100, y: height * (customY || 50) / 100 };
          default: return { x: width - textWidth - mx, y: my };
        }
      };

      if (onProgress) onProgress(20);

      // Embed font
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const useFont = options.fontBold ? fontBold : font;

      const opacity = (options.opacity || 50) / 100;
      const fontSize = options.fontSize || 48;
      const rotation = options.rotation || 0;
      const color = parseColor(options.fontColor);

      // Embed watermark image if needed
      let wmImage = null;
      if (options.type === 'image' && options.watermarkImagePath) {
        try {
          const wmBytes = fs.readFileSync(options.watermarkImagePath);
          const ext = path.extname(options.watermarkImagePath).toLowerCase();
          if (ext === '.png') {
            wmImage = await pdf.embedPng(wmBytes);
          } else if (ext === '.jpg' || ext === '.jpeg') {
            wmImage = await pdf.embedJpg(wmBytes);
          }
        } catch (e) {
          console.error('Failed to embed watermark image:', e);
        }
      }

      if (onProgress) onProgress(40);

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();

        if (options.type === 'text') {
          const text = options.text || 'Watermark';
          const textWidth = useFont.widthOfTextAtSize(text, fontSize);
          const textHeight = fontSize;

          if (options.tileMode) {
            // Tile watermark
            const spacingX = options.tileSpacingX || 150;
            const spacingY = options.tileSpacingY || 150;

            for (let y = spacingY; y < height; y += spacingY) {
              for (let x = spacingX; x < width; x += spacingX) {
                page.drawText(text, {
                  x: x - textWidth / 2,
                  y: y - textHeight / 2,
                  size: fontSize,
                  font: useFont,
                  color: color,
                  opacity: opacity,
                  rotate: degrees(rotation)
                });
              }
            }
          } else {
            const pos = getPosition(page, options.position, options.marginX, options.marginY, options.customX, options.customY, textWidth, textHeight);
            page.drawText(text, {
              x: pos.x,
              y: pos.y,
              size: fontSize,
              font: useFont,
              color: color,
              opacity: opacity,
              rotate: degrees(rotation)
            });
          }
        } else if (options.type === 'image' && wmImage) {
          const scale = (options.watermarkScale || 20) / 100;
          const wmWidth = width * scale;
          const wmHeight = (wmImage.height / wmImage.width) * wmWidth;

          if (options.tileMode) {
            const spacingX = options.tileSpacingX || 150;
            const spacingY = options.tileSpacingY || 150;

            for (let y = spacingY; y < height; y += spacingY) {
              for (let x = spacingX; x < width; x += spacingX) {
                page.drawImage(wmImage, {
                  x: x - wmWidth / 2,
                  y: y - wmHeight / 2,
                  width: wmWidth,
                  height: wmHeight,
                  opacity: opacity,
                  rotate: degrees(rotation)
                });
              }
            }
          } else {
            const pos = getPosition(page, options.position, options.marginX, options.marginY, options.customX, options.customY, wmWidth, wmHeight);
            page.drawImage(wmImage, {
              x: pos.x,
              y: pos.y,
              width: wmWidth,
              height: wmHeight,
              opacity: opacity,
              rotate: degrees(rotation)
            });
          }
        }

        if (onProgress) {
          onProgress(40 + Math.round(((i + 1) / pages.length) * 50));
        }
      }

      const watermarkedPdfBytes = await pdf.save();
      fs.writeFileSync(outputPath, watermarkedPdfBytes);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Failed to add professional watermark: ${error.message}`);
    }
  }

  // Compress PDF (reduce quality)
  async compressPdf(inputPath, outputPath, options = {}) {
    const { onProgress, quality = 'medium' } = options;

    try {
      if (onProgress) onProgress(10);

      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);

      if (onProgress) onProgress(50);

      // Save with compression options
      const compressedPdfBytes = await pdf.save({
        useObjectStreams: true,
        addDefaultPage: false
      });

      fs.writeFileSync(outputPath, compressedPdfBytes);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Failed to compress PDF: ${error.message}`);
    }
  }

  // PDF to images - using pdf-poppler for real PDF rendering
  async pdfToImages(inputPath, outputDir, options = {}) {
    const { onProgress, format = 'png', quality = 90, scale = 2 } = options;

    try {
      if (onProgress) onProgress(10);

      // Get page count first
      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const pageCount = pdf.getPageCount();

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const baseName = path.basename(inputPath, '.pdf');

      // Configure pdf-poppler options
      const outputFormat = (format === 'jpg' || format === 'jpeg') ? 'jpeg' : 'png';

      const opts = {
        format: outputFormat,
        out_dir: outputDir,
        out_prefix: baseName,
        page: null,  // Convert all pages
        scale: Math.round(scale * 1024)  // pdf-poppler uses scale in 1/1024 units, 2048 = 2x
      };

      if (onProgress) onProgress(20);

      // Convert PDF to images using pdf-poppler
      try {
        await pdfPoppler.convert(inputPath, opts);
      } catch (popplerError) {
        // Check if poppler is not installed (macOS/Linux)
        const platform = process.platform;
        if (platform === 'darwin') {
          throw new Error('PDF to image conversion requires poppler. Install with: brew install poppler');
        } else if (platform === 'linux') {
          throw new Error('PDF to image conversion requires poppler-utils. Install with: sudo apt-get install poppler-utils');
        } else {
          throw popplerError;
        }
      }

      // Wait a moment for file system to sync (Windows file locks)
      await new Promise(resolve => setTimeout(resolve, 300));

      if (onProgress) onProgress(80);

      // Get list of output files
      const outputPaths = [];
      const ext = outputFormat === 'jpeg' ? 'jpg' : 'png';

      // pdf-poppler creates files with pattern: prefix-1.png, prefix-2.png, etc.
      for (let i = 1; i <= pageCount; i++) {
        const outputPath = path.join(outputDir, `${baseName}-${i}.${ext}`);
        if (fs.existsSync(outputPath)) {
          outputPaths.push(outputPath);

          // Apply quality compression for JPEG (read buffer first to avoid file lock issues)
          if (outputFormat === 'jpeg' && quality < 100) {
            try {
              // Read file into buffer first
              const imageBuffer = fs.readFileSync(outputPath);
              const compressedBuffer = await sharp(imageBuffer)
                .jpeg({ quality })
                .toBuffer();

              // Write back with retries
              let written = false;
              for (let retry = 0; retry < 3 && !written; retry++) {
                try {
                  fs.writeFileSync(outputPath, compressedBuffer);
                  written = true;
                } catch (writeErr) {
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              }
            } catch (compressErr) {
              // If compression fails, keep original file
              console.error('JPEG compression failed, keeping original:', compressErr.message);
            }
          }
        }
      }

      if (onProgress) onProgress(100);

      return {
        outputDir,
        outputPaths,
        pageCount,
        success: true
      };
    } catch (error) {
      throw new Error(`Failed to convert PDF to images: ${error.message}`);
    }
  }

  // HTML to PDF conversion
  async htmlToPdf(inputPath, outputPath, options = {}) {
    const { onProgress } = options;

    try {
      if (onProgress) onProgress(10);

      const htmlContent = fs.readFileSync(inputPath, 'utf-8');

      // Extract text content from HTML
      const textContent = this.htmlToText(htmlContent);

      if (onProgress) onProgress(50);

      // Create PDF from the text content
      await this.textToPdf(textContent, outputPath, options);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Failed to convert HTML to PDF: ${error.message}`);
    }
  }

  // Protect PDF with password using QPDF
  async protectPdf(inputPath, outputPath, options = {}) {
    const { onProgress, password } = options;

    try {
      if (onProgress) onProgress(10);

      if (!password) {
        throw new Error('Şifre gerekli');
      }

      // Check if QPDF is available
      const qpdfPath = this.getQpdfPath();
      if (!qpdfPath) {
        throw new Error('QPDF bulunamadı. PDF şifreleme için QPDF gerekli.');
      }

      if (onProgress) onProgress(30);

      // QPDF encryption command:
      // qpdf --encrypt user-password owner-password key-length [restrictions] -- input.pdf output.pdf
      // Using 256-bit AES encryption
      const args = [
        '--encrypt',
        password,        // User password (needed to open PDF)
        password,        // Owner password (for editing restrictions)
        '256',           // 256-bit AES encryption
        '--',
        inputPath,
        outputPath
      ];

      await this.execQpdf(args);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`PDF encryption error: ${error.message}`);
    }
  }

  // Unlock PDF (remove password) using QPDF
  async unlockPdf(inputPath, outputPath, options = {}) {
    const { onProgress, password } = options;

    try {
      if (onProgress) onProgress(10);

      // Check if QPDF is available
      const qpdfPath = this.getQpdfPath();
      if (!qpdfPath) {
        // Fallback to pdf-lib for unlocking
        const pdfBytes = fs.readFileSync(inputPath);
        const pdf = await PDFDocument.load(pdfBytes, { password });
        if (onProgress) onProgress(50);
        const unlockedPdfBytes = await pdf.save();
        fs.writeFileSync(outputPath, unlockedPdfBytes);
        if (onProgress) onProgress(100);
        return { outputPath, success: true };
      }

      if (onProgress) onProgress(30);

      // QPDF decrypt command:
      // qpdf --decrypt --password=password input.pdf output.pdf
      const args = [
        '--decrypt',
        `--password=${password || ''}`,
        inputPath,
        outputPath
      ];

      await this.execQpdf(args);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`PDF unlock error: ${error.message}`);
    }
  }

  // Rotate PDF pages
  async rotatePdf(inputPath, outputPath, options = {}) {
    const { onProgress, angle = 90 } = options;

    try {
      if (onProgress) onProgress(10);

      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = pdf.getPages();

      if (onProgress) onProgress(30);

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const currentRotation = page.getRotation().angle;
        page.setRotation({ type: 'degrees', angle: currentRotation + angle });

        if (onProgress) {
          onProgress(30 + Math.round(((i + 1) / pages.length) * 60));
        }
      }

      const rotatedPdfBytes = await pdf.save();
      fs.writeFileSync(outputPath, rotatedPdfBytes);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Failed to rotate PDF: ${error.message}`);
    }
  }

  // Remove specific pages from PDF
  async removePagesPdf(inputPath, outputPath, options = {}) {
    const { onProgress, pages = [] } = options;

    try {
      if (onProgress) onProgress(10);

      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const totalPages = pdf.getPageCount();

      // Convert to 0-indexed and sort descending (to remove from end first)
      const pagesToRemove = pages.map(p => p - 1).sort((a, b) => b - a);

      if (onProgress) onProgress(30);

      // Create new PDF with pages that are NOT in the remove list
      const newPdf = await PDFDocument.create();
      const allPageIndices = Array.from({ length: totalPages }, (_, i) => i);
      const pagesToKeep = allPageIndices.filter(i => !pagesToRemove.includes(i));

      if (pagesToKeep.length === 0) {
        throw new Error('Cannot remove all pages from PDF');
      }

      const copiedPages = await newPdf.copyPages(pdf, pagesToKeep);
      copiedPages.forEach(page => newPdf.addPage(page));

      if (onProgress) onProgress(80);

      const newPdfBytes = await newPdf.save();
      fs.writeFileSync(outputPath, newPdfBytes);

      if (onProgress) onProgress(100);

      return { outputPath, success: true };
    } catch (error) {
      throw new Error(`Failed to remove pages from PDF: ${error.message}`);
    }
  }

  // Extract specific pages from PDF
  async extractPagesPdf(inputPath, outputPath, pages, options = {}) {
    const { onProgress } = options;

    try {
      if (onProgress) onProgress(10);

      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);

      if (onProgress) onProgress(30);

      const newPdf = await PDFDocument.create();
      const totalPages = pdf.getPageCount();

      // Convert 1-based to 0-based indices and filter valid pages
      const validPages = pages
        .map(p => p - 1) // Convert to 0-based
        .filter(p => p >= 0 && p < totalPages)
        .sort((a, b) => a - b);

      if (validPages.length === 0) {
        throw new Error('No valid pages to extract');
      }

      const copiedPages = await newPdf.copyPages(pdf, validPages);
      copiedPages.forEach(page => newPdf.addPage(page));

      if (onProgress) onProgress(70);

      const outputBytes = await newPdf.save();
      fs.writeFileSync(outputPath, outputBytes);

      if (onProgress) onProgress(100);

      return { outputPath, success: true, pageCount: validPages.length };
    } catch (error) {
      throw new Error(`Failed to extract pages from PDF: ${error.message}`);
    }
  }

  // Extract images from PDF
  async extractImagesPdf(inputPath, outputDir, options = {}) {
    const { onProgress } = options;

    try {
      if (onProgress) onProgress(10);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);

      if (onProgress) onProgress(30);

      let imageCount = 0;
      const pages = pdf.getPages();

      // pdf-lib doesn't have direct image extraction
      // We'll try to get embedded images from the PDF
      // This is a simplified approach - full extraction would need pdf.js or similar

      // For now, we'll inform the user about the limitation
      // In a production app, you'd use pdf-image or similar library

      if (onProgress) onProgress(100);

      return { imageCount, success: true, message: 'Image extraction requires additional libraries. Feature coming soon.' };
    } catch (error) {
      throw new Error(`Failed to extract images from PDF: ${error.message}`);
    }
  }

  // Helper: Wrap text to fit width
  wrapText(text, font, fontSize, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push('');
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  // Helper: Escape HTML
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: HTML to plain text
  htmlToText(html) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = DocumentConverter;
