import React from 'react';
import logo from '../assets/logo.png';

function Header({ licenseStatus = {}, onUpgrade }) {
  const isMac = window.electronAPI?.isMac;
  const { isPro, trialDaysLeft } = licenseStatus;

  return (
    <header className="app-header" style={{ WebkitAppRegion: 'drag' }}>
      <div className="header-content">
        {/* Mac traffic lights space */}
        {isMac && <div className="mac-traffic-lights-space"></div>}

        <div className="logo">
          <img src={logo} alt="Convert Everything" className="logo-image" />
          <span className="logo-text">Convert Everything</span>
        </div>

        <div className="header-tagline">
          Offline • Fast • Private • Unlimited
        </div>

        <div className="header-actions" style={{ WebkitAppRegion: 'no-drag' }}>
          {isPro ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'linear-gradient(90deg,#5e5ce6,#6f6ce8)', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', padding: '4px 10px', borderRadius: 999 }}>★ PRO</span>
          ) : (
            <button onClick={onUpgrade} title="Upgrade to Pro"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', color: '#f6c453', border: '1px solid rgba(246,196,83,0.5)', fontWeight: 700, fontSize: 11, padding: '4px 10px', borderRadius: 999, cursor: 'pointer' }}>
              ⚡ {trialDaysLeft > 0 ? `Trial · ${trialDaysLeft}d` : 'Upgrade'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
