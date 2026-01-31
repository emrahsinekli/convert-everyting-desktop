import React from 'react';

function ProgressBar({ progress }) {
  const isComplete = progress >= 100;

  return (
    <div className={`progress-container ${isComplete ? 'complete' : ''}`}>
      <div className="progress-info">
        <span className="progress-label">
          {isComplete ? 'Conversion Complete!' : 'Converting...'}
        </span>
        <span className="progress-percentage">{Math.round(progress)}%</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        >
          <div className="progress-glow"></div>
        </div>
      </div>
      {isComplete && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          File converted successfully!
        </div>
      )}
    </div>
  );
}

export default ProgressBar;
