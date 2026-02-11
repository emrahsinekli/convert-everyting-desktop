import React, { useState } from 'react';
import './EncodingConverterPanel.css';

// HTML entities mapping
const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

const encodingTypes = {
  base64: {
    name: 'Base64',
    icon: '🔤',
    encode: (text) => {
      try {
        return btoa(unescape(encodeURIComponent(text)));
      } catch (e) {
        return 'Error: Invalid input for Base64 encoding';
      }
    },
    decode: (text) => {
      try {
        return decodeURIComponent(escape(atob(text)));
      } catch (e) {
        return 'Error: Invalid Base64 string';
      }
    }
  },
  url: {
    name: 'URL Encoding',
    icon: '🔗',
    encode: (text) => {
      try {
        return encodeURIComponent(text);
      } catch (e) {
        return 'Error: Invalid input for URL encoding';
      }
    },
    decode: (text) => {
      try {
        return decodeURIComponent(text);
      } catch (e) {
        return 'Error: Invalid URL encoded string';
      }
    }
  },
  html: {
    name: 'HTML Entities',
    icon: '📄',
    encode: (text) => {
      return text.replace(/[&<>"'`=\/]/g, (char) => htmlEntities[char] || char);
    },
    decode: (text) => {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      return textarea.value;
    }
  },
  unicode: {
    name: 'Unicode Escape',
    icon: '🌐',
    encode: (text) => {
      return text.split('').map(char => {
        const code = char.charCodeAt(0);
        if (code > 127) {
          return '\\u' + code.toString(16).padStart(4, '0');
        }
        return char;
      }).join('');
    },
    decode: (text) => {
      try {
        return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
          String.fromCharCode(parseInt(code, 16))
        );
      } catch (e) {
        return 'Error: Invalid Unicode escape sequence';
      }
    }
  },
  hex: {
    name: 'Hex Encoding',
    icon: '🔢',
    encode: (text) => {
      return text.split('').map(char =>
        char.charCodeAt(0).toString(16).padStart(2, '0')
      ).join(' ');
    },
    decode: (text) => {
      try {
        const hexArray = text.replace(/\s+/g, ' ').trim().split(' ');
        return hexArray.map(hex => String.fromCharCode(parseInt(hex, 16))).join('');
      } catch (e) {
        return 'Error: Invalid Hex string';
      }
    }
  },
  binary: {
    name: 'Binary (Text)',
    icon: '💻',
    encode: (text) => {
      return text.split('').map(char =>
        char.charCodeAt(0).toString(2).padStart(8, '0')
      ).join(' ');
    },
    decode: (text) => {
      try {
        const binaryArray = text.replace(/\s+/g, ' ').trim().split(' ');
        return binaryArray.map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
      } catch (e) {
        return 'Error: Invalid Binary string';
      }
    }
  },
  rot13: {
    name: 'ROT13',
    icon: '🔄',
    encode: (text) => {
      return text.replace(/[a-zA-Z]/g, (char) => {
        const base = char <= 'Z' ? 65 : 97;
        return String.fromCharCode((char.charCodeAt(0) - base + 13) % 26 + base);
      });
    },
    decode: (text) => {
      // ROT13 is self-inverse
      return text.replace(/[a-zA-Z]/g, (char) => {
        const base = char <= 'Z' ? 65 : 97;
        return String.fromCharCode((char.charCodeAt(0) - base + 13) % 26 + base);
      });
    }
  },
  morse: {
    name: 'Morse Code',
    icon: '📡',
    encode: (text) => {
      const morseCode = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
        'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
        'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
        'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
        '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
        '8': '---..', '9': '----.', ' ': '/', '.': '.-.-.-', ',': '--..--',
        '?': '..--..', '!': '-.-.--', "'": '.----.', '/': '-..-.'
      };
      return text.toUpperCase().split('').map(char => morseCode[char] || char).join(' ');
    },
    decode: (text) => {
      const reverseMorse = {
        '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
        '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
        '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
        '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
        '-.--': 'Y', '--..': 'Z', '-----': '0', '.----': '1', '..---': '2',
        '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7',
        '---..': '8', '----.': '9', '/': ' ', '.-.-.-': '.', '--..--': ',',
        '..--..': '?', '-.-.--': '!', '.----.': "'", '-..-.': '/'
      };
      return text.split(' ').map(code => reverseMorse[code] || code).join('');
    }
  }
};

function EncodingConverterPanel() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [selectedEncoding, setSelectedEncoding] = useState('base64');
  const [mode, setMode] = useState('encode'); // 'encode' or 'decode'

  const handleConvert = () => {
    const encoding = encodingTypes[selectedEncoding];
    const result = mode === 'encode'
      ? encoding.encode(inputText)
      : encoding.decode(inputText);
    setOutputText(result);
  };

  const handleEncodingChange = (encodingKey) => {
    setSelectedEncoding(encodingKey);
    if (inputText) {
      const encoding = encodingTypes[encodingKey];
      const result = mode === 'encode'
        ? encoding.encode(inputText)
        : encoding.decode(inputText);
      setOutputText(result);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (inputText) {
      const encoding = encodingTypes[selectedEncoding];
      const result = newMode === 'encode'
        ? encoding.encode(inputText)
        : encoding.decode(inputText);
      setOutputText(result);
    }
  };

  const handleInputChange = (value) => {
    setInputText(value);
    const encoding = encodingTypes[selectedEncoding];
    const result = mode === 'encode'
      ? encoding.encode(value)
      : encoding.decode(value);
    setOutputText(result);
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(outputText);
  };

  const clearAll = () => {
    setInputText('');
    setOutputText('');
  };

  const swapTexts = () => {
    setInputText(outputText);
    setOutputText(inputText);
    setMode(mode === 'encode' ? 'decode' : 'encode');
  };

  return (
    <div className="encoding-converter-panel">
      <div className="panel-header">
        <h2>Encoding Converter</h2>
        <p>Encode and decode text using various encoding methods</p>
      </div>

      <div className="encoding-content">
        {/* Encoding Type Selection */}
        <div className="encoding-types">
          <h3>Encoding Type</h3>
          <div className="encoding-grid">
            {Object.entries(encodingTypes).map(([key, encoding]) => (
              <button
                key={key}
                className={`encoding-btn ${selectedEncoding === key ? 'active' : ''}`}
                onClick={() => handleEncodingChange(key)}
              >
                <span className="encoding-icon">{encoding.icon}</span>
                <span className="encoding-name">{encoding.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'encode' ? 'active' : ''}`}
            onClick={() => handleModeChange('encode')}
          >
            Encode
          </button>
          <button
            className={`mode-btn ${mode === 'decode' ? 'active' : ''}`}
            onClick={() => handleModeChange('decode')}
          >
            Decode
          </button>
        </div>

        {/* Text Areas */}
        <div className="encoding-areas">
          <div className="text-area-container">
            <div className="text-area-header">
              <label>{mode === 'encode' ? 'Plain Text' : 'Encoded Text'}</label>
              <button className="clear-btn" onClick={clearAll}>Clear</button>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={mode === 'encode' ? 'Enter text to encode...' : 'Enter encoded text to decode...'}
              className="encoding-input"
            />
          </div>

          <div className="encoding-actions">
            <button className="action-btn swap" onClick={swapTexts} title="Swap and reverse">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
              </svg>
            </button>
          </div>

          <div className="text-area-container">
            <div className="text-area-header">
              <label>{mode === 'encode' ? 'Encoded Text' : 'Plain Text'}</label>
              <button className="copy-btn" onClick={copyOutput}>Copy</button>
            </div>
            <textarea
              value={outputText}
              readOnly
              placeholder="Result will appear here..."
              className="encoding-output"
            />
          </div>
        </div>

        {/* Info Section */}
        <div className="encoding-info">
          <h3>About {encodingTypes[selectedEncoding].name}</h3>
          <div className="info-content">
            {selectedEncoding === 'base64' && (
              <p>Base64 is a binary-to-text encoding scheme that represents binary data in ASCII string format. Commonly used for encoding data in emails and web applications.</p>
            )}
            {selectedEncoding === 'url' && (
              <p>URL encoding converts characters into a format that can be transmitted over the Internet. Special characters are replaced with a "%" followed by hex digits.</p>
            )}
            {selectedEncoding === 'html' && (
              <p>HTML entity encoding converts special characters to their HTML entity equivalents, preventing XSS attacks and ensuring proper display in browsers.</p>
            )}
            {selectedEncoding === 'unicode' && (
              <p>Unicode escape sequences represent characters using their Unicode code points. Format: \uXXXX where XXXX is a 4-digit hex number.</p>
            )}
            {selectedEncoding === 'hex' && (
              <p>Hexadecimal encoding represents each byte as two hex digits (00-FF). Useful for representing binary data in a readable format.</p>
            )}
            {selectedEncoding === 'binary' && (
              <p>Binary encoding represents each character as its 8-bit binary equivalent. Useful for understanding how text is stored in computers.</p>
            )}
            {selectedEncoding === 'rot13' && (
              <p>ROT13 is a simple letter substitution cipher that rotates each letter by 13 positions. Applying ROT13 twice returns the original text.</p>
            )}
            {selectedEncoding === 'morse' && (
              <p>Morse code represents letters and numbers using dots and dashes. Originally used in telegraphy, it remains useful for signaling.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EncodingConverterPanel;
