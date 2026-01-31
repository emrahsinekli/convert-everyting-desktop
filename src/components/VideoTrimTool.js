import React, { useState, useRef, useEffect, useCallback } from 'react';

function VideoTrimTool({ selectedFile, onProcess, isProcessing, progress }) {
  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const fileInputRef = useRef(null);

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState(null);
  const [localFile, setLocalFile] = useState(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Trim range (in seconds)
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  // Dragging state
  const [isDragging, setIsDragging] = useState(null); // 'start', 'end', 'playhead', or null

  // Handle local file selection
  const handleLocalFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }
      const url = URL.createObjectURL(file);
      setLocalVideoUrl(url);
      setLocalFile(file);
      setVideoLoaded(false);
      setVideoError(false);
      setStartTime(0);
      setEndTime(0);
      setCurrentTime(0);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }
    };
  }, [localVideoUrl]);

  // Video loaded
  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      setDuration(video.duration);
      setEndTime(video.duration);
      setVideoLoaded(true);
      setVideoError(false);
    }
  }, []);

  // Video error
  const handleVideoError = () => {
    setVideoError(true);
    setVideoLoaded(false);
  };

  // Time update
  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      setCurrentTime(videoRef.current.currentTime);

      // Stop at end time
      if (videoRef.current.currentTime >= endTime) {
        videoRef.current.pause();
        videoRef.current.currentTime = startTime;
        setIsPlaying(false);
      }
    }
  };

  // Play/Pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        if (videoRef.current.currentTime < startTime || videoRef.current.currentTime >= endTime) {
          videoRef.current.currentTime = startTime;
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Format time
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Parse time string to seconds
  const parseTime = (timeStr) => {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      const [h, m, rest] = parts;
      const [s, ms] = rest.split('.');
      return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + (parseInt(ms || 0) / 100);
    }
    return 0;
  };

  // Timeline mouse handlers
  const handleTimelineMouseDown = (e, type) => {
    e.preventDefault();
    setIsDragging(type);
  };

  const handleTimelineMouseMove = useCallback((e) => {
    if (!isDragging || !timelineRef.current || duration === 0) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const time = percent * duration;

    if (isDragging === 'start') {
      const newStart = Math.max(0, Math.min(time, endTime - 0.5));
      setStartTime(newStart);
      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
        setCurrentTime(newStart);
      }
    } else if (isDragging === 'end') {
      const newEnd = Math.max(startTime + 0.5, Math.min(time, duration));
      setEndTime(newEnd);
    } else if (isDragging === 'playhead') {
      const newTime = Math.max(0, Math.min(time, duration));
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    }
  }, [isDragging, duration, startTime, endTime]);

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleTimelineMouseMove);
      window.addEventListener('mouseup', handleTimelineMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleTimelineMouseMove);
        window.removeEventListener('mouseup', handleTimelineMouseUp);
      };
    }
  }, [isDragging, handleTimelineMouseMove, handleTimelineMouseUp]);

  // Click on timeline to seek
  const handleTimelineClick = (e) => {
    if (!timelineRef.current || duration === 0 || isDragging) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;

    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Handle time input changes
  const handleStartTimeChange = (value) => {
    const time = parseTime(value);
    if (!isNaN(time) && time >= 0 && time < endTime) {
      setStartTime(time);
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
    }
  };

  const handleEndTimeChange = (value) => {
    const time = parseTime(value);
    if (!isNaN(time) && time > startTime && time <= duration) {
      setEndTime(time);
    }
  };

  // Preview selected segment
  const previewSegment = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Trim handler
  const handleTrim = () => {
    if (onProcess) {
      onProcess({
        startTime,
        endTime,
        localFile
      });
    }
  };

  const hasVideo = localVideoUrl || (selectedFile && selectedFile.path);
  const videoSrc = localVideoUrl || (selectedFile?.path ? `file:///${selectedFile.path.replace(/\\/g, '/')}` : null);
  const trimDuration = endTime - startTime;

  return (
    <div className="video-trim-tool">
      <div className="trim-preview-section">
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
          <div className="trim-video-wrapper">
            <video
              ref={videoRef}
              src={videoSrc}
              onLoadedMetadata={handleVideoLoaded}
              onError={handleVideoError}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              muted={false}
              playsInline
              style={{ display: videoLoaded ? 'block' : 'none' }}
            />

            {!videoLoaded && !videoError && (
              <div className="video-loading">
                <span>Loading video...</span>
              </div>
            )}

            {videoError && (
              <div className="video-error">
                <p>Failed to load video</p>
                <button onClick={() => fileInputRef.current?.click()}>
                  Select Different Video
                </button>
              </div>
            )}

            {videoLoaded && (
              <>
                {/* Playback Controls */}
                <div className="playback-controls">
                  <button className="play-btn" onClick={togglePlay}>
                    {isPlaying ? (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    )}
                  </button>
                  <span className="current-time">{formatTime(currentTime)}</span>
                  <span className="time-separator">/</span>
                  <span className="total-time">{formatTime(duration)}</span>
                </div>

                {/* Timeline */}
                <div className="trim-timeline-container">
                  <div
                    className="trim-timeline"
                    ref={timelineRef}
                    onClick={handleTimelineClick}
                  >
                    {/* Progress bar */}
                    <div
                      className="timeline-progress"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />

                    {/* Selected range */}
                    <div
                      className="timeline-range"
                      style={{
                        left: `${(startTime / duration) * 100}%`,
                        width: `${((endTime - startTime) / duration) * 100}%`
                      }}
                    />

                    {/* Start handle */}
                    <div
                      className="timeline-handle start"
                      style={{ left: `${(startTime / duration) * 100}%` }}
                      onMouseDown={(e) => handleTimelineMouseDown(e, 'start')}
                    >
                      <div className="handle-bar" />
                    </div>

                    {/* End handle */}
                    <div
                      className="timeline-handle end"
                      style={{ left: `${(endTime / duration) * 100}%` }}
                      onMouseDown={(e) => handleTimelineMouseDown(e, 'end')}
                    >
                      <div className="handle-bar" />
                    </div>

                    {/* Playhead */}
                    <div
                      className="timeline-playhead"
                      style={{ left: `${(currentTime / duration) * 100}%` }}
                      onMouseDown={(e) => handleTimelineMouseDown(e, 'playhead')}
                    />
                  </div>

                  {/* Time markers */}
                  <div className="timeline-markers">
                    <span>00:00</span>
                    <span>{formatTime(duration / 4).substring(0, 8)}</span>
                    <span>{formatTime(duration / 2).substring(0, 8)}</span>
                    <span>{formatTime(duration * 3 / 4).substring(0, 8)}</span>
                    <span>{formatTime(duration).substring(0, 8)}</span>
                  </div>
                </div>

                {/* Change video button */}
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
              </>
            )}
          </div>
        )}
      </div>

      <div className="trim-controls-section">
        <div className="trim-info-card">
          <div className="info-row">
            <span className="info-label">Selected Duration</span>
            <span className="info-value highlight">{formatTime(trimDuration)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Original Duration</span>
            <span className="info-value">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="trim-time-inputs">
          <div className="time-input-group">
            <label>START</label>
            <div className="time-input-wrapper">
              <input
                type="text"
                value={formatTime(startTime)}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                disabled={!videoLoaded}
              />
              <button
                className="set-current-btn"
                onClick={() => setStartTime(currentTime)}
                disabled={!videoLoaded}
                title="Set current position"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </button>
            </div>
          </div>

          <div className="time-input-group">
            <label>END</label>
            <div className="time-input-wrapper">
              <input
                type="text"
                value={formatTime(endTime)}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                disabled={!videoLoaded}
              />
              <button
                className="set-current-btn"
                onClick={() => setEndTime(currentTime)}
                disabled={!videoLoaded}
                title="Set current position"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <button
          className="preview-btn"
          onClick={previewSegment}
          disabled={!videoLoaded || isProcessing}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          Preview Selection
        </button>

        <button
          className="action-btn primary trim-btn"
          onClick={handleTrim}
          disabled={!videoLoaded || isProcessing || trimDuration <= 0}
        >
          {isProcessing ? `Trimming... ${progress}%` : 'Trim Video'}
        </button>
      </div>
    </div>
  );
}

export default VideoTrimTool;
