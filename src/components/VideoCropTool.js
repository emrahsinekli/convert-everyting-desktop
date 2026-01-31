import React, { useState, useRef, useEffect, useCallback } from 'react';

function VideoCropTool({ selectedFile, onProcess, isProcessing, progress, onSelectFile }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [localVideoUrl, setLocalVideoUrl] = useState(null);
  const [localFile, setLocalFile] = useState(null);

  // Crop box state (in percentage of video)
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, width: 80, height: 80 });

  // Actual pixel values for output
  const [outputWidth, setOutputWidth] = useState(1280);
  const [outputHeight, setOutputHeight] = useState(720);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);

  // Aspect ratio
  const [aspectRatio, setAspectRatio] = useState('freeform');
  const [orientation, setOrientation] = useState('landscape');

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const aspectRatios = [
    { id: 'freeform', label: 'Freeform', value: null },
    { id: '1:1', label: '1:1', value: 1 },
    { id: '16:9', label: '16:9', value: 16/9 },
    { id: '9:16', label: '9:16', value: 9/16 },
    { id: '4:3', label: '4:3', value: 4/3 },
    { id: '3:4', label: '3:4', value: 3/4 },
    { id: '21:9', label: '21:9', value: 21/9 },
  ];

  // Handle local file selection for preview
  const handleLocalFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Clean up previous URL
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }

      const url = URL.createObjectURL(file);
      setLocalVideoUrl(url);
      setLocalFile(file);
      setVideoLoaded(false);
      setVideoError(false);

      // Also notify parent if callback exists
      if (onSelectFile) {
        onSelectFile(file);
      }
    }
  };

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }
    };
  }, [localVideoUrl]);

  // Reset when selectedFile changes from parent
  useEffect(() => {
    if (selectedFile && selectedFile.path && !localVideoUrl) {
      // Try to use file:// URL if no local URL
      setVideoLoaded(false);
      setVideoError(false);
    }
  }, [selectedFile, localVideoUrl]);

  // Handle video loaded
  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
      setOutputWidth(video.videoWidth);
      setOutputHeight(video.videoHeight);
      setVideoLoaded(true);
      setVideoError(false);

      // Calculate display dimensions
      setTimeout(() => {
        updateDisplayDimensions();
      }, 100);
    }
  }, []);

  // Handle video error
  const handleVideoError = () => {
    setVideoError(true);
    setVideoLoaded(false);
  };

  // Update display dimensions when container resizes
  const updateDisplayDimensions = useCallback(() => {
    if (containerRef.current && videoRef.current && videoDimensions.width > 0) {
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const videoAspect = videoDimensions.width / videoDimensions.height;
      let displayWidth, displayHeight;

      if (containerWidth / containerHeight > videoAspect) {
        displayHeight = Math.min(containerHeight, 400);
        displayWidth = displayHeight * videoAspect;
      } else {
        displayWidth = Math.min(containerWidth, 600);
        displayHeight = displayWidth / videoAspect;
      }

      setDisplayDimensions({ width: displayWidth, height: displayHeight });
    }
  }, [videoDimensions]);

  useEffect(() => {
    updateDisplayDimensions();
    window.addEventListener('resize', updateDisplayDimensions);
    return () => window.removeEventListener('resize', updateDisplayDimensions);
  }, [updateDisplayDimensions]);

  // Update output values when crop box changes
  useEffect(() => {
    if (videoDimensions.width > 0) {
      const newWidth = Math.round((cropBox.width / 100) * videoDimensions.width);
      const newHeight = Math.round((cropBox.height / 100) * videoDimensions.height);
      const newX = Math.round((cropBox.x / 100) * videoDimensions.width);
      const newY = Math.round((cropBox.y / 100) * videoDimensions.height);

      setOutputWidth(newWidth);
      setOutputHeight(newHeight);
      setPosX(newX);
      setPosY(newY);
    }
  }, [cropBox, videoDimensions]);

  // Handle aspect ratio change
  const handleAspectRatioChange = (ratioId) => {
    setAspectRatio(ratioId);
    const ratio = aspectRatios.find(r => r.id === ratioId);

    if (ratio && ratio.value && videoDimensions.width > 0) {
      const videoAspect = videoDimensions.width / videoDimensions.height;
      const targetAspect = ratio.value;

      let newWidth, newHeight;

      // Calculate dimensions to fit within video bounds
      if (targetAspect > videoAspect) {
        newWidth = 80;
        newHeight = (newWidth / targetAspect) * videoAspect;
      } else {
        newHeight = 80;
        newWidth = (newHeight * targetAspect) / videoAspect;
      }

      // Center the crop box
      const newX = (100 - newWidth) / 2;
      const newY = (100 - newHeight) / 2;

      setCropBox({ x: newX, y: newY, width: newWidth, height: newHeight });
    }
  };

  // Mouse handlers for dragging crop box
  const handleMouseDown = (e, handle = null) => {
    e.preventDefault();
    e.stopPropagation();

    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
    } else {
      setIsDragging(true);
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging && !isResizing) return;
    if (displayDimensions.width === 0) return;

    const deltaX = ((e.clientX - dragStart.x) / displayDimensions.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / displayDimensions.height) * 100;

    if (isDragging) {
      setCropBox(prev => {
        let newX = prev.x + deltaX;
        let newY = prev.y + deltaY;

        newX = Math.max(0, Math.min(newX, 100 - prev.width));
        newY = Math.max(0, Math.min(newY, 100 - prev.height));

        return { ...prev, x: newX, y: newY };
      });
    } else if (isResizing) {
      setCropBox(prev => {
        let newBox = { ...prev };
        const ratio = aspectRatios.find(r => r.id === aspectRatio);
        const videoAspect = videoDimensions.width / videoDimensions.height;

        switch (resizeHandle) {
          case 'se':
            newBox.width = Math.max(10, Math.min(prev.width + deltaX, 100 - prev.x));
            if (ratio?.value) {
              newBox.height = (newBox.width / ratio.value) * videoAspect;
            } else {
              newBox.height = Math.max(10, Math.min(prev.height + deltaY, 100 - prev.y));
            }
            break;
          case 'sw':
            const newWidthSW = Math.max(10, prev.width - deltaX);
            newBox.x = prev.x + prev.width - newWidthSW;
            newBox.width = newWidthSW;
            if (ratio?.value) {
              newBox.height = (newBox.width / ratio.value) * videoAspect;
            } else {
              newBox.height = Math.max(10, Math.min(prev.height + deltaY, 100 - prev.y));
            }
            break;
          case 'ne':
            newBox.width = Math.max(10, Math.min(prev.width + deltaX, 100 - prev.x));
            if (ratio?.value) {
              const newHeightNE = (newBox.width / ratio.value) * videoAspect;
              newBox.y = prev.y + prev.height - newHeightNE;
              newBox.height = newHeightNE;
            } else {
              const newHeightNE = Math.max(10, prev.height - deltaY);
              newBox.y = prev.y + prev.height - newHeightNE;
              newBox.height = newHeightNE;
            }
            break;
          case 'nw':
            const newWidthNW = Math.max(10, prev.width - deltaX);
            newBox.x = prev.x + prev.width - newWidthNW;
            newBox.width = newWidthNW;
            if (ratio?.value) {
              const newHeightNW = (newBox.width / ratio.value) * videoAspect;
              newBox.y = prev.y + prev.height - newHeightNW;
              newBox.height = newHeightNW;
            } else {
              const newHeightNW = Math.max(10, prev.height - deltaY);
              newBox.y = prev.y + prev.height - newHeightNW;
              newBox.height = newHeightNW;
            }
            break;
          default:
            break;
        }

        newBox.x = Math.max(0, newBox.x);
        newBox.y = Math.max(0, newBox.y);
        newBox.width = Math.min(newBox.width, 100 - newBox.x);
        newBox.height = Math.min(newBox.height, 100 - newBox.y);

        return newBox;
      });
    }

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, isResizing, dragStart, displayDimensions, resizeHandle, aspectRatio, aspectRatios, videoDimensions]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Handle manual input changes
  const handleWidthChange = (newWidth) => {
    const width = parseInt(newWidth) || 0;
    setOutputWidth(width);
    if (videoDimensions.width > 0) {
      const widthPercent = (width / videoDimensions.width) * 100;
      setCropBox(prev => ({ ...prev, width: Math.min(widthPercent, 100 - prev.x) }));
    }
  };

  const handleHeightChange = (newHeight) => {
    const height = parseInt(newHeight) || 0;
    setOutputHeight(height);
    if (videoDimensions.height > 0) {
      const heightPercent = (height / videoDimensions.height) * 100;
      setCropBox(prev => ({ ...prev, height: Math.min(heightPercent, 100 - prev.y) }));
    }
  };

  const handlePosXChange = (newX) => {
    const x = parseInt(newX) || 0;
    setPosX(x);
    if (videoDimensions.width > 0) {
      const xPercent = (x / videoDimensions.width) * 100;
      setCropBox(prev => ({ ...prev, x: Math.max(0, Math.min(xPercent, 100 - prev.width)) }));
    }
  };

  const handlePosYChange = (newY) => {
    const y = parseInt(newY) || 0;
    setPosY(y);
    if (videoDimensions.height > 0) {
      const yPercent = (y / videoDimensions.height) * 100;
      setCropBox(prev => ({ ...prev, y: Math.max(0, Math.min(yPercent, 100 - prev.height)) }));
    }
  };

  const handleCrop = () => {
    if (onProcess && (selectedFile || localFile)) {
      onProcess({
        width: outputWidth,
        height: outputHeight,
        x: posX,
        y: posY,
        localFile: localFile
      });
    }
  };

  const toggleOrientation = () => {
    setOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape');
    setCropBox(prev => {
      if (videoDimensions.width === 0) return prev;
      const videoAspect = videoDimensions.width / videoDimensions.height;
      const newWidth = prev.height * videoAspect;
      const newHeight = prev.width / videoAspect;
      return {
        x: Math.max(0, Math.min(prev.x, 100 - newWidth)),
        y: Math.max(0, Math.min(prev.y, 100 - newHeight)),
        width: Math.min(newWidth, 100),
        height: Math.min(newHeight, 100)
      };
    });
  };

  const hasVideo = localVideoUrl || (selectedFile && selectedFile.path);
  const videoSrc = localVideoUrl || (selectedFile?.path ? `file:///${selectedFile.path.replace(/\\/g, '/')}` : null);

  return (
    <div className="video-crop-tool">
      <div className="crop-preview-section">
        <div className="video-container" ref={containerRef}>
          {!hasVideo ? (
            <div className="video-select-prompt">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLocalFileSelect}
                accept="video/*"
                style={{ display: 'none' }}
              />
              <div className="select-video-box" onClick={() => fileInputRef.current?.click()}>
                <span className="select-icon">🎬</span>
                <p>Click to select video</p>
                <span className="supported-formats">MP4, AVI, MKV, MOV, WebM</span>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                src={videoSrc}
                onLoadedMetadata={handleVideoLoaded}
                onError={handleVideoError}
                muted
                loop
                autoPlay
                playsInline
                crossOrigin="anonymous"
                style={{
                  width: displayDimensions.width || 'auto',
                  height: displayDimensions.height || 'auto',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  display: videoLoaded ? 'block' : 'none'
                }}
              />

              {!videoLoaded && !videoError && (
                <div className="video-loading">
                  <span>Loading video...</span>
                </div>
              )}

              {videoError && (
                <div className="video-error">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLocalFileSelect}
                    accept="video/*"
                    style={{ display: 'none' }}
                  />
                  <p>Failed to load video</p>
                  <button onClick={() => fileInputRef.current?.click()}>
                    Select Different Video
                  </button>
                </div>
              )}

              {videoLoaded && (
                <div
                  className="crop-overlay"
                  style={{
                    width: displayDimensions.width,
                    height: displayDimensions.height
                  }}
                >
                  {/* Crop box */}
                  <div
                    className="crop-box"
                    style={{
                      left: `${cropBox.x}%`,
                      top: `${cropBox.y}%`,
                      width: `${cropBox.width}%`,
                      height: `${cropBox.height}%`
                    }}
                    onMouseDown={(e) => handleMouseDown(e)}
                  >
                    {/* Grid lines */}
                    <div className="grid-line vertical" style={{ left: '33.33%' }} />
                    <div className="grid-line vertical" style={{ left: '66.66%' }} />
                    <div className="grid-line horizontal" style={{ top: '33.33%' }} />
                    <div className="grid-line horizontal" style={{ top: '66.66%' }} />

                    {/* Resize handles */}
                    <div className="resize-handle nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
                    <div className="resize-handle ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
                    <div className="resize-handle sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
                    <div className="resize-handle se" onMouseDown={(e) => handleMouseDown(e, 'se')} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {hasVideo && videoLoaded && (
          <div className="change-video-btn-container">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLocalFileSelect}
              accept="video/*"
              style={{ display: 'none' }}
            />
            <button className="change-video-btn" onClick={() => fileInputRef.current?.click()}>
              Select Different Video
            </button>
          </div>
        )}
      </div>

      <div className="crop-controls-section">
        <div className="control-group">
          <label>ASPECT RATIO</label>
          <div className="aspect-ratio-buttons">
            {aspectRatios.map(ratio => (
              <button
                key={ratio.id}
                className={`aspect-btn ${aspectRatio === ratio.id ? 'active' : ''}`}
                onClick={() => handleAspectRatioChange(ratio.id)}
                disabled={!videoLoaded}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-row">
          <div className="control-group">
            <label>WIDTH</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={outputWidth}
                onChange={(e) => handleWidthChange(e.target.value)}
                disabled={!videoLoaded}
              />
              <span>px</span>
            </div>
          </div>
          <span className="dimension-separator">x</span>
          <div className="control-group">
            <label>HEIGHT</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={outputHeight}
                onChange={(e) => handleHeightChange(e.target.value)}
                disabled={!videoLoaded}
              />
              <span>px</span>
            </div>
          </div>
          <button
            className="orientation-btn"
            onClick={toggleOrientation}
            title="Toggle Orientation"
            disabled={!videoLoaded}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        <div className="control-row">
          <div className="control-group">
            <label>POSITION X</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={posX}
                onChange={(e) => handlePosXChange(e.target.value)}
                disabled={!videoLoaded}
              />
              <span>px</span>
            </div>
          </div>
          <div className="control-group">
            <label>POSITION Y</label>
            <div className="input-with-unit">
              <input
                type="number"
                value={posY}
                onChange={(e) => handlePosYChange(e.target.value)}
                disabled={!videoLoaded}
              />
              <span>px</span>
            </div>
          </div>
        </div>

        <div className="video-info">
          <span>Original: {videoDimensions.width} x {videoDimensions.height}</span>
        </div>

        <button
          className="action-btn primary crop-btn"
          onClick={handleCrop}
          disabled={isProcessing || !videoLoaded}
        >
          {isProcessing ? `Cropping... ${progress}%` : 'Crop Video'}
        </button>
      </div>
    </div>
  );
}

export default VideoCropTool;
