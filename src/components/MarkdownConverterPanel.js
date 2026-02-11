import React, { useState, useEffect } from 'react';
import './MarkdownConverterPanel.css';

// Simple markdown to HTML converter
const markdownToHtml = (markdown) => {
  let html = markdown;

  // Escape HTML special characters first (but preserve intentional HTML)
  // html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (```code```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr>');

  // Unordered lists
  html = html.replace(/^[\*\-\+] (.+)$/gm, '<li>$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive li elements in ul/ol
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    return '<ul>\n' + match + '</ul>\n';
  });

  // Paragraphs (lines that aren't already wrapped)
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    if (line.trim() === '') return '';
    if (line.match(/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|p)/)) return line;
    if (line.trim() && !line.startsWith('<')) {
      return `<p>${line}</p>`;
    }
    return line;
  });

  html = processedLines.join('\n');

  // Clean up extra newlines
  html = html.replace(/\n{3,}/g, '\n\n');

  return html;
};

// HTML to Markdown converter
const htmlToMarkdown = (html) => {
  let markdown = html;

  // Remove script and style tags
  markdown = markdown.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  markdown = markdown.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Headers
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n');
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n');

  // Bold and Italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Strikethrough
  markdown = markdown.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~');
  markdown = markdown.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');

  // Links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Images
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n');

  // Inline code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    return content.split('\n').map(line => '> ' + line.trim()).join('\n') + '\n';
  });

  // Lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  });
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    let index = 1;
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${index++}. $1\n`);
  });

  // Paragraphs and line breaks
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<hr\s*\/?>/gi, '---\n');

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&#39;/g, "'");
  markdown = markdown.replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();

  return markdown;
};

const sampleMarkdown = `# Welcome to Markdown

This is a **bold** text and this is *italic*.

## Features

- Easy to write
- Converts to HTML
- Supports code blocks

### Code Example

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

> This is a blockquote

Visit [Google](https://google.com) for more info.

---

1. First item
2. Second item
3. Third item`;

function MarkdownConverterPanel() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [mode, setMode] = useState('md-to-html'); // 'md-to-html' or 'html-to-md'
  const [showPreview, setShowPreview] = useState(true);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    convert();
  }, [inputText, mode]);

  const convert = () => {
    if (!inputText.trim()) {
      setOutputText('');
      return;
    }

    if (mode === 'md-to-html') {
      setOutputText(markdownToHtml(inputText));
    } else {
      setOutputText(htmlToMarkdown(inputText));
    }
  };

  const loadSample = () => {
    if (mode === 'md-to-html') {
      setInputText(sampleMarkdown);
    } else {
      setInputText('<h1>Hello World</h1>\n<p>This is a <strong>paragraph</strong> with <em>formatting</em>.</p>');
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(outputText);
  };

  const clearAll = () => {
    setInputText('');
    setOutputText('');
  };

  const swapMode = () => {
    setMode(mode === 'md-to-html' ? 'html-to-md' : 'md-to-html');
    setInputText(outputText);
    setOutputText('');
  };

  const exportToPdf = async () => {
    if (!outputText) return;

    setConverting(true);
    try {
      const saveResult = await window.electronAPI.saveFile({
        title: 'Save PDF',
        defaultPath: 'document.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (saveResult && !saveResult.canceled && saveResult.filePath) {
        // Use the HTML to PDF conversion
        const htmlContent = mode === 'md-to-html' ? outputText : markdownToHtml(inputText);

        const result = await window.electronAPI.htmlToPdf({
          html: htmlContent,
          outputPath: saveResult.filePath
        });

        if (result.success) {
          alert('PDF exported successfully!');
        } else {
          alert('Failed to export PDF: ' + (result.error || 'Unknown error'));
        }
      }
    } catch (err) {
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setConverting(false);
    }
  };

  const downloadOutput = () => {
    if (!outputText) return;

    const ext = mode === 'md-to-html' ? 'html' : 'md';
    const mimeType = mode === 'md-to-html' ? 'text/html' : 'text/markdown';

    const blob = new Blob([outputText], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="markdown-converter-panel">
      <div className="panel-header">
        <h2>Markdown Converter</h2>
        <p>Convert between Markdown and HTML formats</p>
      </div>

      <div className="markdown-content">
        {/* Mode Selection */}
        <div className="mode-section">
          <div className="mode-tabs">
            <button
              className={`mode-tab ${mode === 'md-to-html' ? 'active' : ''}`}
              onClick={() => setMode('md-to-html')}
            >
              Markdown → HTML
            </button>
            <button
              className={`mode-tab ${mode === 'html-to-md' ? 'active' : ''}`}
              onClick={() => setMode('html-to-md')}
            >
              HTML → Markdown
            </button>
          </div>
          <div className="mode-actions">
            <button className="action-btn" onClick={swapMode}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
              </svg>
              Swap
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <button className="toolbar-btn" onClick={loadSample}>Load Sample</button>
          <button className="toolbar-btn" onClick={copyOutput} disabled={!outputText}>Copy Output</button>
          <button className="toolbar-btn" onClick={downloadOutput} disabled={!outputText}>
            Download {mode === 'md-to-html' ? 'HTML' : 'MD'}
          </button>
          <button className="toolbar-btn" onClick={exportToPdf} disabled={!outputText || converting}>
            {converting ? 'Exporting...' : 'Export PDF'}
          </button>
          <button className="toolbar-btn" onClick={clearAll}>Clear All</button>
          <div className="toolbar-spacer"></div>
          <label className="preview-toggle">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={(e) => setShowPreview(e.target.checked)}
            />
            <span>Show Preview</span>
          </label>
        </div>

        {/* Editor Area */}
        <div className={`editor-area ${showPreview ? 'with-preview' : ''}`}>
          {/* Input */}
          <div className="editor-section">
            <div className="editor-header">
              <label>{mode === 'md-to-html' ? 'Markdown' : 'HTML'}</label>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={mode === 'md-to-html' ? 'Enter Markdown here...' : 'Enter HTML here...'}
              className="editor-input"
              spellCheck={false}
            />
          </div>

          {/* Output */}
          <div className="editor-section">
            <div className="editor-header">
              <label>{mode === 'md-to-html' ? 'HTML' : 'Markdown'}</label>
            </div>
            <textarea
              value={outputText}
              readOnly
              placeholder="Converted output will appear here..."
              className="editor-output"
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          {showPreview && mode === 'md-to-html' && (
            <div className="editor-section preview-section">
              <div className="editor-header">
                <label>Preview</label>
              </div>
              <div
                className="preview-content"
                dangerouslySetInnerHTML={{ __html: outputText }}
              />
            </div>
          )}
        </div>

        {/* Syntax Reference */}
        <div className="reference-section">
          <h3>Markdown Quick Reference</h3>
          <div className="reference-grid">
            <div className="ref-item">
              <code># Heading 1</code>
              <span>Heading 1</span>
            </div>
            <div className="ref-item">
              <code>**bold**</code>
              <span><strong>bold</strong></span>
            </div>
            <div className="ref-item">
              <code>*italic*</code>
              <span><em>italic</em></span>
            </div>
            <div className="ref-item">
              <code>[link](url)</code>
              <span>Link</span>
            </div>
            <div className="ref-item">
              <code>`code`</code>
              <span><code>code</code></span>
            </div>
            <div className="ref-item">
              <code>- list item</code>
              <span>List item</span>
            </div>
            <div className="ref-item">
              <code>&gt; quote</code>
              <span>Blockquote</span>
            </div>
            <div className="ref-item">
              <code>---</code>
              <span>Horizontal rule</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarkdownConverterPanel;
