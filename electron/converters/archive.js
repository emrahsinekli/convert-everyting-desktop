const archiver = require('archiver');
const unzipper = require('unzipper');
const tar = require('tar');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

class ArchiveConverter {
  constructor() {
    this.supportedFormats = ['zip', 'tar', 'tar.gz', 'tgz', 'gz'];
  }

  // Create archive from files
  async createArchive(files, outputPath, options = {}) {
    const { format = 'zip', level = 'normal', onProgress } = options;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Compression level mapping
    const levelMap = {
      'fast': 1,
      'normal': 5,
      'best': 9
    };
    const compressionLevel = levelMap[level] || 5;

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);

      if (format === 'zip') {
        const archive = archiver('zip', {
          zlib: { level: compressionLevel }
        });

        output.on('close', () => {
          if (onProgress) onProgress(100);
          resolve({ outputPath, success: true, size: archive.pointer() });
        });

        archive.on('warning', (err) => {
          if (err.code !== 'ENOENT') {
            console.warn('Archive warning:', err);
          }
        });

        archive.on('error', (err) => {
          reject(new Error(`Archive creation failed: ${err.message}`));
        });

        archive.on('progress', (progress) => {
          if (onProgress && progress.entries.total > 0) {
            const percent = Math.round((progress.entries.processed / progress.entries.total) * 100);
            onProgress(percent);
          }
        });

        archive.pipe(output);

        // Add files to archive
        files.forEach(filePath => {
          const normalizedPath = filePath.replace(/\\/g, '/');
          const fileName = path.basename(normalizedPath);
          archive.file(normalizedPath, { name: fileName });
        });

        archive.finalize();

      } else if (format === 'tar' || format === 'tar.gz' || format === 'tgz') {
        // Create tar archive
        const tarOptions = {
          gzip: format !== 'tar',
          file: outputPath,
          cwd: path.dirname(files[0])
        };

        const fileNames = files.map(f => path.basename(f));

        tar.create(tarOptions, fileNames)
          .then(() => {
            if (onProgress) onProgress(100);
            resolve({ outputPath, success: true });
          })
          .catch(err => {
            reject(new Error(`TAR creation failed: ${err.message}`));
          });
      } else {
        reject(new Error(`Unsupported archive format: ${format}`));
      }
    });
  }

  // Extract archive
  async extractArchive(inputPath, outputDir, options = {}) {
    const { onProgress } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const ext = path.extname(inputPath).toLowerCase();
    const fileName = path.basename(inputPath).toLowerCase();

    return new Promise((resolve, reject) => {
      if (ext === '.zip') {
        // Extract ZIP
        fs.createReadStream(inputPath)
          .pipe(unzipper.Extract({ path: outputDir }))
          .on('close', () => {
            if (onProgress) onProgress(100);
            resolve({ outputDir, success: true });
          })
          .on('error', (err) => {
            reject(new Error(`ZIP extraction failed: ${err.message}`));
          });

      } else if (ext === '.tar' || fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz') || ext === '.gz') {
        // Extract TAR or TAR.GZ
        const isGzipped = fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz') || ext === '.gz';

        tar.extract({
          file: inputPath,
          cwd: outputDir,
          gzip: isGzipped
        })
          .then(() => {
            if (onProgress) onProgress(100);
            resolve({ outputDir, success: true });
          })
          .catch(err => {
            reject(new Error(`TAR extraction failed: ${err.message}`));
          });

      } else {
        reject(new Error(`Unsupported archive format: ${ext}`));
      }
    });
  }

  // Get archive info
  async getArchiveInfo(inputPath) {
    const ext = path.extname(inputPath).toLowerCase();
    const stats = fs.statSync(inputPath);

    return {
      path: inputPath,
      size: stats.size,
      format: ext.slice(1),
      modified: stats.mtime
    };
  }
}

module.exports = ArchiveConverter;
