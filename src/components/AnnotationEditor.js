import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KImage, Rect, Ellipse, Arrow, Line, Text, Transformer } from 'react-konva';

// Self-contained annotation editor. Renders the working image on a Konva stage,
// lets the user add text/arrows/shapes/highlight/redact/blur, then bakes them
// into the image (overlay PNG + blur-region list) via the main process.
function AnnotationEditor({ imageDataUrl, naturalWidth, naturalHeight, onApply, busy }) {
  const [img, setImg] = useState(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600, scale: 1 });
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#ff3b30');
  const [strokeW, setStrokeW] = useState(4);
  const [fontSize, setFontSize] = useState(28);
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingText, setEditingText] = useState(null); // {id, x, y, value}
  const drawing = useRef(null);
  const stageRef = useRef();
  const trRef = useRef();
  const annotLayerRef = useRef();
  const wrapRef = useRef();

  // Load image + fit stage to container
  useEffect(() => {
    if (!imageDataUrl) return;
    const im = new window.Image();
    im.onload = () => {
      setImg(im);
      const maxW = wrapRef.current ? wrapRef.current.clientWidth - 40 : 800;
      const maxH = (wrapRef.current ? wrapRef.current.clientHeight : 600) - 40;
      const scale = Math.min(maxW / im.naturalWidth, maxH / im.naturalHeight, 1);
      setStageSize({ w: Math.round(im.naturalWidth * scale), h: Math.round(im.naturalHeight * scale), scale });
    };
    im.src = imageDataUrl;
  }, [imageDataUrl]);

  // Attach transformer to selected node
  useEffect(() => {
    if (!trRef.current) return;
    const stage = stageRef.current;
    if (selectedId && stage) {
      const node = stage.findOne('#' + selectedId);
      trRef.current.nodes(node ? [node] : []);
    } else {
      trRef.current.nodes([]);
    }
    trRef.current.getLayer() && trRef.current.getLayer().batchDraw();
  }, [selectedId, shapes]);

  const addShape = (s) => setShapes((p) => [...p, s]);
  const updateShape = (id, attrs) => setShapes((p) => p.map((s) => (s.id === id ? { ...s, ...attrs } : s)));
  const deleteSelected = useCallback(() => {
    if (selectedId) { setShapes((p) => p.filter((s) => s.id !== selectedId)); setSelectedId(null); }
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingText) deleteSelected(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, editingText, deleteSelected]);

  const newId = () => 'a' + Math.random().toString(36).slice(2, 9);

  const onMouseDown = (e) => {
    if (tool === 'select') {
      if (e.target === e.target.getStage() || e.target.attrs.name === 'bg') setSelectedId(null);
      return;
    }
    const pos = e.target.getStage().getPointerPosition();
    const id = newId();
    if (tool === 'text') {
      const s = { id, type: 'text', x: pos.x, y: pos.y, text: 'Text', fill: color, fontSize };
      addShape(s); setEditingText({ id, x: pos.x, y: pos.y, value: 'Text' }); setTool('select'); setSelectedId(id);
      return;
    }
    if (tool === 'pen') {
      drawing.current = { id, type: 'pen', points: [pos.x, pos.y], stroke: color, strokeWidth: strokeW };
      addShape(drawing.current);
      return;
    }
    drawing.current = { id, type: tool, x: pos.x, y: pos.y, w: 0, h: 0,
      points: [pos.x, pos.y, pos.x, pos.y], stroke: color, strokeWidth: strokeW,
      fill: tool === 'highlight' ? hexA(color, 0.35) : (tool === 'redact' ? '#000000' : (tool === 'blur' ? 'rgba(120,120,140,0.45)' : 'transparent')) };
    addShape(drawing.current);
  };

  const onMouseMove = (e) => {
    if (!drawing.current) return;
    const pos = e.target.getStage().getPointerPosition();
    const d = drawing.current;
    if (d.type === 'pen') { updateShape(d.id, { points: [...shapesById(d.id).points, pos.x, pos.y] }); return; }
    if (d.type === 'arrow') { updateShape(d.id, { points: [d.x, d.y, pos.x, pos.y] }); return; }
    updateShape(d.id, { w: pos.x - d.x, h: pos.y - d.y });
  };
  const shapesById = (id) => shapes.find((s) => s.id === id) || drawing.current;

  const onMouseUp = () => {
    if (drawing.current) {
      const d = shapesById(drawing.current.id);
      // discard tiny shapes
      if (d && d.type !== 'pen' && d.type !== 'arrow' && Math.abs(d.w) < 4 && Math.abs(d.h) < 4) {
        setShapes((p) => p.filter((s) => s.id !== d.id));
      }
      drawing.current = null;
    }
  };

  // normalize rect (handle negative w/h)
  const rectAttrs = (s) => ({
    x: s.w < 0 ? s.x + s.w : s.x, y: s.h < 0 ? s.y + s.h : s.y,
    width: Math.abs(s.w), height: Math.abs(s.h),
  });

  const apply = async () => {
    setSelectedId(null);
    // wait a tick so transformer detaches before export
    await new Promise((r) => setTimeout(r, 50));
    const pixelRatio = naturalWidth / stageSize.w;
    // blur regions in natural coords (exclude from overlay)
    const blurRegions = shapes.filter((s) => s.type === 'blur').map((s) => {
      const r = rectAttrs(s);
      return { x: r.x * pixelRatio, y: r.y * pixelRatio, width: r.width * pixelRatio, height: r.height * pixelRatio };
    });
    // overlay: hide blur placeholders, export annotation layer only
    const layer = annotLayerRef.current;
    const blurNodes = [];
    shapes.filter((s) => s.type === 'blur').forEach((s) => {
      const n = stageRef.current.findOne('#' + s.id); if (n) { blurNodes.push(n); n.hide(); }
    });
    layer.batchDraw();
    const overlayDataUrl = layer.toDataURL({ pixelRatio, mimeType: 'image/png' });
    blurNodes.forEach((n) => n.show()); layer.batchDraw();
    onApply({ overlayDataUrl, blurRegions });
  };

  const TOOLS = [
    { id: 'select', ic: '🖱️', label: 'Select' },
    { id: 'text', ic: '🔤', label: 'Text' },
    { id: 'arrow', ic: '↗', label: 'Arrow' },
    { id: 'rect', ic: '▭', label: 'Box' },
    { id: 'ellipse', ic: '◯', label: 'Circle' },
    { id: 'pen', ic: '✏️', label: 'Pen' },
    { id: 'highlight', ic: '🖍️', label: 'Highlight' },
    { id: 'redact', ic: '⬛', label: 'Redact' },
    { id: 'blur', ic: '🌫️', label: 'Blur' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.10)', background: '#242426' }}>
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => { setTool(t.id); setSelectedId(null); }}
            style={{ background: tool === t.id ? '#5e5ce6' : '#3a3a3c', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 11px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {t.ic} {t.label}
          </button>
        ))}
        <span style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
        <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (selectedId) updateShape(selectedId, { stroke: e.target.value, fill: shapeFill(shapes.find(s=>s.id===selectedId), e.target.value) }); }} title="Color" style={{ width: 34, height: 30, border: 'none', background: 'none', cursor: 'pointer' }} />
        <label style={{ color: '#aeaeb2', fontSize: 12 }}>Size
          <input type="range" min="1" max="30" value={strokeW} onChange={(e) => setStrokeW(parseInt(e.target.value))} style={{ verticalAlign: 'middle', marginLeft: 6, accentColor: '#5e5ce6' }} />
        </label>
        <label style={{ color: '#aeaeb2', fontSize: 12 }}>Font
          <input type="range" min="12" max="96" value={fontSize} onChange={(e) => { setFontSize(parseInt(e.target.value)); if (selectedId) updateShape(selectedId, { fontSize: parseInt(e.target.value) }); }} style={{ verticalAlign: 'middle', marginLeft: 6, accentColor: '#5e5ce6' }} />
        </label>
        <span style={{ flex: 1 }} />
        <button onClick={deleteSelected} disabled={!selectedId} style={{ background: 'transparent', color: '#ffb4b4', border: '1px solid #5a3a3a', borderRadius: 7, padding: '7px 11px', cursor: 'pointer' }}>🗑 Delete</button>
        <button onClick={() => { setShapes([]); setSelectedId(null); }} style={{ background: 'transparent', color: '#d8d8de', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '7px 11px', cursor: 'pointer' }}>Clear</button>
        <button onClick={apply} disabled={busy || !shapes.length} style={{ background: 'linear-gradient(90deg,#5e5ce6,#6f6ce8)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontWeight: 700 }}>✓ Apply</button>
      </div>

      <div ref={wrapRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#161617', overflow: 'auto', position: 'relative' }}>
        {img && (
          <Stage ref={stageRef} width={stageSize.w} height={stageSize.h}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,.5)', cursor: tool === 'select' ? 'default' : 'crosshair' }}>
            <Layer>
              <KImage image={img} width={stageSize.w} height={stageSize.h} name="bg" />
            </Layer>
            <Layer ref={annotLayerRef}>
              {shapes.map((s) => {
                const common = {
                  key: s.id, id: s.id, draggable: tool === 'select',
                  onClick: () => tool === 'select' && setSelectedId(s.id),
                  onTap: () => setSelectedId(s.id),
                  onDragEnd: (e) => updateShape(s.id, { x: e.target.x(), y: e.target.y() }),
                };
                if (s.type === 'text') return <Text {...common} x={s.x} y={s.y} text={s.text} fill={s.fill} fontSize={s.fontSize} fontStyle="bold"
                  onDblClick={() => setEditingText({ id: s.id, x: s.x, y: s.y, value: s.text })}
                  onTransformEnd={(e)=>{const n=e.target;updateShape(s.id,{fontSize:Math.max(8,s.fontSize*n.scaleY())});n.scaleX(1);n.scaleY(1);}} />;
                if (s.type === 'arrow') return <Arrow {...common} points={s.points} stroke={s.stroke} fill={s.stroke} strokeWidth={s.strokeWidth} pointerLength={s.strokeWidth*2.5} pointerWidth={s.strokeWidth*2.5} />;
                if (s.type === 'pen') return <Line {...common} points={s.points} stroke={s.stroke} strokeWidth={s.strokeWidth} tension={0.4} lineCap="round" lineJoin="round" />;
                if (s.type === 'ellipse') { const r = rectAttrs(s); return <Ellipse {...common} x={r.x + r.width/2} y={r.y + r.height/2} radiusX={r.width/2} radiusY={r.height/2} stroke={s.stroke} strokeWidth={s.strokeWidth} fill={s.type==='highlight'?s.fill:'transparent'}
                  onDragEnd={(e)=>updateShape(s.id,{x:s.x+e.target.x()-(r.x+r.width/2),y:s.y+e.target.y()-(r.y+r.height/2)})} />; }
                // rect-like: rect, highlight, redact, blur
                const r = rectAttrs(s);
                return <Rect {...common} x={r.x} y={r.y} width={r.width} height={r.height}
                  stroke={s.type==='redact'||s.type==='blur'?undefined:s.stroke} strokeWidth={s.strokeWidth}
                  fill={s.type==='rect'?'transparent':s.fill} cornerRadius={s.type==='blur'?4:0}
                  onTransformEnd={(e)=>{const n=e.target;updateShape(s.id,{x:n.x(),y:n.y(),w:Math.max(4,n.width()*n.scaleX()),h:Math.max(4,n.height()*n.scaleY())});n.scaleX(1);n.scaleY(1);}} />;
              })}
              <Transformer ref={trRef} rotateEnabled={false} ignoreStroke />
            </Layer>
          </Stage>
        )}

        {editingText && (
          <textarea autoFocus defaultValue={editingText.value}
            onBlur={(e) => { updateShape(editingText.id, { text: e.target.value || ' ' }); setEditingText(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); } }}
            style={{ position: 'absolute', left: (wrapRef.current ? (wrapRef.current.clientWidth - stageSize.w)/2 : 0) + editingText.x, top: (wrapRef.current ? (wrapRef.current.clientHeight - stageSize.h)/2 : 0) + editingText.y, fontSize, fontWeight: 'bold', color, background: 'rgba(0,0,0,.5)', border: '1px solid #5e5ce6', borderRadius: 4, padding: 2, minWidth: 80, zIndex: 10 }} />
        )}
      </div>
    </div>
  );
}

function hexA(hex, a) {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16), g = parseInt(m.substring(2, 4), 16), b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function shapeFill(s, c) {
  if (!s) return 'transparent';
  if (s.type === 'highlight') return hexA(c, 0.35);
  return s.fill;
}

export default AnnotationEditor;
