import React, { useState, useEffect, useCallback } from 'react';

const TYPE_PRESETS = [
  { id: 'web', label: 'WebP', types: ['webp'] },
  { id: 'heic', label: 'HEIC (iPhone)', types: ['heic', 'heif'] },
  { id: 'both', label: 'WebP + HEIC', types: ['webp', 'heic', 'heif'] },
  { id: 'allimg', label: 'All images', types: ['webp', 'heic', 'heif', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'avif'] },
];

function WatchFoldersPanel() {
  const [folders, setFolders] = useState([]);
  const [typesPreset, setTypesPreset] = useState('both');
  const [outFormat, setOutFormat] = useState('jpeg');
  const [qa, setQa] = useState({ installed: 0, total: 3 });
  const [qaBusy, setQaBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (window.electronAPI?.watchList) setFolders(await window.electronAPI.watchList());
    if (window.electronAPI?.quickActionsStatus) setQa(await window.electronAPI.quickActionsStatus());
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const installQA = async () => {
    setQaBusy(true);
    try {
      const r = await window.electronAPI.quickActionsInstall();
      if (!r.success) alert('Error: ' + r.error);
    } finally { setQaBusy(false); refresh(); }
  };
  const uninstallQA = async () => { setQaBusy(true); try { await window.electronAPI.quickActionsUninstall(); } finally { setQaBusy(false); refresh(); } };

  const addFolder = async () => {
    const preset = TYPE_PRESETS.find((p) => p.id === typesPreset) || TYPE_PRESETS[2];
    const res = await window.electronAPI.watchAdd({ types: preset.types, outFormat, subfolder: true });
    if (!res.canceled) refresh();
  };
  const remove = async (id) => { await window.electronAPI.watchRemove({ id }); refresh(); };
  const toggle = async (id, enabled) => { await window.electronAPI.watchSetEnabled({ id, enabled }); refresh(); };

  return (
    <div className="watch-panel" style={{ padding: 28, maxWidth: 760, color: 'var(--text-primary)' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>⚡ Automation</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
        Convert without lifting a finger — right from Finder, or automatically when files land in a folder. All offline.
      </p>

      {/* Finder Quick Actions */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 22 }}>🖱️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Finder Right-Click (Quick Actions)</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Adds “Convert to JPG / PNG / WebP” to Finder’s right-click → Quick Actions, so you can convert without opening the app.
              {qa.installed > 0 && <span style={{ color: 'var(--secondary)' }}> · Installed ({qa.installed}/{qa.total})</span>}
            </div>
          </div>
          {qa.installed > 0 ? (
            <button onClick={uninstallQA} disabled={qaBusy} style={{ background: 'transparent', border: '1px solid var(--border-light)', color: '#ffb4b4', borderRadius: 'var(--radius-sm)', padding: '9px 14px', cursor: 'pointer' }}>Remove</button>
          ) : (
            <button onClick={installQA} disabled={qaBusy} style={{ background: 'linear-gradient(90deg,var(--primary),#6f6ce8)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 16px', fontWeight: 600, cursor: 'pointer' }}>
              {qaBusy ? 'Installing…' : 'Enable'}
            </button>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: 16, margin: '26px 0 0' }}>👁️ Watched Folders</h2>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18, marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Watch for</label>
            <select value={typesPreset} onChange={(e) => setTypesPreset(e.target.value)}
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: 13 }}>
              {TYPE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Convert to</label>
            <select value={outFormat} onChange={(e) => setOutFormat(e.target.value)}
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: 13 }}>
              <option value="jpeg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option>
            </select>
          </div>
          <button onClick={addFolder}
            style={{ background: 'linear-gradient(90deg,var(--primary),#6f6ce8)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ＋ Add Folder
          </button>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {folders.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            No watched folders yet. Add one above to automate conversions.
          </div>
        )}
        {folders.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>📁</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.folder}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {f.types.join(', ').toUpperCase()} → {(f.outFormat === 'jpeg' ? 'jpg' : f.outFormat).toUpperCase()} · saves to /Converted
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={f.enabled} onChange={(e) => toggle(f.id, e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
              {f.enabled ? 'Active' : 'Paused'}
            </label>
            <button onClick={() => remove(f.id)} style={{ background: 'transparent', border: '1px solid var(--border-light)', color: '#ffb4b4', borderRadius: 'var(--radius-sm)', padding: '7px 12px', cursor: 'pointer' }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WatchFoldersPanel;
