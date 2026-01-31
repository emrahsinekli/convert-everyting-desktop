import React, { useState, useCallback, useEffect } from 'react';

function GIFToolsPanel({ initialTool = 'maker' }) {
  const [activeToolTab, setActiveToolTab] = useState(initialTool);

  useEffect(() => {
    setActiveToolTab(initialTool);
  }, [initialTool]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // GIF Maker options
  const [gifFps, setGifFps] = useState(10);
  const [gifWidth, setGifWidth] = useState(480);
  const [gifDelay, setGifDelay] = useState(100);

  // Video to GIF options
  const [videoStartTime, setVideoStartTime] = useState('00:00:00');
  const [videoDuration, setVideoDuration] = useState(5);

  // Compress options
  const [compressQuality, setCompressQuality] = useState(80);
  const [compressColors, setCompressColors] = useState(256);

  const tools = [
    { id: 'maker', label: 'GIF Maker', icon: '🖼️' },
    { id: 'video2gif', label: 'Video to GIF', icon: '🎬' },
    { id: 'compress', label: 'Compress', icon: '📦' },
    { id: 'gif2video', label: 'GIF to Video', icon: '🎥' }
  ];

  // Handle single file selection (for video/gif)
  const handleSelectFile = useCallback(async (filters) => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: filters
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const info = await window.electronAPI.getFileInfo(result.filePaths[0]);
      setSelectedFile(info);
    }
  }, []);

  // Handle multiple image selection for GIF maker
  const handleSelectImages = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const files = await Promise.all(
        result.filePaths.map(async (path) => {
          const info = await window.electronAPI.getFileInfo(path);
          return info;
        })
      );
      setSelectedImages(files);
    }
  }, []);

  // Get output path
  const getOutputPath = (suffix, ext) => {
    if (!selectedFile) return '';
    const inputPath = selectedFile.path;
    const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
    return `${outputDir}/${baseName}_${suffix}.${ext}`;
  };

  // Handle GIF Maker (images to GIF)
  const handleMakeGif = useCallback(async () => {
    if (selectedImages.length < 2 || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const firstFile = selectedImages[0];
      const outputDir = firstFile.path.substring(0, Math.max(firstFile.path.lastIndexOf('\\'), firstFile.path.lastIndexOf('/')));
      const outputPath = `${outputDir}/animated_${Date.now()}.gif`;

      const result = await window.electronAPI.imagesToGif({
        files: selectedImages.map(f => f.path),
        outputPath,
        fps: gifFps,
        width: gifWidth,
        delay: gifDelay
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('GIF created!');
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
  }, [selectedImages, gifFps, gifWidth, gifDelay]);

  // Handle Video to GIF
  const handleVideoToGif = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath('animated', 'gif');
      const result = await window.electronAPI.videoToGif({
        inputPath: selectedFile.path,
        outputPath,
        startTime: videoStartTime,
        duration: videoDuration,
        fps: gifFps,
        width: gifWidth
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('GIF created!');
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
  }, [selectedFile, videoStartTime, videoDuration, gifFps, gifWidth]);

  // Handle GIF Compress
  const handleCompressGif = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath('compressed', 'gif');
      const result = await window.electronAPI.compressGif({
        inputPath: selectedFile.path,
        outputPath,
        colors: compressColors,
        quality: compressQuality
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('GIF compressed!');
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
  }, [selectedFile, compressColors, compressQuality]);

  // Handle GIF to Video
  const handleGifToVideo = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath('video', 'mp4');
      const result = await window.electronAPI.gifToVideo({
        inputPath: selectedFile.path,
        outputPath
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Video created!');
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
  const clearImages = () => setSelectedImages([]);

  const renderToolContent = () => {
    switch (activeToolTab) {
      case 'maker':
        return (
          <div className="tool-content">
            <h3>Create GIF</h3>
            <p>Create animated GIF from images.</p>

            <button className="select-files-btn" onClick={handleSelectImages} disabled={isProcessing}>
              {selectedImages.length > 0 ? 'Add More' : 'Select Images'}
            </button>

            {selectedImages.length > 0 && (
              <>
                <div className="selected-files-list">
                  <div className="files-header">
                    <span>{selectedImages.length} images selected</span>
                    <button className="clear-all-btn" onClick={clearImages}>Clear</button>
                  </div>
                  <ul>
                    {selectedImages.slice(0, 5).map((file, index) => (
                      <li key={index}>
                        <span className="file-icon">🖼️</span>
                        <span className="file-name">{file.name}</span>
                      </li>
                    ))}
                    {selectedImages.length > 5 && (
                      <li className="more-files">+{selectedImages.length - 5} more...</li>
                    )}
                  </ul>
                </div>

                <div className="gif-options">
                  <div className="option-row">
                    <div className="option-group">
                      <label>FPS</label>
                      <input
                        type="number"
                        value={gifFps}
                        onChange={(e) => setGifFps(parseInt(e.target.value))}
                        min="1"
                        max="30"
                      />
                    </div>
                    <div className="option-group">
                      <label>Width (px)</label>
                      <input
                        type="number"
                        value={gifWidth}
                        onChange={(e) => setGifWidth(parseInt(e.target.value))}
                        min="100"
                        max="1920"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <button
              className="action-btn primary"
              onClick={handleMakeGif}
              disabled={selectedImages.length < 2 || isProcessing}
            >
              {isProcessing ? `Creating... ${progress}%` : 'Create GIF'}
            </button>
          </div>
        );

      case 'video2gif':
        return (
          <div className="tool-content">
            <h3>Video to GIF</h3>
            <p>Create GIF from video file.</p>

            <button
              className="select-files-btn"
              onClick={() => handleSelectFile([{ name: 'Video', extensions: ['mp4', 'avi', 'mkv', 'mov', 'webm'] }])}
              disabled={isProcessing}
            >
              {selectedFile ? 'Select Different Video' : 'Select Video'}
            </button>

            {selectedFile && (
              <>
                <div className="selected-file-info">
                  <div className="file-details">
                    <span className="file-icon">🎬</span>
                    <div>
                      <span className="file-name">{selectedFile.name}</span>
                      <span className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <button className="clear-btn" onClick={clearFile}>✕</button>
                  </div>
                </div>

                <div className="gif-options">
                  <div className="option-row">
                    <div className="option-group">
                      <label>Start (HH:MM:SS)</label>
                      <input
                        type="text"
                        value={videoStartTime}
                        onChange={(e) => setVideoStartTime(e.target.value)}
                        placeholder="00:00:00"
                      />
                    </div>
                    <div className="option-group">
                      <label>Duration (seconds)</label>
                      <input
                        type="number"
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                        min="1"
                        max="60"
                      />
                    </div>
                  </div>
                  <div className="option-row">
                    <div className="option-group">
                      <label>FPS</label>
                      <input
                        type="number"
                        value={gifFps}
                        onChange={(e) => setGifFps(parseInt(e.target.value))}
                        min="1"
                        max="30"
                      />
                    </div>
                    <div className="option-group">
                      <label>Width (px)</label>
                      <input
                        type="number"
                        value={gifWidth}
                        onChange={(e) => setGifWidth(parseInt(e.target.value))}
                        min="100"
                        max="1920"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <button
              className="action-btn primary"
              onClick={handleVideoToGif}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? `Creating... ${progress}%` : 'Create GIF'}
            </button>
          </div>
        );

      case 'compress':
        return (
          <div className="tool-content">
            <h3>Compress GIF</h3>
            <p>Reduce GIF file size.</p>

            <button
              className="select-files-btn"
              onClick={() => handleSelectFile([{ name: 'GIF', extensions: ['gif'] }])}
              disabled={isProcessing}
            >
              {selectedFile ? 'Select Different GIF' : 'Select GIF'}
            </button>

            {selectedFile && (
              <>
                <div className="selected-file-info">
                  <div className="file-details">
                    <span className="file-icon">🎞️</span>
                    <div>
                      <span className="file-name">{selectedFile.name}</span>
                      <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button className="clear-btn" onClick={clearFile}>✕</button>
                  </div>
                </div>

                <div className="compress-options">
                  <div className="option-group">
                    <label>Color Count: {compressColors}</label>
                    <input
                      type="range"
                      min="16"
                      max="256"
                      step="16"
                      value={compressColors}
                      onChange={(e) => setCompressColors(parseInt(e.target.value))}
                    />
                  </div>
                  <p className="hint">
                    {compressColors >= 192 ? 'High quality, larger file' :
                     compressColors >= 128 ? 'Medium quality' : 'Low quality, smaller file'}
                  </p>
                </div>
              </>
            )}

            <button
              className="action-btn primary"
              onClick={handleCompressGif}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? `Compressing... ${progress}%` : 'Compress'}
            </button>
          </div>
        );

      case 'gif2video':
        return (
          <div className="tool-content">
            <h3>GIF to Video</h3>
            <p>Convert GIF file to MP4 video.</p>

            <button
              className="select-files-btn"
              onClick={() => handleSelectFile([{ name: 'GIF', extensions: ['gif'] }])}
              disabled={isProcessing}
            >
              {selectedFile ? 'Select Different GIF' : 'Select GIF'}
            </button>

            {selectedFile && (
              <div className="selected-file-info">
                <div className="file-details">
                  <span className="file-icon">🎞️</span>
                  <div>
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button className="clear-btn" onClick={clearFile}>✕</button>
                </div>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleGifToVideo}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? `Converting... ${progress}%` : 'Convert to Video'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="gif-tools-panel">
      <div className="tools-header">
        <h1>GIF Tools</h1>
        <p>Create and edit your GIF files</p>
      </div>

      <div className="tool-tabs">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-tab ${activeToolTab === tool.id ? 'active' : ''}`}
            onClick={() => { setActiveToolTab(tool.id); setSelectedFile(null); setSelectedImages([]); }}
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

export default GIFToolsPanel;
