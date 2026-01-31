import React, { useState, useCallback, useRef, useEffect } from 'react';

function FileDropZone({ onFilesSelected, selectedFiles, disabled, acceptedExtensions }) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [thumbnails, setThumbnails] = useState({});
  const fileInputRef = useRef(null);

  // Load thumbnails for image files
  useEffect(() => {
    const loadThumbnails = async () => {
      if (!window.electronAPI) return;

      const newThumbnails = { ...thumbnails };
      let hasChanges = false;

      for (const file of selectedFiles) {
        if (!newThumbnails[file.path] && isImageFile(file.name)) {
          try {
            const thumbnail = await window.electronAPI.getThumbnail(file.path);
            if (thumbnail) {
              newThumbnails[file.path] = thumbnail;
              hasChanges = true;
            }
          } catch (err) {
            console.error('Failed to load thumbnail:', err);
          }
        }
      }

      if (hasChanges) {
        setThumbnails(newThumbnails);
      }
    };

    loadThumbnails();
  }, [selectedFiles]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    let files = Array.from(e.dataTransfer.files).map(file => ({
      name: file.name,
      path: file.path,
      size: file.size,
      type: file.type
    }));

    // Filter by accepted extensions if specified
    if (acceptedExtensions && acceptedExtensions.length > 0) {
      files = files.filter(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        return acceptedExtensions.includes(ext);
      });
    }

    if (files.length > 0) {
      onFilesSelected([...selectedFiles, ...files]);
    }
  }, [disabled, onFilesSelected, selectedFiles, acceptedExtensions]);

  const handleClick = useCallback(async () => {
    if (disabled) return;

    if (window.electronAPI) {
      // Build file filters based on acceptedExtensions
      const filters = acceptedExtensions && acceptedExtensions.length > 0
        ? [{ name: `Supported Files (${acceptedExtensions.map(e => '.' + e).join(', ')})`, extensions: acceptedExtensions }]
        : [{ name: 'All Files', extensions: ['*'] }];

      const result = await window.electronAPI.openFile({
        filters: filters
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const files = result.filePaths.map(filePath => ({
          name: filePath.split(/[/\\]/).pop(),
          path: filePath,
          size: 0,
          type: ''
        }));
        onFilesSelected(files);
      }
    }
  }, [disabled, onFilesSelected, acceptedExtensions]);

  // Add more files
  const handleAddFiles = useCallback(async (e) => {
    e.stopPropagation();
    if (disabled) return;

    if (window.electronAPI) {
      // Build file filters based on acceptedExtensions
      const filters = acceptedExtensions && acceptedExtensions.length > 0
        ? [{ name: `Supported Files (${acceptedExtensions.map(e => '.' + e).join(', ')})`, extensions: acceptedExtensions }]
        : [{ name: 'All Files', extensions: ['*'] }];

      const result = await window.electronAPI.openFile({
        filters: filters
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const newFiles = result.filePaths.map(filePath => ({
          name: filePath.split(/[/\\]/).pop(),
          path: filePath,
          size: 0,
          type: ''
        }));
        onFilesSelected([...selectedFiles, ...newFiles]);
      }
    }
  }, [disabled, onFilesSelected, selectedFiles, acceptedExtensions]);

  // Remove single file
  const handleRemoveFile = useCallback((e, index) => {
    e.stopPropagation();
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
  }, [selectedFiles, onFilesSelected]);

  // Clear all files
  const handleClearAll = useCallback((e) => {
    e.stopPropagation();
    onFilesSelected([]);
  }, [onFilesSelected]);

  // Drag reorder handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOverItem = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFiles = [...selectedFiles];
    const draggedItem = newFiles[draggedIndex];
    newFiles.splice(draggedIndex, 1);
    newFiles.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    onFilesSelected(newFiles);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];
    const docExts = ['pdf', 'docx', 'doc', 'txt', 'html', 'md'];

    if (videoExts.includes(ext)) return '🎬';
    if (audioExts.includes(ext)) return '🎵';
    if (imageExts.includes(ext)) return '🖼️';
    if (docExts.includes(ext)) return '📄';
    return '📁';
  };

  const getFileCategory = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'wmv', 'flv'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];

    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (imageExts.includes(ext)) return 'image';
    return 'document';
  };

  const isImageFile = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'].includes(ext);
  };

  return (
    <div className="dropzone-container">
      {selectedFiles.length === 0 ? (
        <div
          className={`dropzone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <div className="dropzone-content">
            <div className="dropzone-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3>Drag files here</h3>
            <p>or click to select</p>
          </div>
        </div>
      ) : (
        <div
          className={`file-manager ${isDragging ? 'dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Header */}
          <div className="file-manager-header">
            <div className="header-left">
              <h3>
                <span className="file-count">{selectedFiles.length}</span>
                files selected
              </h3>
              {selectedFiles.length > 1 && (
                <span className="reorder-hint">Drag to reorder</span>
              )}
            </div>
            <div className="header-actions">
              <button className="add-files-btn" onClick={handleAddFiles} disabled={disabled}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add More
              </button>
              <button className="clear-all-btn" onClick={handleClearAll} disabled={disabled}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="m19 6-2 14H7L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
                Clear
              </button>
            </div>
          </div>

          {/* File List */}
          <div className="file-list-grid">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.path}-${index}`}
                className={`file-card ${draggedIndex === index ? 'dragging' : ''} ${getFileCategory(file.name)}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOverItem(e, index)}
              >
                {/* Order Number */}
                <div className="file-order">{index + 1}</div>

                {/* Thumbnail */}
                <div className="file-thumbnail">
                  {isImageFile(file.name) && thumbnails[file.path] ? (
                    <img
                      src={thumbnails[file.path]}
                      alt={file.name}
                    />
                  ) : (
                    <div className="file-icon-large">
                      {getFileIcon(file.name)}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="file-details">
                  <span className="file-name" title={file.name}>
                    {file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name}
                  </span>
                  <span className="file-ext">.{file.name.split('.').pop().toUpperCase()}</span>
                  {file.size > 0 && (
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  className="remove-file-btn"
                  onClick={(e) => handleRemoveFile(e, index)}
                  title="Remove file"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                {/* Drag Handle */}
                <div className="drag-handle" title="Drag to reorder">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                  </svg>
                </div>
              </div>
            ))}

            {/* Add More Card */}
            <div className="file-card add-card" onClick={handleAddFiles}>
              <div className="add-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span>Add File</span>
            </div>
          </div>

          {/* Drop Zone Hint */}
          {isDragging && (
            <div className="drop-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Drop files here</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FileDropZone;
