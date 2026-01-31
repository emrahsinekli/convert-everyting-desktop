import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker setup - use worker from public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

function PDFMergeTool() {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [allPages, setAllPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draggedPage, setDraggedPage] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const fileInputRef = useRef(null);

  // Load image file and create page entry
  const loadImage = async (file) => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      let imageDataUrl;

      if (file.path && window.electronAPI) {
        // Electron file - read via IPC
        const result = await window.electronAPI.readFileAsBuffer(file.path);
        if (!result.success) {
          throw new Error(result.error || 'Failed to read file');
        }
        // Get file extension to determine mime type
        const ext = file.name.split('.').pop().toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' :
                        ext === 'gif' ? 'image/gif' :
                        ext === 'webp' ? 'image/webp' :
                        ext === 'bmp' ? 'image/bmp' : 'image/jpeg';
        imageDataUrl = `data:${mimeType};base64,${result.data}`;
      } else if (file.arrayBuffer) {
        // Browser file input
        const reader = new FileReader();
        imageDataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        throw new Error('File format not supported');
      }

      // Create a single page entry for the image
      const page = {
        id: `${fileId}-image-1`,
        fileId,
        pageNum: 1,
        thumbnail: imageDataUrl,
        isImage: true, // Mark as image for merge handling
        imagePath: file.path,
        imageData: imageDataUrl,
        fileName: file.name,
        selected: true
      };

      return {
        id: fileId,
        name: file.name,
        path: file.path,
        numPages: 1,
        isImage: true,
        pages: [page]
      };
    } catch (error) {
      console.error('Image load error:', error);
      throw error;
    }
  };

  // Generate thumbnail for a PDF page
  const generateThumbnail = async (pdfDoc, pageNum, fileId) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.3 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      return {
        id: `${fileId}-page-${pageNum}`,
        fileId,
        pageNum,
        thumbnail: canvas.toDataURL('image/jpeg', 0.7),
        width: viewport.width,
        height: viewport.height,
        selected: true
      };
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return null;
    }
  };

  // Load PDF and extract pages
  const loadPDF = async (file) => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      let pdfData;

      if (file.path && window.electronAPI) {
        // Electron file - read via IPC
        const result = await window.electronAPI.readFileAsBuffer(file.path);
        if (!result.success) {
          throw new Error(result.error || 'Failed to read file');
        }
        // Convert base64 to Uint8Array
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pdfData = bytes;
      } else if (file.arrayBuffer) {
        // Browser file input
        const arrayBuffer = await file.arrayBuffer();
        pdfData = new Uint8Array(arrayBuffer);
      } else {
        throw new Error('File format not supported');
      }

      const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const numPages = pdfDoc.numPages;

      const pages = [];
      for (let i = 1; i <= numPages; i++) {
        setProgress(Math.round((i / numPages) * 100));
        const pageData = await generateThumbnail(pdfDoc, i, fileId);
        if (pageData) {
          pageData.fileName = file.name;
          pageData.filePath = file.path; // Store file path in each page for backup
          pages.push(pageData);
        }
      }

      return {
        id: fileId,
        name: file.name,
        path: file.path,
        numPages,
        pages
      };
    } catch (error) {
      console.error('PDF load error:', error);
      throw error;
    }
  };

  // Handle PDF file selection
  const handleSelectFiles = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile', 'multiSelections']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      setIsLoading(true);
      setProgress(0);

      try {
        const newFiles = [];
        const newPages = [];

        for (let i = 0; i < result.filePaths.length; i++) {
          const filePath = result.filePaths[i];
          const fileName = filePath.split(/[\\/]/).pop();

          const pdfFile = await loadPDF({ path: filePath, name: fileName });
          newFiles.push(pdfFile);
          newPages.push(...pdfFile.pages);
        }

        setPdfFiles(prev => [...prev, ...newFiles]);
        setAllPages(prev => [...prev, ...newPages]);

        // Select all new pages by default
        setSelectedPages(prev => {
          const newSet = new Set(prev);
          newPages.forEach(p => newSet.add(p.id));
          return newSet;
        });
      } catch (error) {
        alert('Error loading PDF: ' + error.message);
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
    }
  }, []);

  // Handle image file selection
  const handleSelectImages = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }],
      properties: ['openFile', 'multiSelections']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      setIsLoading(true);
      setProgress(0);

      try {
        const newFiles = [];
        const newPages = [];

        for (let i = 0; i < result.filePaths.length; i++) {
          const filePath = result.filePaths[i];
          const fileName = filePath.split(/[\\/]/).pop();
          setProgress(Math.round(((i + 1) / result.filePaths.length) * 100));

          const imageFile = await loadImage({ path: filePath, name: fileName });
          newFiles.push(imageFile);
          newPages.push(...imageFile.pages);
        }

        setPdfFiles(prev => [...prev, ...newFiles]);
        setAllPages(prev => [...prev, ...newPages]);

        // Select all new pages by default
        setSelectedPages(prev => {
          const newSet = new Set(prev);
          newPages.forEach(p => newSet.add(p.id));
          return newSet;
        });
      } catch (error) {
        alert('Error loading image: ' + error.message);
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
    }
  }, []);

  // Handle Word file selection (converts to PDF first, then loads pages)
  const handleSelectWord = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: 'Word Documents', extensions: ['docx', 'doc'] }],
      properties: ['openFile', 'multiSelections']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      setIsLoading(true);
      setProgress(0);

      try {
        const newFiles = [];
        const newPages = [];

        for (let i = 0; i < result.filePaths.length; i++) {
          const filePath = result.filePaths[i];
          const fileName = filePath.split(/[\\/]/).pop();
          setProgress(Math.round(((i + 0.5) / result.filePaths.length) * 100));

          // Convert Word to PDF first
          const tempPdfPath = filePath.replace(/\.(docx?|doc)$/i, '_temp_converted.pdf');
          const conversionResult = await window.electronAPI.startConversion({
            inputPath: filePath,
            outputPath: tempPdfPath,
            outputFormat: 'pdf'
          });

          if (conversionResult?.success && conversionResult.outputPath) {
            // Now load the converted PDF
            const pdfFile = await loadPDF({ path: conversionResult.outputPath, name: fileName + ' (Word)' });
            // Mark pages as from Word document
            pdfFile.pages.forEach(page => {
              page.isFromWord = true;
              page.originalWordPath = filePath;
            });
            pdfFile.isFromWord = true;
            newFiles.push(pdfFile);
            newPages.push(...pdfFile.pages);
          } else {
            throw new Error('Failed to convert Word document: ' + (conversionResult?.error || 'Unknown error'));
          }

          setProgress(Math.round(((i + 1) / result.filePaths.length) * 100));
        }

        setPdfFiles(prev => [...prev, ...newFiles]);
        setAllPages(prev => [...prev, ...newPages]);

        // Select all new pages by default
        setSelectedPages(prev => {
          const newSet = new Set(prev);
          newPages.forEach(p => newSet.add(p.id));
          return newSet;
        });
      } catch (error) {
        alert('Error loading Word: ' + error.message);
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
    }
  }, []);

  // Toggle page selection
  const togglePageSelection = (pageId) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  // Select all pages
  const selectAllPages = () => {
    setSelectedPages(new Set(allPages.map(p => p.id)));
  };

  // Deselect all pages
  const deselectAllPages = () => {
    setSelectedPages(new Set());
  };

  // Select pages from specific file
  const selectFilePages = (fileId) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      allPages.filter(p => p.fileId === fileId).forEach(p => newSet.add(p.id));
      return newSet;
    });
  };

  // Deselect pages from specific file
  const deselectFilePages = (fileId) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      allPages.filter(p => p.fileId === fileId).forEach(p => newSet.delete(p.id));
      return newSet;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedPage(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedPage === null || draggedPage === dropIndex) {
      setDraggedPage(null);
      setDragOverIndex(null);
      return;
    }

    const newPages = [...allPages];
    const [draggedItem] = newPages.splice(draggedPage, 1);

    // Adjust drop index if dragging from before to after
    const adjustedIndex = draggedPage < dropIndex ? dropIndex - 1 : dropIndex;
    newPages.splice(adjustedIndex, 0, draggedItem);

    setAllPages(newPages);
    setDraggedPage(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedPage(null);
    setDragOverIndex(null);
  };

  // Move page to specific position
  const movePage = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const newPages = [...allPages];
    const [movedItem] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, movedItem);
    setAllPages(newPages);
  };

  // Move selected pages
  const moveSelectedToStart = () => {
    const selected = allPages.filter(p => selectedPages.has(p.id));
    const unselected = allPages.filter(p => !selectedPages.has(p.id));
    setAllPages([...selected, ...unselected]);
  };

  const moveSelectedToEnd = () => {
    const selected = allPages.filter(p => selectedPages.has(p.id));
    const unselected = allPages.filter(p => !selectedPages.has(p.id));
    setAllPages([...unselected, ...selected]);
  };

  // Delete selected pages
  const deleteSelectedPages = () => {
    setAllPages(prev => prev.filter(p => !selectedPages.has(p.id)));
    setSelectedPages(new Set());
  };

  // Delete single page
  const deletePage = (pageId) => {
    setAllPages(prev => prev.filter(p => p.id !== pageId));
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      newSet.delete(pageId);
      return newSet;
    });
  };

  // Remove entire PDF file
  const removeFile = (fileId) => {
    setPdfFiles(prev => prev.filter(f => f.id !== fileId));
    setAllPages(prev => prev.filter(p => p.fileId !== fileId));
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      allPages.filter(p => p.fileId === fileId).forEach(p => newSet.delete(p.id));
      return newSet;
    });
  };

  // Merge PDFs
  const handleMerge = async () => {
    if (!window.electronAPI) return;

    const selectedPagesList = allPages.filter(p => selectedPages.has(p.id));
    if (selectedPagesList.length === 0) {
      alert('Please select at least one page');
      return;
    }

    // Ask for save location
    const saveResult = await window.electronAPI.saveFile({
      defaultPath: 'merged.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (saveResult.canceled || !saveResult.filePath) return;

    setIsMerging(true);
    setProgress(0);

    try {
      // Separate PDF pages and image pages
      const pdfPages = selectedPagesList.filter(p => !p.isImage);
      const imagePages = selectedPagesList.filter(p => p.isImage);

      // Group PDF pages by source file
      const pagesByFile = {};
      pdfPages.forEach((page) => {
        if (!pagesByFile[page.fileId]) {
          pagesByFile[page.fileId] = {
            path: pdfFiles.find(f => f.id === page.fileId)?.path,
            pages: []
          };
        }
        pagesByFile[page.fileId].pages.push(page.pageNum);
      });

      // Build final page order with both PDFs and images
      const finalPageOrder = selectedPagesList.map((page, index) => {
        if (page.isImage) {
          return {
            type: 'image',
            imagePath: page.imagePath,
            imageData: page.imageData,
            order: index
          };
        } else {
          // Find the file to get the path
          const file = pdfFiles.find(f => f.id === page.fileId);
          return {
            type: 'pdf',
            fileId: page.fileId,
            filePath: file?.path || page.filePath || null,
            pageNum: page.pageNum,
            order: index
          };
        }
      }).filter(p => p.type === 'image' || p.filePath);

      // Create merge params
      const mergeParams = {
        files: Object.values(pagesByFile).map(f => ({
          path: f.path,
          pages: f.pages
        })),
        outputPath: saveResult.filePath,
        pageOrder: finalPageOrder
      };

      const result = await window.electronAPI.mergePdfs(mergeParams);

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert(`PDF merged successfully! ${selectedPagesList.length} pages`);
      } else {
        throw new Error(result?.error || 'Merge failed');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsMerging(false);
        setProgress(0);
      }, 1000);
    }
  };

  // Clear all
  const clearAll = () => {
    setPdfFiles([]);
    setAllPages([]);
    setSelectedPages(new Set());
  };

  // Get unique file colors for visual distinction
  const getFileColor = (fileId) => {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];
    const fileIndex = pdfFiles.findIndex(f => f.id === fileId);
    return colors[fileIndex % colors.length];
  };

  return (
    <div className="pdf-merge-tool">
      <div className="merge-toolbar">
        <div className="toolbar-left">
          <button
            className="add-files-btn"
            onClick={handleSelectFiles}
            disabled={isLoading || isMerging}
          >
            <span className="btn-icon">+</span>
            Add PDF
          </button>

          {allPages.length > 0 && (
            <>
              <div className="toolbar-divider"></div>
              <button
                className="toolbar-btn"
                onClick={selectAllPages}
                title="Select All"
              >
                ☑️ All
              </button>
              <button
                className="toolbar-btn"
                onClick={deselectAllPages}
                title="Deselect"
              >
                ☐ None
              </button>
              <div className="toolbar-divider"></div>
              <button
                className="toolbar-btn danger"
                onClick={deleteSelectedPages}
                disabled={selectedPages.size === 0}
                title="Delete Selected"
              >
                🗑️ Delete ({selectedPages.size})
              </button>
            </>
          )}
        </div>

        <div className="toolbar-right">
          {allPages.length > 0 && (
            <>
              <div className="view-toggle">
                <button
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  ⊞
                </button>
                <button
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List View"
                >
                  ☰
                </button>
              </div>
              <button
                className="toolbar-btn"
                onClick={clearAll}
                title="Clear All"
              >
                🧹 Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* File list summary */}
      {pdfFiles.length > 0 && (
        <div className="files-summary">
          {pdfFiles.map(file => (
            <div
              key={file.id}
              className="file-badge"
              style={{ borderColor: getFileColor(file.id) }}
            >
              <span
                className="file-color-dot"
                style={{ backgroundColor: getFileColor(file.id) }}
              ></span>
              <span className="file-badge-name">{file.name}</span>
              <span className="file-badge-pages">({file.numPages} pages)</span>
              <button
                className="file-badge-remove"
                onClick={() => removeFile(file.id)}
                title="Remove File"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>Loading PDF... {progress}%</p>
            <div className="loading-bar">
              <div className="loading-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && allPages.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📑</div>
          <h3>Add Your Files</h3>
          <p>Add PDF, image, or Word files to merge. You can drag pages to reorder them, include or exclude selected pages.</p>
          <div className="empty-buttons">
            <button className="primary-btn" onClick={handleSelectFiles}>
              📄 PDF
            </button>
            <button className="primary-btn image-variant" onClick={handleSelectImages}>
              🖼️ Image
            </button>
            <button className="primary-btn word-variant" onClick={handleSelectWord}>
              📝 Word
            </button>
          </div>
        </div>
      )}

      {/* Pages grid/list */}
      {!isLoading && allPages.length > 0 && (
        <div className={`pages-container ${viewMode}`}>
          {allPages.map((page, index) => (
            <div
              key={page.id}
              className={`page-item ${selectedPages.has(page.id) ? 'selected' : ''} ${draggedPage === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div
                className="page-file-indicator"
                style={{ backgroundColor: getFileColor(page.fileId) }}
                title={page.fileName}
              ></div>

              <div className="page-thumbnail-wrapper" onClick={() => togglePageSelection(page.id)}>
                <img
                  src={page.thumbnail}
                  alt={`Page ${page.pageNum}`}
                  className="page-thumbnail"
                />
                <div className="page-checkbox">
                  {selectedPages.has(page.id) ? '✓' : ''}
                </div>
              </div>

              <div className="page-info">
                <span className="page-number">Page {page.pageNum}</span>
                {viewMode === 'list' && (
                  <span className="page-file-name">{page.fileName}</span>
                )}
              </div>

              <div className="page-actions">
                <button
                  className="page-action-btn"
                  onClick={() => movePage(index, Math.max(0, index - 1))}
                  disabled={index === 0}
                  title="Move Up"
                >
                  ↑
                </button>
                <button
                  className="page-action-btn"
                  onClick={() => movePage(index, Math.min(allPages.length - 1, index + 1))}
                  disabled={index === allPages.length - 1}
                  title="Move Down"
                >
                  ↓
                </button>
                <button
                  className="page-action-btn danger"
                  onClick={() => deletePage(page.id)}
                  title="Delete Page"
                >
                  ×
                </button>
              </div>

              <div className="page-order-badge">{index + 1}</div>
            </div>
          ))}

          {/* Drop zone at end */}
          <div
            className={`add-more-zone ${dragOverIndex === allPages.length ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, allPages.length)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, allPages.length)}
          >
            <div className="add-zone-buttons">
              <button className="add-zone-btn" onClick={handleSelectFiles} title="Add PDF">
                📄 PDF
              </button>
              <button className="add-zone-btn" onClick={handleSelectImages} title="Add Image">
                🖼️ Image
              </button>
              <button className="add-zone-btn" onClick={handleSelectWord} title="Add Word">
                📝 Word
              </button>
            </div>
            <span className="add-zone-hint">Add Files</span>
          </div>
        </div>
      )}

      {/* Merge button */}
      {allPages.length > 0 && (
        <div className="merge-footer">
          <div className="merge-summary">
            <span className="summary-item">
              <strong>{pdfFiles.length}</strong> files
            </span>
            <span className="summary-divider">•</span>
            <span className="summary-item">
              <strong>{allPages.length}</strong> total pages
            </span>
            <span className="summary-divider">•</span>
            <span className="summary-item selected">
              <strong>{selectedPages.size}</strong> selected
            </span>
          </div>

          <button
            className="merge-btn"
            onClick={handleMerge}
            disabled={isMerging || selectedPages.size === 0}
          >
            {isMerging ? (
              <>Merging... {progress}%</>
            ) : (
              <>📑 Merge PDF ({selectedPages.size} pages)</>
            )}
          </button>
        </div>
      )}

      {/* Progress bar when merging */}
      {isMerging && (
        <div className="merge-progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      )}

      <style>{`
        .pdf-merge-tool {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1a1a2e;
          border-radius: 12px;
          overflow: hidden;
        }

        .merge-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #16162a;
          border-bottom: 1px solid #2a2a4a;
        }

        .toolbar-left, .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .add-files-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-files-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .add-files-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .add-files-btn.image-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .add-files-btn.image-btn:hover {
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }

        .btn-icon {
          font-size: 18px;
          font-weight: bold;
        }

        .toolbar-divider {
          width: 1px;
          height: 24px;
          background: #3a3a5a;
          margin: 0 4px;
        }

        .toolbar-btn {
          padding: 6px 12px;
          background: #2a2a4a;
          color: #e0e0e0;
          border: 1px solid #3a3a5a;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
        }

        .toolbar-btn:hover {
          background: #3a3a5a;
          border-color: #4a4a6a;
        }

        .toolbar-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toolbar-btn.danger:hover {
          background: #dc2626;
          border-color: #dc2626;
        }

        .view-toggle {
          display: flex;
          background: #2a2a4a;
          border-radius: 6px;
          overflow: hidden;
        }

        .view-btn {
          padding: 6px 10px;
          background: transparent;
          color: #888;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .view-btn:hover {
          color: #fff;
        }

        .view-btn.active {
          background: #667eea;
          color: white;
        }

        .files-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 16px;
          background: #1e1e38;
          border-bottom: 1px solid #2a2a4a;
        }

        .file-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: #2a2a4a;
          border: 2px solid;
          border-radius: 20px;
          font-size: 12px;
        }

        .file-color-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .file-badge-name {
          color: #e0e0e0;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-badge-pages {
          color: #888;
        }

        .file-badge-remove {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 0 2px;
          font-size: 16px;
          line-height: 1;
        }

        .file-badge-remove:hover {
          color: #ef4444;
        }

        .loading-overlay {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 40px;
        }

        .loading-content {
          text-align: center;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid #3a3a5a;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-bar {
          width: 200px;
          height: 4px;
          background: #3a3a5a;
          border-radius: 2px;
          margin-top: 12px;
          overflow: hidden;
        }

        .loading-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          transition: width 0.3s;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 60px 40px;
          text-align: center;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state h3 {
          color: #e0e0e0;
          margin-bottom: 8px;
        }

        .empty-state p {
          color: #888;
          max-width: 400px;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .primary-btn {
          padding: 12px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .primary-btn.image-variant {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .primary-btn.image-variant:hover {
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
        }

        .primary-btn.word-variant {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        }

        .primary-btn.word-variant:hover {
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        .empty-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .pages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .pages-container.grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 16px;
        }

        .pages-container.list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .page-item {
          position: relative;
          background: #2a2a4a;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: grab;
          transition: all 0.2s;
          overflow: hidden;
        }

        .pages-container.grid .page-item {
          padding: 8px;
        }

        .pages-container.list .page-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          gap: 12px;
        }

        .page-item:hover {
          border-color: #4a4a6a;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .page-item.selected {
          border-color: #667eea;
          background: #2a2a5a;
        }

        .page-item.dragging {
          opacity: 0.5;
          transform: scale(0.95);
        }

        .page-item.drag-over {
          border-color: #10b981;
          background: #1a3a2a;
        }

        .page-file-indicator {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
        }

        .pages-container.list .page-file-indicator {
          position: static;
          width: 4px;
          height: 40px;
          border-radius: 2px;
        }

        .page-thumbnail-wrapper {
          position: relative;
          cursor: pointer;
        }

        .pages-container.grid .page-thumbnail-wrapper {
          aspect-ratio: 3/4;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1a1a2e;
          border-radius: 4px;
          overflow: hidden;
        }

        .pages-container.list .page-thumbnail-wrapper {
          width: 50px;
          height: 65px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1a1a2e;
          border-radius: 4px;
          overflow: hidden;
        }

        .page-thumbnail {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .page-checkbox {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          background: rgba(0, 0, 0, 0.6);
          border: 2px solid #667eea;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .page-item.selected .page-checkbox {
          background: #667eea;
        }

        .page-info {
          padding: 6px 0;
          text-align: center;
        }

        .pages-container.list .page-info {
          flex: 1;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .page-number {
          font-size: 12px;
          color: #e0e0e0;
        }

        .page-file-name {
          font-size: 11px;
          color: #888;
        }

        .page-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .pages-container.grid .page-actions {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
        }

        .page-item:hover .page-actions {
          opacity: 1;
        }

        .page-action-btn {
          width: 24px;
          height: 24px;
          background: rgba(0, 0, 0, 0.7);
          border: none;
          border-radius: 4px;
          color: #e0e0e0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        .page-action-btn:hover {
          background: #4a4a6a;
        }

        .page-action-btn.danger:hover {
          background: #dc2626;
        }

        .page-action-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .page-order-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(0, 0, 0, 0.7);
          color: #e0e0e0;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .pages-container.list .page-order-badge {
          position: static;
          background: #3a3a5a;
        }

        .add-more-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: 2px dashed #3a3a5a;
          border-radius: 8px;
          transition: all 0.2s;
          color: #888;
          min-height: 120px;
          padding: 16px;
        }

        .pages-container.list .add-more-zone {
          flex-direction: column;
          min-height: 80px;
          padding: 12px;
        }

        .add-more-zone:hover {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.05);
        }

        .add-more-zone.drag-over {
          border-color: #10b981;
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        .add-zone-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .add-zone-btn {
          padding: 8px 14px;
          background: #3a3a5a;
          color: #e0e0e0;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
        }

        .add-zone-btn:hover {
          background: #667eea;
          color: white;
          transform: translateY(-1px);
        }

        .add-zone-hint {
          color: #666;
          font-size: 12px;
        }

        .add-icon {
          font-size: 24px;
          font-weight: bold;
        }

        .merge-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #16162a;
          border-top: 1px solid #2a2a4a;
        }

        .merge-summary {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #888;
          font-size: 14px;
        }

        .summary-item strong {
          color: #e0e0e0;
        }

        .summary-item.selected strong {
          color: #667eea;
        }

        .summary-divider {
          color: #3a3a5a;
        }

        .merge-btn {
          padding: 12px 24px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .merge-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .merge-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .merge-progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #2a2a4a;
        }

        .merge-progress-bar .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #059669);
          transition: width 0.3s;
        }
      `}</style>
    </div>
  );
}

export default PDFMergeTool;
