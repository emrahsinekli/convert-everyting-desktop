import React, { useState, useEffect, useCallback } from 'react';
import './HtmlBeautifierPanel.css';

// HTML Beautify function
const beautifyHtml = (html) => {
  if (!html.trim()) return '';

  let result = '';
  let indent = 0;
  const indentStr = '  ';

  // Self-closing / void tags
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);

  // Inline tags that shouldn't force newlines
  const inlineTags = new Set([
    'a', 'abbr', 'b', 'bdo', 'br', 'cite', 'code', 'dfn', 'em', 'i',
    'img', 'input', 'kbd', 'label', 'mark', 'q', 's', 'samp', 'small',
    'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr'
  ]);

  // Pre-process: normalize whitespace but preserve content in pre/code/script/style
  let processed = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Tokenize HTML
  const tokens = [];
  let pos = 0;

  while (pos < processed.length) {
    if (processed[pos] === '<') {
      // Check for comment
      if (processed.substr(pos, 4) === '<!--') {
        const endComment = processed.indexOf('-->', pos);
        if (endComment !== -1) {
          tokens.push({ type: 'comment', value: processed.substring(pos, endComment + 3) });
          pos = endComment + 3;
          continue;
        }
      }

      // Check for doctype
      if (processed.substr(pos, 9).toLowerCase() === '<!doctype') {
        const endDoctype = processed.indexOf('>', pos);
        if (endDoctype !== -1) {
          tokens.push({ type: 'doctype', value: processed.substring(pos, endDoctype + 1) });
          pos = endDoctype + 1;
          continue;
        }
      }

      // Regular tag
      const endTag = processed.indexOf('>', pos);
      if (endTag !== -1) {
        const tagContent = processed.substring(pos, endTag + 1);
        const isClosing = tagContent[1] === '/';
        const isSelfClosing = tagContent[tagContent.length - 2] === '/';
        const tagNameMatch = tagContent.match(/<\/?([a-zA-Z][a-zA-Z0-9-]*)/);
        const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : '';

        tokens.push({
          type: isClosing ? 'close' : (isSelfClosing || voidTags.has(tagName) ? 'void' : 'open'),
          value: tagContent,
          tagName: tagName,
          isInline: inlineTags.has(tagName)
        });
        pos = endTag + 1;
        continue;
      }
    }

    // Text content
    let nextTag = processed.indexOf('<', pos);
    if (nextTag === -1) nextTag = processed.length;
    const text = processed.substring(pos, nextTag);
    if (text.trim()) {
      tokens.push({ type: 'text', value: text.trim() });
    }
    pos = nextTag;
  }

  // Build output
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    switch (token.type) {
      case 'doctype':
      case 'comment':
        result += indentStr.repeat(indent) + token.value + '\n';
        break;
      case 'open':
        result += indentStr.repeat(indent) + token.value + '\n';
        indent++;
        break;
      case 'close':
        indent = Math.max(0, indent - 1);
        result += indentStr.repeat(indent) + token.value + '\n';
        break;
      case 'void':
        result += indentStr.repeat(indent) + token.value + '\n';
        break;
      case 'text':
        result += indentStr.repeat(indent) + token.value + '\n';
        break;
      default:
        break;
    }
  }

  return result.trim();
};

// HTML Minify function
const minifyHtml = (html) => {
  if (!html.trim()) return '';

  let result = html;

  // Remove comments
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // Remove whitespace between tags
  result = result.replace(/>\s+</g, '><');

  // Remove leading/trailing whitespace per line
  result = result.replace(/^\s+/gm, '');
  result = result.replace(/\s+$/gm, '');

  // Collapse multiple whitespace to single space
  result = result.replace(/\s{2,}/g, ' ');

  // Remove newlines
  result = result.replace(/\n/g, '');

  return result.trim();
};

const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sample Page</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  .container { max-width: 800px; margin: 0 auto; }
  h1 { color: #333; }
  .card { background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 12px 0; }
</style>
</head>
<body>
<div class="container">
<h1>Hello World</h1>
<p>This is a <strong>sample</strong> HTML page with some <em>formatting</em>.</p>
<div class="card">
<h2>Features</h2>
<ul>
<li>Beautify HTML</li>
<li>Minify HTML</li>
<li>Live Preview</li>
</ul>
</div>
<div class="card">
<h2>Links</h2>
<a href="https://example.com">Visit Example</a>
</div>
<img src="https://via.placeholder.com/400x200" alt="Placeholder">
<hr>
<footer>
<p>&copy; 2024 Sample Page</p>
</footer>
</div>
</body>
</html>`;

function HtmlBeautifierPanel() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [mode, setMode] = useState('beautify'); // 'beautify' or 'minify'
  const [showPreview, setShowPreview] = useState(true);
  const [indentSize, setIndentSize] = useState(2);
  const [stats, setStats] = useState({ inputSize: 0, outputSize: 0 });

  const convert = useCallback(() => {
    if (!inputText.trim()) {
      setOutputText('');
      setStats({ inputSize: 0, outputSize: 0 });
      return;
    }

    let result;
    if (mode === 'beautify') {
      result = beautifyHtml(inputText);
    } else {
      result = minifyHtml(inputText);
    }

    setOutputText(result);
    setStats({
      inputSize: new Blob([inputText]).size,
      outputSize: new Blob([result]).size
    });
  }, [inputText, mode, indentSize]);

  useEffect(() => {
    convert();
  }, [convert]);

  const loadSample = () => {
    setInputText(sampleHtml);
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(outputText);
  };

  const clearAll = () => {
    setInputText('');
    setOutputText('');
    setStats({ inputSize: 0, outputSize: 0 });
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const getSavingsPercent = () => {
    if (stats.inputSize === 0) return 0;
    return Math.round(((stats.inputSize - stats.outputSize) / stats.inputSize) * 100);
  };

  return (
    <div className="html-beautifier-panel">
      <div className="panel-header">
        <h2>HTML Beautifier & Viewer</h2>
        <p>Beautify, minify, and preview HTML code</p>
      </div>

      <div className="html-content">
        {/* Mode Selection */}
        <div className="mode-section">
          <div className="mode-tabs">
            <button
              className={`mode-tab ${mode === 'beautify' ? 'active' : ''}`}
              onClick={() => setMode('beautify')}
            >
              Beautify
            </button>
            <button
              className={`mode-tab ${mode === 'minify' ? 'active' : ''}`}
              onClick={() => setMode('minify')}
            >
              Minify
            </button>
          </div>
          <div className="mode-actions">
            {mode === 'beautify' && (
              <div className="indent-selector">
                <label>Indent:</label>
                <select
                  value={indentSize}
                  onChange={(e) => setIndentSize(Number(e.target.value))}
                >
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                  <option value={1}>1 tab</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <button className="toolbar-btn" onClick={loadSample}>Load Sample</button>
          <button className="toolbar-btn" onClick={copyOutput} disabled={!outputText}>Copy Output</button>
          <button className="toolbar-btn" onClick={clearAll}>Clear All</button>
          <div className="toolbar-spacer"></div>

          {/* Stats */}
          {stats.inputSize > 0 && (
            <div className="size-stats">
              <span>{formatBytes(stats.inputSize)} → {formatBytes(stats.outputSize)}</span>
              {mode === 'minify' && stats.inputSize > stats.outputSize && (
                <span className="savings">-{getSavingsPercent()}%</span>
              )}
            </div>
          )}

          <label className="preview-toggle">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={(e) => setShowPreview(e.target.checked)}
            />
            <span>Preview</span>
          </label>
        </div>

        {/* Editor Area */}
        <div className={`editor-area ${showPreview ? 'with-preview' : ''}`}>
          {/* Input */}
          <div className="editor-section">
            <div className="editor-header">
              <label>Input HTML</label>
              <span className="line-count">
                {inputText ? inputText.split('\n').length : 0} lines
              </span>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your HTML here..."
              className="editor-input"
              spellCheck={false}
            />
          </div>

          {/* Output */}
          <div className="editor-section">
            <div className="editor-header">
              <label>{mode === 'beautify' ? 'Beautified' : 'Minified'} HTML</label>
              <span className="line-count">
                {outputText ? outputText.split('\n').length : 0} lines
              </span>
            </div>
            <textarea
              value={outputText}
              readOnly
              placeholder={`${mode === 'beautify' ? 'Beautified' : 'Minified'} HTML will appear here...`}
              className="editor-output"
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="editor-section preview-section">
              <div className="editor-header">
                <label>Live Preview</label>
              </div>
              <iframe
                className="preview-frame"
                srcDoc={inputText || '<p style="color:#666;font-family:sans-serif;text-align:center;padding:40px;">Preview will appear here...</p>'}
                title="HTML Preview"
                sandbox="allow-scripts"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HtmlBeautifierPanel;
