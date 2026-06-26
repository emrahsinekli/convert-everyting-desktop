import React, { useState } from 'react';

function Sidebar({ activeTab, onTabChange, onDependencyClick }) {
  const [expandedModules, setExpandedModules] = useState({
    convert: true,
    tools: false,
    utilities: false
  });

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  // Main modules with their sub-items
  const modules = [
    {
      id: 'convert',
      label: 'Convert',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" />
          <line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
      ),
      items: [
        { id: 'convert-video', label: 'Video Converter', icon: '🎬' },
        { id: 'convert-audio', label: 'Audio Converter', icon: '🎵' },
        { id: 'convert-image', label: 'Image Converter', icon: '🖼️' },
        { id: 'convert-document', label: 'Document Converter', icon: '📄' },
        { id: 'convert-ebook', label: 'Ebook Converter', icon: '📚' },
        { id: 'convert-archive', label: 'Archive Converter', icon: '📦' }
      ]
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
      items: [
        { id: 'tools-video', label: 'Video Tools', icon: '🎬' },
        { id: 'tools-image', label: 'Image Tools', icon: '🖼️' },
        { id: 'tools-audio', label: 'Audio Tools', icon: '🎵' },
        { id: 'tools-gif', label: 'GIF Tools', icon: '🎞️' },
        { id: 'tools-pdf', label: 'PDF Tools', icon: '📄' },
        { id: 'tools-watch', label: 'Automation', icon: '⚡' }
      ]
    },
    {
      id: 'utilities',
      label: 'Utilities',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
      items: [
        { id: 'util-unit', label: 'Unit Converter', icon: '📏' },
        { id: 'util-color', label: 'Color Converter', icon: '🎨' },
        { id: 'util-text', label: 'Text Converter', icon: '🔤' },
        { id: 'util-encoding', label: 'Encoding Tools', icon: '🔐' },
        { id: 'util-number', label: 'Number Base', icon: '🔢' },
        { id: 'util-timestamp', label: 'Timestamp', icon: '⏰' },
        { id: 'util-data', label: 'Data Converter', icon: '📊' },
        { id: 'util-subtitle', label: 'Subtitle Converter', icon: '💬' },
        { id: 'util-icon', label: 'Icon Converter', icon: '🖼️' },
        { id: 'util-markdown', label: 'Markdown Converter', icon: '📝' },
        { id: 'util-font', label: 'Font Converter', icon: '🔠' },
        { id: 'util-html', label: 'HTML Beautifier', icon: '🌐' }
      ]
    }
  ];

  const otherItems = [
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    }
  ];

  // Check if any sub-item in a module is active
  const isModuleActive = (module) => {
    return module.items.some(item => activeTab === item.id);
  };

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {/* Main Modules */}
        {modules.map((module) => (
          <div key={module.id} className="nav-module">
            <button
              className={`nav-module-header ${expandedModules[module.id] ? 'expanded' : ''} ${isModuleActive(module) ? 'active' : ''}`}
              onClick={() => toggleModule(module.id)}
            >
              <span className="nav-icon">{module.icon}</span>
              <span className="nav-label">{module.label}</span>
              <span className="expand-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polyline points={expandedModules[module.id] ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                </svg>
              </span>
            </button>

            {expandedModules[module.id] && (
              <div className="nav-module-items">
                {module.items.map((item) => (
                  <button
                    key={item.id}
                    className={`nav-sub-item ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => onTabChange(item.id)}
                  >
                    <span className="sub-icon">{item.icon}</span>
                    <span className="sub-label">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Divider */}
        <div className="nav-divider"></div>

        {/* Other Items */}
        {otherItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="settings-button" onClick={onDependencyClick}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
