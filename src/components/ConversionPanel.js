import React from 'react';
import FormatSelector from './FormatSelector';
import { AUDIO_BITRATE_PRESETS, isLossyAudioFormat } from '../utils/audioFormats';
import { useTranslation } from '../i18n';

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
  onMergePdfChange,
  audioBitrate,
  onAudioBitrateChange
}) {
  const t = useTranslation();
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

  // Lossless targets (flac, wav, aiff...) ignore a bitrate, so only offer the
  // choice when the encoder will actually apply it.
  const showBitrateOption = isLossyAudioFormat(selectedFormat) && typeof onAudioBitrateChange === 'function';

  return (
    <div className="conversion-panel">
      <div className="panel-header">
        <h2>{t('conversion.title')}</h2>
        <p>{t('conversion.subtitle')}</p>
      </div>

      <div className="format-sections">
        {/* Video Formats */}
        {supportedFormats.video && supportedFormats.video.length > 0 && (
          <div className="format-section">
            <h3>
              <span className="section-icon">🎬</span>
              {t('conversion.videoFormats')}
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
              {t('conversion.audioFormats')}
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
              {t('conversion.imageFormats')}
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
              {t('conversion.documentFormats')}
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
              {t('conversion.transcription')}
              <span className="ai-badge">AI</span>
            </h3>
            <p className="section-description">
              {t('conversion.transcriptionHint')}
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

      {/* Audio Bitrate Option */}
      {showBitrateOption && (
        <div className="bitrate-option">
          <div className="bitrate-option-header">
            <span className="bitrate-option-title">{t('bitrate.title')}</span>
            <span className="bitrate-option-value">{audioBitrate} {t('bitrate.unit')}</span>
          </div>
          <div className="bitrate-option-presets">
            {AUDIO_BITRATE_PRESETS.map((rate) => (
              <button
                key={rate}
                type="button"
                className={`bitrate-preset ${audioBitrate === rate ? 'active' : ''}`}
                onClick={() => onAudioBitrateChange(rate)}
                disabled={isConverting}
              >
                {rate}
              </button>
            ))}
          </div>
          <p className="bitrate-hint">
            {audioBitrate >= 320
              ? t('bitrate.hintHighest')
              : audioBitrate >= 256
                ? t('bitrate.hintHigh')
                : audioBitrate >= 192
                  ? t('bitrate.hintStandard')
                  : t('bitrate.hintLow')}
          </p>
        </div>
      )}

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
              {mergePdf ? t('conversion.mergeIntoSinglePdf') : t('conversion.createSeparatePdfs')}
            </span>
          </label>
          <p className="merge-hint">
            {mergePdf
              ? t('conversion.mergeHint', { count: selectedFiles.length })
              : t('conversion.separateHint')
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
            {showBitrateOption && <span className="bitrate-badge">{audioBitrate} {t('bitrate.unit')}</span>}
            {showMergeOption && mergePdf && <span className="merge-badge">{t('conversion.mergeBadge')}</span>}
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
                  {t('conversion.converting', { progress })}
                </>
              ) : (
                <>
                  <span className="button-icon">⚡</span>
                  {t('conversion.convertAll', { count: selectedFiles.length })}
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
                  {t('conversion.converting', { progress })}
                </>
              ) : (
                <>
                  <span className="button-icon">⚡</span>
                  {t('conversion.convertNow')}
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
