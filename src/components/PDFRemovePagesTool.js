import React, { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

function PDFRemovePagesTool() {
  const [pdfFile, setPdfFile] = useState(null);
  const [allPages, setAllPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set()); // Pages to REMOVE
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Generate thumbnail for a PDF page
  const generateThumbnail = async (pdfDoc, pageNum) => {
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
        id: `page-${pageNum}`,
        pageNum,
        thumbnail: canvas.toDataURL('image/jpeg', 0.7),
        width: viewport.width,
        height: viewport.height
      };
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return null;
    }
  };

  // Load PDF and extract pages
  const loadPDF = async (filePath, fileName) => {
    try {
      let pdfData;

      if (filePath && window.electronAPI) {
        const result = await window.electronAPI.readFileAsBuffer(filePath);
        if (!result.success) {
          throw new Error(result.error || 'Failed to read file');
        }
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pdfData = bytes;
      } else {
        throw new Error('File format not supported');
      }

      const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const numPages = pdfDoc.numPages;

      const pages = [];
      for (let i = 1; i <= numPages; i++) {
        setProgress(Math.round((i / numPages) * 100));
        const pageData = await generateThumbnail(pdfDoc, i);
        if (pageData) {
          pages.push(pageData);
        }
      }

      return {
        name: fileName,
        path: filePath,
        numPages,
        pages
      };
    } catch (error) {
      console.error('PDF load error:', error);
      throw error;
    }
  };

  // Handle PDF file selection
  const handleSelectFile = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      setIsLoading(true);
      setProgress(0);
      setSelectedPages(new Set());

      try {
        const filePath = result.filePaths[0];
        const fileName = filePath.split(/[\\/]/).pop();

        const pdf = await loadPDF(filePath, fileName);
        setPdfFile(pdf);
        setAllPages(pdf.pages);
      } catch (error) {
        alert('Error loading PDF: ' + error.message);
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
    }
  }, []);

  // Toggle page selection (mark for removal)
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

  // Invert selection
  const invertSelection = () => {
    setSelectedPages(prev => {
      const newSet = new Set();
      allPages.forEach(p => {
        if (!prev.has(p.id)) {
          newSet.add(p.id);
        }
      });
      return newSet;
    });
  };

  // Remove selected pages
  const handleRemovePages = async () => {
    if (!window.electronAPI || !pdfFile) return;

    if (selectedPages.size === 0) {
      alert('Please select pages to remove');
      return;
    }

    if (selectedPages.size === allPages.length) {
      alert('You cannot remove all pages. At least one page must remain.');
      return;
    }

    // Ask for save location
    const saveResult = await window.electronAPI.saveFile({
      defaultPath: pdfFile.name.replace('.pdf', '_pages_removed.pdf'),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (saveResult.canceled || !saveResult.filePath) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Get page numbers to remove (1-indexed)
      const pagesToRemove = allPages
        .filter(p => selectedPages.has(p.id))
        .map(p => p.pageNum);

      const result = await window.electronAPI.removePagesPdf({
        inputPath: pdfFile.path,
        outputPath: saveResult.filePath,
        pages: pagesToRemove
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert(`${pagesToRemove.length} pages removed successfully!`);

        // Reload the new PDF
        const newPdf = await loadPDF(saveResult.filePath, saveResult.filePath.split(/[\\/]/).pop());
        setPdfFile(newPdf);
        setAllPages(newPdf.pages);
        setSelectedPages(new Set());
      } else {
        throw new Error(result?.error || 'Operation failed');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  };

  // Clear all
  const clearAll = () => {
    setPdfFile(null);
    setAllPages([]);
    setSelectedPages(new Set());
  };

  return (
    <div className="pdf-remove-tool">
      <div className="remove-toolbar">
        <div className="toolbar-left">
          <button
            className="select-file-btn"
            onClick={handleSelectFile}
            disabled={isLoading || isProcessing}
          >
            <span className="btn-icon">📄</span>
            Select PDF
          </button>

          {allPages.length > 0 && (
            <>
              <div className="toolbar-divider"></div>
              <button className="toolbar-btn" onClick={selectAllPages} title="Select All">
                ☑️ Select All
              </button>
              <button className="toolbar-btn" onClick={deselectAllPages} title="Deselect">
                ☐ None
              </button>
              <button className="toolbar-btn" onClick={invertSelection} title="Invert Selection">
                🔄 Invert
              </button>
            </>
          )}
        </div>

        <div className="toolbar-right">
          {pdfFile && (
            <button className="toolbar-btn" onClick={clearAll} title="Clear">
              🧹 Clear
            </button>
          )}
        </div>
      </div>

      {/* File info */}
      {pdfFile && (
        <div className="file-info-bar">
          <span className="file-name">📄 {pdfFile.name}</span>
          <span className="file-pages">{pdfFile.numPages} pages</span>
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
      {!isLoading && !pdfFile && (
        <div className="empty-state">
          <div className="empty-icon">🗑️</div>
          <h3>Remove Pages</h3>
          <p>Select a PDF file, mark pages to remove, and create a new PDF.</p>
          <button className="primary-btn" onClick={handleSelectFile}>
            📄 Select PDF
          </button>
        </div>
      )}

      {/* Pages grid */}
      {!isLoading && allPages.length > 0 && (
        <div className="pages-grid">
          {allPages.map((page) => (
            <div
              key={page.id}
              className={`page-item ${selectedPages.has(page.id) ? 'marked-remove' : ''}`}
              onClick={() => togglePageSelection(page.id)}
            >
              <div className="page-thumbnail-wrapper">
                <img
                  src={page.thumbnail}
                  alt={`Page ${page.pageNum}`}
                  className="page-thumbnail"
                />
                {selectedPages.has(page.id) && (
                  <div className="remove-overlay">
                    <span className="remove-icon">✕</span>
                  </div>
                )}
              </div>
              <div className="page-info">
                <span className="page-number">Page {page.pageNum}</span>
              </div>
              <div className={`selection-indicator ${selectedPages.has(page.id) ? 'selected' : ''}`}>
                {selectedPages.has(page.id) ? '✕' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer with action button */}
      {allPages.length > 0 && (
        <div className="remove-footer">
          <div className="remove-summary">
            <span className="summary-item">
              <strong>{allPages.length}</strong> total pages
            </span>
            <span className="summary-divider">•</span>
            <span className="summary-item remove">
              <strong>{selectedPages.size}</strong> to remove
            </span>
            <span className="summary-divider">•</span>
            <span className="summary-item keep">
              <strong>{allPages.length - selectedPages.size}</strong> remaining
            </span>
          </div>

          <button
            className="remove-btn"
            onClick={handleRemovePages}
            disabled={isProcessing || selectedPages.size === 0 || selectedPages.size === allPages.length}
          >
            {isProcessing ? (
              <>Processing... {progress}%</>
            ) : (
              <>🗑️ Remove {selectedPages.size} Pages</>
            )}
          </button>
        </div>
      )}

      {/* Progress bar when processing */}
      {isProcessing && (
        <div className="process-progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      )}

      <style>{`
        .pdf-remove-tool {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1a1a2e;
          border-radius: 12px;
          overflow: hidden;
        }

        .remove-toolbar {
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

        .select-file-btn {
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

        .select-file-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .select-file-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-icon {
          font-size: 16px;
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

        .file-info-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #1e1e38;
          border-bottom: 1px solid #2a2a4a;
        }

        .file-name {
          color: #e0e0e0;
          font-weight: 500;
        }

        .file-pages {
          color: #888;
          font-size: 13px;
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
          color: #e0e0e0;
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

        .pages-grid {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 16px;
          align-content: start;
        }

        .page-item {
          position: relative;
          background: #2a2a4a;
          border: 3px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          overflow: hidden;
          padding: 8px;
        }

        .page-item:hover {
          border-color: #4a4a6a;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .page-item.marked-remove {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.15);
        }

        .page-thumbnail-wrapper {
          position: relative;
          aspect-ratio: 3/4;
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

        .remove-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(239, 68, 68, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remove-icon {
          font-size: 48px;
          color: white;
          font-weight: bold;
        }

        .page-info {
          padding: 6px 0;
          text-align: center;
        }

        .page-number {
          font-size: 12px;
          color: #e0e0e0;
        }

        .selection-indicator {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 24px;
          height: 24px;
          background: #2a2a4a;
          border: 2px solid #4a4a6a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: bold;
          transition: all 0.2s;
        }

        .selection-indicator.selected {
          background: #ef4444;
          border-color: #ef4444;
        }

        .remove-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #16162a;
          border-top: 1px solid #2a2a4a;
        }

        .remove-summary {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #888;
          font-size: 14px;
        }

        .summary-item strong {
          color: #e0e0e0;
        }

        .summary-item.remove strong {
          color: #ef4444;
        }

        .summary-item.keep strong {
          color: #10b981;
        }

        .summary-divider {
          color: #3a3a5a;
        }

        .remove-btn {
          padding: 12px 24px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .remove-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }

        .remove-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .process-progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #2a2a4a;
        }

        .process-progress-bar .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ef4444, #dc2626);
          transition: width 0.3s;
        }
      `}</style>
    </div>
  );
}

export default PDFRemovePagesTool;
