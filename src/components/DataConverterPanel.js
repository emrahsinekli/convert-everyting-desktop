import React, { useState, useEffect, useCallback } from 'react';
import './DataConverterPanel.css';

// Simple CSV parser
const parseCSV = (csv) => {
  const lines = csv.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    result.push(obj);
  }

  return result;
};

// Convert array to CSV
const toCSV = (data) => {
  if (!Array.isArray(data) || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape values that contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
};

// Simple XML parser (basic implementation)
const parseXML = (xml) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const parseNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim();
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const obj = {};
        const children = Array.from(node.childNodes).filter(
          n => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim())
        );

        if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
          return children[0].textContent.trim();
        }

        children.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const key = child.nodeName;
            const value = parseNode(child);

            if (obj[key]) {
              if (!Array.isArray(obj[key])) {
                obj[key] = [obj[key]];
              }
              obj[key].push(value);
            } else {
              obj[key] = value;
            }
          }
        });

        return obj;
      }

      return null;
    };

    const root = doc.documentElement;
    return { [root.nodeName]: parseNode(root) };
  } catch (e) {
    throw new Error('Invalid XML');
  }
};

// Convert object to XML
const toXML = (data, indent = 0) => {
  const spaces = '  '.repeat(indent);

  if (typeof data !== 'object' || data === null) {
    return String(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => toXML(item, indent)).join('\n');
  }

  let xml = '';
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          xml += `${spaces}<${key}>\n${toXML(item, indent + 1)}${spaces}</${key}>\n`;
        } else {
          xml += `${spaces}<${key}>${item}</${key}>\n`;
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      xml += `${spaces}<${key}>\n${toXML(value, indent + 1)}${spaces}</${key}>\n`;
    } else {
      xml += `${spaces}<${key}>${value}</${key}>\n`;
    }
  }

  return xml;
};

// Simple YAML parser (basic implementation)
const parseYAML = (yaml) => {
  const lines = yaml.split('\n');
  const result = {};
  const stack = [{ indent: -1, obj: result }];

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2].trim();
    let value = match[3].trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Find the parent object
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (value === '' || value === null) {
      // This key will have nested values
      parent[key] = {};
      stack.push({ indent, obj: parent[key] });
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Array notation
      parent[key] = value.slice(1, -1).split(',').map(v => v.trim());
    } else if (value === 'true') {
      parent[key] = true;
    } else if (value === 'false') {
      parent[key] = false;
    } else if (!isNaN(value) && value !== '') {
      parent[key] = Number(value);
    } else {
      parent[key] = value;
    }
  }

  return result;
};

// Convert object to YAML
const toYAML = (data, indent = 0) => {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  if (typeof data !== 'object' || data === null) {
    return String(data);
  }

  if (Array.isArray(data)) {
    return '[' + data.join(', ') + ']';
  }

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n${toYAML(value, indent + 1)}`;
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}: [${value.join(', ')}]\n`;
    } else if (typeof value === 'string' && (value.includes(':') || value.includes('#'))) {
      yaml += `${spaces}${key}: "${value}"\n`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
};

const formats = ['JSON', 'CSV', 'XML', 'YAML'];

const sampleData = {
  JSON: `[
  { "name": "John", "age": 30, "city": "New York" },
  { "name": "Jane", "age": 25, "city": "London" }
]`,
  CSV: `name,age,city
John,30,New York
Jane,25,London`,
  XML: `<people>
  <person>
    <name>John</name>
    <age>30</age>
    <city>New York</city>
  </person>
  <person>
    <name>Jane</name>
    <age>25</age>
    <city>London</city>
  </person>
</people>`,
  YAML: `people:
  - name: John
    age: 30
    city: New York
  - name: Jane
    age: 25
    city: London`
};

function DataConverterPanel() {
  const [inputFormat, setInputFormat] = useState('JSON');
  const [outputFormat, setOutputFormat] = useState('CSV');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [error, setError] = useState('');

  const convert = useCallback(() => {
    setError('');

    if (!inputText.trim()) {
      setOutputText('');
      return;
    }

    try {
      let data;

      // Parse input
      switch (inputFormat) {
        case 'JSON':
          data = JSON.parse(inputText);
          break;
        case 'CSV':
          data = parseCSV(inputText);
          break;
        case 'XML':
          data = parseXML(inputText);
          break;
        case 'YAML':
          data = parseYAML(inputText);
          break;
        default:
          throw new Error('Unknown input format');
      }

      // Convert to output format
      let result;
      switch (outputFormat) {
        case 'JSON':
          result = JSON.stringify(data, null, 2);
          break;
        case 'CSV':
          // If data is not an array, try to extract array from it
          let arrayData = data;
          if (!Array.isArray(data)) {
            const keys = Object.keys(data);
            if (keys.length === 1 && Array.isArray(data[keys[0]])) {
              arrayData = data[keys[0]];
            } else {
              arrayData = [data];
            }
          }
          result = toCSV(arrayData);
          break;
        case 'XML':
          result = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n' + toXML(data, 1) + '</root>';
          break;
        case 'YAML':
          result = toYAML(data);
          break;
        default:
          throw new Error('Unknown output format');
      }

      setOutputText(result);
    } catch (e) {
      setError(`Conversion error: ${e.message}`);
      setOutputText('');
    }
  }, [inputText, inputFormat, outputFormat]);

  // Auto-convert when input text, input format, or output format changes
  useEffect(() => {
    convert();
  }, [convert]);

  const loadSample = () => {
    setInputText(sampleData[inputFormat]);
    setError('');
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(outputText);
  };

  const clearAll = () => {
    setInputText('');
    setOutputText('');
    setError('');
  };

  const swapFormats = () => {
    const temp = inputFormat;
    setInputFormat(outputFormat);
    setOutputFormat(temp);
    setInputText(outputText);
    setOutputText('');
  };

  return (
    <div className="data-converter-panel">
      <div className="panel-header">
        <h2>Data Converter</h2>
        <p>Convert between JSON, CSV, XML, and YAML formats</p>
      </div>

      <div className="data-content">
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
                  {format}
                </button>
              ))}
            </div>
          </div>

          <button className="swap-btn" onClick={swapFormats} title="Swap formats">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
            </svg>
          </button>

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
                  {format}
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
          <button className="action-btn" onClick={clearAll}>
            Clear All
          </button>
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

        {/* Text Areas */}
        <div className="data-areas">
          <div className="data-area-container">
            <div className="data-area-header">
              <label>Input ({inputFormat})</label>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Paste your ${inputFormat} data here...`}
              className="data-input"
              spellCheck={false}
            />
          </div>

          <div className="data-area-container">
            <div className="data-area-header">
              <label>Output ({outputFormat})</label>
              <button className="copy-btn" onClick={copyOutput} disabled={!outputText}>
                Copy
              </button>
            </div>
            <textarea
              value={outputText}
              readOnly
              placeholder="Converted data will appear here..."
              className="data-output"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Tips */}
        <div className="tips-section">
          <h3>Tips</h3>
          <ul>
            <li><strong>JSON:</strong> Standard JavaScript Object Notation. Arrays and objects are supported.</li>
            <li><strong>CSV:</strong> First row should contain headers. Values are comma-separated.</li>
            <li><strong>XML:</strong> Hierarchical data format. Root element is required.</li>
            <li><strong>YAML:</strong> Human-readable data format. Uses indentation for structure.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DataConverterPanel;
