import React, { useState, useCallback, useEffect } from 'react';
import WatermarkTool from './WatermarkTool';

function ImageToolsPanel({ initialTool = 'resize' }) {
  const [activeToolTab, setActiveToolTab] = useState(initialTool);

  useEffect(() => {
    setActiveToolTab(initialTool);
  }, [initialTool]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Resize options
  const [resizeWidth, setResizeWidth] = useState(1920);
  const [resizeHeight, setResizeHeight] = useState(1080);
  const [maintainRatio, setMaintainRatio] = useState(true);

  // Compress options
  const [quality, setQuality] = useState(80);
  const [targetSizeKB, setTargetSizeKB] = useState(null);

  // Crop options
  const [cropLeft, setCropLeft] = useState(0);
  const [cropTop, setCropTop] = useState(0);
  const [cropWidth, setCropWidth] = useState(800);
  const [cropHeight, setCropHeight] = useState(600);

  // Rotate options
  const [rotation, setRotation] = useState(90);

  const tools = [
    { id: 'resize', label: 'Resize', icon: '📐' },
    { id: 'compress', label: 'Compress', icon: '📦' },
    { id: 'crop', label: 'Crop', icon: '✂️' },
    { id: 'rotate', label: 'Rotate', icon: '🔄' },
    { id: 'flip', label: 'Flip', icon: '↔️' },
    { id: 'watermark', label: 'Watermark', icon: '💧' }
  ];

  // Handle file selection
  const handleSelectFile = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'heic', 'heif', 'avif'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const info = await window.electronAPI.getFileInfo(result.filePaths[0]);
      setSelectedFile(info);
    }
  }, []);

  // Get output path
  const getOutputPath = (suffix) => {
    if (!selectedFile) return '';
    const inputPath = selectedFile.path;
    const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
    const ext = selectedFile.extension;
    return `${outputDir}/${baseName}_${suffix}.${ext}`;
  };

  // Handle resize
  const handleResize = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath('resized');
      const result = await window.electronAPI.resizeImage({
        inputPath: selectedFile.path,
        outputPath,
        width: resizeWidth,
        height: maintainRatio ? null : resizeHeight,
        fit: 'inside'
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Image resized successfully!');
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
  }, [selectedFile, resizeWidth, resizeHeight, maintainRatio]);

  // Handle compress
  const handleCompress = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath('compressed');
      const result = await window.electronAPI.compressImage({
        inputPath: selectedFile.path,
        outputPath,
        quality,
        targetSizeKB
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Image compressed successfully!');
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
  }, [selectedFile, quality, targetSizeKB]);

  // Handle crop
  const handleCrop = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath('cropped');
      const result = await window.electronAPI.cropImage({
        inputPath: selectedFile.path,
        outputPath,
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Image cropped successfully!');
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
  }, [selectedFile, cropLeft, cropTop, cropWidth, cropHeight]);

  // Handle rotate
  const handleRotate = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath('rotated');
      const result = await window.electronAPI.rotateImage({
        inputPath: selectedFile.path,
        outputPath,
        angle: rotation
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Image rotated successfully!');
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
  }, [selectedFile, rotation]);

  // Handle watermark
  const handleWatermark = useCallback(async (watermarkConfig) => {
    if (!window.electronAPI) return;

    let inputPath = selectedFile?.path;
    let fileName = selectedFile?.name;

    if (watermarkConfig.localFile && watermarkConfig.localFile.path) {
      inputPath = watermarkConfig.localFile.path;
      fileName = watermarkConfig.localFile.name;
    }

    if (!inputPath) {
      alert('Please select an image file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const ext = fileName.split('.').pop();
      const outputPath = `${outputDir}/${baseName}_watermarked.${ext}`;

      const result = await window.electronAPI.watermarkImage({
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
      alert('Error: ' + error.message);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000);
    }
  }, [selectedFile]);

  const clearFile = () => setSelectedFile(null);

  const renderToolContent = () => {
    switch (activeToolTab) {
      case 'resize':
        return (
          <div className="tool-content">
            <h3>Resize Image</h3>
            <p>Change the dimensions of your image.</p>

            {selectedFile && (
              <div className="resize-options">
                <div className="option-row">
                  <div className="option-group">
                    <label>Width (px)</label>
                    <input
                      type="number"
                      value={resizeWidth}
                      onChange={(e) => setResizeWidth(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="option-group">
                    <label>Height (px)</label>
                    <input
                      type="number"
                      value={resizeHeight}
                      onChange={(e) => setResizeHeight(parseInt(e.target.value))}
                      disabled={maintainRatio}
                    />
                  </div>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={maintainRatio}
                    onChange={(e) => setMaintainRatio(e.target.checked)}
                  />
                  <span>Maintain aspect ratio</span>
                </label>
                <div className="preset-buttons">
                  <button onClick={() => { setResizeWidth(1920); setResizeHeight(1080); }}>1920x1080</button>
                  <button onClick={() => { setResizeWidth(1280); setResizeHeight(720); }}>1280x720</button>
                  <button onClick={() => { setResizeWidth(800); setResizeHeight(600); }}>800x600</button>
                  <button onClick={() => { setResizeWidth(640); setResizeHeight(480); }}>640x480</button>
                </div>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleResize}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? `Resizing... ${progress}%` : 'Resize'}
            </button>
          </div>
        );

      case 'compress':
        return (
          <div className="tool-content">
            <h3>Compress Image</h3>
            <p>Reduce the file size of your image.</p>

            {selectedFile && (
              <div className="compress-options">
                <div className="option-group">
                  <label>Quality: {quality}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value))}
                  />
                </div>
                <p className="hint">
                  {quality > 80 ? 'High quality, larger file' :
                   quality > 50 ? 'Medium quality, balanced' : 'Low quality, smaller file'}
                </p>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleCompress}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? `Compressing... ${progress}%` : 'Compress'}
            </button>
          </div>
        );

      case 'crop':
        return (
          <div className="tool-content">
            <h3>Crop Image</h3>
            <p>Cut a specific area of your image.</p>

            {selectedFile && (
              <div className="crop-options">
                <div className="option-row">
                  <div className="option-group">
                    <label>Left (px)</label>
                    <input
                      type="number"
                      value={cropLeft}
                      onChange={(e) => setCropLeft(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="option-group">
                    <label>Top (px)</label>
                    <input
                      type="number"
                      value={cropTop}
                      onChange={(e) => setCropTop(parseInt(e.target.value))}
                    />
                  </div>
                </div>
                <div className="option-row">
                  <div className="option-group">
                    <label>Width (px)</label>
                    <input
                      type="number"
                      value={cropWidth}
                      onChange={(e) => setCropWidth(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="option-group">
                    <label>Height (px)</label>
                    <input
                      type="number"
                      value={cropHeight}
                      onChange={(e) => setCropHeight(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleCrop}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? `Cropping... ${progress}%` : 'Crop'}
            </button>
          </div>
        );

      case 'rotate':
        return (
          <div className="tool-content">
            <h3>Rotate Image</h3>
            <p>Rotate the image to a specific angle.</p>

            {selectedFile && (
              <div className="rotate-options">
                <div className="rotation-buttons">
                  {[90, 180, 270].map((angle) => (
                    <button
                      key={angle}
                      className={`rotation-btn ${rotation === angle ? 'active' : ''}`}
                      onClick={() => setRotation(angle)}
                    >
                      {angle}°
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleRotate}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? `Rotating... ${progress}%` : 'Rotate'}
            </button>
          </div>
        );

      case 'flip':
        return (
          <div className="tool-content">
            <h3>Flip Image</h3>
            <p>Flip the image horizontally or vertically.</p>

            <div className="coming-soon-box">
              <span className="coming-soon-icon">🔄</span>
              <h4>Flip Image</h4>
              <p>Horizontal and vertical flip - Coming soon</p>
            </div>
          </div>
        );

      case 'watermark':
        return (
          <div className="tool-content watermark-tool-content">
            <h3>Add Watermark</h3>
            <p>Add text or logo watermark to image - with professional options.</p>

            <WatermarkTool
              mediaType="image"
              selectedFile={selectedFile}
              onProcess={handleWatermark}
              isProcessing={isProcessing}
              progress={progress}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="image-tools-panel">
      <div className="tools-header">
        <h1>Image Tools</h1>
        <p>Edit your image files</p>
      </div>

      <div className="tool-tabs">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-tab ${activeToolTab === tool.id ? 'active' : ''}`}
            onClick={() => setActiveToolTab(tool.id)}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-label">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="tool-panel">
        <button className="select-files-btn" onClick={handleSelectFile} disabled={isProcessing}>
          {selectedFile ? 'Select Different Image' : 'Select Image'}
        </button>

        {selectedFile && (
          <div className="selected-file-info">
            <div className="file-details">
              <span className="file-icon">🖼️</span>
              <div>
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
              <button className="clear-btn" onClick={clearFile}>✕</button>
            </div>
          </div>
        )}

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

export default ImageToolsPanel;
