import React, { useState } from 'react';
import './TextConverterPanel.css';

// Text transformation functions
const transformations = {
  uppercase: {
    name: 'UPPERCASE',
    description: 'Convert all letters to uppercase',
    transform: (text) => text.toUpperCase()
  },
  lowercase: {
    name: 'lowercase',
    description: 'Convert all letters to lowercase',
    transform: (text) => text.toLowerCase()
  },
  titleCase: {
    name: 'Title Case',
    description: 'Capitalize the first letter of each word',
    transform: (text) => text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
  },
  sentenceCase: {
    name: 'Sentence case',
    description: 'Capitalize the first letter of each sentence',
    transform: (text) => {
      return text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (char) => char.toUpperCase());
    }
  },
  camelCase: {
    name: 'camelCase',
    description: 'Convert to camelCase (for programming)',
    transform: (text) => {
      return text
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
        .replace(/^[A-Z]/, (char) => char.toLowerCase());
    }
  },
  pascalCase: {
    name: 'PascalCase',
    description: 'Convert to PascalCase (for programming)',
    transform: (text) => {
      return text
        .toLowerCase()
        .replace(/(?:^|[^a-zA-Z0-9]+)(.)/g, (_, char) => char.toUpperCase());
    }
  },
  snakeCase: {
    name: 'snake_case',
    description: 'Convert to snake_case (for programming)',
    transform: (text) => {
      return text
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    }
  },
  kebabCase: {
    name: 'kebab-case',
    description: 'Convert to kebab-case (for URLs)',
    transform: (text) => {
      return text
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
  },
  slug: {
    name: 'url-slug',
    description: 'Convert to URL-friendly slug',
    transform: (text) => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
  },
  alternatingCase: {
    name: 'aLtErNaTiNg',
    description: 'Alternate between upper and lowercase',
    transform: (text) => {
      return text
        .split('')
        .map((char, i) => (i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()))
        .join('');
    }
  },
  inverseCase: {
    name: 'iNVERSE cASE',
    description: 'Invert the case of each letter',
    transform: (text) => {
      return text
        .split('')
        .map((char) => {
          if (char === char.toUpperCase()) return char.toLowerCase();
          if (char === char.toLowerCase()) return char.toUpperCase();
          return char;
        })
        .join('');
    }
  },
  reverseText: {
    name: 'Reverse',
    description: 'Reverse the entire text',
    transform: (text) => text.split('').reverse().join('')
  },
  reverseWords: {
    name: 'Reverse Words',
    description: 'Reverse the order of words',
    transform: (text) => text.split(/\s+/).reverse().join(' ')
  },
  removeSpaces: {
    name: 'Remove Spaces',
    description: 'Remove all spaces from text',
    transform: (text) => text.replace(/\s+/g, '')
  },
  removeExtraSpaces: {
    name: 'Remove Extra Spaces',
    description: 'Replace multiple spaces with single space',
    transform: (text) => text.replace(/\s+/g, ' ').trim()
  },
  removeLineBreaks: {
    name: 'Remove Line Breaks',
    description: 'Replace line breaks with spaces',
    transform: (text) => text.replace(/\n+/g, ' ')
  },
  addLineNumbers: {
    name: 'Add Line Numbers',
    description: 'Add line numbers to each line',
    transform: (text) => {
      return text.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
    }
  }
};

function TextConverterPanel() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [selectedTransform, setSelectedTransform] = useState('uppercase');

  const handleTransform = (transformKey) => {
    setSelectedTransform(transformKey);
    const result = transformations[transformKey].transform(inputText);
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
    const temp = inputText;
    setInputText(outputText);
    setOutputText(temp);
  };

  // Calculate text statistics
  const stats = {
    characters: inputText.length,
    charactersNoSpaces: inputText.replace(/\s/g, '').length,
    words: inputText.trim() ? inputText.trim().split(/\s+/).length : 0,
    lines: inputText ? inputText.split('\n').length : 0,
    sentences: inputText.split(/[.!?]+/).filter(s => s.trim()).length
  };

  return (
    <div className="text-converter-panel">
      <div className="panel-header">
        <h2>Text Converter</h2>
        <p>Transform text with various case and formatting options</p>
      </div>

      <div className="text-content">
        {/* Transform Buttons */}
        <div className="transform-section">
          <h3>Transformations</h3>
          <div className="transform-grid">
            {Object.entries(transformations).map(([key, transform]) => (
              <button
                key={key}
                className={`transform-btn ${selectedTransform === key ? 'active' : ''}`}
                onClick={() => handleTransform(key)}
                title={transform.description}
              >
                {transform.name}
              </button>
            ))}
          </div>
        </div>

        {/* Text Areas */}
        <div className="text-areas">
          <div className="text-area-container">
            <div className="text-area-header">
              <label>Input Text</label>
              <span className="char-count">{inputText.length} characters</span>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                const result = transformations[selectedTransform].transform(e.target.value);
                setOutputText(result);
              }}
              placeholder="Enter or paste your text here..."
              className="text-input"
            />
          </div>

          <div className="text-actions">
            <button className="action-btn" onClick={swapTexts} title="Swap input and output">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
              </svg>
            </button>
            <button className="action-btn" onClick={clearAll} title="Clear all">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>

          <div className="text-area-container">
            <div className="text-area-header">
              <label>Output Text</label>
              <button className="copy-btn" onClick={copyOutput}>
                Copy
              </button>
            </div>
            <textarea
              value={outputText}
              readOnly
              placeholder="Transformed text will appear here..."
              className="text-output"
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="text-stats">
          <h3>Text Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats.characters}</span>
              <span className="stat-label">Characters</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.charactersNoSpaces}</span>
              <span className="stat-label">Without Spaces</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.words}</span>
              <span className="stat-label">Words</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.lines}</span>
              <span className="stat-label">Lines</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.sentences}</span>
              <span className="stat-label">Sentences</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TextConverterPanel;
