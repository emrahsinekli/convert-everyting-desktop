import React, { useState } from 'react';
import './SubtitleConverterPanel.css';

// Time format helpers
const timeToMs = (time) => {
  const parts = time.split(/[:,.]/);
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseInt(parts[2]) || 0;
  const ms = parseInt(parts[3]) || 0;
  return (hours * 3600000) + (minutes * 60000) + (seconds * 1000) + ms;
};

const msToSrtTime = (ms) => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
};

const msToVttTime = (ms) => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
};

const msToAssTime = (ms) => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
};

// Parse SRT format
const parseSRT = (text) => {
  const subtitles = [];
  const blocks = text.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    const timeLine = lines[1];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.]?\d*)\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]?\d*)/);

    if (!timeMatch) continue;

    const startTime = timeToMs(timeMatch[1].replace('.', ','));
    const endTime = timeToMs(timeMatch[2].replace('.', ','));
    const text = lines.slice(2).join('\n');

    subtitles.push({ index, startTime, endTime, text });
  }

  return subtitles;
};

// Parse VTT format
const parseVTT = (text) => {
  const subtitles = [];
  // Remove WEBVTT header and metadata
  const content = text.replace(/^WEBVTT[^\n]*\n+/, '').replace(/NOTE[^\n]*\n+/g, '');
  const blocks = content.trim().split(/\n\n+/);

  let index = 1;
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;

    // Find the time line
    let timeLineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    const timeLine = lines[timeLineIndex];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[.,]?\d*)\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]?\d*)/);

    if (!timeMatch) continue;

    const startTime = timeToMs(timeMatch[1].replace(',', '.'));
    const endTime = timeToMs(timeMatch[2].replace(',', '.'));
    const subtitleText = lines.slice(timeLineIndex + 1).join('\n');

    subtitles.push({ index: index++, startTime, endTime, text: subtitleText });
  }

  return subtitles;
};

// Parse ASS/SSA format
const parseASS = (text) => {
  const subtitles = [];
  const lines = text.split('\n');

  let index = 1;
  for (const line of lines) {
    if (line.startsWith('Dialogue:')) {
      const parts = line.substring(9).split(',');
      if (parts.length >= 10) {
        const startTime = timeToMs(parts[1].trim().replace('.', ':'));
        const endTime = timeToMs(parts[2].trim().replace('.', ':'));
        const subtitleText = parts.slice(9).join(',').replace(/\\N/g, '\n').replace(/{[^}]*}/g, '');

        subtitles.push({ index: index++, startTime, endTime, text: subtitleText.trim() });
      }
    }
  }

  return subtitles;
};

// Convert to SRT
const toSRT = (subtitles) => {
  return subtitles.map((sub, i) => {
    return `${i + 1}\n${msToSrtTime(sub.startTime)} --> ${msToSrtTime(sub.endTime)}\n${sub.text}`;
  }).join('\n\n');
};

// Convert to VTT
const toVTT = (subtitles) => {
  const vttContent = subtitles.map((sub) => {
    return `${msToVttTime(sub.startTime)} --> ${msToVttTime(sub.endTime)}\n${sub.text}`;
  }).join('\n\n');

  return `WEBVTT\n\n${vttContent}`;
};

// Convert to ASS
const toASS = (subtitles) => {
  const header = `[Script Info]
Title: Converted Subtitle
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = subtitles.map((sub) => {
    const text = sub.text.replace(/\n/g, '\\N');
    return `Dialogue: 0,${msToAssTime(sub.startTime)},${msToAssTime(sub.endTime)},Default,,0,0,0,,${text}`;
  }).join('\n');

  return `${header}\n${events}`;
};

// Convert to SUB (MicroDVD format - frame-based, assuming 25fps)
const toSUB = (subtitles, fps = 25) => {
  return subtitles.map((sub) => {
    const startFrame = Math.floor(sub.startTime * fps / 1000);
    const endFrame = Math.floor(sub.endTime * fps / 1000);
    const text = sub.text.replace(/\n/g, '|');
    return `{${startFrame}}{${endFrame}}${text}`;
  }).join('\n');
};

const formats = ['SRT', 'VTT', 'ASS', 'SUB'];

const sampleSubtitle = `1
00:00:01,000 --> 00:00:04,000
Hello, welcome to the video!

2
00:00:05,000 --> 00:00:08,000
This is a sample subtitle file.

3
00:00:09,000 --> 00:00:12,000
You can convert between different formats.`;

function SubtitleConverterPanel() {
  const [inputFormat, setInputFormat] = useState('SRT');
  const [outputFormat, setOutputFormat] = useState('VTT');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [error, setError] = useState('');
  const [subtitleCount, setSubtitleCount] = useState(0);

  const convert = () => {
    setError('');

    if (!inputText.trim()) {
      setOutputText('');
      setSubtitleCount(0);
      return;
    }

    try {
      let subtitles;

      // Parse input
      switch (inputFormat) {
        case 'SRT':
          subtitles = parseSRT(inputText);
          break;
        case 'VTT':
          subtitles = parseVTT(inputText);
          break;
        case 'ASS':
          subtitles = parseASS(inputText);
          break;
        case 'SUB':
          // SUB format parsing would need frame rate info
          throw new Error('SUB input parsing is not fully supported. Please use SRT, VTT, or ASS as input.');
        default:
          throw new Error('Unknown input format');
      }

      setSubtitleCount(subtitles.length);

      if (subtitles.length === 0) {
        throw new Error('No subtitles found in input');
      }

      // Convert to output format
      let result;
      switch (outputFormat) {
        case 'SRT':
          result = toSRT(subtitles);
          break;
        case 'VTT':
          result = toVTT(subtitles);
          break;
        case 'ASS':
          result = toASS(subtitles);
          break;
        case 'SUB':
          result = toSUB(subtitles);
          break;
        default:
          throw new Error('Unknown output format');
      }

      setOutputText(result);
    } catch (e) {
      setError(`Conversion error: ${e.message}`);
      setOutputText('');
    }
  };

  const loadSample = () => {
    setInputText(sampleSubtitle);
    setInputFormat('SRT');
    setError('');
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(outputText);
  };

  const clearAll = () => {
    setInputText('');
    setOutputText('');
    setError('');
    setSubtitleCount(0);
  };

  const downloadOutput = () => {
    if (!outputText) return;

    const extensions = { SRT: 'srt', VTT: 'vtt', ASS: 'ass', SUB: 'sub' };
    const blob = new Blob([outputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitle.${extensions[outputFormat]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="subtitle-converter-panel">
      <div className="panel-header">
        <h2>Subtitle Converter</h2>
        <p>Convert between SRT, VTT, ASS, and SUB subtitle formats</p>
      </div>

      <div className="subtitle-content">
        {/* Format Selection */}
        <div className="format-selection">
          <div className="format-group">
            <label>Input Format</label>
            <div className="format-buttons">
              {formats.map((format) => (
                <button
                  key={format}
                  className={`format-btn ${inputFormat === format ? 'active' : ''}`}
                  onClick={() => setInputFormat(format)}
                >
                  .{format.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="arrow-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>

          <div className="format-group">
            <label>Output Format</label>
            <div className="format-buttons">
              {formats.map((format) => (
                <button
                  key={format}
                  className={`format-btn ${outputFormat === format ? 'active' : ''}`}
                  onClick={() => setOutputFormat(format)}
                  disabled={format === inputFormat}
                >
                  .{format.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="converter-actions">
          <button className="action-btn primary" onClick={convert}>
            Convert
          </button>
          <button className="action-btn" onClick={loadSample}>
            Load Sample
          </button>
          <button className="action-btn" onClick={downloadOutput} disabled={!outputText}>
            Download
          </button>
          <button className="action-btn" onClick={clearAll}>
            Clear All
          </button>
        </div>

        {/* Status */}
        {subtitleCount > 0 && (
          <div className="status-message">
            Found {subtitleCount} subtitle{subtitleCount !== 1 ? 's' : ''} in input
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Text Areas */}
        <div className="subtitle-areas">
          <div className="subtitle-area-container">
            <div className="subtitle-area-header">
              <label>Input ({inputFormat})</label>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Paste your ${inputFormat} subtitle here...`}
              className="subtitle-input"
              spellCheck={false}
            />
          </div>

          <div className="subtitle-area-container">
            <div className="subtitle-area-header">
              <label>Output ({outputFormat})</label>
              <button className="copy-btn" onClick={copyOutput} disabled={!outputText}>
                Copy
              </button>
            </div>
            <textarea
              value={outputText}
              readOnly
              placeholder="Converted subtitle will appear here..."
              className="subtitle-output"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Format Info */}
        <div className="format-info">
          <h3>Format Information</h3>
          <div className="info-grid">
            <div className="info-card">
              <h4>.srt (SubRip)</h4>
              <p>Most common format. Simple text with timecodes.</p>
            </div>
            <div className="info-card">
              <h4>.vtt (WebVTT)</h4>
              <p>Web standard. Supports styling and positioning.</p>
            </div>
            <div className="info-card">
              <h4>.ass (Advanced SSA)</h4>
              <p>Advanced styling with colors, fonts, and effects.</p>
            </div>
            <div className="info-card">
              <h4>.sub (MicroDVD)</h4>
              <p>Frame-based format. Used with video files.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubtitleConverterPanel;
