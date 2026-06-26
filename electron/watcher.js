// Watched Folders — auto-convert files dropped into a folder, fully offline.
// Uses chokidar with awaitWriteFinish so partially-written files are skipped.
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

class WatchManager {
  // store: electron-store; convertImage(inputPath, outputPath, outFormat) -> Promise
  // notify(title, body): optional notification callback
  constructor(store, convertImage, notify) {
    this.store = store;
    this.convertImage = convertImage;
    this.notify = notify || (() => {});
    this.watchers = new Map(); // id -> chokidar watcher
  }

  list() {
    return this.store.get('watchedFolders', []);
  }

  // Recreate watchers for all enabled configs (call on app ready)
  startAll() {
    for (const cfg of this.list()) {
      if (cfg.enabled) this._startWatcher(cfg);
    }
  }

  add(cfg) {
    const all = this.list();
    const entry = {
      id: 'w' + Date.now(),
      folder: cfg.folder,
      types: cfg.types || ['webp', 'heic', 'heif'],
      outFormat: cfg.outFormat || 'jpeg',
      subfolder: cfg.subfolder !== false, // save to /Converted by default
      enabled: true,
    };
    all.push(entry);
    this.store.set('watchedFolders', all);
    this._startWatcher(entry);
    return entry;
  }

  remove(id) {
    const all = this.list().filter((w) => w.id !== id);
    this.store.set('watchedFolders', all);
    this._stopWatcher(id);
  }

  setEnabled(id, enabled) {
    const all = this.list().map((w) => (w.id === id ? { ...w, enabled } : w));
    this.store.set('watchedFolders', all);
    const cfg = all.find((w) => w.id === id);
    if (enabled && cfg) this._startWatcher(cfg);
    else this._stopWatcher(id);
  }

  _stopWatcher(id) {
    const w = this.watchers.get(id);
    if (w) { w.close(); this.watchers.delete(id); }
  }

  _startWatcher(cfg) {
    this._stopWatcher(cfg.id);
    if (!fs.existsSync(cfg.folder)) return;
    const watcher = chokidar.watch(cfg.folder, {
      ignoreInitial: true,            // don't convert files already there
      depth: 0,                       // top level only
      awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 },
    });
    watcher.on('add', (filePath) => this._onFile(cfg, filePath));
    this.watchers.set(cfg.id, watcher);
  }

  async _onFile(cfg, filePath) {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (!cfg.types.includes(ext)) return;
    // skip our own outputs
    if (path.basename(path.dirname(filePath)) === 'Converted') return;
    try {
      const dir = cfg.subfolder ? path.join(cfg.folder, 'Converted') : cfg.folder;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const base = path.basename(filePath, path.extname(filePath));
      const outExt = cfg.outFormat === 'jpeg' ? 'jpg' : cfg.outFormat;
      const outputPath = path.join(dir, `${base}.${outExt}`);
      await this.convertImage(filePath, outputPath, cfg.outFormat);
      this.notify('Converted', `${path.basename(filePath)} → ${outExt.toUpperCase()}`);
    } catch (e) {
      this.notify('Conversion failed', path.basename(filePath));
    }
  }
}

module.exports = WatchManager;
