import React, { useState, useCallback, useEffect } from 'react';
import VideoCropTool from './VideoCropTool';
import VideoTrimTool from './VideoTrimTool';
import WatermarkTool from './WatermarkTool';

function VideoToolsPanel({ initialTool = 'compress' }) {
  const [activeToolTab, setActiveToolTab] = useState(initialTool);

  useEffect(() => {
    setActiveToolTab(initialTool);
  }, [initialTool]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Compress options
  const [targetSize, setTargetSize] = useState(10); // MB
  const [quality, setQuality] = useState('medium');

  // Trim options
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:30');

  // Crop options
  const [cropWidth, setCropWidth] = useState(1280);
  const [cropHeight, setCropHeight] = useState(720);

  // Rotate/Flip options
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const tools = [
    { id: 'compress', label: 'Compress', icon: '📦' },
    { id: 'trim', label: 'Trim', icon: '✂️' },
    { id: 'crop', label: 'Crop', icon: '🖼️' },
    { id: 'rotate', label: 'Rotate', icon: '🔄' },
    { id: 'flip', label: 'Flip', icon: '↔️' },
    { id: 'watermark', label: 'Watermark', icon: '💧' },
    { id: 'toGif', label: 'To GIF', icon: '🎞️' }
  ];

  // Handle file selection
  const handleSelectFile = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv', 'm4v', 'mpeg', 'mpg'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const info = await window.electronAPI.getFileInfo(result.filePaths[0]);
      setSelectedFile(info);
    }
  }, []);

  // Generic process handler
  const handleProcess = useCallback(async (operation) => {
    if (!selectedFile || !window.electronAPI) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const inputPath = selectedFile.path;
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      let outputPath, result;

      switch (operation) {
        case 'compress':
          outputPath = `${outputDir}/${baseName}_compressed.mp4`;
          result = await window.electronAPI.compressVideo({
            inputPath,
            outputPath,
            targetSizeMB: targetSize,
            quality
          });
          break;
        case 'trim':
          outputPath = `${outputDir}/${baseName}_trimmed.mp4`;
          result = await window.electronAPI.trimVideo({
            inputPath,
            outputPath,
            startTime: timeToSeconds(startTime),
            endTime: timeToSeconds(endTime)
          });
          break;
        case 'crop':
          outputPath = `${outputDir}/${baseName}_cropped.mp4`;
          result = await window.electronAPI.cropVideo({
            inputPath,
            outputPath,
            width: cropWidth,
            height: cropHeight
          });
          break;
        case 'rotate':
          outputPath = `${outputDir}/${baseName}_rotated.mp4`;
          result = await window.electronAPI.rotateVideo({
            inputPath,
            outputPath,
            angle: rotation
          });
          break;
        case 'flip':
          outputPath = `${outputDir}/${baseName}_flipped.mp4`;
          result = await window.electronAPI.flipVideo({
            inputPath,
            outputPath,
            horizontal: flipH,
            vertical: flipV
          });
          break;
        case 'toGif':
          outputPath = `${outputDir}/${baseName}.gif`;
          result = await window.electronAPI.videoToGif({
            inputPath,
            outputPath,
            startTime: timeToSeconds(startTime),
            duration: timeToSeconds(endTime) - timeToSeconds(startTime)
          });
          break;
        default:
          throw new Error('Unknown operation');
      }

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath || outputPath);
        alert('Operation completed successfully!');
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
  }, [selectedFile, targetSize, quality, startTime, endTime, cropWidth, cropHeight, rotation, flipH, flipV]);

  // Handle visual crop process
  const handleCropProcess = useCallback(async (cropParams) => {
    if (!window.electronAPI) return;

    // Get input path from either selectedFile or localFile (from drag/drop in crop tool)
    let inputPath = selectedFile?.path;
    let fileName = selectedFile?.name;

    // In Electron, File objects from input elements have a .path property
    if (cropParams.localFile && cropParams.localFile.path) {
      inputPath = cropParams.localFile.path;
      fileName = cropParams.localFile.name;
    }

    if (!inputPath) {
      alert('Please select a video file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const outputPath = `${outputDir}/${baseName}_cropped.mp4`;

      const result = await window.electronAPI.cropVideo({
        inputPath,
        outputPath,
        width: cropParams.width,
        height: cropParams.height,
        x: cropParams.x,
        y: cropParams.y
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath || outputPath);
        alert('Operation completed successfully!');
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

  // Handle visual trim process
  const handleTrimProcess = useCallback(async (trimParams) => {
    if (!window.electronAPI) return;

    let inputPath = selectedFile?.path;
    let fileName = selectedFile?.name;

    if (trimParams.localFile && trimParams.localFile.path) {
      inputPath = trimParams.localFile.path;
      fileName = trimParams.localFile.name;
    }

    if (!inputPath) {
      alert('Please select a video file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const outputPath = `${outputDir}/${baseName}_trimmed.mp4`;

      const result = await window.electronAPI.trimVideo({
        inputPath,
        outputPath,
        startTime: trimParams.startTime,
        endTime: trimParams.endTime
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath || outputPath);
        alert('Operation completed successfully!');
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
      alert('Please select a video file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const outputPath = `${outputDir}/${baseName}_watermarked.mp4`;

      const result = await window.electronAPI.watermarkVideo({
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

  const timeToSeconds = (time) => {
    const parts = time.split(':');
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  };

  const clearFile = () => setSelectedFile(null);

  const renderToolContent = () => {
    switch (activeToolTab) {
      case 'compress':
        return (
          <div className="tool-content">
            <h3>Compress Video</h3>
            <p>Reduce the size of your video file.</p>

            {selectedFile && (
              <div className="compress-options">
                <div className="option-group">
                  <label>Target Size (MB)</label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={targetSize}
                    onChange={(e) => setTargetSize(parseInt(e.target.value))}
                  />
                  <span className="value-display">{targetSize} MB</span>
                </div>

                <div className="option-group">
                  <label>Quality</label>
                  <div className="quality-buttons">
                    {['low', 'medium', 'high'].map((q) => (
                      <button
                        key={q}
                        className={`quality-btn ${quality === q ? 'active' : ''}`}
                        onClick={() => setQuality(q)}
                      >
                        {q === 'low' ? 'Low' : q === 'medium' ? 'Medium' : 'High'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={() => handleProcess('compress')}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? `Compressing... ${progress}%` : 'Compress'}
            </button>
          </div>
        );

      case 'trim':
        return (
          <div className="tool-content trim-tool-content">
            <h3>Trim Video</h3>
            <p>Cut a specific portion of the video - with timeline.</p>

            <VideoTrimTool
              selectedFile={selectedFile}
              onProcess={(trimParams) => handleTrimProcess(trimParams)}
              isProcessing={isProcessing}
              progress={progress}
            />
          </div>
        );

      case 'crop':
        return (
          <div className="tool-content crop-tool-content">
            <h3>Crop Video</h3>
            <p>Crop the edges of your video - with visual editor.</p>

            <VideoCropTool
              selectedFile={selectedFile}
              onProcess={(cropParams) => handleCropProcess(cropParams)}
              isProcessing={isProcessing}
              progress={progress}
            />
          </div>
        );

      case 'rotate':
        return (
          <div className="tool-content">
            <h3>Rotate Video</h3>
            <p>Rotate the video to a specific angle.</p>

            {selectedFile && (
              <div className="rotate-options">
                <div className="rotation-buttons">
                  {[0, 90, 180, 270].map((angle) => (
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
              onClick={() => handleProcess('rotate')}
              disabled={!selectedFile || isProcessing || rotation === 0}
            >
              {isProcessing ? `Rotating... ${progress}%` : 'Rotate Video'}
            </button>
          </div>
        );

      case 'flip':
        return (
          <div className="tool-content">
            <h3>Flip Video</h3>
            <p>Flip the video horizontally or vertically.</p>

            {selectedFile && (
              <div className="flip-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={flipH}
                    onChange={(e) => setFlipH(e.target.checked)}
                  />
                  <span>Flip Horizontal (Mirror)</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={flipV}
                    onChange={(e) => setFlipV(e.target.checked)}
                  />
                  <span>Flip Vertical</span>
                </label>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={() => handleProcess('flip')}
              disabled={!selectedFile || isProcessing || (!flipH && !flipV)}
            >
              {isProcessing ? `Flipping... ${progress}%` : 'Flip Video'}
            </button>
          </div>
        );

      case 'watermark':
        return (
          <div className="tool-content watermark-tool-content">
            <h3>Video Watermark</h3>
            <p>Add text or logo watermark to video - with professional options.</p>

            <WatermarkTool
              mediaType="video"
              selectedFile={selectedFile}
              onProcess={handleWatermark}
              isProcessing={isProcessing}
              progress={progress}
            />
          </div>
        );

      case 'toGif':
        return (
          <div className="tool-content">
            <h3>Video to GIF</h3>
            <p>Convert video to animated GIF.</p>

            {selectedFile && (
              <div className="gif-options">
                <div className="option-group">
                  <label>Start (HH:MM:SS)</label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="00:00:00"
                  />
                </div>
                <div className="option-group">
                  <label>End (HH:MM:SS)</label>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="00:00:10"
                  />
                </div>
                <p className="hint">Maximum 10 seconds recommended for GIF.</p>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={() => handleProcess('toGif')}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? `Converting... ${progress}%` : 'Create GIF'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="video-tools-panel">
      <div className="tools-header">
        <h1>Video Tools</h1>
        <p>Edit and convert your video files</p>
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
          {selectedFile ? 'Select Different Video' : 'Select Video'}
        </button>

        {selectedFile && (
          <div className="selected-file-info">
            <div className="file-details">
              <span className="file-icon">🎬</span>
              <div>
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
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

export default VideoToolsPanel;
