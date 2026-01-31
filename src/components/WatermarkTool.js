import React, { useState, useRef, useEffect } from 'react';

function WatermarkTool({
  mediaType = 'image', // 'image', 'pdf', 'video'
  selectedFile,
  onProcess,
  isProcessing,
  progress
}) {
  const fileInputRef = useRef(null);
  const watermarkImageInputRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const [localFile, setLocalFile] = useState(null);
  const [localFileUrl, setLocalFileUrl] = useState(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  // Watermark type
  const [watermarkType, setWatermarkType] = useState('text'); // 'text' or 'image'

  // Text watermark options
  const [text, setText] = useState('Watermark');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(48);
  const [fontColor, setFontColor] = useState('#ffffff');
  const [fontBold, setFontBold] = useState(false);
  const [fontItalic, setFontItalic] = useState(false);
  const [textShadow, setTextShadow] = useState(true);
  const [shadowColor, setShadowColor] = useState('#000000');

  // Image watermark options
  const [watermarkImage, setWatermarkImage] = useState(null);
  const [watermarkImageUrl, setWatermarkImageUrl] = useState(null);
  const [watermarkScale, setWatermarkScale] = useState(20); // percentage of media size

  // Common options
  const [opacity, setOpacity] = useState(50);
  const [position, setPosition] = useState('bottom-right');
  const [customX, setCustomX] = useState(50);
  const [customY, setCustomY] = useState(50);
  const [rotation, setRotation] = useState(0);
  const [marginX, setMarginX] = useState(20);
  const [marginY, setMarginY] = useState(20);
  const [tileMode, setTileMode] = useState(false);
  const [tileSpacingX, setTileSpacingX] = useState(100);
  const [tileSpacingY, setTileSpacingY] = useState(100);

  const fonts = [
    'Arial', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New',
    'Impact', 'Comic Sans MS', 'Trebuchet MS', 'Palatino', 'Garamond'
  ];

  const positions = [
    { id: 'top-left', label: 'Top Left', icon: '↖' },
    { id: 'top-center', label: 'Top Center', icon: '↑' },
    { id: 'top-right', label: 'Top Right', icon: '↗' },
    { id: 'middle-left', label: 'Middle Left', icon: '←' },
    { id: 'center', label: 'Center', icon: '⊕' },
    { id: 'middle-right', label: 'Middle Right', icon: '→' },
    { id: 'bottom-left', label: 'Bottom Left', icon: '↙' },
    { id: 'bottom-center', label: 'Bottom Center', icon: '↓' },
    { id: 'bottom-right', label: 'Bottom Right', icon: '↘' },
    { id: 'custom', label: 'Custom', icon: '✦' }
  ];

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (localFileUrl) {
        URL.revokeObjectURL(localFileUrl);
      }
      const url = URL.createObjectURL(file);
      setLocalFile(file);
      setLocalFileUrl(url);
      setPreviewLoaded(false);
    }
  };

  // Handle watermark image selection
  const handleWatermarkImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (watermarkImageUrl) {
        URL.revokeObjectURL(watermarkImageUrl);
      }
      const url = URL.createObjectURL(file);
      setWatermarkImage(file);
      setWatermarkImageUrl(url);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (localFileUrl) URL.revokeObjectURL(localFileUrl);
      if (watermarkImageUrl) URL.revokeObjectURL(watermarkImageUrl);
    };
  }, []);

  // Draw preview
  useEffect(() => {
    if (!previewCanvasRef.current || !localFileUrl) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');

    const drawMediaToCanvas = (mediaElement, mediaWidth, mediaHeight) => {
      // Scale canvas to fit preview area
      const maxWidth = 500;
      const maxHeight = 350;
      let width = mediaWidth;
      let height = mediaHeight;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw media
      ctx.drawImage(mediaElement, 0, 0, width, height);

      // Draw watermark preview
      drawWatermarkPreview(ctx, width, height);
      setPreviewLoaded(true);
    };

    if (mediaType === 'image') {
      const img = new Image();
      img.onload = () => {
        drawMediaToCanvas(img, img.width, img.height);
      };
      img.src = localFileUrl;
    } else if (mediaType === 'video') {
      // For video, create a video element and capture a frame
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        // Seek to 1 second or 10% of duration for thumbnail
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        drawMediaToCanvas(video, video.videoWidth, video.videoHeight);
      };

      video.onerror = () => {
        // If video fails to load, show placeholder
        canvas.width = 500;
        canvas.height = 350;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Video Preview', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText(localFile?.name || 'Video file', canvas.width / 2, canvas.height / 2 + 10);
        drawWatermarkPreview(ctx, canvas.width, canvas.height);
        setPreviewLoaded(true);
      };

      video.src = localFileUrl;
    } else if (mediaType === 'pdf') {
      // For PDF, show a placeholder
      canvas.width = 400;
      canvas.height = 500;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('PDF Preview', canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.fillText(localFile?.name || 'PDF file', canvas.width / 2, canvas.height / 2 + 10);

      drawWatermarkPreview(ctx, canvas.width, canvas.height);
      setPreviewLoaded(true);
    }
  }, [localFileUrl, watermarkType, text, fontFamily, fontSize, fontColor, fontBold, fontItalic,
      textShadow, shadowColor, watermarkImageUrl, watermarkScale, opacity, position,
      customX, customY, rotation, marginX, marginY, tileMode, tileSpacingX, tileSpacingY, mediaType, localFile]);

  const drawWatermarkPreview = (ctx, width, height) => {
    ctx.save();
    ctx.globalAlpha = opacity / 100;

    const drawSingleWatermark = (x, y) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);

      if (watermarkType === 'text') {
        const fontStyle = `${fontItalic ? 'italic ' : ''}${fontBold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
        ctx.font = fontStyle;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (textShadow) {
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        ctx.fillStyle = fontColor;
        ctx.fillText(text, 0, 0);
      } else if (watermarkType === 'image' && watermarkImageUrl) {
        const wmImg = new Image();
        wmImg.src = watermarkImageUrl;
        if (wmImg.complete) {
          const wmWidth = (width * watermarkScale) / 100;
          const wmHeight = (wmImg.height / wmImg.width) * wmWidth;
          ctx.drawImage(wmImg, -wmWidth / 2, -wmHeight / 2, wmWidth, wmHeight);
        }
      }

      ctx.restore();
    };

    if (tileMode) {
      // Tile watermark across entire area
      for (let y = tileSpacingY; y < height; y += tileSpacingY) {
        for (let x = tileSpacingX; x < width; x += tileSpacingX) {
          drawSingleWatermark(x, y);
        }
      }
    } else {
      // Single watermark at position
      let x, y;
      const mx = marginX;
      const my = marginY;

      switch (position) {
        case 'top-left':
          x = mx + fontSize; y = my + fontSize / 2;
          break;
        case 'top-center':
          x = width / 2; y = my + fontSize / 2;
          break;
        case 'top-right':
          x = width - mx - fontSize; y = my + fontSize / 2;
          break;
        case 'middle-left':
          x = mx + fontSize; y = height / 2;
          break;
        case 'center':
          x = width / 2; y = height / 2;
          break;
        case 'middle-right':
          x = width - mx - fontSize; y = height / 2;
          break;
        case 'bottom-left':
          x = mx + fontSize; y = height - my - fontSize / 2;
          break;
        case 'bottom-center':
          x = width / 2; y = height - my - fontSize / 2;
          break;
        case 'bottom-right':
          x = width - mx - fontSize; y = height - my - fontSize / 2;
          break;
        case 'custom':
          x = (customX / 100) * width;
          y = (customY / 100) * height;
          break;
        default:
          x = width / 2; y = height / 2;
      }

      drawSingleWatermark(x, y);
    }

    ctx.restore();
  };

  const handleApplyWatermark = () => {
    if (!onProcess) return;

    // Extract only serializable data - paths instead of File objects
    // File objects cannot be cloned for IPC communication
    const watermarkConfig = {
      type: watermarkType,
      // Text options
      text,
      fontFamily,
      fontSize,
      fontColor,
      fontBold,
      fontItalic,
      textShadow,
      shadowColor,
      // Image options
      watermarkImagePath: watermarkImage?.path || null,
      watermarkScale,
      // Common options
      opacity,
      position,
      customX,
      customY,
      rotation,
      marginX,
      marginY,
      tileMode,
      tileSpacingX,
      tileSpacingY,
      // File - only serializable properties (path and name)
      localFile: localFile ? { path: localFile.path, name: localFile.name } : null
    };

    onProcess(watermarkConfig);
  };

  const hasFile = localFileUrl || (selectedFile && selectedFile.path);
  const acceptTypes = mediaType === 'image' ? 'image/*' :
                      mediaType === 'video' ? 'video/*' :
                      '.pdf';

  return (
    <div className="watermark-tool">
      <div className="watermark-preview-section">
        {!hasFile ? (
          <div className="watermark-select-prompt">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept={acceptTypes}
              style={{ display: 'none' }}
            />
            <div className="select-file-box" onClick={() => fileInputRef.current?.click()}>
              <span className="select-icon">
                {mediaType === 'image' ? '🖼️' : mediaType === 'video' ? '🎬' : '📄'}
              </span>
              <p>Click to select file</p>
              <span className="supported-formats">
                {mediaType === 'image' && 'PNG, JPG, WebP, BMP'}
                {mediaType === 'video' && 'MP4, AVI, MKV, MOV, WebM'}
                {mediaType === 'pdf' && 'PDF files'}
              </span>
            </div>
          </div>
        ) : (
          <div className="watermark-preview-wrapper">
            <canvas ref={previewCanvasRef} className="watermark-preview-canvas" />

            <div className="change-file-btn-container">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept={acceptTypes}
                style={{ display: 'none' }}
              />
              <button className="change-file-btn" onClick={() => fileInputRef.current?.click()}>
                Select Different File
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="watermark-controls-section">
        {/* Watermark Type */}
        <div className="control-group">
          <label>WATERMARK TYPE</label>
          <div className="watermark-type-buttons">
            <button
              className={`type-btn ${watermarkType === 'text' ? 'active' : ''}`}
              onClick={() => setWatermarkType('text')}
            >
              <span>Aa</span>
              <span>Text</span>
            </button>
            <button
              className={`type-btn ${watermarkType === 'image' ? 'active' : ''}`}
              onClick={() => setWatermarkType('image')}
            >
              <span>🖼️</span>
              <span>Image</span>
            </button>
          </div>
        </div>

        {/* Text Watermark Options */}
        {watermarkType === 'text' && (
          <div className="text-watermark-options">
            <div className="control-group">
              <label>TEXT</label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Watermark text"
                className="text-input"
              />
            </div>

            <div className="control-row">
              <div className="control-group">
                <label>FONT</label>
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                  {fonts.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="control-group">
                <label>SIZE</label>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value) || 12)}
                  min="8"
                  max="200"
                />
              </div>
            </div>

            <div className="control-row">
              <div className="control-group">
                <label>COLOR</label>
                <div className="color-input-wrapper">
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                  />
                  <span>{fontColor}</span>
                </div>
              </div>
              <div className="control-group style-buttons">
                <label>STYLE</label>
                <div className="style-btn-group">
                  <button
                    className={`style-btn ${fontBold ? 'active' : ''}`}
                    onClick={() => setFontBold(!fontBold)}
                  >
                    B
                  </button>
                  <button
                    className={`style-btn italic ${fontItalic ? 'active' : ''}`}
                    onClick={() => setFontItalic(!fontItalic)}
                  >
                    I
                  </button>
                </div>
              </div>
            </div>

            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={textShadow}
                  onChange={(e) => setTextShadow(e.target.checked)}
                />
                <span>Add Shadow</span>
              </label>
              {textShadow && (
                <div className="color-input-wrapper small">
                  <input
                    type="color"
                    value={shadowColor}
                    onChange={(e) => setShadowColor(e.target.value)}
                  />
                  <span>Shadow Color</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image Watermark Options */}
        {watermarkType === 'image' && (
          <div className="image-watermark-options">
            <div className="control-group">
              <label>WATERMARK IMAGE</label>
              <input
                type="file"
                ref={watermarkImageInputRef}
                onChange={handleWatermarkImageSelect}
                accept="image/*"
                style={{ display: 'none' }}
              />
              {watermarkImageUrl ? (
                <div className="watermark-image-preview">
                  <img src={watermarkImageUrl} alt="Watermark" />
                  <button onClick={() => watermarkImageInputRef.current?.click()}>
                    Change
                  </button>
                </div>
              ) : (
                <button
                  className="select-watermark-btn"
                  onClick={() => watermarkImageInputRef.current?.click()}
                >
                  Select PNG/Logo
                </button>
              )}
            </div>

            <div className="control-group">
              <label>SIZE: {watermarkScale}%</label>
              <input
                type="range"
                min="5"
                max="100"
                value={watermarkScale}
                onChange={(e) => setWatermarkScale(parseInt(e.target.value))}
              />
            </div>
          </div>
        )}

        {/* Common Options */}
        <div className="common-options">
          <div className="control-group">
            <label>OPACITY: {opacity}%</label>
            <input
              type="range"
              min="1"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(parseInt(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>ROTATION: {rotation}°</label>
            <input
              type="range"
              min="-180"
              max="180"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value))}
            />
            <div className="rotation-presets">
              <button onClick={() => setRotation(0)}>0°</button>
              <button onClick={() => setRotation(-45)}>-45°</button>
              <button onClick={() => setRotation(45)}>45°</button>
              <button onClick={() => setRotation(-90)}>-90°</button>
            </div>
          </div>

          <div className="control-group">
            <label>POSITION</label>
            <div className="position-grid">
              {positions.map(pos => (
                <button
                  key={pos.id}
                  className={`position-btn ${position === pos.id ? 'active' : ''}`}
                  onClick={() => setPosition(pos.id)}
                  title={pos.label}
                >
                  {pos.icon}
                </button>
              ))}
            </div>
          </div>

          {position === 'custom' && (
            <div className="control-row">
              <div className="control-group">
                <label>X: {customX}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customX}
                  onChange={(e) => setCustomX(parseInt(e.target.value))}
                />
              </div>
              <div className="control-group">
                <label>Y: {customY}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customY}
                  onChange={(e) => setCustomY(parseInt(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="control-row">
            <div className="control-group">
              <label>MARGIN X: {marginX}px</label>
              <input
                type="range"
                min="0"
                max="200"
                value={marginX}
                onChange={(e) => setMarginX(parseInt(e.target.value))}
              />
            </div>
            <div className="control-group">
              <label>MARGIN Y: {marginY}px</label>
              <input
                type="range"
                min="0"
                max="200"
                value={marginY}
                onChange={(e) => setMarginY(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="control-group">
            <label className="checkbox-label tile-checkbox">
              <input
                type="checkbox"
                checked={tileMode}
                onChange={(e) => setTileMode(e.target.checked)}
              />
              <span>Tile (Cover Entire Surface)</span>
            </label>
          </div>

          {tileMode && (
            <div className="control-row">
              <div className="control-group">
                <label>SPACING X: {tileSpacingX}px</label>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={tileSpacingX}
                  onChange={(e) => setTileSpacingX(parseInt(e.target.value))}
                />
              </div>
              <div className="control-group">
                <label>SPACING Y: {tileSpacingY}px</label>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={tileSpacingY}
                  onChange={(e) => setTileSpacingY(parseInt(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        <button
          className="action-btn primary watermark-apply-btn"
          onClick={handleApplyWatermark}
          disabled={!hasFile || isProcessing || (watermarkType === 'image' && !watermarkImageUrl)}
        >
          {isProcessing ? `Applying... ${progress}%` : 'Apply Watermark'}
        </button>
      </div>
    </div>
  );
}

export default WatermarkTool;
