import React, { useState } from 'react';
import './FontConverterPanel.css';

const fontFormats = [
  { id: 'ttf', name: 'TTF', description: 'TrueType Font - Most compatible', icon: 'T' },
  { id: 'otf', name: 'OTF', description: 'OpenType Font - Advanced features', icon: 'O' },
  { id: 'woff', name: 'WOFF', description: 'Web Open Font Format - Web use', icon: 'W' },
  { id: 'woff2', name: 'WOFF2', description: 'WOFF 2.0 - Better compression', icon: '2' },
  { id: 'eot', name: 'EOT', description: 'Embedded OpenType - Legacy IE', icon: 'E' }
];

function FontConverterPanel() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [outputFormat, setOutputFormat] = useState('woff2');
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);

  const handleFileSelect = async () => {
    try {
      const result = await window.electronAPI.openFile({
        title: 'Select Font Files',
        properties: ['multiSelections'],
        filters: [
          { name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2', 'eot'] }
        ]
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        const files = result.filePaths.map(path => ({
          path,
          name: path.split(/[/\\]/).pop(),
          format: path.split('.').pop().toLowerCase()
        }));
        setSelectedFiles(files);
        setError('');
        setResults([]);
      }
    } catch (err) {
      setError('Failed to select files: ' + err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext);
    });

    if (files.length > 0) {
      const fileData = files.map(file => ({
        path: file.path,
        name: file.name,
        format: file.name.split('.').pop().toLowerCase()
      }));
      setSelectedFiles(fileData);
      setError('');
      setResults([]);
    } else {
      setError('Please drop valid font files (TTF, OTF, WOFF, WOFF2, EOT)');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select font files first');
      return;
    }

    setConverting(true);
    setError('');
    setResults([]);
    setProgress(0);

    try {
      // Ask for output directory
      const dirResult = await window.electronAPI.openDirectory();

      if (dirResult && !dirResult.canceled && dirResult.filePaths.length > 0) {
        const outputDir = dirResult.filePaths[0];
        const conversionResults = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setProgress(((i + 1) / selectedFiles.length) * 100);

          try {
            const outputName = file.name.replace(/\.[^.]+$/, `.${outputFormat}`);
            const outputPath = `${outputDir}/${outputName}`;

            const result = await window.electronAPI.startConversion({
              type: 'font',
              inputPath: file.path,
              outputPath: outputPath,
              outputFormat: outputFormat
            });

            conversionResults.push({
              name: file.name,
              success: result.success,
              outputPath: result.success ? outputPath : null,
              error: result.error || null
            });
          } catch (err) {
            conversionResults.push({
              name: file.name,
              success: false,
              error: err.message
            });
          }
        }

        setResults(conversionResults);

        const successCount = conversionResults.filter(r => r.success).length;
        if (successCount === selectedFiles.length) {
          // All successful
        } else if (successCount > 0) {
          setError(`${successCount} of ${selectedFiles.length} fonts converted successfully`);
        } else {
          setError('All conversions failed. Make sure the required tools are installed.');
        }
      }
    } catch (err) {
      setError('Conversion failed: ' + err.message);
    } finally {
      setConverting(false);
    }
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setResults([]);
    setError('');
    setProgress(0);
  };

  const getInputFormat = (file) => {
    return file.format.toUpperCase();
  };

  return (
    <div className="font-converter-panel">
      <div className="panel-header">
        <h2>Font Converter</h2>
        <p>Convert between TTF, OTF, WOFF, WOFF2, and EOT font formats</p>
      </div>

      <div className="font-content">
        {/* Drop Zone */}
        <div
          className={`drop-zone ${selectedFiles.length > 0 ? 'has-files' : ''}`}
          onClick={selectedFiles.length === 0 ? handleFileSelect : undefined}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {selectedFiles.length === 0 ? (
            <>
              <div className="drop-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="drop-text">Click to select or drag & drop font files</p>
              <p className="drop-supported">Supports TTF, OTF, WOFF, WOFF2, EOT</p>
            </>
          ) : (
            <div className="files-list">
              <div className="files-header">
                <span>{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</span>
                <button className="add-more-btn" onClick={handleFileSelect}>Add More</button>
              </div>
              <div className="files-grid">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <div className="file-icon">{getInputFormat(file)}</div>
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-format">{file.format.toUpperCase()}</span>
                    </div>
                    <button className="remove-btn" onClick={() => removeFile(index)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Output Format Selection */}
        <div className="format-section">
          <h3>Output Format</h3>
          <div className="format-grid">
            {fontFormats.map((format) => (
              <button
                key={format.id}
                className={`format-option ${outputFormat === format.id ? 'active' : ''}`}
                onClick={() => setOutputFormat(format.id)}
              >
                <span className="format-icon">{format.icon}</span>
                <div className="format-details">
                  <span className="format-name">.{format.id}</span>
                  <span className="format-desc">{format.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Progress */}
        {converting && (
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="progress-text">Converting... {Math.round(progress)}%</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="results-section">
            <h3>Results</h3>
            <div className="results-list">
              {results.map((result, index) => (
                <div key={index} className={`result-item ${result.success ? 'success' : 'failed'}`}>
                  <span className="result-icon">
                    {result.success ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )}
                  </span>
                  <span className="result-name">{result.name}</span>
                  <span className="result-status">
                    {result.success ? `→ .${outputFormat}` : result.error}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="actions-section">
          <button
            className="convert-btn"
            onClick={handleConvert}
            disabled={selectedFiles.length === 0 || converting}
          >
            {converting ? (
              <>
                <span className="spinner"></span>
                Converting...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                </svg>
                Convert to {outputFormat.toUpperCase()}
              </>
            )}
          </button>
          <button className="clear-btn" onClick={clearAll} disabled={converting}>
            Clear All
          </button>
        </div>

        {/* Info Section */}
        <div className="info-section">
          <h3>About Font Formats</h3>
          <div className="info-grid">
            <div className="info-card">
              <h4>TTF / OTF</h4>
              <p>Desktop fonts. TTF is widely compatible, OTF supports advanced typographic features.</p>
            </div>
            <div className="info-card">
              <h4>WOFF / WOFF2</h4>
              <p>Web fonts. WOFF2 offers better compression. Use for websites.</p>
            </div>
            <div className="info-card">
              <h4>EOT</h4>
              <p>Legacy web font format. Only needed for Internet Explorer 8 and below.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FontConverterPanel;
