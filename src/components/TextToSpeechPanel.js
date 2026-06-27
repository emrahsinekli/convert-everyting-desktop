import React, { useState, useEffect, useCallback, useMemo } from 'react';

const LANG_NAMES = {
  en: 'English', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano',
  pt: 'Português', ru: 'Русский', ja: '日本語', ko: '한국어', zh: '中文', ar: 'العربية',
  hi: 'हिन्दी', nl: 'Nederlands', pl: 'Polski', sv: 'Svenska', da: 'Dansk', fi: 'Suomi',
  no: 'Norsk', el: 'Ελληνικά', he: 'עברית', id: 'Bahasa', ms: 'Melayu', cs: 'Čeština',
  ro: 'Română', hu: 'Magyar', th: 'ไทย', uk: 'Українська', vi: 'Tiếng Việt',
};

function TextToSpeechPanel() {
  const [voices, setVoices] = useState([]);
  const [voice, setVoice] = useState('');
  const [text, setText] = useState('');
  const [rate, setRate] = useState(175);
  const [format, setFormat] = useState('mp3');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    (async () => {
      if (!window.electronAPI?.ttsGetVoices) return;
      const r = await window.electronAPI.ttsGetVoices();
      if (r?.success && r.voices?.length) {
        setVoices(r.voices);
        const en = r.voices.find((v) => v.langCode === 'en');
        setVoice((en || r.voices[0]).id);
      }
    })();
  }, []);

  // group voices by language for the dropdown
  const grouped = useMemo(() => {
    const g = {};
    for (const v of voices) (g[v.langCode] = g[v.langCode] || []).push(v);
    return Object.entries(g).sort((a, b) => (LANG_NAMES[a[0]] || a[0]).localeCompare(LANG_NAMES[b[0]] || b[0]));
  }, [voices]);

  const speak = useCallback(async () => {
    if (!text.trim() || !window.electronAPI) return;
    setBusy(true); setDone('');
    try {
      const save = await window.electronAPI.saveFile({
        defaultPath: `speech.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (save.canceled || !save.filePath) { setBusy(false); return; }
      const res = await window.electronAPI.ttsConvert({ text, outputPath: save.filePath, voice, rate });
      if (res?.success) { await window.electronAPI.showInFolder(res.outputPath); setDone('Saved: ' + res.outputPath); }
      else throw new Error(res?.error || 'Failed');
    } catch (e) { alert('Error: ' + e.message); }
    finally { setBusy(false); }
  }, [text, voice, rate, format]);

  const pickTxt = async () => {
    const r = await window.electronAPI.openFile({ filters: [{ name: 'Text', extensions: ['txt', 'md'] }] });
    if (!r.canceled && r.filePaths[0]) {
      const buf = await window.electronAPI.readFileAsBuffer(r.filePaths[0]);
      if (buf?.success) setText(atob(buf.data));
    }
  };

  const inp = { width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '9px 11px', fontSize: 13 };

  return (
    <div style={{ padding: 28, maxWidth: 820, color: 'var(--text-primary)' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>🔊 Text to Speech</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
        Turn text into natural speech — {voices.length} voices across {new Set(voices.map((v) => v.langCode)).size} languages, 100% offline.
      </p>

      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste text here…"
        style={{ ...inp, minHeight: 160, resize: 'vertical', lineHeight: 1.5, marginTop: 8 }} />

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={pickTxt} className="" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', cursor: 'pointer' }}>📄 Load .txt</button>
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 12, alignSelf: 'center' }}>{text.length} chars</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, marginTop: 18 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Voice</label>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} style={inp}>
            {grouped.map(([code, vs]) => (
              <optgroup key={code} label={LANG_NAMES[code] || code.toUpperCase()}>
                {vs.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Speed: {rate} wpm</label>
          <input type="range" min="100" max="300" value={rate} onChange={(e) => setRate(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value)} style={inp}>
            <option value="mp3">MP3</option><option value="wav">WAV</option><option value="m4a">M4A</option>
          </select>
        </div>
      </div>

      <button onClick={speak} disabled={busy || !text.trim()}
        style={{ marginTop: 20, background: 'linear-gradient(90deg,var(--primary),#6f6ce8)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px 22px', fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy || !text.trim() ? 0.5 : 1 }}>
        {busy ? 'Generating…' : '🔊 Generate Speech'}
      </button>
      {done && <p style={{ color: 'var(--secondary)', fontSize: 12.5, marginTop: 12 }}>✓ {done}</p>}
      {voices.length === 0 && <p style={{ color: 'var(--warning)', fontSize: 12.5, marginTop: 12 }}>No system voices found. Add more in System Settings ▸ Accessibility ▸ Spoken Content ▸ System Voices.</p>}
    </div>
  );
}

export default TextToSpeechPanel;
