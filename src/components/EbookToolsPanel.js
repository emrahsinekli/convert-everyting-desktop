import React, { useState, useCallback } from 'react';

function EbookToolsPanel() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputFormat, setOutputFormat] = useState('epub');

  const ebookFormats = [
    { id: 'epub', label: 'EPUB', desc: 'Most compatible' },
    { id: 'mobi', label: 'MOBI', desc: 'Kindle (old)' },
    { id: 'azw3', label: 'AZW3', desc: 'Kindle Format 8' },
    { id: 'pdf', label: 'PDF', desc: 'Portable Document' },
    { id: 'txt', label: 'TXT', desc: 'Plain Text' }
  ];

  const inputFormats = ['epub', 'mobi', 'azw3', 'pdf', 'txt', 'html', 'docx'];

  // Handle file selection
  const handleSelectFile = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [
        { name: 'Ebook Files', extensions: inputFormats }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const info = await window.electronAPI.getFileInfo(result.filePaths[0]);
      setSelectedFile(info);
    }
  }, []);

  // Get output path
  const getOutputPath = () => {
    if (!selectedFile) return '';
    const inputPath = selectedFile.path;
    const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
    return `${outputDir}/${baseName}_converted.${outputFormat}`;
  };

  // Handle conversion
  const handleConvert = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath();
      const result = await window.electronAPI.convertEbook({
        inputPath: selectedFile.path,
        outputPath,
        outputFormat
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Ebook converted!');
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
  }, [selectedFile, outputFormat]);

  const clearFile = () => setSelectedFile(null);

  // Get available output formats based on input
  const getAvailableFormats = () => {
    if (!selectedFile) return ebookFormats;
    const inputExt = selectedFile.extension.toLowerCase();
    // Filter out same format
    return ebookFormats.filter(f => f.id !== inputExt);
  };

  return (
    <div className="ebook-tools-panel">
      <div className="tools-header">
        <h1>Ebook Converter</h1>
        <p>Convert EPUB, MOBI, AZW3 and other formats</p>
      </div>

      <div className="tool-panel">
        <div className="tool-content">
          <h3>Convert Ebook</h3>
          <p>Convert your ebook files to different formats.</p>

          <button className="select-files-btn" onClick={handleSelectFile} disabled={isProcessing}>
            {selectedFile ? 'Select Different File' : 'Select Ebook File'}
          </button>

          {selectedFile && (
            <>
              <div className="selected-file-info">
                <div className="file-details">
                  <span className="file-icon">📚</span>
                  <div>
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button className="clear-btn" onClick={clearFile}>✕</button>
                </div>
              </div>

              <div className="format-options">
                <label>Output Format</label>
                <div className="format-buttons">
                  {getAvailableFormats().map((fmt) => (
                    <button
                      key={fmt.id}
                      className={`format-btn ${outputFormat === fmt.id ? 'active' : ''}`}
                      onClick={() => setOutputFormat(fmt.id)}
                    >
                      <span className="format-name">{fmt.label}</span>
                      <span className="format-desc">{fmt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <button
            className="action-btn primary"
            onClick={handleConvert}
            disabled={!selectedFile || isProcessing}
          >
            {isProcessing ? `Converting... ${progress}%` : 'Convert'}
          </button>

          <div className="info-box">
            <h4>Supported Formats</h4>
            <ul>
              <li><strong>EPUB</strong> - Most common ebook format</li>
              <li><strong>MOBI</strong> - Old Kindle format</li>
              <li><strong>AZW3</strong> - New Kindle Format 8</li>
              <li><strong>PDF</strong> - Portable Document Format</li>
              <li><strong>TXT</strong> - Plain text</li>
            </ul>
            <p className="note">
              Note: Additional tools may be required for MOBI and AZW3 conversions.
            </p>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="processing-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
}

export default EbookToolsPanel;
