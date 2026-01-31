import React from 'react';

function Header() {
  const isMac = window.electronAPI?.isMac;

  return (
    <header className="app-header" style={{ WebkitAppRegion: 'drag' }}>
      <div className="header-content">
        {/* Mac traffic lights space */}
        {isMac && <div className="mac-traffic-lights-space"></div>}

        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="logo-text">Convert Everything</span>
        </div>

        <div className="header-tagline">
          Universal File Converter
        </div>

        <div className="header-actions" style={{ WebkitAppRegion: 'no-drag' }}>
          <span className="version-badge">v1.0.0</span>
        </div>
      </div>
    </header>
  );
}

export default Header;
