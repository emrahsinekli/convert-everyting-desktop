import React, { useState, useRef, useEffect, useCallback } from 'react';

function AudioTrimTool({ selectedFile, onProcess, isProcessing, progress }) {
  const audioRef = useRef(null);
  const timelineRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [localAudioUrl, setLocalAudioUrl] = useState(null);
  const [localFile, setLocalFile] = useState(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Trim range (in seconds)
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  // Dragging state
  const [isDragging, setIsDragging] = useState(null);

  // Waveform data
  const [waveformData, setWaveformData] = useState([]);

  // Handle local file selection
  const handleLocalFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
      }
      const url = URL.createObjectURL(file);
      setLocalAudioUrl(url);
      setLocalFile(file);
      setAudioLoaded(false);
      setAudioError(false);
      setStartTime(0);
      setEndTime(0);
      setCurrentTime(0);
      setWaveformData([]);

      // Generate waveform
      generateWaveform(file);
    }
  };

  // Generate waveform from audio file
  const generateWaveform = async (file) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const rawData = audioBuffer.getChannelData(0);
      const samples = 200;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData = [];

      for (let i = 0; i < samples; i++) {
        let blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }

      // Normalize
      const multiplier = Math.pow(Math.max(...filteredData), -1);
      const normalizedData = filteredData.map(n => n * multiplier);

      setWaveformData(normalizedData);
      audioContext.close();
    } catch (error) {
      console.error('Waveform generation failed:', error);
      // Generate fake waveform as fallback
      const fakeData = Array.from({ length: 200 }, () => Math.random() * 0.5 + 0.2);
      setWaveformData(fakeData);
    }
  };

  // Draw waveform on canvas
  useEffect(() => {
    if (canvasRef.current && waveformData.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = width / waveformData.length;
      const startPercent = startTime / duration;
      const endPercent = endTime / duration;

      waveformData.forEach((value, index) => {
        const x = index * barWidth;
        const barHeight = value * height * 0.8;
        const y = (height - barHeight) / 2;

        const percent = index / waveformData.length;
        const isInRange = percent >= startPercent && percent <= endPercent;

        ctx.fillStyle = isInRange ? '#6366f1' : '#3a3a55';
        ctx.fillRect(x, y, barWidth - 1, barHeight);
      });
    }
  }, [waveformData, startTime, endTime, duration]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (localAudioUrl) {
        URL.revokeObjectURL(localAudioUrl);
      }
    };
  }, [localAudioUrl]);

  // Audio loaded
  const handleAudioLoaded = useCallback(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      setDuration(audio.duration);
      setEndTime(audio.duration);
      setAudioLoaded(true);
      setAudioError(false);
    }
  }, []);

  // Audio error
  const handleAudioError = () => {
    setAudioError(true);
    setAudioLoaded(false);
  };

  // Time update
  const handleTimeUpdate = () => {
    if (audioRef.current && !isDragging) {
      setCurrentTime(audioRef.current.currentTime);

      if (audioRef.current.currentTime >= endTime) {
        audioRef.current.pause();
        audioRef.current.currentTime = startTime;
        setIsPlaying(false);
      }
    }
  };

  // Play/Pause
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (audioRef.current.currentTime < startTime || audioRef.current.currentTime >= endTime) {
          audioRef.current.currentTime = startTime;
        }
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Format time
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00:00.00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Parse time string
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
      if (audioRef.current) {
        audioRef.current.currentTime = newStart;
        setCurrentTime(newStart);
      }
    } else if (isDragging === 'end') {
      const newEnd = Math.max(startTime + 0.5, Math.min(time, duration));
      setEndTime(newEnd);
    } else if (isDragging === 'playhead') {
      const newTime = Math.max(0, Math.min(time, duration));
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
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

  // Click on timeline
  const handleTimelineClick = (e) => {
    if (!timelineRef.current || duration === 0 || isDragging) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;

    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Handle time input changes
  const handleStartTimeChange = (value) => {
    const time = parseTime(value);
    if (!isNaN(time) && time >= 0 && time < endTime) {
      setStartTime(time);
      if (audioRef.current) {
        audioRef.current.currentTime = time;
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

  // Preview segment
  const previewSegment = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
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

  const hasAudio = localAudioUrl || (selectedFile && selectedFile.path);
  const audioSrc = localAudioUrl || (selectedFile?.path ? `file:///${selectedFile.path.replace(/\\/g, '/')}` : null);
  const trimDuration = endTime - startTime;

  return (
    <div className="audio-trim-tool">
      <div className="audio-preview-section">
        {!hasAudio ? (
          <div className="audio-select-prompt">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLocalFileSelect}
              accept="audio/*"
              style={{ display: 'none' }}
            />
            <div className="select-audio-box" onClick={() => fileInputRef.current?.click()}>
              <span className="select-icon">🎵</span>
              <p>Click to select audio file</p>
              <span className="supported-formats">MP3, WAV, FLAC, AAC, OGG</span>
            </div>
          </div>
        ) : (
          <div className="audio-player-wrapper">
            <audio
              ref={audioRef}
              src={audioSrc}
              onLoadedMetadata={handleAudioLoaded}
              onError={handleAudioError}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              style={{ display: 'none' }}
            />

            {!audioLoaded && !audioError && (
              <div className="audio-loading">
                <span>Loading audio file...</span>
              </div>
            )}

            {audioError && (
              <div className="audio-error">
                <p>Failed to load audio file</p>
                <button onClick={() => fileInputRef.current?.click()}>
                  Select Different Audio
                </button>
              </div>
            )}

            {audioLoaded && (
              <>
                {/* Waveform Display */}
                <div className="waveform-container">
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={120}
                    className="waveform-canvas"
                  />
                  <div className="waveform-overlay">
                    <div
                      className="waveform-range"
                      style={{
                        left: `${(startTime / duration) * 100}%`,
                        width: `${((endTime - startTime) / duration) * 100}%`
                      }}
                    />
                    <div
                      className="waveform-playhead"
                      style={{ left: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="audio-playback-controls">
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
                <div className="audio-timeline-container">
                  <div
                    className="audio-timeline"
                    ref={timelineRef}
                    onClick={handleTimelineClick}
                  >
                    <div
                      className="timeline-progress"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
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

                  <div className="timeline-markers">
                    <span>00:00</span>
                    <span>{formatTime(duration / 4).substring(0, 8)}</span>
                    <span>{formatTime(duration / 2).substring(0, 8)}</span>
                    <span>{formatTime(duration * 3 / 4).substring(0, 8)}</span>
                    <span>{formatTime(duration).substring(0, 8)}</span>
                  </div>
                </div>

                {/* Change audio button */}
                <div className="change-audio-btn-container">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLocalFileSelect}
                    accept="audio/*"
                    style={{ display: 'none' }}
                  />
                  <button className="change-audio-btn" onClick={() => fileInputRef.current?.click()}>
                    Select Different Audio
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="audio-controls-section">
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
                disabled={!audioLoaded}
              />
              <button
                className="set-current-btn"
                onClick={() => setStartTime(currentTime)}
                disabled={!audioLoaded}
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
                disabled={!audioLoaded}
              />
              <button
                className="set-current-btn"
                onClick={() => setEndTime(currentTime)}
                disabled={!audioLoaded}
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
          disabled={!audioLoaded || isProcessing}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          Preview Selection
        </button>

        <button
          className="action-btn primary trim-btn"
          onClick={handleTrim}
          disabled={!audioLoaded || isProcessing || trimDuration <= 0}
        >
          {isProcessing ? `Trimming... ${progress}%` : 'Trim Audio'}
        </button>
      </div>
    </div>
  );
}

export default AudioTrimTool;
