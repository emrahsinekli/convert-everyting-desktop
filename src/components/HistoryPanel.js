import React from 'react';

function HistoryPanel({ history, onClearHistory }) {
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const handleOpenFile = async (filePath) => {
    if (window.electronAPI) {
      await window.electronAPI.showInFolder(filePath);
    }
  };

  return (
    <div className="history-panel">
      <div className="panel-header">
        <h2>Conversion History</h2>
        {history.length > 0 && (
          <button className="clear-history-button" onClick={onClearHistory}>
            Clear History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="empty-history">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h3>No conversion history yet</h3>
          <p>Your converted files will appear here</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <div
              key={item.id}
              className={`history-item ${item.success ? 'success' : 'failed'}`}
              onClick={() => handleOpenFile(item.outputFile)}
            >
              <div className="history-icon">
                {item.success ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
              </div>

              <div className="history-details">
                <div className="history-files">
                  <span className="input-file">{item.inputFile}</span>
                  <span className="arrow">→</span>
                  <span className="output-format">.{item.format}</span>
                </div>
                <div className="history-meta">
                  <span className="history-date">{formatDate(item.timestamp)}</span>
                  {item.count && (
                    <span className="batch-info">
                      {item.successCount}/{item.count} files
                    </span>
                  )}
                </div>
              </div>

              <div className="history-action">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryPanel;
