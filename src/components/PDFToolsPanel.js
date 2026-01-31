import React, { useState, useCallback, useEffect } from 'react';
import WatermarkTool from './WatermarkTool';
import PDFMergeTool from './PDFMergeTool';
import PDFRemovePagesTool from './PDFRemovePagesTool';
import PDFExtractPagesTool from './PDFExtractPagesTool';

function PDFToolsPanel({ initialTool = 'merge' }) {
  const [activeToolTab, setActiveToolTab] = useState(initialTool);

  useEffect(() => {
    setActiveToolTab(initialTool);
  }, [initialTool]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Watermark options
  const [watermarkText, setWatermarkText] = useState('WATERMARK');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkFontSize, setWatermarkFontSize] = useState(50);

  // Compress options
  const [compressQuality, setCompressQuality] = useState('medium');

  // Protect options
  const [protectPassword, setProtectPassword] = useState('');

  // Remove pages options
  const [pagesToRemove, setPagesToRemove] = useState('');

  // Rotate pages options
  const [rotateAngle, setRotateAngle] = useState(90);

  // Extract pages options
  const [pagesToExtract, setPagesToExtract] = useState('');

  // Image files for "Images to PDF"
  const [imageFiles, setImageFiles] = useState([]);

  // HTML file for "HTML to PDF"
  const [htmlFile, setHtmlFile] = useState(null);

  // PDF to Images options
  const [imageFormat, setImageFormat] = useState('png');
  const [imageQuality, setImageQuality] = useState(90);

  const tools = [
    { id: 'merge', label: 'Merge', icon: '📑' },
    { id: 'split', label: 'Split', icon: '✂️' },
    { id: 'compress', label: 'Compress', icon: '📦' },
    { id: 'watermark', label: 'Watermark', icon: '💧' },
    { id: 'protect', label: 'Protect', icon: '🔒' },
    { id: 'unlock', label: 'Unlock', icon: '🔓' },
    { id: 'rotate', label: 'Rotate', icon: '🔄' },
    { id: 'removePages', label: 'Remove', icon: '🗑️' },
    { id: 'extractPages', label: 'Extract', icon: '📤' },
    { id: 'extractImages', label: 'Images', icon: '🖼️' },
    { id: 'pdfToImages', label: 'To JPG', icon: '🖼️' },
    { id: 'imagesToPdf', label: 'From Images', icon: '📷' },
    { id: 'htmlToPdf', label: 'From HTML', icon: '🌐' }
  ];

  // Handle file selection
  const handleSelectFiles = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const files = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const info = await window.electronAPI.getFileInfo(filePath);
          return info;
        })
      );
      // Filter only PDF files
      const pdfFiles = files.filter(f => f.extension === 'pdf');
      setSelectedFiles(pdfFiles);
    }
  }, []);

  // Handle merge
  const handleMerge = useCallback(async () => {
    if (selectedFiles.length < 2 || !window.electronAPI) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const firstFilePath = selectedFiles[0].path;
      const outputDir = firstFilePath.substring(0, Math.max(firstFilePath.lastIndexOf('\\'), firstFilePath.lastIndexOf('/')));
      const outputPath = `${outputDir}/merged_${Date.now()}.pdf`;

      const result = await window.electronAPI.mergePdfs({
        files: selectedFiles.map(f => f.path),
        outputPath
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('PDF files merged successfully!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Merge error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles]);

  // Handle split
  const handleSplit = useCallback(async () => {
    if (selectedFiles.length !== 1 || !window.electronAPI) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFiles[0].path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const splitDir = `${outputDir}/split_${Date.now()}`;

      const result = await window.electronAPI.splitPdf({
        inputPath,
        outputDir: splitDir
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(splitDir);
        alert(`PDF split into ${result.outputPaths.length} pages!`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Split error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles]);

  // Handle watermark (professional version with WatermarkTool)
  const handleWatermark = useCallback(async (watermarkConfig) => {
    if (!window.electronAPI) return;

    let inputPath = selectedFiles[0]?.path;
    let fileName = selectedFiles[0]?.name;

    if (watermarkConfig.localFile && watermarkConfig.localFile.path) {
      inputPath = watermarkConfig.localFile.path;
      fileName = watermarkConfig.localFile.name;
    }

    if (!inputPath) {
      alert('Please select a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = fileName.replace('.pdf', '');
      const outputPath = `${outputDir}/${baseName}_watermarked.pdf`;

      const result = await window.electronAPI.watermarkPdf({
        inputPath,
        outputPath,
        ...watermarkConfig
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath || outputPath);
        alert('Watermark added!');
      } else {
        throw new Error(result?.error || 'Operation failed');
      }
    } catch (error) {
      alert('Watermark error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles]);

  // Handle compress
  const handleCompress = useCallback(async () => {
    if (selectedFiles.length !== 1 || !window.electronAPI) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFiles[0].path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = selectedFiles[0].name.replace('.pdf', '');
      const outputPath = `${outputDir}/${baseName}_compressed.pdf`;

      const result = await window.electronAPI.compressPdf({
        inputPath,
        outputPath,
        quality: compressQuality
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('PDF compressed successfully!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Compression error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles, compressQuality]);

  // Handle protect PDF
  const handleProtect = useCallback(async () => {
    if (selectedFiles.length !== 1 || !window.electronAPI || !protectPassword) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFiles[0].path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = selectedFiles[0].name.replace('.pdf', '');
      const outputPath = `${outputDir}/${baseName}_protected.pdf`;

      const result = await window.electronAPI.protectPdf({
        inputPath,
        outputPath,
        password: protectPassword
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('PDF protected with password!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Protection error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles, protectPassword]);

  // Handle unlock PDF
  const handleUnlock = useCallback(async () => {
    if (selectedFiles.length !== 1 || !window.electronAPI || !protectPassword) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFiles[0].path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = selectedFiles[0].name.replace('.pdf', '');
      const outputPath = `${outputDir}/${baseName}_unlocked.pdf`;

      const result = await window.electronAPI.unlockPdf({
        inputPath,
        outputPath,
        password: protectPassword
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('PDF unlocked!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Unlock error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles, protectPassword]);

  // Handle rotate PDF
  const handleRotate = useCallback(async () => {
    if (selectedFiles.length !== 1 || !window.electronAPI) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFiles[0].path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = selectedFiles[0].name.replace('.pdf', '');
      const outputPath = `${outputDir}/${baseName}_rotated.pdf`;

      const result = await window.electronAPI.rotatePdf({
        inputPath,
        outputPath,
        angle: rotateAngle
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('PDF rotated!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Rotation error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles, rotateAngle]);

  // Handle remove pages
  const handleRemovePages = useCallback(async () => {
    if (selectedFiles.length !== 1 || !window.electronAPI || !pagesToRemove) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFiles[0].path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = selectedFiles[0].name.replace('.pdf', '');
      const outputPath = `${outputDir}/${baseName}_pages_removed.pdf`;

      // Parse pages to remove (e.g., "1,3,5-7" -> [1,3,5,6,7])
      const pages = [];
      pagesToRemove.split(',').forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(n => parseInt(n.trim()));
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        } else {
          pages.push(parseInt(part));
        }
      });

      const result = await window.electronAPI.removePagesPdf({
        inputPath,
        outputPath,
        pages: pages.filter(p => !isNaN(p))
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Pages removed!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Page removal error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles, pagesToRemove]);

  // Handle extract pages
  const handleExtractPages = useCallback(async () => {
    if (selectedFiles.length !== 1 || !window.electronAPI || !pagesToExtract) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFiles[0].path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = selectedFiles[0].name.replace('.pdf', '');
      const outputPath = `${outputDir}/${baseName}_extracted.pdf`;

      // Parse pages to extract (e.g., "1,3,5-7" -> [1,3,5,6,7])
      const pages = [];
      pagesToExtract.split(',').forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(n => parseInt(n.trim()));
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        } else {
          pages.push(parseInt(part));
        }
      });

      const result = await window.electronAPI.extractPagesPdf({
        inputPath,
        outputPath,
        pages: pages.filter(p => !isNaN(p))
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Pages extracted!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Page extraction error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles, pagesToExtract]);

  // Handle extract images
  const handleExtractImages = useCallback(async () => {
    if (selectedFiles.length !== 1 || !window.electronAPI) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFiles[0].path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const extractDir = `${outputDir}/extracted_images_${Date.now()}`;

      const result = await window.electronAPI.extractImagesPdf({
        inputPath,
        outputDir: extractDir
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(extractDir);
        alert(`${result.imageCount || 0} images extracted!`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Image extraction error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles]);

  // Handle PDF to Images
  const handlePdfToImages = useCallback(async () => {
    if (selectedFiles.length !== 1 || !window.electronAPI) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFiles[0].path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const imagesDir = `${outputDir}/pdf_pages_${Date.now()}`;

      const result = await window.electronAPI.pdfToImages({
        inputPath,
        outputDir: imagesDir,
        format: imageFormat,
        quality: imageQuality
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(imagesDir);
        alert(`PDF converted to ${result.pageCount} images!`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('PDF to Images error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFiles, imageFormat, imageQuality]);

  // Handle select image files for Images to PDF
  const handleSelectImages = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const files = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const info = await window.electronAPI.getFileInfo(filePath);
          return info;
        })
      );
      // Filter only image files
      const images = files.filter(f => ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(f.extension.toLowerCase()));
      setImageFiles(images);
    }
  }, []);

  // Handle Images to PDF
  const handleImagesToPdf = useCallback(async () => {
    if (imageFiles.length < 1 || !window.electronAPI) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const firstFilePath = imageFiles[0].path;
      const outputDir = firstFilePath.substring(0, Math.max(firstFilePath.lastIndexOf('\\'), firstFilePath.lastIndexOf('/')));
      const outputPath = `${outputDir}/images_combined_${Date.now()}.pdf`;

      const result = await window.electronAPI.imagesToPdf({
        files: imageFiles.map(f => f.path),
        outputPath
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Images merged into PDF!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Images to PDF error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [imageFiles]);

  // Handle select HTML file
  const handleSelectHtml = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const info = await window.electronAPI.getFileInfo(result.filePaths[0]);
      if (['html', 'htm'].includes(info.extension.toLowerCase())) {
        setHtmlFile(info);
      } else {
        alert('Please select an HTML file');
      }
    }
  }, []);

  // Handle HTML to PDF
  const handleHtmlToPdf = useCallback(async () => {
    if (!htmlFile || !window.electronAPI) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = htmlFile.path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = htmlFile.name.replace(/\.(html|htm)$/i, '');
      const outputPath = `${outputDir}/${baseName}.pdf`;

      const result = await window.electronAPI.htmlToPdf({
        inputPath,
        outputPath
      });

      if (result.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('HTML converted to PDF!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('HTML to PDF error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [htmlFile]);

  const clearFiles = () => setSelectedFiles([]);
  const clearImageFiles = () => setImageFiles([]);
  const clearHtmlFile = () => setHtmlFile(null);

  const renderToolContent = () => {
    switch (activeToolTab) {
      case 'merge':
        return (
          <div className="tool-content merge-tool-content">
            <PDFMergeTool />
          </div>
        );

      case 'split':
        return (
          <div className="tool-content">
            <h3>Split PDF</h3>
            <p>Split PDF file into separate pages.</p>

            <div className="file-requirements">
              <span className="requirement-badge">1 PDF required</span>
            </div>

            <button className="select-files-btn" onClick={handleSelectFiles} disabled={isProcessing}>
              Select PDF File
            </button>

            {selectedFiles.length > 0 && (
              <div className="selected-files-list">
                <div className="files-header">
                  <span>{selectedFiles.length} file selected</span>
                  <button className="clear-btn" onClick={clearFiles}>Clear</button>
                </div>
                {selectedFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ))}
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleSplit}
              disabled={selectedFiles.length !== 1 || isProcessing}
            >
              {isProcessing ? `Splitting... ${progress}%` : 'Split Pages'}
            </button>
          </div>
        );

      case 'watermark':
        return (
          <div className="tool-content watermark-tool-content">
            <h3>Add Watermark</h3>
            <p>Add text or logo watermark to PDF file - with professional options.</p>

            <WatermarkTool
              mediaType="pdf"
              selectedFile={selectedFiles[0]}
              onProcess={handleWatermark}
              isProcessing={isProcessing}
              progress={progress}
            />
          </div>
        );

      case 'compress':
        return (
          <div className="tool-content">
            <h3>Compress PDF</h3>
            <p>Reduce PDF file size.</p>

            <div className="file-requirements">
              <span className="requirement-badge">1 PDF required</span>
            </div>

            <button className="select-files-btn" onClick={handleSelectFiles} disabled={isProcessing}>
              Select PDF File
            </button>

            {selectedFiles.length > 0 && (
              <>
                <div className="selected-files-list">
                  <div className="files-header">
                    <span>{selectedFiles.length} file selected</span>
                    <button className="clear-btn" onClick={clearFiles}>Clear</button>
                  </div>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="file-item">
                      <span className="file-icon">📄</span>
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>

                <div className="compress-options">
                  <label>Compression Quality</label>
                  <div className="quality-buttons">
                    {['low', 'medium', 'high'].map((q) => (
                      <button
                        key={q}
                        className={`quality-btn ${compressQuality === q ? 'active' : ''}`}
                        onClick={() => setCompressQuality(q)}
                      >
                        {q === 'low' ? 'Low' : q === 'medium' ? 'Medium' : 'High'}
                      </button>
                    ))}
                  </div>
                  <p className="quality-hint">
                    {compressQuality === 'low' && 'Smallest size, lower quality'}
                    {compressQuality === 'medium' && 'Balanced size and quality'}
                    {compressQuality === 'high' && 'Best quality, larger size'}
                  </p>
                </div>
              </>
            )}

            <button
              className="action-btn primary"
              onClick={handleCompress}
              disabled={selectedFiles.length !== 1 || isProcessing}
            >
              {isProcessing ? `Compressing... ${progress}%` : 'Compress'}
            </button>
          </div>
        );

      case 'protect':
        return (
          <div className="tool-content">
            <h3>Protect PDF</h3>
            <p>Protect your PDF with a password.</p>

            <button className="select-files-btn" onClick={handleSelectFiles} disabled={isProcessing}>
              Select PDF File
            </button>

            {selectedFiles.length > 0 && (
              <>
                <div className="selected-files-list">
                  <div className="files-header">
                    <span>{selectedFiles[0].name}</span>
                    <button className="clear-btn" onClick={clearFiles}>Clear</button>
                  </div>
                </div>

                <div className="protect-options">
                  <div className="option-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={protectPassword}
                      onChange={(e) => setProtectPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              className="action-btn primary"
              onClick={handleProtect}
              disabled={selectedFiles.length !== 1 || isProcessing || !protectPassword}
            >
              {isProcessing ? `Protecting... ${progress}%` : 'Protect'}
            </button>
          </div>
        );

      case 'unlock':
        return (
          <div className="tool-content">
            <h3>Unlock PDF</h3>
            <p>Remove password protection from PDF.</p>

            <button className="select-files-btn" onClick={handleSelectFiles} disabled={isProcessing}>
              Select PDF File
            </button>

            {selectedFiles.length > 0 && (
              <>
                <div className="selected-files-list">
                  <div className="files-header">
                    <span>{selectedFiles[0].name}</span>
                    <button className="clear-btn" onClick={clearFiles}>Clear</button>
                  </div>
                </div>

                <div className="unlock-options">
                  <div className="option-group">
                    <label>Current Password</label>
                    <input
                      type="password"
                      value={protectPassword}
                      onChange={(e) => setProtectPassword(e.target.value)}
                      placeholder="Enter PDF password"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              className="action-btn primary"
              onClick={handleUnlock}
              disabled={selectedFiles.length !== 1 || isProcessing || !protectPassword}
            >
              {isProcessing ? `Unlocking... ${progress}%` : 'Unlock'}
            </button>
          </div>
        );

      case 'rotate':
        return (
          <div className="tool-content">
            <h3>Rotate PDF</h3>
            <p>Rotate PDF pages.</p>

            <button className="select-files-btn" onClick={handleSelectFiles} disabled={isProcessing}>
              Select PDF File
            </button>

            {selectedFiles.length > 0 && (
              <>
                <div className="selected-files-list">
                  <div className="files-header">
                    <span>{selectedFiles[0].name}</span>
                    <button className="clear-btn" onClick={clearFiles}>Clear</button>
                  </div>
                </div>

                <div className="rotate-options">
                  <div className="rotation-buttons">
                    {[90, 180, 270].map((angle) => (
                      <button
                        key={angle}
                        className={`rotation-btn ${rotateAngle === angle ? 'active' : ''}`}
                        onClick={() => setRotateAngle(angle)}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              className="action-btn primary"
              onClick={handleRotate}
              disabled={selectedFiles.length !== 1 || isProcessing}
            >
              {isProcessing ? `Rotating... ${progress}%` : 'Rotate'}
            </button>
          </div>
        );

      case 'removePages':
        return (
          <div className="tool-content remove-pages-tool-content">
            <PDFRemovePagesTool />
          </div>
        );

      case 'extractPages':
        return (
          <div className="tool-content extract-pages-tool-content">
            <PDFExtractPagesTool />
          </div>
        );

      case 'extractImages':
        return (
          <div className="tool-content">
            <h3>Extract Images</h3>
            <p>Extract all images from PDF and save them.</p>

            <button className="select-files-btn" onClick={handleSelectFiles} disabled={isProcessing}>
              Select PDF File
            </button>

            {selectedFiles.length > 0 && (
              <div className="selected-files-list">
                <div className="files-header">
                  <span>{selectedFiles[0].name}</span>
                  <button className="clear-btn" onClick={clearFiles}>Clear</button>
                </div>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleExtractImages}
              disabled={selectedFiles.length !== 1 || isProcessing}
            >
              {isProcessing ? `Extracting... ${progress}%` : 'Extract Images'}
            </button>
          </div>
        );

      case 'pdfToImages':
        return (
          <div className="tool-content">
            <h3>PDF to JPG/PNG</h3>
            <p>Convert PDF pages to image files.</p>

            <button className="select-files-btn" onClick={handleSelectFiles} disabled={isProcessing}>
              Select PDF File
            </button>

            {selectedFiles.length > 0 && (
              <>
                <div className="selected-files-list">
                  <div className="files-header">
                    <span>{selectedFiles[0].name}</span>
                    <button className="clear-btn" onClick={clearFiles}>Clear</button>
                  </div>
                </div>

                <div className="image-format-options">
                  <div className="option-group">
                    <label>Format</label>
                    <div className="format-buttons">
                      <button
                        className={`format-btn ${imageFormat === 'png' ? 'active' : ''}`}
                        onClick={() => setImageFormat('png')}
                      >
                        PNG
                      </button>
                      <button
                        className={`format-btn ${imageFormat === 'jpg' ? 'active' : ''}`}
                        onClick={() => setImageFormat('jpg')}
                      >
                        JPG
                      </button>
                    </div>
                  </div>
                  {imageFormat === 'jpg' && (
                    <div className="option-group">
                      <label>Quality: {imageQuality}%</label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={imageQuality}
                        onChange={(e) => setImageQuality(parseInt(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              className="action-btn primary"
              onClick={handlePdfToImages}
              disabled={selectedFiles.length !== 1 || isProcessing}
            >
              {isProcessing ? `Converting... ${progress}%` : 'Convert to Images'}
            </button>
          </div>
        );

      case 'imagesToPdf':
        return (
          <div className="tool-content">
            <h3>Images to PDF</h3>
            <p>Combine multiple images into a single PDF file.</p>

            <button className="select-files-btn" onClick={handleSelectImages} disabled={isProcessing}>
              Select Image Files
            </button>

            {imageFiles.length > 0 && (
              <div className="selected-files-list">
                <div className="files-header">
                  <span>{imageFiles.length} images selected</span>
                  <button className="clear-btn" onClick={clearImageFiles}>Clear</button>
                </div>
                {imageFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <span className="file-icon">🖼️</span>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleImagesToPdf}
              disabled={imageFiles.length < 1 || isProcessing}
            >
              {isProcessing ? `Combining... ${progress}%` : 'Create PDF'}
            </button>
          </div>
        );

      case 'htmlToPdf':
        return (
          <div className="tool-content">
            <h3>HTML to PDF</h3>
            <p>Convert HTML file to PDF.</p>

            <button className="select-files-btn" onClick={handleSelectHtml} disabled={isProcessing}>
              Select HTML File
            </button>

            {htmlFile && (
              <div className="selected-files-list">
                <div className="files-header">
                  <span>{htmlFile.name}</span>
                  <button className="clear-btn" onClick={clearHtmlFile}>Clear</button>
                </div>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleHtmlToPdf}
              disabled={!htmlFile || isProcessing}
            >
              {isProcessing ? `Converting... ${progress}%` : 'Create PDF'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="pdf-tools-panel">
      <div className="pdf-tools-header">
        <h1>PDF Tools</h1>
        <p>Edit, merge and convert your PDF files</p>
      </div>

      <div className="tool-tabs">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-tab ${activeToolTab === tool.id ? 'active' : ''}`}
            onClick={() => {
              setActiveToolTab(tool.id);
              setSelectedFiles([]);
            }}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-label">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="tool-panel">
        {renderToolContent()}
      </div>

      {isProcessing && (
        <div className="processing-overlay">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PDFToolsPanel;
