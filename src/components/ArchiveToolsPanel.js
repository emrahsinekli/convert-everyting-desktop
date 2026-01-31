import React, { useState, useCallback } from 'react';

function ArchiveToolsPanel() {
  const [activeToolTab, setActiveToolTab] = useState('compress');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Compress options
  const [archiveFormat, setArchiveFormat] = useState('zip');
  const [compressionLevel, setCompressionLevel] = useState('normal');

  const tools = [
    { id: 'compress', label: 'Create Archive', icon: '📦' },
    { id: 'extract', label: 'Extract', icon: '📂' }
  ];

  const archiveFormats = [
    { id: 'zip', label: 'ZIP', desc: 'Most compatible' },
    { id: 'tar', label: 'TAR', desc: 'Unix archive' },
    { id: 'tar.gz', label: 'TAR.GZ', desc: 'Compressed tar' }
  ];

  // Handle file selection for compression
  const handleSelectFiles = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      properties: ['openFile', 'multiSelections']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const files = await Promise.all(
        result.filePaths.map(async (path) => {
          const info = await window.electronAPI.getFileInfo(path);
          return info;
        })
      );
      setSelectedFiles(files);
    }
  }, []);

  // Handle archive selection for extraction
  const handleSelectArchive = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [
        { name: 'Archives', extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'tar.gz', 'tgz'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const info = await window.electronAPI.getFileInfo(result.filePaths[0]);
      setSelectedArchive(info);
    }
  }, []);

  // Handle create archive
  const handleCreateArchive = useCallback(async () => {
    if (selectedFiles.length === 0 || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const firstFile = selectedFiles[0];
      const outputDir = firstFile.path.substring(0, Math.max(firstFile.path.lastIndexOf('\\'), firstFile.path.lastIndexOf('/')));
      const outputPath = `${outputDir}/archive_${Date.now()}.${archiveFormat}`;

      const result = await window.electronAPI.createArchive({
        files: selectedFiles.map(f => f.path),
        outputPath,
        format: archiveFormat,
        level: compressionLevel
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Archive created!');
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
  }, [selectedFiles, archiveFormat, compressionLevel]);

  // Handle extract archive
  const handleExtractArchive = useCallback(async () => {
    if (!selectedArchive || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedArchive.path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const extractDir = `${outputDir}/extracted_${Date.now()}`;

      const result = await window.electronAPI.extractArchive({
        inputPath,
        outputDir: extractDir
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(extractDir);
        alert('Archive extracted!');
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
  }, [selectedArchive]);

  const clearFiles = () => setSelectedFiles([]);
  const clearArchive = () => setSelectedArchive(null);

  const renderToolContent = () => {
    switch (activeToolTab) {
      case 'compress':
        return (
          <div className="tool-content">
            <h3>Create Archive</h3>
            <p>Compress and archive your files.</p>

            <button className="select-files-btn" onClick={handleSelectFiles} disabled={isProcessing}>
              {selectedFiles.length > 0 ? 'Add More' : 'Select Files'}
            </button>

            {selectedFiles.length > 0 && (
              <>
                <div className="selected-files-list">
                  <div className="files-header">
                    <span>{selectedFiles.length} files selected</span>
                    <button className="clear-all-btn" onClick={clearFiles}>Clear</button>
                  </div>
                  <ul>
                    {selectedFiles.slice(0, 5).map((file, index) => (
                      <li key={index}>
                        <span className="file-icon">📄</span>
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                      </li>
                    ))}
                    {selectedFiles.length > 5 && (
                      <li className="more-files">+{selectedFiles.length - 5} more...</li>
                    )}
                  </ul>
                </div>

                <div className="archive-options">
                  <div className="option-group">
                    <label>Archive Format</label>
                    <div className="format-buttons">
                      {archiveFormats.map((fmt) => (
                        <button
                          key={fmt.id}
                          className={`format-btn ${archiveFormat === fmt.id ? 'active' : ''}`}
                          onClick={() => setArchiveFormat(fmt.id)}
                        >
                          <span className="format-name">{fmt.label}</span>
                          <span className="format-desc">{fmt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="option-group">
                    <label>Compression Level</label>
                    <div className="level-buttons">
                      {['fast', 'normal', 'best'].map((level) => (
                        <button
                          key={level}
                          className={`level-btn ${compressionLevel === level ? 'active' : ''}`}
                          onClick={() => setCompressionLevel(level)}
                        >
                          {level === 'fast' ? 'Fast' : level === 'normal' ? 'Normal' : 'Best'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            <button
              className="action-btn primary"
              onClick={handleCreateArchive}
              disabled={selectedFiles.length === 0 || isProcessing}
            >
              {isProcessing ? `Creating... ${progress}%` : 'Create Archive'}
            </button>
          </div>
        );

      case 'extract':
        return (
          <div className="tool-content">
            <h3>Extract Archive</h3>
            <p>Extract ZIP, RAR, 7Z, TAR archives.</p>

            <button className="select-files-btn" onClick={handleSelectArchive} disabled={isProcessing}>
              {selectedArchive ? 'Select Different Archive' : 'Select Archive File'}
            </button>

            {selectedArchive && (
              <div className="selected-file-info">
                <div className="file-details">
                  <span className="file-icon">📦</span>
                  <div>
                    <span className="file-name">{selectedArchive.name}</span>
                    <span className="file-size">{(selectedArchive.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button className="clear-btn" onClick={clearArchive}>✕</button>
                </div>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleExtractArchive}
              disabled={!selectedArchive || isProcessing}
            >
              {isProcessing ? `Extracting... ${progress}%` : 'Extract Archive'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="archive-tools-panel">
      <div className="tools-header">
        <h1>Archive Tools</h1>
        <p>Archive your files or extract archives</p>
      </div>

      <div className="tool-tabs">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-tab ${activeToolTab === tool.id ? 'active' : ''}`}
            onClick={() => { setActiveToolTab(tool.id); setSelectedFiles([]); setSelectedArchive(null); }}
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
        <div className="processing-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
}

export default ArchiveToolsPanel;
