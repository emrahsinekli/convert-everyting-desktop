import React, { useState, useCallback, useEffect } from 'react';
import AudioTrimTool from './AudioTrimTool';

function AudioToolsPanel({ initialTool = 'compress' }) {
  const [activeToolTab, setActiveToolTab] = useState(initialTool);

  useEffect(() => {
    setActiveToolTab(initialTool);
  }, [initialTool]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Compress options
  const [audioBitrate, setAudioBitrate] = useState(128);

  // Trim options
  const [trimStart, setTrimStart] = useState('00:00:00');
  const [trimEnd, setTrimEnd] = useState('00:01:00');

  const tools = [
    { id: 'compress', label: 'Compress', icon: '📦' },
    { id: 'trim', label: 'Trim', icon: '✂️' },
    { id: 'merge', label: 'Merge', icon: '🔗' }
  ];

  // Handle single file selection
  const handleSelectFile = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const info = await window.electronAPI.getFileInfo(result.filePaths[0]);
      setSelectedFile(info);
    }
  }, []);

  // Handle multiple file selection for merge
  const handleSelectFiles = useCallback(async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.openFile({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const files = await Promise.all(
        result.filePaths.map(async (path) => {
          const info = await window.electronAPI.getFileInfo(path);
          return info;
        })
      );
      setSelectedFiles(files);
    }
  }, []);

  // Get output path
  const getOutputPath = (suffix, ext = null) => {
    if (!selectedFile) return '';
    const inputPath = selectedFile.path;
    const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
    const extension = ext || selectedFile.extension;
    return `${outputDir}/${baseName}_${suffix}.${extension}`;
  };

  // Handle compress
  const handleCompress = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath('compressed');
      const result = await window.electronAPI.compressAudio({
        inputPath: selectedFile.path,
        outputPath,
        bitrate: audioBitrate
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Audio file compressed!');
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
  }, [selectedFile, audioBitrate]);

  // Handle trim
  const handleTrim = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const outputPath = getOutputPath('trimmed');
      const result = await window.electronAPI.trimAudio({
        inputPath: selectedFile.path,
        outputPath,
        startTime: trimStart,
        endTime: trimEnd
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Audio file trimmed!');
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
  }, [selectedFile, trimStart, trimEnd]);

  // Handle visual trim process (from AudioTrimTool)
  const handleTrimProcess = useCallback(async (trimParams) => {
    if (!window.electronAPI) return;

    let inputPath = selectedFile?.path;
    let fileName = selectedFile?.name;

    if (trimParams.localFile && trimParams.localFile.path) {
      inputPath = trimParams.localFile.path;
      fileName = trimParams.localFile.name;
    }

    if (!inputPath) {
      alert('Please select an audio file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const outputDir = inputPath.substring(0, Math.max(inputPath.lastIndexOf('\\'), inputPath.lastIndexOf('/')));
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const ext = fileName.split('.').pop();
      const outputPath = `${outputDir}/${baseName}_trimmed.${ext}`;

      const result = await window.electronAPI.trimAudio({
        inputPath,
        outputPath,
        startTime: formatSecondsToTime(trimParams.startTime),
        endTime: formatSecondsToTime(trimParams.endTime)
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath || outputPath);
        alert('Audio file trimmed!');
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

  // Format seconds to time string (HH:MM:SS)
  const formatSecondsToTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Handle merge
  const handleMerge = useCallback(async () => {
    if (selectedFiles.length < 2 || !window.electronAPI) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const firstFile = selectedFiles[0];
      const outputDir = firstFile.path.substring(0, Math.max(firstFile.path.lastIndexOf('\\'), firstFile.path.lastIndexOf('/')));
      const outputPath = `${outputDir}/merged_audio_${Date.now()}.${firstFile.extension}`;

      const result = await window.electronAPI.mergeAudio({
        files: selectedFiles.map(f => f.path),
        outputPath
      });

      if (result?.success) {
        setProgress(100);
        await window.electronAPI.showInFolder(result.outputPath);
        alert('Audio files merged!');
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
  }, [selectedFiles]);

  const clearFile = () => setSelectedFile(null);
  const clearFiles = () => setSelectedFiles([]);

  const renderToolContent = () => {
    switch (activeToolTab) {
      case 'compress':
        return (
          <div className="tool-content">
            <h3>Compress Audio</h3>
            <p>Reduce the file size of your audio.</p>

            {selectedFile && (
              <div className="compress-options">
                <div className="option-group">
                  <label>Bit Rate: {audioBitrate} kbps</label>
                  <input
                    type="range"
                    min="64"
                    max="320"
                    step="32"
                    value={audioBitrate}
                    onChange={(e) => setAudioBitrate(parseInt(e.target.value))}
                  />
                </div>
                <div className="bitrate-presets">
                  <button className={audioBitrate === 64 ? 'active' : ''} onClick={() => setAudioBitrate(64)}>64 kbps</button>
                  <button className={audioBitrate === 128 ? 'active' : ''} onClick={() => setAudioBitrate(128)}>128 kbps</button>
                  <button className={audioBitrate === 192 ? 'active' : ''} onClick={() => setAudioBitrate(192)}>192 kbps</button>
                  <button className={audioBitrate === 256 ? 'active' : ''} onClick={() => setAudioBitrate(256)}>256 kbps</button>
                  <button className={audioBitrate === 320 ? 'active' : ''} onClick={() => setAudioBitrate(320)}>320 kbps</button>
                </div>
                <p className="hint">
                  {audioBitrate >= 256 ? 'High quality' :
                   audioBitrate >= 128 ? 'Standard quality' : 'Low quality, smaller size'}
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

      case 'trim':
        return (
          <div className="tool-content trim-tool-content">
            <h3>Trim Audio</h3>
            <p>Cut a specific portion of the audio file - with waveform.</p>

            <AudioTrimTool
              selectedFile={selectedFile}
              onProcess={(trimParams) => handleTrimProcess(trimParams)}
              isProcessing={isProcessing}
              progress={progress}
            />
          </div>
        );

      case 'merge':
        return (
          <div className="tool-content">
            <h3>Merge Audio</h3>
            <p>Combine multiple audio files into one.</p>

            <button className="select-files-btn" onClick={handleSelectFiles} disabled={isProcessing}>
              {selectedFiles.length > 0 ? 'Add More' : 'Select Audio Files'}
            </button>

            {selectedFiles.length > 0 && (
              <div className="selected-files-list">
                <div className="files-header">
                  <span>{selectedFiles.length} files selected</span>
                  <button className="clear-all-btn" onClick={clearFiles}>Clear</button>
                </div>
                <ul>
                  {selectedFiles.map((file, index) => (
                    <li key={index}>
                      <span className="file-icon">🎵</span>
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              className="action-btn primary"
              onClick={handleMerge}
              disabled={selectedFiles.length < 2 || isProcessing}
            >
              {isProcessing ? `Merging... ${progress}%` : 'Merge'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="audio-tools-panel">
      <div className="tools-header">
        <h1>Audio Tools</h1>
        <p>Edit your audio files</p>
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
        {activeToolTab !== 'merge' && (
          <>
            <button className="select-files-btn" onClick={handleSelectFile} disabled={isProcessing}>
              {selectedFile ? 'Select Different Audio' : 'Select Audio File'}
            </button>

            {selectedFile && (
              <div className="selected-file-info">
                <div className="file-details">
                  <span className="file-icon">🎵</span>
                  <div>
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button className="clear-btn" onClick={clearFile}>✕</button>
                </div>
              </div>
            )}
          </>
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

export default AudioToolsPanel;
