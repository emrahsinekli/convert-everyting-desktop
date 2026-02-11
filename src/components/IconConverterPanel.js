import React, { useState, useRef } from 'react';
import './IconConverterPanel.css';

const iconSizes = {
  ico: [16, 24, 32, 48, 64, 128, 256],
  icns: [16, 32, 64, 128, 256, 512, 1024]
};

function IconConverterPanel() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [outputFormat, setOutputFormat] = useState('ico');
  const [selectedSizes, setSelectedSizes] = useState([16, 32, 48, 256]);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [imageDimensions, setImageDimensions] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async () => {
    try {
      const result = await window.electronAPI.openFile({
        title: 'Select Image',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'] }
        ]
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        setSelectedFile(filePath);
        setError('');

        // Get file info for preview
        const fileInfo = await window.electronAPI.getFileInfo(filePath);
        if (fileInfo.thumbnail) {
          setPreview(fileInfo.thumbnail);
        }

        // Try to get image dimensions
        const img = new Image();
        img.onload = () => {
          setImageDimensions({ width: img.width, height: img.height });
        };
        if (fileInfo.thumbnail) {
          img.src = fileInfo.thumbnail;
        }
      }
    } catch (err) {
      setError('Failed to select file: ' + err.message);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const filePath = file.path;
        setSelectedFile(filePath);
        setError('');

        // Create preview from dropped file
        const reader = new FileReader();
        reader.onload = (event) => {
          setPreview(event.target.result);

          // Get dimensions
          const img = new Image();
          img.onload = () => {
            setImageDimensions({ width: img.width, height: img.height });
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        setError('Please drop an image file (PNG, JPG, etc.)');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const toggleSize = (size) => {
    setSelectedSizes(prev => {
      if (prev.includes(size)) {
        return prev.filter(s => s !== size);
      } else {
        return [...prev, size].sort((a, b) => a - b);
      }
    });
  };

  const selectAllSizes = () => {
    setSelectedSizes([...iconSizes[outputFormat]]);
  };

  const clearSizes = () => {
    setSelectedSizes([]);
  };

  const handleConvert = async () => {
    if (!selectedFile) {
      setError('Please select an image file first');
      return;
    }

    if (selectedSizes.length === 0) {
      setError('Please select at least one icon size');
      return;
    }

    setConverting(true);
    setError('');

    try {
      // Ask for output directory
      const dirResult = await window.electronAPI.openDirectory();

      if (dirResult && !dirResult.canceled && dirResult.filePaths.length > 0) {
        const outputDir = dirResult.filePaths[0];

        // Call backend to convert - will create separate files for each size
        const result = await window.electronAPI.convertIcon({
          inputPath: selectedFile,
          outputDir: outputDir,
          outputFormat: outputFormat,
          sizes: selectedSizes
        });

        if (result.success) {
          // Show success with file count
          setError('');
          alert(`${result.fileCount} icon(s) created successfully!\n\nFiles:\n${result.files.join('\n')}`);
        } else {
          setError(result.error || 'Conversion failed');
        }
      }
    } catch (err) {
      setError('Conversion failed: ' + err.message);
    } finally {
      setConverting(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setImageDimensions(null);
    setError('');
  };

  return (
    <div className="icon-converter-panel">
      <div className="panel-header">
        <h2>Icon Converter</h2>
        <p>Convert images to ICO (Windows) or ICNS (macOS) icon formats</p>
      </div>

      <div className="icon-content">
        {/* File Drop Zone */}
        <div
          className={`drop-zone ${selectedFile ? 'has-file' : ''}`}
          onClick={!selectedFile ? handleFileSelect : undefined}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {!selectedFile ? (
            <>
              <div className="drop-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="drop-text">Click to select or drag & drop an image</p>
              <p className="drop-supported">Supports PNG, JPG, BMP, GIF, WebP</p>
            </>
          ) : (
            <div className="file-preview">
              {preview && (
                <img src={preview} alt="Preview" className="preview-image" />
              )}
              <div className="file-info">
                <span className="file-name">{selectedFile.split(/[/\\]/).pop()}</span>
                {imageDimensions && (
                  <span className="file-dimensions">
                    {imageDimensions.width} x {imageDimensions.height} px
                  </span>
                )}
              </div>
              <button className="clear-file-btn" onClick={clearSelection}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Output Format Selection */}
        <div className="format-section">
          <h3>Output Format</h3>
          <div className="format-options">
            <button
              className={`format-option ${outputFormat === 'ico' ? 'active' : ''}`}
              onClick={() => {
                setOutputFormat('ico');
                setSelectedSizes([16, 32, 48, 256]);
              }}
            >
              <span className="format-icon">🪟</span>
              <div className="format-details">
                <span className="format-name">.ICO</span>
                <span className="format-desc">Windows Icon</span>
              </div>
            </button>
            <button
              className={`format-option ${outputFormat === 'icns' ? 'active' : ''}`}
              onClick={() => {
                setOutputFormat('icns');
                setSelectedSizes([16, 32, 128, 256, 512]);
              }}
            >
              <span className="format-icon">🍎</span>
              <div className="format-details">
                <span className="format-name">.ICNS</span>
                <span className="format-desc">macOS Icon</span>
              </div>
            </button>
          </div>
        </div>

        {/* Size Selection */}
        <div className="sizes-section">
          <div className="sizes-header">
            <h3>Icon Sizes</h3>
            <div className="sizes-actions">
              <button className="size-action-btn" onClick={selectAllSizes}>Select All</button>
              <button className="size-action-btn" onClick={clearSizes}>Clear</button>
            </div>
          </div>
          <div className="sizes-grid">
            {iconSizes[outputFormat].map((size) => (
              <button
                key={size}
                className={`size-btn ${selectedSizes.includes(size) ? 'active' : ''}`}
                onClick={() => toggleSize(size)}
              >
                <span className="size-value">{size}</span>
                <span className="size-unit">x {size}</span>
              </button>
            ))}
          </div>
          <p className="sizes-hint">
            Selected: {selectedSizes.length} size{selectedSizes.length !== 1 ? 's' : ''}
            {selectedSizes.length > 0 && ` (${selectedSizes.join(', ')})`}
          </p>
        </div>

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

        {/* Convert Button */}
        <button
          className="convert-btn"
          onClick={handleConvert}
          disabled={!selectedFile || selectedSizes.length === 0 || converting}
        >
          {converting ? (
            <>
              <span className="spinner"></span>
              Converting...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Create {outputFormat.toUpperCase()} Icon
            </>
          )}
        </button>

        {/* Info Section */}
        <div className="info-section">
          <h3>About Icon Formats</h3>
          <div className="info-grid">
            <div className="info-card">
              <h4>.ICO (Windows)</h4>
              <p>Windows icon format. Can contain multiple sizes in one file. Recommended sizes: 16x16, 32x32, 48x48, 256x256.</p>
            </div>
            <div className="info-card">
              <h4>.ICNS (macOS)</h4>
              <p>macOS icon format. Supports high-resolution Retina displays. Recommended sizes: 16x16 to 1024x1024.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IconConverterPanel;
