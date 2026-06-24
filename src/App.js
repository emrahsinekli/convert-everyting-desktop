import React, { useState, useEffect, useCallback } from 'react';
import FileDropZone from './components/FileDropZone';
import ConversionPanel from './components/ConversionPanel';
import ProgressBar from './components/ProgressBar';
import FormatSelector from './components/FormatSelector';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DependencyModal from './components/DependencyModal';
import HistoryPanel from './components/HistoryPanel';
import PDFToolsPanel from './components/PDFToolsPanel';
import VideoToolsPanel from './components/VideoToolsPanel';
import ImageToolsPanel from './components/ImageToolsPanel';
import AudioToolsPanel from './components/AudioToolsPanel';
import GIFToolsPanel from './components/GIFToolsPanel';
import ArchiveToolsPanel from './components/ArchiveToolsPanel';
import EbookToolsPanel from './components/EbookToolsPanel';
import LicenseActivation from './components/LicenseActivation';
import { convertPdfToImages } from './utils/pdfRenderer';
import licenseService from './services/licenseService';

// Utility Panels
import UnitConverterPanel from './components/UnitConverterPanel';
import ColorConverterPanel from './components/ColorConverterPanel';
import TextConverterPanel from './components/TextConverterPanel';
import EncodingConverterPanel from './components/EncodingConverterPanel';
import NumberBaseConverterPanel from './components/NumberBaseConverterPanel';
import TimestampConverterPanel from './components/TimestampConverterPanel';
import DataConverterPanel from './components/DataConverterPanel';
import SubtitleConverterPanel from './components/SubtitleConverterPanel';
import IconConverterPanel from './components/IconConverterPanel';
import MarkdownConverterPanel from './components/MarkdownConverterPanel';
import FontConverterPanel from './components/FontConverterPanel';
import HtmlBeautifierPanel from './components/HtmlBeautifierPanel';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [supportedFormats, setSupportedFormats] = useState({});
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [conversionHistory, setConversionHistory] = useState([]);
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [dependencies, setDependencies] = useState({});
  const [activeTab, setActiveTab] = useState('convert-video');
  const [allFormats, setAllFormats] = useState({});
  const [showWhisperInstall, setShowWhisperInstall] = useState(false);
  const [installingWhisper, setInstallingWhisper] = useState(false);
  const [whisperInstallStatus, setWhisperInstallStatus] = useState('');
  const [mergePdf, setMergePdf] = useState(true); // Merge multiple images into single PDF
  const [errorModal, setErrorModal] = useState({ show: false, message: '', title: 'Error' });
  const [copySuccess, setCopySuccess] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState({ checking: true, valid: false });
  const [licenseInfo, setLicenseInfo] = useState(null);

  // Check license on startup using Firebase
  useEffect(() => {
    const checkLicense = async () => {
      try {
        const result = await licenseService.checkLicense();
        setLicenseStatus({ checking: false, valid: result.valid });
        if (result.valid) {
          setLicenseInfo(result);
        }
      } catch (error) {
        console.error('License check failed:', error);
        setLicenseStatus({ checking: false, valid: false });
      }
    };

    checkLicense();
  }, []);

  // Load initial data (only after license is valid)
  useEffect(() => {
    const loadData = async () => {
      if (window.electronAPI && licenseStatus.valid) {
        // Check dependencies
        const deps = await window.electronAPI.checkDependencies();
        setDependencies(deps);

        // Get all formats
        const formats = await window.electronAPI.getAllFormats();
        setAllFormats(formats);

        // Load history from storage
        const history = await window.electronAPI.getSetting('conversionHistory');
        if (history) {
          setConversionHistory(history);
        }
      }
    };

    loadData();
  }, [licenseStatus.valid]);

  // Listen for progress updates
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onProgress(({ progress }) => {
        setProgress(progress);
      });

      return () => {
        window.electronAPI.removeProgressListeners();
      };
    }
  }, []);

  // Detect file category from extension
  const getFileCategory = useCallback((fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv', 'm4v', '3gp'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus'];
    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'svg'];
    const documentExts = ['pdf', 'docx', 'doc', 'txt', 'html', 'md', 'rtf', 'odt', 'xlsx', 'xls', 'pptx', 'ppt'];

    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (imageExts.includes(ext)) return 'image';
    if (documentExts.includes(ext)) return 'document';
    return null;
  }, []);

  // Handle file selection
  const handleFilesSelected = useCallback(async (files) => {
    setSelectedFiles(files);
    setSelectedFormat(null);

    if (files.length > 0 && window.electronAPI) {
      // Get file info and supported formats
      const fileInfo = await window.electronAPI.getFileInfo(files[0].path);
      const formats = await window.electronAPI.getSupportedFormats(fileInfo.extension);
      setSupportedFormats(formats);

      // Auto-switch to correct converter based on file type
      const category = getFileCategory(files[0].name);
      if (category) {
        const targetTab = `convert-${category}`;
        if (activeTab !== targetTab && activeTab.startsWith('convert-')) {
          setActiveTab(targetTab);
        }
      }
    }
  }, [getFileCategory, activeTab]);

  // Handle format selection
  const handleFormatSelect = useCallback((format) => {
    setSelectedFormat(format);
  }, []);

  // Handle conversion - Auto save to same folder
  const handleConvert = useCallback(async () => {
    if (!selectedFiles.length || !selectedFormat || !window.electronAPI) return;

    setIsConverting(true);
    setProgress(0);

    try {
      // Auto generate output path (same folder, new extension)
      const inputPath = selectedFiles[0].path;
      const pathSeparator = inputPath.includes('\\') ? '\\' : '/';
      const inputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      // Clean filename: remove special chars, replace spaces with underscore
      const inputName = selectedFiles[0].name
        .replace(/\.[^/.]+$/, '')  // Remove extension
        .replace(/[()[\]{}]/g, '') // Remove brackets
        .replace(/\s+/g, '_')      // Replace spaces with underscore
        .replace(/_converted/g, ''); // Avoid double _converted
      const outputPath = `${inputDir}${pathSeparator}${inputName}_converted.${selectedFormat}`;

      // Check if this is PDF to image conversion (use renderer-based approach for cross-platform)
      const inputExt = selectedFiles[0].name.split('.').pop().toLowerCase();
      const imageFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'];
      const isPdfToImage = inputExt === 'pdf' && imageFormats.includes(selectedFormat.toLowerCase());

      let result;
      let finalOutputPath = outputPath;

      if (isPdfToImage) {
        // Use renderer-based PDF to image conversion (works on all platforms)
        result = await convertPdfToImages(inputPath, inputDir, {
          format: selectedFormat,
          quality: 90,
          scale: 2,
          onProgress: (p) => setProgress(p)
        });
        // For PDF to images, show the first output file or the directory
        finalOutputPath = result.outputPaths && result.outputPaths.length > 0
          ? result.outputPaths[0]
          : inputDir;
      } else {
        // Standard conversion via main process
        result = await window.electronAPI.startConversion({
          inputPath: inputPath,
          outputPath: outputPath,
          outputFormat: selectedFormat,
          options: {}
        });
        finalOutputPath = result.outputPath || outputPath;
      }

      if (result.success) {
        // Add to history
        const historyItem = {
          id: Date.now(),
          inputFile: selectedFiles[0].name,
          outputFile: finalOutputPath,
          format: selectedFormat,
          timestamp: new Date().toISOString(),
          success: true
        };

        const newHistory = [historyItem, ...conversionHistory].slice(0, 50);
        setConversionHistory(newHistory);
        await window.electronAPI.setSetting('conversionHistory', newHistory);

        // Show success
        setProgress(100);

        // Open folder with converted file
        await window.electronAPI.showInFolder(finalOutputPath);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Conversion failed:', error);
      // Check if it's a Whisper installation error
      if (error.message && error.message.includes('WHISPER_NOT_INSTALLED')) {
        setShowWhisperInstall(true);
      } else {
        setErrorModal({ show: true, message: error.message, title: 'Conversion Error' });
      }
    } finally {
      setTimeout(() => {
        setIsConverting(false);
        setProgress(0);
      }, 1500);
    }
  }, [selectedFiles, selectedFormat, conversionHistory]);

  // Check if all selected files are images
  const allFilesAreImages = useCallback(() => {
    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];
    return selectedFiles.every(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return imageExts.includes(ext);
    });
  }, [selectedFiles]);

  // Handle batch conversion - Auto save to same folder
  const handleBatchConvert = useCallback(async () => {
    if (!selectedFiles.length || !selectedFormat || !window.electronAPI) return;

    setIsConverting(true);
    setProgress(0);

    try {
      // Use same folder as first file
      const firstFilePath = selectedFiles[0].path;
      const outputDir = firstFilePath.substring(0, firstFilePath.lastIndexOf('\\') !== -1 ? firstFilePath.lastIndexOf('\\') : firstFilePath.lastIndexOf('/'));

      // Check if we should merge images to single PDF
      if (selectedFormat === 'pdf' && mergePdf && allFilesAreImages()) {
        // Merge all images into single PDF
        const outputPath = `${outputDir}/merged_${Date.now()}.pdf`;
        const result = await window.electronAPI.mergeImagesToPdf({
          files: selectedFiles.map(f => f.path),
          outputPath: outputPath
        });

        if (result.success) {
          const historyItem = {
            id: Date.now(),
            inputFile: `${selectedFiles.length} images merged`,
            outputFile: outputPath,
            format: selectedFormat,
            timestamp: new Date().toISOString(),
            success: true,
            count: selectedFiles.length,
            successCount: selectedFiles.length
          };

          const newHistory = [historyItem, ...conversionHistory].slice(0, 50);
          setConversionHistory(newHistory);
          await window.electronAPI.setSetting('conversionHistory', newHistory);

          setProgress(100);
          await window.electronAPI.showInFolder(outputPath);
        } else {
          throw new Error(result.error);
        }
      } else {
        // Standard batch conversion - each file separately
        const results = await window.electronAPI.batchConvert({
          files: selectedFiles.map(f => f.path),
          outputDir: outputDir,
          outputFormat: selectedFormat,
          options: {}
        });

        // Check for failed conversions
        const failedResults = results.filter(r => !r.success);
        const successCount = results.filter(r => r.success).length;

        // Add to history
        const historyItem = {
          id: Date.now(),
          inputFile: `${selectedFiles.length} files`,
          outputFile: outputDir,
          format: selectedFormat,
          timestamp: new Date().toISOString(),
          success: successCount === selectedFiles.length,
          count: selectedFiles.length,
          successCount
        };

        const newHistory = [historyItem, ...conversionHistory].slice(0, 50);
        setConversionHistory(newHistory);
        await window.electronAPI.setSetting('conversionHistory', newHistory);

        setProgress(100);

        // Show errors if any files failed
        if (failedResults.length > 0) {
          const errorMessages = failedResults.map(r => {
            const fileName = r.file.split(/[\\/]/).pop();
            return `${fileName}: ${r.error}`;
          }).join('\n\n');

          setErrorModal({
            show: true,
            message: `${successCount}/${results.length} files successful.\n\nFailed files:\n${errorMessages}`,
            title: 'Some Files Could Not Be Converted'
          });
        }

        // Open folder if at least one succeeded
        if (successCount > 0) {
          await window.electronAPI.showInFolder(outputDir);
        }
      }
    } catch (error) {
      console.error('Batch conversion failed:', error);
      // Check if it's a Whisper installation error
      if (error.message && error.message.includes('WHISPER_NOT_INSTALLED')) {
        setShowWhisperInstall(true);
      } else {
        setErrorModal({ show: true, message: error.message, title: 'Batch Conversion Error' });
      }
    } finally {
      setTimeout(() => {
        setIsConverting(false);
        setProgress(0);
      }, 1500);
    }
  }, [selectedFiles, selectedFormat, conversionHistory, mergePdf, allFilesAreImages]);

  // Copy error to clipboard
  const handleCopyError = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(errorModal.message);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [errorModal.message]);

  // Quick convert handler - opens file dialog with filter and sets output format
  const handleQuickConvert = useCallback(async (sourceExt, targetFormat) => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [{ name: `${sourceExt.toUpperCase()} Files`, extensions: [sourceExt] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const files = result.filePaths.map(filePath => ({
        name: filePath.split(/[/\\]/).pop(),
        path: filePath,
        size: 0,
        type: ''
      }));

      // Set files first
      setSelectedFiles(files);

      // Get supported formats for the file
      if (files.length > 0) {
        const fileInfo = await window.electronAPI.getFileInfo(files[0].path);
        const formats = await window.electronAPI.getSupportedFormats(fileInfo.extension);
        setSupportedFormats(formats);
      }

      // Then set the target format
      setSelectedFormat(targetFormat);
    }
  }, []);

  // Handle license activation
  const handleLicenseActivated = useCallback((result) => {
    setLicenseStatus({ checking: false, valid: true });
    setLicenseInfo(result);
  }, []);

  // Handle Whisper installation - automatic download
  const handleInstallWhisper = useCallback(async () => {
    if (!window.electronAPI) return;

    setInstallingWhisper(true);
    setWhisperInstallStatus('Starting installation...');

    window.electronAPI.onDependencyProgress(({ progress, status }) => {
      setWhisperInstallStatus(status || `Downloading... ${progress}%`);
    });

    try {
      const result = await window.electronAPI.installDependency('whisper');

      if (result.success) {
        setWhisperInstallStatus('Whisper AI kuruldu!');
        // Refresh dependencies
        const deps = await window.electronAPI.checkDependencies();
        setDependencies(deps);
        setTimeout(() => {
          setShowWhisperInstall(false);
          setInstallingWhisper(false);
          setWhisperInstallStatus('');
        }, 1500);
      } else {
        setWhisperInstallStatus(result.message || 'Installation failed');
        setInstallingWhisper(false);
      }
    } catch (error) {
      setWhisperInstallStatus('Error: ' + error.message);
      setInstallingWhisper(false);
    } finally {
      window.electronAPI.removeDependencyListeners();
    }
  }, []);

  // Show loading while checking license
  if (licenseStatus.checking) {
    return (
      <div className="app license-loading">
        <div className="license-loading-content">
          <div className="loading-spinner"></div>
          <p>Lisans kontrol ediliyor...</p>
        </div>
        <style>{`
          .license-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16162a 50%, #0f0f1a 100%);
          }
          .license-loading-content {
            text-align: center;
            color: #888;
          }
          .loading-spinner {
            width: 48px;
            height: 48px;
            border: 3px solid #3a3a5a;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show license activation if not valid
  if (!licenseStatus.valid) {
    return <LicenseActivation onActivated={handleLicenseActivated} />;
  }

  return (
    <div className="app">
      <Header />

      <div className="app-content">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onDependencyClick={() => setShowDependencyModal(true)}
        />

        <main className="main-content">
          {/* Global Progress Bar - Always visible at top when converting */}
          {isConverting && (
            <div className="global-progress-bar">
              <div className="progress-info">
                <span className="progress-label">Converting...</span>
                <span className="progress-percent">{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {/* CONVERT MODULE */}
          {(activeTab === 'convert-video' || activeTab === 'convert-audio' ||
            activeTab === 'convert-image' || activeTab === 'convert-document') && (
            <>
              <div className="hero-section">
                <h1 className="hero-title">
                  {activeTab === 'convert-video' && 'Video Converter'}
                  {activeTab === 'convert-audio' && 'Audio Converter'}
                  {activeTab === 'convert-image' && 'Image Converter'}
                  {activeTab === 'convert-document' && 'Document Converter'}
                </h1>
                <p className="hero-subtitle">
                  {activeTab === 'convert-video' && 'MP4, AVI, MKV, MOV, WebM and more'}
                  {activeTab === 'convert-audio' && 'MP3, WAV, FLAC, AAC, OGG and more'}
                  {activeTab === 'convert-image' && 'PNG, JPG, WebP, GIF, BMP and more'}
                  {activeTab === 'convert-document' && 'PDF, DOCX, TXT, HTML and more'}
                </p>
              </div>

              {/* Quick Image Conversion Shortcuts */}
              {activeTab === 'convert-image' && selectedFiles.length === 0 && (
                <div className="quick-convert-section">
                  <h3>Quick Convert</h3>
                  <div className="quick-convert-grid">
                    <button className="quick-convert-btn" onClick={() => handleQuickConvert('webp', 'png')}>
                      <span className="from">WEBP</span>
                      <span className="arrow">→</span>
                      <span className="to">PNG</span>
                    </button>
                    <button className="quick-convert-btn" onClick={() => handleQuickConvert('jfif', 'png')}>
                      <span className="from">JFIF</span>
                      <span className="arrow">→</span>
                      <span className="to">PNG</span>
                    </button>
                    <button className="quick-convert-btn" onClick={() => handleQuickConvert('heic', 'jpg')}>
                      <span className="from">HEIC</span>
                      <span className="arrow">→</span>
                      <span className="to">JPG</span>
                    </button>
                    <button className="quick-convert-btn" onClick={() => handleQuickConvert('heic', 'png')}>
                      <span className="from">HEIC</span>
                      <span className="arrow">→</span>
                      <span className="to">PNG</span>
                    </button>
                    <button className="quick-convert-btn" onClick={() => handleQuickConvert('webp', 'jpg')}>
                      <span className="from">WEBP</span>
                      <span className="arrow">→</span>
                      <span className="to">JPG</span>
                    </button>
                    <button className="quick-convert-btn" onClick={() => handleQuickConvert('png', 'jpg')}>
                      <span className="from">PNG</span>
                      <span className="arrow">→</span>
                      <span className="to">JPG</span>
                    </button>
                    <button className="quick-convert-btn" onClick={() => handleQuickConvert('jpg', 'png')}>
                      <span className="from">JPG</span>
                      <span className="arrow">→</span>
                      <span className="to">PNG</span>
                    </button>
                    <button className="quick-convert-btn" onClick={() => handleQuickConvert('bmp', 'png')}>
                      <span className="from">BMP</span>
                      <span className="arrow">→</span>
                      <span className="to">PNG</span>
                    </button>
                  </div>
                </div>
              )}

              <FileDropZone
                onFilesSelected={handleFilesSelected}
                selectedFiles={selectedFiles}
                disabled={isConverting}
                filterType={activeTab.replace('convert-', '')}
              />

              {selectedFiles.length > 0 && (
                <ConversionPanel
                  selectedFiles={selectedFiles}
                  supportedFormats={supportedFormats}
                  allFormats={allFormats}
                  selectedFormat={selectedFormat}
                  onFormatSelect={handleFormatSelect}
                  onConvert={handleConvert}
                  onBatchConvert={handleBatchConvert}
                  isConverting={isConverting}
                  progress={progress}
                  mergePdf={mergePdf}
                  onMergePdfChange={setMergePdf}
                  filterType={activeTab.replace('convert-', '')}
                />
              )}
            </>
          )}

          {activeTab === 'convert-ebook' && (
            <EbookToolsPanel mode="convert" />
          )}

          {activeTab === 'convert-archive' && (
            <ArchiveToolsPanel mode="convert" />
          )}

          {/* TOOLS MODULE */}
          {activeTab === 'tools-video' && (
            <VideoToolsPanel />
          )}

          {activeTab === 'tools-image' && (
            <ImageToolsPanel />
          )}

          {activeTab === 'tools-audio' && (
            <AudioToolsPanel />
          )}

          {activeTab === 'tools-gif' && (
            <GIFToolsPanel />
          )}

          {activeTab === 'tools-pdf' && (
            <PDFToolsPanel />
          )}

          {activeTab === 'history' && (
            <HistoryPanel
              history={conversionHistory}
              onClearHistory={() => {
                setConversionHistory([]);
                window.electronAPI?.setSetting('conversionHistory', []);
              }}
            />
          )}

          {/* UTILITIES MODULE */}
          {activeTab === 'util-unit' && <UnitConverterPanel />}
          {activeTab === 'util-color' && <ColorConverterPanel />}
          {activeTab === 'util-text' && <TextConverterPanel />}
          {activeTab === 'util-encoding' && <EncodingConverterPanel />}
          {activeTab === 'util-number' && <NumberBaseConverterPanel />}
          {activeTab === 'util-timestamp' && <TimestampConverterPanel />}
          {activeTab === 'util-data' && <DataConverterPanel />}
          {activeTab === 'util-subtitle' && <SubtitleConverterPanel />}
          {activeTab === 'util-icon' && <IconConverterPanel />}
          {activeTab === 'util-markdown' && <MarkdownConverterPanel />}
          {activeTab === 'util-font' && <FontConverterPanel />}
          {activeTab === 'util-html' && <HtmlBeautifierPanel />}
        </main>
      </div>

      {showDependencyModal && (
        <DependencyModal
          dependencies={dependencies}
          onClose={() => setShowDependencyModal(false)}
          onRefresh={async () => {
            const deps = await window.electronAPI?.checkDependencies();
            setDependencies(deps || {});
          }}
          licenseInfo={licenseInfo}
        />
      )}

      {/* Error Modal */}
      {errorModal.show && (
        <div className="modal-overlay" onClick={() => setErrorModal({ ...errorModal, show: false })}>
          <div className="modal error-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header error-header">
              <h2>{errorModal.title}</h2>
              <button className="close-button" onClick={() => setErrorModal({ ...errorModal, show: false })}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-content">
              <div className="error-message-box">
                <code>{errorModal.message}</code>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className={`copy-button ${copySuccess ? 'success' : ''}`}
                onClick={handleCopyError}
              >
                {copySuccess ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy Error
                  </>
                )}
              </button>
              <button
                className="primary-button"
                onClick={() => setErrorModal({ ...errorModal, show: false })}
              >
                OK
              </button>
            </div>

            <style>{`
              .error-modal {
                max-width: 600px;
              }
              .error-header h2 {
                color: #ef4444;
              }
              .error-message-box {
                background: #1a1a2e;
                border: 1px solid #ef4444;
                border-radius: 8px;
                padding: 16px;
                max-height: 300px;
                overflow-y: auto;
              }
              .error-message-box code {
                color: #fca5a5;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 13px;
                white-space: pre-wrap;
                word-break: break-word;
              }
              .copy-button {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 20px;
                background: #3a3a5a;
                color: #e0e0e0;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
              }
              .copy-button:hover {
                background: #4a4a6a;
              }
              .copy-button.success {
                background: #10b981;
                color: white;
              }
              .copy-button svg {
                flex-shrink: 0;
              }
            `}</style>
          </div>
        </div>
      )}

      {/* Whisper Install Modal */}
      {showWhisperInstall && (
        <div className="modal-overlay" onClick={() => !installingWhisper && setShowWhisperInstall(false)}>
          <div className="modal whisper-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Whisper AI Installation</h2>
              {!installingWhisper && (
                <button className="close-button" onClick={() => setShowWhisperInstall(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            <div className="modal-content">
              <p>
                <strong>Whisper AI</strong> is required to transcribe video/audio files.
              </p>
              <p>
                Whisper is a free AI model that works <strong>completely offline</strong> on your computer.
              </p>
              <p className="size-info">
                Download size: ~150 MB
              </p>

              {whisperInstallStatus && (
                <div className={`status-box ${installingWhisper ? 'installing' : ''}`}>
                  {installingWhisper && <span className="spinner"></span>}
                  {whisperInstallStatus}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setShowWhisperInstall(false)}
                disabled={installingWhisper}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={handleInstallWhisper}
                disabled={installingWhisper}
              >
                {installingWhisper ? 'Installing...' : 'Download & Install'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
