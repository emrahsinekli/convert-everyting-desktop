import React from 'react';
import FormatSelector from './FormatSelector';

function ConversionPanel({
  selectedFiles,
  supportedFormats,
  allFormats,
  selectedFormat,
  onFormatSelect,
  onConvert,
  onBatchConvert,
  isConverting,
  progress,
  mergePdf,
  onMergePdfChange
}) {
  const hasMultipleFiles = selectedFiles.length > 1;

  // Get input file type
  const inputExt = selectedFiles[0]?.name.split('.').pop().toLowerCase();

  // Check if transcription is available
  const canTranscribe = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(inputExt);

  // Check if all files are images
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];
  const allFilesAreImages = selectedFiles.every(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    return imageExts.includes(ext);
  });

  // Show PDF merge option when: multiple files + all images + PDF selected
  const showMergeOption = hasMultipleFiles && allFilesAreImages && selectedFormat === 'pdf';

  return (
    <div className="conversion-panel">
      <div className="panel-header">
        <h2>Select Output Format</h2>
        <p>Choose the format you want to convert to</p>
      </div>

      <div className="format-sections">
        {/* Video Formats */}
        {supportedFormats.video && supportedFormats.video.length > 0 && (
          <div className="format-section">
            <h3>
              <span className="section-icon">🎬</span>
              Video Formats
            </h3>
            <FormatSelector
              formats={supportedFormats.video}
              selectedFormat={selectedFormat}
              onSelect={onFormatSelect}
              category="video"
            />
          </div>
        )}

        {/* Audio Formats */}
        {supportedFormats.audio && supportedFormats.audio.length > 0 && (
          <div className="format-section">
            <h3>
              <span className="section-icon">🎵</span>
              Audio Formats
            </h3>
            <FormatSelector
              formats={supportedFormats.audio}
              selectedFormat={selectedFormat}
              onSelect={onFormatSelect}
              category="audio"
            />
          </div>
        )}

        {/* Image Formats */}
        {supportedFormats.image && supportedFormats.image.length > 0 && (
          <div className="format-section">
            <h3>
              <span className="section-icon">🖼️</span>
              Image Formats
            </h3>
            <FormatSelector
              formats={supportedFormats.image}
              selectedFormat={selectedFormat}
              onSelect={onFormatSelect}
              category="image"
            />
          </div>
        )}

        {/* Document Formats */}
        {supportedFormats.document && supportedFormats.document.length > 0 && (
          <div className="format-section">
            <h3>
              <span className="section-icon">📄</span>
              Document Formats
            </h3>
            <FormatSelector
              formats={supportedFormats.document}
              selectedFormat={selectedFormat}
              onSelect={onFormatSelect}
              category="document"
            />
          </div>
        )}

        {/* Transcription Formats */}
        {supportedFormats.transcription && supportedFormats.transcription.length > 0 && (
          <div className="format-section transcription-section">
            <h3>
              <span className="section-icon">🎙️</span>
              AI Transcription
              <span className="ai-badge">AI</span>
            </h3>
            <p className="section-description">
              Convert speech to text using AI (Whisper)
            </p>
            <FormatSelector
              formats={supportedFormats.transcription}
              selectedFormat={selectedFormat}
              onSelect={onFormatSelect}
              category="transcription"
            />
          </div>
        )}
      </div>

      {/* PDF Merge Option */}
      {showMergeOption && (
        <div className="merge-option">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={mergePdf}
              onChange={(e) => onMergePdfChange(e.target.checked)}
            />
            <span className="toggle-switch"></span>
            <span className="toggle-text">
              {mergePdf ? 'Merge into single PDF' : 'Create separate PDFs'}
            </span>
          </label>
          <p className="merge-hint">
            {mergePdf
              ? `${selectedFiles.length} images will be merged into a single PDF file (by order)`
              : `Each image will be saved as a separate PDF file`
            }
          </p>
        </div>
      )}

      {/* Convert Button */}
      <div className="convert-actions">
        {selectedFormat && (
          <div className="conversion-summary">
            <span className="from-format">{inputExt.toUpperCase()}</span>
            <span className="arrow">→</span>
            <span className="to-format">{selectedFormat.toUpperCase()}</span>
            {showMergeOption && mergePdf && <span className="merge-badge">Merge</span>}
          </div>
        )}

        <div className="action-buttons">
          {hasMultipleFiles ? (
            <button
              className="convert-button batch"
              onClick={onBatchConvert}
              disabled={!selectedFormat || isConverting}
            >
              {isConverting ? (
                <>
                  <span className="spinner"></span>
                  Converting {progress}%...
                </>
              ) : (
                <>
                  <span className="button-icon">⚡</span>
                  Convert All ({selectedFiles.length} files)
                </>
              )}
            </button>
          ) : (
            <button
              className="convert-button"
              onClick={onConvert}
              disabled={!selectedFormat || isConverting}
            >
              {isConverting ? (
                <>
                  <span className="spinner"></span>
                  Converting {progress}%...
                </>
              ) : (
                <>
                  <span className="button-icon">⚡</span>
                  Convert Now
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConversionPanel;
