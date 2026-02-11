import React, { useState, useEffect } from 'react';
import './TimestampConverterPanel.css';

function TimestampConverterPanel() {
  const [timestamp, setTimestamp] = useState('');
  const [date, setDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize with current timestamp
  useEffect(() => {
    const now = new Date();
    setTimestamp(Math.floor(now.getTime() / 1000).toString());
    setDate(now);
  }, []);

  const handleTimestampChange = (value) => {
    setTimestamp(value);
    if (value) {
      // Check if it's milliseconds or seconds
      const num = parseInt(value);
      if (!isNaN(num)) {
        // If number is too large for seconds (after year 3000), treat as milliseconds
        const ms = num > 32503680000 ? num : num * 1000;
        setDate(new Date(ms));
      }
    }
  };

  const handleDateChange = (field, value) => {
    const newDate = new Date(date);

    switch (field) {
      case 'year':
        newDate.setFullYear(parseInt(value) || 2024);
        break;
      case 'month':
        newDate.setMonth((parseInt(value) || 1) - 1);
        break;
      case 'day':
        newDate.setDate(parseInt(value) || 1);
        break;
      case 'hour':
        newDate.setHours(parseInt(value) || 0);
        break;
      case 'minute':
        newDate.setMinutes(parseInt(value) || 0);
        break;
      case 'second':
        newDate.setSeconds(parseInt(value) || 0);
        break;
      default:
        break;
    }

    setDate(newDate);
    setTimestamp(Math.floor(newDate.getTime() / 1000).toString());
  };

  const setToNow = () => {
    const now = new Date();
    setDate(now);
    setTimestamp(Math.floor(now.getTime() / 1000).toString());
  };

  const copyValue = (value) => {
    navigator.clipboard.writeText(value);
  };

  // Format date in various formats
  const formats = {
    'Unix Timestamp (s)': Math.floor(date.getTime() / 1000).toString(),
    'Unix Timestamp (ms)': date.getTime().toString(),
    'ISO 8601': date.toISOString(),
    'RFC 2822': date.toUTCString(),
    'Local Date': date.toLocaleDateString(),
    'Local Time': date.toLocaleTimeString(),
    'Local DateTime': date.toLocaleString(),
    'UTC Date': date.toUTCString(),
    'Date Only': date.toISOString().split('T')[0],
    'Time Only': date.toISOString().split('T')[1].split('.')[0]
  };

  // Common timestamps
  const commonDates = [
    { name: 'Unix Epoch', timestamp: 0 },
    { name: 'Y2K', timestamp: 946684800 },
    { name: 'Year 2038 Problem', timestamp: 2147483647 },
    { name: 'Start of Today', timestamp: Math.floor(new Date().setHours(0, 0, 0, 0) / 1000) },
    { name: 'End of Today', timestamp: Math.floor(new Date().setHours(23, 59, 59, 999) / 1000) }
  ];

  return (
    <div className="timestamp-panel">
      <div className="panel-header">
        <h2>Timestamp Converter</h2>
        <p>Convert between Unix timestamps and human-readable dates</p>
      </div>

      <div className="timestamp-content">
        {/* Current Time Display */}
        <div className="current-time-section">
          <div className="current-time-display">
            <span className="current-label">Current Time</span>
            <span className="current-value">{currentTime.toLocaleString()}</span>
            <span className="current-timestamp">{Math.floor(currentTime.getTime() / 1000)}</span>
          </div>
        </div>

        {/* Main Converter */}
        <div className="converter-section">
          <div className="timestamp-input-section">
            <div className="section-header">
              <h3>Unix Timestamp</h3>
              <button className="now-btn" onClick={setToNow}>
                Now
              </button>
            </div>
            <div className="timestamp-input-wrapper">
              <input
                type="number"
                value={timestamp}
                onChange={(e) => handleTimestampChange(e.target.value)}
                placeholder="Enter Unix timestamp"
                className="timestamp-input"
              />
              <button
                className="copy-btn"
                onClick={() => copyValue(timestamp)}
              >
                Copy
              </button>
            </div>
            <span className="input-hint">Enter timestamp in seconds or milliseconds</span>
          </div>

          <div className="arrow-divider">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
            </svg>
          </div>

          <div className="date-input-section">
            <h3>Date & Time</h3>
            <div className="date-inputs">
              <div className="date-input-group">
                <label>Year</label>
                <input
                  type="number"
                  value={date.getFullYear()}
                  onChange={(e) => handleDateChange('year', e.target.value)}
                  min="1970"
                  max="2100"
                />
              </div>
              <div className="date-input-group">
                <label>Month</label>
                <input
                  type="number"
                  value={date.getMonth() + 1}
                  onChange={(e) => handleDateChange('month', e.target.value)}
                  min="1"
                  max="12"
                />
              </div>
              <div className="date-input-group">
                <label>Day</label>
                <input
                  type="number"
                  value={date.getDate()}
                  onChange={(e) => handleDateChange('day', e.target.value)}
                  min="1"
                  max="31"
                />
              </div>
              <div className="date-input-group">
                <label>Hour</label>
                <input
                  type="number"
                  value={date.getHours()}
                  onChange={(e) => handleDateChange('hour', e.target.value)}
                  min="0"
                  max="23"
                />
              </div>
              <div className="date-input-group">
                <label>Minute</label>
                <input
                  type="number"
                  value={date.getMinutes()}
                  onChange={(e) => handleDateChange('minute', e.target.value)}
                  min="0"
                  max="59"
                />
              </div>
              <div className="date-input-group">
                <label>Second</label>
                <input
                  type="number"
                  value={date.getSeconds()}
                  onChange={(e) => handleDateChange('second', e.target.value)}
                  min="0"
                  max="59"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Output Formats */}
        <div className="formats-section">
          <h3>Output Formats</h3>
          <div className="formats-grid">
            {Object.entries(formats).map(([name, value]) => (
              <div key={name} className="format-item">
                <span className="format-name">{name}</span>
                <div className="format-value-wrapper">
                  <code className="format-value">{value}</code>
                  <button
                    className="copy-btn small"
                    onClick={() => copyValue(value)}
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Common Timestamps */}
        <div className="common-section">
          <h3>Common Timestamps</h3>
          <div className="common-grid">
            {commonDates.map((item) => (
              <button
                key={item.name}
                className="common-item"
                onClick={() => handleTimestampChange(item.timestamp.toString())}
              >
                <span className="common-name">{item.name}</span>
                <span className="common-timestamp">{item.timestamp}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Difference */}
        <div className="difference-section">
          <h3>Time Difference from Now</h3>
          <div className="difference-display">
            {(() => {
              const diff = date.getTime() - currentTime.getTime();
              const absDiff = Math.abs(diff);
              const seconds = Math.floor(absDiff / 1000);
              const minutes = Math.floor(seconds / 60);
              const hours = Math.floor(minutes / 60);
              const days = Math.floor(hours / 24);
              const years = Math.floor(days / 365);

              let display = '';
              if (years > 0) display = `${years} year${years > 1 ? 's' : ''}`;
              else if (days > 0) display = `${days} day${days > 1 ? 's' : ''}`;
              else if (hours > 0) display = `${hours} hour${hours > 1 ? 's' : ''}`;
              else if (minutes > 0) display = `${minutes} minute${minutes > 1 ? 's' : ''}`;
              else display = `${seconds} second${seconds !== 1 ? 's' : ''}`;

              return (
                <>
                  <span className={`difference-value ${diff > 0 ? 'future' : 'past'}`}>
                    {display}
                  </span>
                  <span className="difference-label">
                    {diff > 0 ? 'in the future' : 'in the past'}
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimestampConverterPanel;
