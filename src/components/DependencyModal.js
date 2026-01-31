import React, { useState } from 'react';

function DependencyModal({ dependencies, onClose, onRefresh, licenseInfo }) {
  const [installing, setInstalling] = useState(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatus, setInstallStatus] = useState('');

  const handleInstall = async (depName) => {
    if (!window.electronAPI) return;

    setInstalling(depName);
    setInstallProgress(0);
    setInstallStatus('Starting installation...');

    window.electronAPI.onDependencyProgress(({ progress, status }) => {
      setInstallProgress(progress);
      setInstallStatus(status);
    });

    try {
      const result = await window.electronAPI.installDependency(depName);

      if (result.success) {
        setInstallStatus('Installation complete!');
        await onRefresh();
      } else {
        setInstallStatus(result.message);
      }
    } catch (error) {
      setInstallStatus('Installation error: ' + error.message);
    } finally {
      setTimeout(() => {
        setInstalling(null);
        window.electronAPI.removeDependencyListeners();
      }, 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Dependencies & Settings</h2>
          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-content">
          <div className="dependency-list">
            {Object.entries(dependencies).map(([key, dep]) => (
              <div key={key} className={`dependency-item ${dep.installed ? 'installed' : ''}`}>
                <div className="dep-info">
                  <div className="dep-header">
                    <h3>{dep.name}</h3>
                    <span className={`status-badge ${dep.installed ? 'success' : 'warning'}`}>
                      {dep.installed ? (dep.bundled ? 'Bundled' : 'Installed') : 'Not Installed'}
                    </span>
                  </div>
                  <p className="dep-description">{dep.description}</p>
                  {!dep.installed && dep.required && (
                    <p className="dep-required">Required for core functionality</p>
                  )}
                </div>

                <div className="dep-actions">
                  {!dep.installed && !dep.bundled && (
                    <>
                      {installing === key ? (
                        <div className="install-progress">
                          <div className="mini-progress-bar">
                            <div
                              className="mini-progress-fill"
                              style={{ width: `${installProgress}%` }}
                            />
                          </div>
                          <span className="install-status">{installStatus}</span>
                        </div>
                      ) : (
                        <>
                          {key === 'whisper' ? (
                            <button
                              className="install-button"
                              onClick={() => handleInstall(key)}
                              disabled={installing !== null}
                            >
                              Download
                            </button>
                          ) : (
                            <code className="install-command">{dep.installCommand}</code>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {dep.installed && !dep.bundled && (
                    <span className="check-icon">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="modal-section">
            <h3>About AI Transcription</h3>
            <p>
              You can download Whisper AI to transcribe audio/video files.
              With this feature, you can convert any video or audio file to text,
              subtitles (SRT) or web subtitles (VTT) format.
            </p>
            <p>
              <strong>Note:</strong> Whisper AI works completely offline,
              no internet connection required. No Python needed.
            </p>
          </div>

          <div className="modal-section">
            <h3>License Information</h3>
            <div className="system-info">
              <div className="info-row">
                <span>Status:</span>
                <span className="license-active">Active</span>
              </div>
              {licenseInfo?.key && (
                <div className="info-row">
                  <span>License:</span>
                  <span>{licenseInfo.key}</span>
                </div>
              )}
              {licenseInfo?.activatedAt && (
                <div className="info-row">
                  <span>Activated:</span>
                  <span>{new Date(licenseInfo.activatedAt).toLocaleDateString('en-US')}</span>
                </div>
              )}
              <div className="info-row">
                <span>Support:</span>
                <a href="mailto:emrahsinekli@gmail.com" style={{ color: '#667eea' }}>
                  emrahsinekli@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div className="modal-section">
            <h3>System Information</h3>
            <div className="system-info">
              <div className="info-row">
                <span>Platform:</span>
                <span>{window.electronAPI?.platform || 'Unknown'}</span>
              </div>
              <div className="info-row">
                <span>Architecture:</span>
                <span>{window.electronAPI?.arch || 'Unknown'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={onRefresh}>
            Refresh
          </button>
          <button className="primary-button" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default DependencyModal;
