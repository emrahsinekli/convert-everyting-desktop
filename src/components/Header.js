import React, { useEffect, useRef, useState } from 'react';
import logo from '../assets/logo.png';
import { useI18n } from '../i18n';

function Header({ licenseStatus = {}, onUpgrade, onHelp }) {
  const isMac = window.electronAPI?.isMac;
  const { isPro, trialDaysLeft } = licenseStatus;
  const { t, language, setLanguage, languages } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the language menu on any click outside of it
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocumentClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, [menuOpen]);

  const active = languages.find((item) => item.code === language) || languages[0];

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
          {t('header.tagline')}
        </div>

        <div className="header-actions" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            className="header-icon-button"
            onClick={onHelp}
            title={t('header.helpTitle')}
            aria-label={t('header.helpTitle')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          <div className="language-picker" ref={menuRef}>
            <button
              className="header-icon-button language-button"
              onClick={() => setMenuOpen((open) => !open)}
              title={t('header.languageTitle')}
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
            >
              <span className="language-flag">{active.flag}</span>
              <span className="language-code">{active.code.toUpperCase()}</span>
            </button>

            {menuOpen && (
              <ul className="language-menu" role="listbox">
                {languages.map((item) => (
                  <li key={item.code}>
                    <button
                      className={`language-menu-item ${item.code === language ? 'active' : ''}`}
                      role="option"
                      aria-selected={item.code === language}
                      onClick={() => { setLanguage(item.code); setMenuOpen(false); }}
                    >
                      <span className="language-flag">{item.flag}</span>
                      <span className="language-name">{item.nativeLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isPro ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'linear-gradient(90deg,#5e5ce6,#6f6ce8)', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', padding: '4px 10px', borderRadius: 999 }}>★ {t('header.pro')}</span>
          ) : (
            <button onClick={onUpgrade} title={t('header.upgradeTitle')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', color: '#f6c453', border: '1px solid rgba(246,196,83,0.5)', fontWeight: 700, fontSize: 11, padding: '4px 10px', borderRadius: 999, cursor: 'pointer' }}>
              ⚡ {trialDaysLeft > 0 ? t('header.trialDays', { days: trialDaysLeft }) : t('header.upgrade')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
