import React, { useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import './HelpPanel.css';

// Section order is fixed; the titles and bodies come from the active locale so
// the guide is translated along with the rest of the interface.
const SECTIONS = [
  { id: 'gettingStarted', icon: '🚀' },
  { id: 'batch', icon: '📦' },
  { id: 'audio', icon: '🎵' },
  { id: 'video', icon: '🎬' },
  { id: 'image', icon: '🖼️' },
  { id: 'transcription', icon: '🎙️' },
  { id: 'automation', icon: '⚡' },
  { id: 'dependencies', icon: '🧩' },
  { id: 'troubleshooting', icon: '🛠️' },
  { id: 'privacy', icon: '🔒' }
];

function HelpPanel({ onClose }) {
  const t = useTranslation();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState('gettingStarted');

  const sections = useMemo(() => SECTIONS.map((section) => ({
    ...section,
    title: t(`help.${section.id}Title`),
    body: t(`help.${section.id}Body`)
  })), [t]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sections;
    return sections.filter((section) =>
      section.title.toLowerCase().includes(needle) || section.body.toLowerCase().includes(needle)
    );
  }, [sections, query]);

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(event) => event.stopPropagation()}>
        <div className="help-header">
          <div>
            <h2>{t('help.title')}</h2>
            <p>{t('help.subtitle')}</p>
          </div>
          <button className="help-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        <input
          className="help-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('help.searchPlaceholder')}
        />

        <div className="help-body">
          {visible.length === 0 ? (
            <p className="help-empty">{t('help.noResults')}</p>
          ) : (
            visible.map((section) => {
              // While searching, show every match expanded rather than making
              // the user click through each hit.
              const expanded = query.trim() ? true : openId === section.id;
              return (
                <section key={section.id} className={`help-section ${expanded ? 'expanded' : ''}`}>
                  <button
                    className="help-section-header"
                    onClick={() => setOpenId(openId === section.id ? null : section.id)}
                    aria-expanded={expanded}
                  >
                    <span className="help-section-icon">{section.icon}</span>
                    <span className="help-section-title">{section.title}</span>
                    <span className="help-section-chevron">{expanded ? '−' : '+'}</span>
                  </button>
                  {expanded && (
                    <div className="help-section-body">
                      {section.body.split('\n\n').map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default HelpPanel;
