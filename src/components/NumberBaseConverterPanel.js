import React, { useState, useEffect } from 'react';
import './NumberBaseConverterPanel.css';

const bases = {
  binary: { name: 'Binary', base: 2, prefix: '0b', placeholder: '1010' },
  octal: { name: 'Octal', base: 8, prefix: '0o', placeholder: '12' },
  decimal: { name: 'Decimal', base: 10, prefix: '', placeholder: '10' },
  hexadecimal: { name: 'Hexadecimal', base: 16, prefix: '0x', placeholder: 'A' }
};

function NumberBaseConverterPanel() {
  const [values, setValues] = useState({
    binary: '',
    octal: '',
    decimal: '',
    hexadecimal: ''
  });
  const [activeInput, setActiveInput] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const validateInput = (value, base) => {
    if (!value) return true;
    const cleanValue = value.replace(/\s/g, '');

    switch (base) {
      case 2:
        return /^[01]+$/.test(cleanValue);
      case 8:
        return /^[0-7]+$/.test(cleanValue);
      case 10:
        return /^-?\d+$/.test(cleanValue);
      case 16:
        return /^[0-9A-Fa-f]+$/.test(cleanValue);
      default:
        return false;
    }
  };

  const convertFromBase = (value, fromBase) => {
    if (!value) {
      setValues({
        binary: '',
        octal: '',
        decimal: '',
        hexadecimal: ''
      });
      setError('');
      return;
    }

    const cleanValue = value.replace(/\s/g, '');

    if (!validateInput(cleanValue, fromBase)) {
      setError(`Invalid ${Object.keys(bases).find(k => bases[k].base === fromBase)} number`);
      return;
    }

    setError('');

    try {
      // Convert to decimal first
      const decimalValue = parseInt(cleanValue, fromBase);

      if (isNaN(decimalValue)) {
        setError('Invalid number');
        return;
      }

      // Convert from decimal to all bases
      const newValues = {
        binary: decimalValue.toString(2),
        octal: decimalValue.toString(8),
        decimal: decimalValue.toString(10),
        hexadecimal: decimalValue.toString(16).toUpperCase()
      };

      setValues(newValues);
    } catch (e) {
      setError('Conversion error');
    }
  };

  const handleInputChange = (key, value) => {
    setActiveInput(key);
    setValues(prev => ({ ...prev, [key]: value }));
    convertFromBase(value, bases[key].base);
  };

  const copyValue = (key) => {
    navigator.clipboard.writeText(values[key]);
  };

  const copyWithPrefix = (key) => {
    const prefix = bases[key].prefix;
    navigator.clipboard.writeText(prefix + values[key]);
  };

  const addToHistory = () => {
    if (values.decimal && !history.some(h => h.decimal === values.decimal)) {
      setHistory(prev => [{ ...values }, ...prev.slice(0, 9)]);
    }
  };

  const loadFromHistory = (item) => {
    setValues(item);
  };

  const clearAll = () => {
    setValues({
      binary: '',
      octal: '',
      decimal: '',
      hexadecimal: ''
    });
    setError('');
    setActiveInput(null);
  };

  // Format binary with spaces every 4 digits
  const formatBinary = (value) => {
    if (!value) return '';
    const padded = value.padStart(Math.ceil(value.length / 4) * 4, '0');
    return padded.match(/.{4}/g).join(' ');
  };

  return (
    <div className="number-base-panel">
      <div className="panel-header">
        <h2>Number Base Converter</h2>
        <p>Convert between binary, octal, decimal, and hexadecimal</p>
      </div>

      <div className="number-content">
        {/* Main Converter */}
        <div className="converter-grid">
          {Object.entries(bases).map(([key, config]) => (
            <div key={key} className={`base-input-group ${activeInput === key ? 'active' : ''}`}>
              <div className="base-header">
                <label>{config.name}</label>
                <span className="base-indicator">Base {config.base}</span>
              </div>
              <div className="input-wrapper">
                {config.prefix && <span className="prefix">{config.prefix}</span>}
                <input
                  type="text"
                  value={values[key]}
                  onChange={(e) => handleInputChange(key, e.target.value.toUpperCase())}
                  placeholder={config.placeholder}
                  className={`base-input ${config.prefix ? 'has-prefix' : ''}`}
                />
                <div className="input-actions">
                  <button
                    className="action-btn"
                    onClick={() => copyValue(key)}
                    title="Copy value"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  {config.prefix && (
                    <button
                      className="action-btn"
                      onClick={() => copyWithPrefix(key)}
                      title={`Copy with ${config.prefix} prefix`}
                    >
                      {config.prefix}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

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

        {/* Actions */}
        <div className="panel-actions">
          <button className="primary-btn" onClick={addToHistory} disabled={!values.decimal}>
            Save to History
          </button>
          <button className="secondary-btn" onClick={clearAll}>
            Clear All
          </button>
        </div>

        {/* Formatted Display */}
        {values.binary && (
          <div className="formatted-section">
            <h3>Formatted Binary</h3>
            <div className="formatted-binary">
              <code>{formatBinary(values.binary)}</code>
              <button
                className="copy-formatted"
                onClick={() => navigator.clipboard.writeText(formatBinary(values.binary))}
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Bit Information */}
        {values.decimal && (
          <div className="bit-info">
            <h3>Bit Information</h3>
            <div className="bit-grid">
              <div className="bit-item">
                <span className="bit-value">{values.binary.length}</span>
                <span className="bit-label">Bits</span>
              </div>
              <div className="bit-item">
                <span className="bit-value">{Math.ceil(values.binary.length / 8)}</span>
                <span className="bit-label">Bytes</span>
              </div>
              <div className="bit-item">
                <span className="bit-value">{values.hexadecimal.length}</span>
                <span className="bit-label">Hex Digits</span>
              </div>
              <div className="bit-item">
                <span className="bit-value">{parseInt(values.decimal) >= 0 ? 'Positive' : 'Negative'}</span>
                <span className="bit-label">Sign</span>
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="history-section">
            <h3>History</h3>
            <div className="history-list">
              {history.map((item, index) => (
                <button
                  key={index}
                  className="history-item"
                  onClick={() => loadFromHistory(item)}
                >
                  <span className="history-decimal">{item.decimal}</span>
                  <span className="history-hex">0x{item.hexadecimal}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Reference */}
        <div className="reference-section">
          <h3>Quick Reference</h3>
          <div className="reference-table">
            <div className="ref-header">
              <span>Dec</span>
              <span>Bin</span>
              <span>Oct</span>
              <span>Hex</span>
            </div>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n => (
              <div key={n} className="ref-row">
                <span>{n}</span>
                <span>{n.toString(2).padStart(4, '0')}</span>
                <span>{n.toString(8)}</span>
                <span>{n.toString(16).toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NumberBaseConverterPanel;
