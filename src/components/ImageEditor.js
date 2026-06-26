import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import WatermarkTool from './WatermarkTool';
import AnnotationEditor from './AnnotationEditor';
import exifr from 'exifr';
import './ImageEditor.css';

const DEFAULT_ADJ = {
  brightness: 1, contrast: 1, saturation: 1, temperature: 0,
  blur: 0, sharpen: false, grayscale: false, invert: false, sepia: false,
};

const FILTER_PRESETS = [
  { id: 'none', label: 'Original', adj: {} },
  { id: 'gray', label: 'B&W', adj: { grayscale: true } },
  { id: 'bwhi', label: 'B&W Pro', adj: { grayscale: true, contrast: 1.3 } },
  { id: 'sepia', label: 'Sepia', adj: { sepia: true } },
  { id: 'vintage', label: 'Vintage', adj: { sepia: true, contrast: 0.9, saturation: 0.8, brightness: 1.05 } },
  { id: 'vivid', label: 'Vivid', adj: { saturation: 1.5, contrast: 1.12 } },
  { id: 'warm', label: 'Warm', adj: { temperature: 45, saturation: 1.1 } },
  { id: 'cool', label: 'Cool', adj: { temperature: -45 } },
  { id: 'invert', label: 'Invert', adj: { invert: true } },
  { id: 'fade', label: 'Fade', adj: { contrast: 0.85, brightness: 1.08, saturation: 0.9 } },
];

const ASPECTS = [
  { id: 'free', label: 'Free', value: undefined },
  { id: 'orig', label: 'Original', value: 'orig' },
  { id: '1', label: '1:1', value: 1 },
  { id: '43', label: '4:3', value: 4 / 3 },
  { id: '34', label: '3:4', value: 3 / 4 },
  { id: '169', label: '16:9', value: 16 / 9 },
  { id: '916', label: '9:16', value: 9 / 16 },
  { id: '32', label: '3:2', value: 3 / 2 },
];

const SOCIAL_PRESETS = [
  { label: 'Instagram Post', w: 1080, h: 1080 },
  { label: 'Instagram Story', w: 1080, h: 1920 },
  { label: 'YouTube Thumb', w: 1280, h: 720 },
  { label: 'Facebook Cover', w: 1640, h: 924 },
  { label: 'Twitter/X Post', w: 1600, h: 900 },
  { label: 'LinkedIn Banner', w: 1584, h: 396 },
];

function rotatedDims(w, h, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return { w: Math.round(w * c + h * s), h: Math.round(w * s + h * c) };
}

function ImageEditor({ initialTool = 'crop' }) {
  const [file, setFile] = useState(null);            // {path, name, ext}
  const [base, setBase] = useState(null);            // {dataUrl, naturalWidth, naturalHeight}
  const [working, setWorking] = useState(null);      // transformed preview {dataUrl, w, h}
  const [tool, setTool] = useState(initialTool);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');

  // transform
  const [rot90, setRot90] = useState(0);             // 0,90,180,270
  const [straighten, setStraighten] = useState(0);   // -45..45
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // crop
  const [crop, setCrop] = useState(null);            // % crop
  const [completedCrop, setCompletedCrop] = useState(null);
  const [aspect, setAspect] = useState(undefined);
  const [grid, setGrid] = useState(true);

  // adjustments
  const [adj, setAdj] = useState(DEFAULT_ADJ);
  const [activePreset, setActivePreset] = useState('none');

  // resize / export
  const [resizeW, setResizeW] = useState('');
  const [resizeH, setResizeH] = useState('');
  const [lockRatio, setLockRatio] = useState(true);
  const [format, setFormat] = useState('png');
  const [quality, setQuality] = useState(90);
  const [stripMeta, setStripMeta] = useState(true);

  const [compareOriginal, setCompareOriginal] = useState(false);
  // frame + export scale + exif
  const [pad, setPad] = useState(0);
  const [padColor, setPadColor] = useState('#ffffff');
  const [border, setBorder] = useState(0);
  const [borderColor, setBorderColor] = useState('#1a1a1a');
  const [rounded, setRounded] = useState(0);
  const [exportScale, setExportScale] = useState(1);
  const [exif, setExif] = useState(null);
  const imgRef = useRef(null);
  const totalAngle = ((rot90 + straighten) % 360 + 360) % 360;

  // ---- Load image ----
  const openImage = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.openFile({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'heic', 'heif', 'avif', 'svg'] }]
    });
    if (result.canceled || !result.filePaths.length) return;
    const p = result.filePaths[0];
    setBusy(true); setBusyMsg('Loading image…');
    try {
      const info = await window.electronAPI.getFileInfo(p);
      const prev = await window.electronAPI.getImagePreview({ inputPath: p });
      if (!prev.success) throw new Error(prev.error || 'Could not read image');
      setFile({ path: p, name: info.name, ext: (info.extension || 'png').toLowerCase() });
      setBase({ dataUrl: prev.dataUrl, naturalWidth: prev.naturalWidth, naturalHeight: prev.naturalHeight });
      // reset edits
      setRot90(0); setStraighten(0); setFlipH(false); setFlipV(false);
      setCrop(null); setCompletedCrop(null); setAspect(undefined);
      setAdj(DEFAULT_ADJ); setActivePreset('none');
      setResizeW(prev.naturalWidth || ''); setResizeH(prev.naturalHeight || '');
      const inExt = (info.extension || 'png').toLowerCase();
      setFormat(['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'].includes(inExt) ? (inExt === 'jpg' ? 'jpeg' : inExt) : 'png');
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  // ---- Recompute transformed working image whenever geometry changes ----
  useEffect(() => {
    if (!base) { setWorking(null); return; }
    const im = new Image();
    im.onload = () => {
      const angle = totalAngle;
      const { w, h } = rotatedDims(im.naturalWidth, im.naturalHeight, angle);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(w / 2, h / 2);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1); // flip outer (applied after rotate to image)
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
      setWorking({ dataUrl: canvas.toDataURL('image/png'), w, h });
    };
    im.src = base.dataUrl;
  }, [base, totalAngle, flipH, flipV]);

  // ---- Live CSS filter ----
  const filterCss = useMemo(() => {
    const a = adj;
    const parts = [
      `brightness(${a.brightness})`,
      `contrast(${a.contrast})`,
      `saturate(${a.saturation})`,
    ];
    if (a.grayscale) parts.push('grayscale(1)');
    if (a.sepia) parts.push('sepia(0.65)');
    if (a.invert) parts.push('invert(1)');
    if (a.blur > 0) parts.push(`blur(${a.blur}px)`);
    return compareOriginal ? 'none' : parts.join(' ');
  }, [adj, compareOriginal]);

  const tempOverlay = useMemo(() => {
    if (compareOriginal || !adj.temperature) return null;
    const t = adj.temperature / 100;
    const color = t > 0 ? '255,150,40' : '40,150,255';
    return { background: `rgba(${color},${Math.abs(t) * 0.4})`, mixBlendMode: 'soft-light' };
  }, [adj.temperature, compareOriginal]);

  const setAdjVal = (k, v) => { setAdj((s) => ({ ...s, [k]: v })); setActivePreset('custom'); };
  const applyPreset = (preset) => {
    setAdj({ ...DEFAULT_ADJ, ...preset.adj });
    setActivePreset(preset.id);
  };

  // ---- Aspect change ----
  const onAspectChange = (av) => {
    let value = av;
    if (av === 'orig' && base) value = base.naturalWidth / base.naturalHeight;
    setAspect(value);
    if (value && imgRef.current) {
      const { width, height } = imgRef.current;
      const c = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, value, width, height), width, height);
      setCrop(c); setCompletedCrop(c);
    }
  };

  // ---- Reset ----
  const resetAll = () => {
    setRot90(0); setStraighten(0); setFlipH(false); setFlipV(false);
    setCrop(null); setCompletedCrop(null); setAspect(undefined);
    setAdj(DEFAULT_ADJ); setActivePreset('none');
    if (base) { setResizeW(base.naturalWidth); setResizeH(base.naturalHeight); }
  };

  // ---- Build recipe + export ----
  const buildRecipe = () => {
    const recipe = {
      rotate: totalAngle,
      flipH, flipV,
      brightness: adj.brightness, contrast: adj.contrast, saturation: adj.saturation,
      temperature: adj.temperature, blur: adj.blur, sharpen: adj.sharpen,
      grayscale: adj.grayscale, invert: adj.invert, sepia: adj.sepia,
      format, quality, stripMetadata: stripMeta,
    };
    // frame
    if (pad > 0) { recipe.padding = pad; recipe.paddingColor = hexToRgb(padColor); }
    if (border > 0) { recipe.border = border; recipe.borderColor = hexToRgb(borderColor); }
    if (rounded > 0) recipe.rounded = rounded;
    if (exportScale && exportScale !== 1) recipe.scale = exportScale;
    // crop -> transformed-natural px
    if (completedCrop && completedCrop.width > 0 && base) {
      const td = rotatedDims(base.naturalWidth, base.naturalHeight, totalAngle);
      const unit = completedCrop.unit;
      let fx, fy, fw, fh;
      if (unit === '%') {
        fx = completedCrop.x / 100; fy = completedCrop.y / 100;
        fw = completedCrop.width / 100; fh = completedCrop.height / 100;
      } else if (imgRef.current) {
        fx = completedCrop.x / imgRef.current.width; fy = completedCrop.y / imgRef.current.height;
        fw = completedCrop.width / imgRef.current.width; fh = completedCrop.height / imgRef.current.height;
      }
      if (fw > 0.001 && fh > 0.001) {
        recipe.crop = {
          left: Math.round(fx * td.w), top: Math.round(fy * td.h),
          width: Math.round(fw * td.w), height: Math.round(fh * td.h),
        };
      }
    }
    // resize
    if (resizeW || resizeH) {
      const rw = parseInt(resizeW) || null;
      const rh = parseInt(resizeH) || null;
      // only treat as resize if differs from source
      recipe.resize = { width: rw, height: rh, fit: lockRatio ? 'inside' : 'fill' };
    }
    return recipe;
  };

  const outPath = (fmt) => {
    if (!file) return '';
    const dir = file.path.substring(0, Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\')));
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    return `${dir}/${baseName}_edited.${ext}`;
  };

  const doExport = async () => {
    if (!file || !window.electronAPI) return;
    setBusy(true); setBusyMsg('Exporting…');
    try {
      const recipe = buildRecipe();
      const outputPath = outPath(format);
      const res = await window.electronAPI.applyImageEdit({ inputPath: file.path, outputPath, recipe });
      if (res?.success) {
        await window.electronAPI.showInFolder(res.outputPath);
      } else {
        throw new Error(res?.error || 'Export failed');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // keep resize ratio
  const onResizeW = (v) => {
    setResizeW(v);
    if (lockRatio && base && v) setResizeH(Math.round((parseInt(v) || 0) * base.naturalHeight / base.naturalWidth));
  };
  const onResizeH = (v) => {
    setResizeH(v);
    if (lockRatio && base && v) setResizeW(Math.round((parseInt(v) || 0) * base.naturalWidth / base.naturalHeight));
  };

  const RAIL = [
    { id: 'crop', ic: '✂️', label: 'Crop' },
    { id: 'transform', ic: '🔄', label: 'Rotate' },
    { id: 'adjust', ic: '🎚️', label: 'Adjust' },
    { id: 'filter', ic: '🎨', label: 'Filters' },
    { id: 'resize', ic: '📐', label: 'Resize' },
    { id: 'frame', ic: '🖼️', label: 'Frame' },
    { id: 'bg', ic: '🪄', label: 'Cutout' },
    { id: 'annotate', ic: '🖊️', label: 'Markup' },
    { id: 'watermark', ic: '💧', label: 'Mark' },
    { id: 'info', ic: 'ⓘ', label: 'Info' },
    { id: 'export', ic: '💾', label: 'Export' },
  ];

  // ---- EXIF metadata (read in renderer via exifr) ----
  useEffect(() => {
    if (tool !== 'info' || !file || !window.electronAPI) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await window.electronAPI.readFileAsBuffer(file.path);
        if (!r?.success) { setExif({}); return; }
        const bin = atob(r.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const data = await exifr.parse(bytes, { tiff: true, exif: true, gps: true }).catch(() => null);
        if (!cancelled) setExif(data || {});
      } catch { if (!cancelled) setExif({}); }
    })();
    return () => { cancelled = true; };
  }, [tool, file]);

  // ---- Annotations: bake overlay + blur regions into the working image ----
  const doApplyAnnotations = async ({ overlayDataUrl, blurRegions }) => {
    if (!file || !window.electronAPI) return;
    setBusy(true); setBusyMsg('Applying annotations…');
    try {
      const res = await window.electronAPI.applyAnnotations({ inputPath: file.path, baseDataUrl: working?.dataUrl, overlayBase64: overlayDataUrl, blurRegions });
      if (!res?.success) throw new Error(res?.error || 'Annotation failed');
      setFile((f) => ({ ...f, path: res.tempPath, ext: 'png' }));
      setBase((b) => ({ ...b, dataUrl: res.dataUrl }));
      setFormat('png');
      setTool('export');
    } catch (e) {
      alert('Error: ' + e.message);
    } finally { setBusy(false); }
  };

  // ---- Background removal (local, offline AI) ----
  const [bgDone, setBgDone] = useState(false);
  const doRemoveBg = async () => {
    if (!file || !window.electronAPI) return;
    setBusy(true); setBusyMsg('Removing background (on-device AI)…');
    try {
      const res = await window.electronAPI.removeBackground({ inputPath: file.path });
      if (!res?.success) throw new Error(res?.error || 'Background removal failed');
      // The cutout becomes the new working source so further edits/exports use it
      setFile((f) => ({ ...f, path: res.tempPath, ext: 'png' }));
      setBase((b) => ({ ...b, dataUrl: res.dataUrl }));
      setFormat('png');
      setBgDone(true);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally { setBusy(false); }
  };

  // ---- Watermark (reuse existing pro WatermarkTool) ----
  const doWatermark = async (config) => {
    if (!file || !window.electronAPI) return;
    setBusy(true); setBusyMsg('Applying watermark…');
    try {
      const dir = file.path.substring(0, Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\')));
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const ext = file.ext || 'png';
      const outputPath = `${dir}/${baseName}_watermarked.${ext}`;
      const res = await window.electronAPI.watermarkImage({ inputPath: file.path, outputPath, ...config });
      if (res?.success) await window.electronAPI.showInFolder(res.outputPath || outputPath);
      else throw new Error(res?.error || 'Watermark failed');
    } catch (e) {
      alert('Error: ' + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="img-editor">
      <div className="ie-topbar">
        <span className="ie-title">🖼️ Image Editor</span>
        <button className="ie-btn" onClick={openImage}>📂 {file ? 'Open Another' : 'Open Image'}</button>
        {file && <span style={{ color: '#8e8e93', fontSize: 12 }}>{file.name}</span>}
        <div className="spacer" />
        {file && (
          <>
            <button className="ie-btn ghost" onMouseDown={() => setCompareOriginal(true)} onMouseUp={() => setCompareOriginal(false)} onMouseLeave={() => setCompareOriginal(false)} title="Hold to see original">👁️ Before/After</button>
            <button className="ie-btn danger" onClick={resetAll}>↺ Reset</button>
            <button className="ie-btn primary" onClick={doExport} disabled={busy}>💾 Export</button>
          </>
        )}
      </div>

      <div className="ie-body">
        <div className="ie-rail">
          {RAIL.map((r) => (
            <button key={r.id} className={`ie-rail-btn ${tool === r.id ? 'active' : ''}`} onClick={() => setTool(r.id)} disabled={!file}>
              <span className="ic">{r.ic}</span>{r.label}
            </button>
          ))}
        </div>

        {tool === 'annotate' && file && working ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <AnnotationEditor imageDataUrl={working.dataUrl} naturalWidth={working.w} naturalHeight={working.h} onApply={doApplyAnnotations} busy={busy} />
          </div>
        ) : tool === 'watermark' && file ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <h3 style={{ margin: '0 0 4px' }}>Watermark</h3>
            <p className="sub" style={{ color: '#8e8e93', fontSize: 12, marginTop: 0 }}>Add a text or logo watermark with full positioning, opacity & tiling.</p>
            <WatermarkTool mediaType="image" selectedFile={file} onProcess={doWatermark} isProcessing={busy} progress={0} />
          </div>
        ) : (
        <>
        <div className="ie-canvas-wrap">
          {!file && (
            <div className="ie-empty">
              <div className="big">🖼️</div>
              <h2>Professional Image Editor</h2>
              <p>Open an image to crop, rotate, adjust, filter, resize & export — with live preview.</p>
              <button className="ie-btn primary" style={{ marginTop: 16 }} onClick={openImage}>📂 Open Image</button>
            </div>
          )}

          {file && working && (
            <div className="ie-canvas-inner" style={{ position: 'relative' }}>
              {tool === 'crop' ? (
                <ReactCrop
                  crop={crop}
                  onChange={(_, pc) => setCrop(pc)}
                  onComplete={(_, pc) => setCompletedCrop(pc)}
                  aspect={aspect}
                  ruleOfThirds={grid}
                >
                  <img ref={imgRef} src={working.dataUrl} alt="edit" className="ie-preview-img" style={{ filter: filterCss }} />
                </ReactCrop>
              ) : (
                <div style={{ position: 'relative', background: pad ? padColor : 'transparent', padding: pad ? Math.min(pad, 48) : 0, border: border ? `${Math.min(border, 24)}px solid ${borderColor}` : 'none', borderRadius: rounded ? Math.min(rounded, 80) : 0, boxSizing: 'border-box' }}>
                  <img ref={imgRef} src={working.dataUrl} alt="edit" className="ie-preview-img" style={{ filter: filterCss, borderRadius: rounded ? Math.min(rounded, 80) : 0, display: 'block' }} />
                  {tempOverlay && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...tempOverlay }} />}
                </div>
              )}
            </div>
          )}

          {working && <div className="ie-zoom-info">{working.w} × {working.h}px</div>}
          {busy && <div className="ie-overlay-msg"><div className="ie-spinner" /><span>{busyMsg}</span></div>}
        </div>

        {file && (
          <div className="ie-inspector">
            {tool === 'crop' && (
              <>
                <h3>Crop</h3>
                <p className="sub">Drag the handles. Pick a ratio for fixed crops.</p>
                <div className="ie-chip-row">
                  {ASPECTS.map((a) => (
                    <button key={a.id} className={`ie-chip ${(aspect === a.value || (a.value === undefined && !aspect)) ? 'active' : ''}`} onClick={() => onAspectChange(a.value)}>{a.label}</button>
                  ))}
                </div>
                <label className="ie-check"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Rule-of-thirds grid</label>
                <button className="ie-btn ghost ie-btn-block" onClick={() => { setCrop(null); setCompletedCrop(null); setAspect(undefined); }}>Clear crop</button>
                <p className="sub" style={{ marginTop: 14 }}>Crop applies on export at full resolution.</p>
              </>
            )}

            {tool === 'transform' && (
              <>
                <h3>Rotate & Flip</h3>
                <p className="sub">Live preview. Applied at export in full quality.</p>
                <div className="ie-chip-row">
                  <button className="ie-chip" onClick={() => setRot90((r) => (r + 270) % 360)}>⟲ 90° Left</button>
                  <button className="ie-chip" onClick={() => setRot90((r) => (r + 90) % 360)}>⟳ 90° Right</button>
                  <button className="ie-chip" onClick={() => setRot90((r) => (r + 180) % 360)}>180°</button>
                </div>
                <div className="ie-field">
                  <label>Straighten <span className="val">{straighten}°</span></label>
                  <input type="range" min="-45" max="45" value={straighten} onChange={(e) => setStraighten(parseInt(e.target.value))} />
                </div>
                <div className="ie-chip-row">
                  <button className={`ie-chip ${flipH ? 'active' : ''}`} onClick={() => setFlipH((v) => !v)}>↔ Flip H</button>
                  <button className={`ie-chip ${flipV ? 'active' : ''}`} onClick={() => setFlipV((v) => !v)}>↕ Flip V</button>
                </div>
                <button className="ie-btn ghost ie-btn-block" onClick={() => { setRot90(0); setStraighten(0); setFlipH(false); setFlipV(false); }}>Reset transform</button>
              </>
            )}

            {tool === 'adjust' && (
              <>
                <h3>Adjustments</h3>
                <p className="sub">Live preview via GPU; exported with high-quality engine.</p>
                {[
                  ['brightness', 'Brightness', 0, 2, 0.01],
                  ['contrast', 'Contrast', 0, 2, 0.01],
                  ['saturation', 'Saturation', 0, 2, 0.01],
                  ['temperature', 'Temperature', -100, 100, 1],
                  ['blur', 'Blur', 0, 20, 0.5],
                ].map(([k, label, min, max, step]) => (
                  <div className="ie-field" key={k}>
                    <label>{label} <span className="val">{k === 'temperature' ? adj[k] : adj[k]}</span></label>
                    <input type="range" min={min} max={max} step={step} value={adj[k]} onChange={(e) => setAdjVal(k, parseFloat(e.target.value))} />
                  </div>
                ))}
                <label className="ie-check"><input type="checkbox" checked={adj.sharpen} onChange={(e) => setAdjVal('sharpen', e.target.checked)} /> Sharpen</label>
                <label className="ie-check"><input type="checkbox" checked={adj.grayscale} onChange={(e) => setAdjVal('grayscale', e.target.checked)} /> Grayscale</label>
                <label className="ie-check"><input type="checkbox" checked={adj.invert} onChange={(e) => setAdjVal('invert', e.target.checked)} /> Invert</label>
                <button className="ie-btn ghost ie-btn-block" onClick={() => { setAdj(DEFAULT_ADJ); setActivePreset('none'); }}>Reset adjustments</button>
              </>
            )}

            {tool === 'filter' && (
              <>
                <h3>Filters</h3>
                <p className="sub">One-tap looks. Fine-tune in Adjust.</p>
                <div className="ie-filter-grid">
                  {FILTER_PRESETS.map((p) => (
                    <button key={p.id} className={`ie-filter-tile ${activePreset === p.id ? 'active' : ''}`} onClick={() => applyPreset(p)}>
                      {working && <img src={working.dataUrl} alt={p.label} style={{ filter: presetFilterCss(p.adj) }} />}
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {tool === 'resize' && (
              <>
                <h3>Resize</h3>
                <p className="sub">Source: {base?.naturalWidth} × {base?.naturalHeight}px</p>
                <div className="ie-row">
                  <div className="ie-field"><label>Width</label><input type="number" value={resizeW} onChange={(e) => onResizeW(e.target.value)} /></div>
                  <div className="ie-field"><label>Height</label><input type="number" value={resizeH} onChange={(e) => onResizeH(e.target.value)} /></div>
                </div>
                <label className="ie-check"><input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} /> Lock aspect ratio</label>
                <div className="ie-chip-row">
                  {[25, 50, 75].map((pct) => (
                    <button key={pct} className="ie-chip" onClick={() => { if (base) { setResizeW(Math.round(base.naturalWidth * pct / 100)); setResizeH(Math.round(base.naturalHeight * pct / 100)); } }}>{pct}%</button>
                  ))}
                  <button className="ie-chip" onClick={() => { if (base) { setResizeW(base.naturalWidth); setResizeH(base.naturalHeight); } }}>100%</button>
                </div>
                <p className="sub" style={{ marginTop: 10 }}>Social presets</p>
                <div className="ie-chip-row">
                  {SOCIAL_PRESETS.map((s) => (
                    <button key={s.label} className="ie-chip" onClick={() => { setResizeW(s.w); setResizeH(s.h); setLockRatio(false); }}>{s.label}</button>
                  ))}
                </div>
              </>
            )}

            {tool === 'frame' && (
              <>
                <h3>Frame</h3>
                <p className="sub">Add padding, a border and rounded corners. Applied on export.</p>
                <div className="ie-field">
                  <label>Padding <span className="val">{pad}px</span></label>
                  <input type="range" min="0" max="200" value={pad} onChange={(e) => setPad(parseInt(e.target.value))} />
                </div>
                <div className="ie-row" style={{ alignItems: 'center' }}>
                  <div className="ie-field" style={{ flex: 2 }}><label>Padding color</label><input type="color" value={padColor} onChange={(e) => setPadColor(e.target.value)} style={{ width: '100%', height: 32, background: 'none', border: 'none' }} /></div>
                </div>
                <div className="ie-field">
                  <label>Border <span className="val">{border}px</span></label>
                  <input type="range" min="0" max="60" value={border} onChange={(e) => setBorder(parseInt(e.target.value))} />
                </div>
                <div className="ie-field"><label>Border color</label><input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} style={{ width: '100%', height: 32, background: 'none', border: 'none' }} /></div>
                <div className="ie-field">
                  <label>Rounded corners <span className="val">{rounded}px</span></label>
                  <input type="range" min="0" max="200" value={rounded} onChange={(e) => setRounded(parseInt(e.target.value))} />
                </div>
                <button className="ie-btn ghost ie-btn-block" onClick={() => { setPad(0); setBorder(0); setRounded(0); }}>Reset frame</button>
              </>
            )}

            {tool === 'info' && (
              <>
                <h3>Image Info</h3>
                <p className="sub">Dimensions, format and EXIF metadata.</p>
                <div style={{ fontSize: 12.5, lineHeight: 1.9, color: '#d8d8de' }}>
                  <div><b>Size:</b> {base?.naturalWidth} × {base?.naturalHeight}px</div>
                  <div><b>File:</b> {file?.name}</div>
                  {exif === null && <div className="sub">Reading metadata…</div>}
                  {exif && Object.keys(exif).length === 0 && <div className="sub" style={{ marginTop: 8 }}>No EXIF metadata (clean / already stripped).</div>}
                  {exif && exif.Make && <div><b>Camera:</b> {exif.Make} {exif.Model}</div>}
                  {exif && exif.LensModel && <div><b>Lens:</b> {exif.LensModel}</div>}
                  {exif && exif.FNumber && <div><b>Aperture:</b> ƒ/{exif.FNumber}</div>}
                  {exif && exif.ExposureTime && <div><b>Shutter:</b> {exif.ExposureTime < 1 ? '1/' + Math.round(1 / exif.ExposureTime) : exif.ExposureTime}s</div>}
                  {exif && exif.ISO && <div><b>ISO:</b> {exif.ISO}</div>}
                  {exif && exif.FocalLength && <div><b>Focal:</b> {exif.FocalLength}mm</div>}
                  {exif && exif.DateTimeOriginal && <div><b>Taken:</b> {String(exif.DateTimeOriginal).slice(0, 19).replace('T', ' ')}</div>}
                  {exif && exif.latitude && <div style={{ color: '#ff9f0a' }}><b>⚠ GPS:</b> {exif.latitude.toFixed(5)}, {exif.longitude.toFixed(5)}</div>}
                </div>
                {exif && exif.latitude && <p className="sub" style={{ marginTop: 12, color: '#ff9f0a' }}>This image contains location data. Enable “Strip metadata” in Export to remove it.</p>}
              </>
            )}

            {tool === 'bg' && (
              <>
                <h3>Background Removal</h3>
                <p className="sub">100% on-device AI (U²-Net). No upload, fully private & offline.</p>
                <button className="ie-btn primary ie-btn-block" onClick={doRemoveBg} disabled={busy}>🪄 Remove Background</button>
                {bgDone && <p className="sub" style={{ marginTop: 12, color: '#7CFC9A' }}>✓ Background removed. Export as PNG to keep transparency, or add a new background color below.</p>}
                <p className="sub" style={{ marginTop: 14 }}>Tip: after removing, use Crop/Resize and Export → PNG. The checkerboard shows transparent areas.</p>
              </>
            )}

            {tool === 'export' && (
              <>
                <h3>Export</h3>
                <p className="sub">Choose format & quality, then Export.</p>
                <div className="ie-field">
                  <label>Format</label>
                  <select value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="png">PNG (lossless, transparency)</option>
                    <option value="jpeg">JPG (smaller, photos)</option>
                    <option value="webp">WebP (modern, small)</option>
                    <option value="avif">AVIF (smallest, modern)</option>
                    <option value="tiff">TIFF (print)</option>
                  </select>
                </div>
                {['jpeg', 'webp', 'avif', 'tiff'].includes(format) && (
                  <div className="ie-field">
                    <label>Quality <span className="val">{quality}%</span></label>
                    <input type="range" min="10" max="100" value={quality} onChange={(e) => setQuality(parseInt(e.target.value))} />
                  </div>
                )}
                <div className="ie-field">
                  <label>Scale (Retina)</label>
                  <div className="ie-chip-row" style={{ marginBottom: 0 }}>
                    {[1, 2, 3].map((s) => (
                      <button key={s} className={`ie-chip ${exportScale === s ? 'active' : ''}`} onClick={() => setExportScale(s)}>@{s}x</button>
                    ))}
                  </div>
                </div>
                <label className="ie-check"><input type="checkbox" checked={stripMeta} onChange={(e) => setStripMeta(e.target.checked)} /> Strip metadata (EXIF/GPS) — privacy</label>
                <button className="ie-btn primary ie-btn-block" onClick={doExport} disabled={busy}>💾 Export Image</button>
                <p className="ie-size-readout">Saved next to the original as “{file?.name?.replace(/\.[^/.]+$/, '')}_edited.{format === 'jpeg' ? 'jpg' : format}”.</p>
              </>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  const m = (hex || '#ffffff').replace('#', '');
  return { r: parseInt(m.substring(0, 2), 16), g: parseInt(m.substring(2, 4), 16), b: parseInt(m.substring(4, 6), 16), alpha: 1 };
}

function presetFilterCss(a) {
  const parts = [
    `brightness(${a.brightness ?? 1})`,
    `contrast(${a.contrast ?? 1})`,
    `saturate(${a.saturation ?? 1})`,
  ];
  if (a.grayscale) parts.push('grayscale(1)');
  if (a.sepia) parts.push('sepia(0.65)');
  if (a.invert) parts.push('invert(1)');
  return parts.join(' ');
}

export default ImageEditor;
