import React, { useState, useEffect, useCallback } from 'react';
import './ColorConverterPanel.css';

// Color conversion functions
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
};

const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        h = 0;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

const hslToRgb = (h, s, l) => {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
};

const rgbToCmyk = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const k = 1 - Math.max(r, g, b);

  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100)
  };
};

const cmykToRgb = (c, m, y, k) => {
  c /= 100;
  m /= 100;
  y /= 100;
  k /= 100;

  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k))
  };
};

// Preset colors
const presetColors = [
  { name: 'Red', hex: '#FF0000' },
  { name: 'Green', hex: '#00FF00' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Cyan', hex: '#00FFFF' },
  { name: 'Magenta', hex: '#FF00FF' },
  { name: 'Orange', hex: '#FF8000' },
  { name: 'Purple', hex: '#8000FF' },
  { name: 'Pink', hex: '#FF80C0' },
  { name: 'Lime', hex: '#80FF00' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Olive', hex: '#808000' },
  { name: 'Gray', hex: '#808080' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
  { name: 'Coral', hex: '#FF7F50' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Indigo', hex: '#4B0082' }
];

function ColorConverterPanel() {
  const [hex, setHex] = useState('#3B82F6');
  const [rgb, setRgb] = useState({ r: 59, g: 130, b: 246 });
  const [hsl, setHsl] = useState({ h: 217, s: 91, l: 60 });
  const [cmyk, setCmyk] = useState({ c: 76, m: 47, y: 0, k: 4 });
  const [activeInput, setActiveInput] = useState(null);

  const updateFromRgb = useCallback((r, g, b, source) => {
    const newHex = rgbToHex(r, g, b);
    const newHsl = rgbToHsl(r, g, b);
    const newCmyk = rgbToCmyk(r, g, b);

    if (source !== 'hex') setHex(newHex);
    if (source !== 'rgb') setRgb({ r, g, b });
    if (source !== 'hsl') setHsl(newHsl);
    if (source !== 'cmyk') setCmyk(newCmyk);
  }, []);

  const handleHexChange = (value) => {
    setHex(value);
    setActiveInput('hex');

    const normalized = value.startsWith('#') ? value : '#' + value;
    const rgbResult = hexToRgb(normalized);

    if (rgbResult) {
      updateFromRgb(rgbResult.r, rgbResult.g, rgbResult.b, 'hex');
    }
  };

  const handleRgbChange = (component, value) => {
    const newRgb = { ...rgb, [component]: parseInt(value) || 0 };
    setRgb(newRgb);
    setActiveInput('rgb');
    updateFromRgb(newRgb.r, newRgb.g, newRgb.b, 'rgb');
  };

  const handleHslChange = (component, value) => {
    const newHsl = { ...hsl, [component]: parseInt(value) || 0 };
    setHsl(newHsl);
    setActiveInput('hsl');

    const rgbResult = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
    updateFromRgb(rgbResult.r, rgbResult.g, rgbResult.b, 'hsl');
  };

  const handleCmykChange = (component, value) => {
    const newCmyk = { ...cmyk, [component]: parseInt(value) || 0 };
    setCmyk(newCmyk);
    setActiveInput('cmyk');

    const rgbResult = cmykToRgb(newCmyk.c, newCmyk.m, newCmyk.y, newCmyk.k);
    updateFromRgb(rgbResult.r, rgbResult.g, rgbResult.b, 'cmyk');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const selectPreset = (presetHex) => {
    handleHexChange(presetHex);
  };

  // Generate color strings for copying
  const colorStrings = {
    hex: hex,
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    rgba: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`,
    hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    cmyk: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`
  };

  return (
    <div className="color-converter-panel">
      <div className="panel-header">
        <h2>Color Converter</h2>
        <p>Convert between HEX, RGB, HSL, and CMYK color formats</p>
      </div>

      <div className="color-content">
        {/* Color Preview */}
        <div className="color-preview-section">
          <div
            className="color-preview"
            style={{ backgroundColor: hex }}
          >
            <input
              type="color"
              value={hex}
              onChange={(e) => handleHexChange(e.target.value)}
              className="color-picker-input"
            />
          </div>
          <div className="color-info">
            <span className="color-name">Selected Color</span>
            <span className="color-value">{hex}</span>
          </div>
        </div>

        {/* Color Inputs */}
        <div className="color-inputs">
          {/* HEX */}
          <div className="color-input-group">
            <div className="input-header">
              <label>HEX</label>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(colorStrings.hex)}
                title="Copy HEX"
              >
                Copy
              </button>
            </div>
            <input
              type="text"
              value={hex}
              onChange={(e) => handleHexChange(e.target.value)}
              className="hex-input"
              placeholder="#000000"
            />
          </div>

          {/* RGB */}
          <div className="color-input-group">
            <div className="input-header">
              <label>RGB</label>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(colorStrings.rgb)}
                title="Copy RGB"
              >
                Copy
              </button>
            </div>
            <div className="multi-input">
              <div className="input-with-label">
                <span>R</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.r}
                  onChange={(e) => handleRgbChange('r', e.target.value)}
                />
              </div>
              <div className="input-with-label">
                <span>G</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.g}
                  onChange={(e) => handleRgbChange('g', e.target.value)}
                />
              </div>
              <div className="input-with-label">
                <span>B</span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.b}
                  onChange={(e) => handleRgbChange('b', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* HSL */}
          <div className="color-input-group">
            <div className="input-header">
              <label>HSL</label>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(colorStrings.hsl)}
                title="Copy HSL"
              >
                Copy
              </button>
            </div>
            <div className="multi-input">
              <div className="input-with-label">
                <span>H</span>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={hsl.h}
                  onChange={(e) => handleHslChange('h', e.target.value)}
                />
              </div>
              <div className="input-with-label">
                <span>S%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={hsl.s}
                  onChange={(e) => handleHslChange('s', e.target.value)}
                />
              </div>
              <div className="input-with-label">
                <span>L%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={hsl.l}
                  onChange={(e) => handleHslChange('l', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CMYK */}
          <div className="color-input-group">
            <div className="input-header">
              <label>CMYK</label>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(colorStrings.cmyk)}
                title="Copy CMYK"
              >
                Copy
              </button>
            </div>
            <div className="multi-input cmyk">
              <div className="input-with-label">
                <span>C%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={cmyk.c}
                  onChange={(e) => handleCmykChange('c', e.target.value)}
                />
              </div>
              <div className="input-with-label">
                <span>M%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={cmyk.m}
                  onChange={(e) => handleCmykChange('m', e.target.value)}
                />
              </div>
              <div className="input-with-label">
                <span>Y%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={cmyk.y}
                  onChange={(e) => handleCmykChange('y', e.target.value)}
                />
              </div>
              <div className="input-with-label">
                <span>K%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={cmyk.k}
                  onChange={(e) => handleCmykChange('k', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preset Colors */}
        <div className="preset-colors">
          <h3>Preset Colors</h3>
          <div className="preset-grid">
            {presetColors.map((color) => (
              <button
                key={color.hex}
                className="preset-color"
                style={{ backgroundColor: color.hex }}
                onClick={() => selectPreset(color.hex)}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* CSS Output */}
        <div className="css-output">
          <h3>CSS Values</h3>
          <div className="css-values">
            {Object.entries(colorStrings).map(([format, value]) => (
              <div key={format} className="css-value-item">
                <code>{value}</code>
                <button
                  className="copy-btn small"
                  onClick={() => copyToClipboard(value)}
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ColorConverterPanel;
