import React from 'react';

function Header() {
  const isMac = window.electronAPI?.isMac;

  return (
    <header className="app-header" style={{ WebkitAppRegion: 'drag' }}>
      <div className="header-content">
        {/* Mac traffic lights space */}
        {isMac && <div className="mac-traffic-lights-space"></div>}

        <div className="logo">
          <img src="/logo.png" alt="Convert Everything" className="logo-image" />
          <span className="logo-text">Convert Everything</span>
        </div>

        <div className="header-tagline">
          Offline • Fast • Private • Unlimited
        </div>

        <div className="header-actions" style={{ WebkitAppRegion: 'no-drag' }}>
          <span className="version-badge">v1.0.0</span>
        </div>
      </div>
    </header>
  );
}

export default Header;
