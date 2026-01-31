# Convert Everything to Everything

> Universal File Converter - Video, Audio, Images, Documents & AI Transcription

A powerful desktop application that converts any file format to any other supported format. Works offline, cross-platform (Windows, macOS, Linux).

## Features

### Video Conversion
- **Input:** MP4, AVI, MKV, MOV, WebM, WMV, FLV
- **Output:** MP4, AVI, MKV, MOV, WebM, GIF
- Quality presets (Low, Medium, High, Ultra)
- Resolution scaling
- Frame rate adjustment

### Audio Conversion
- **Input:** MP3, WAV, FLAC, AAC, OGG, M4A, WMA
- **Output:** MP3, WAV, FLAC, AAC, OGG, M4A
- Extract audio from video
- Bitrate control
- Audio normalization

### Image Conversion
- **Input:** PNG, JPG, JPEG, WebP, GIF, BMP, TIFF, HEIC, SVG
- **Output:** PNG, JPG, WebP, GIF, BMP, TIFF, ICO, AVIF
- Quality adjustment
- Resize & crop
- Batch conversion

### Document Conversion
- **Input:** PDF, DOCX, DOC, TXT, HTML, MD
- **Output:** PDF, DOCX, TXT, HTML, MD
- Images to PDF
- PDF merge & split

### AI Transcription (Whisper)
- **Input:** Any video or audio file
- **Output:** TXT, SRT (subtitles), VTT (web captions)
- 100% offline processing
- Multiple language support
- Model sizes: tiny, base, small, medium, large

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Setup

```bash
# Clone or download the project
cd "convert everyting to everyting"

# Install dependencies
npm install

# Start the application
npm start
```

### For AI Transcription (Optional)

To enable AI-powered speech-to-text:

1. Install Python 3.8+
2. Run: `pip install openai-whisper`
3. Restart the application

## Building for Distribution

```bash
# Build for current platform
npm run electron-build

# Output will be in /dist folder
```

### Platform-specific builds:
- **Windows:** Creates NSIS installer and portable EXE
- **macOS:** Creates DMG and ZIP
- **Linux:** Creates AppImage and DEB

## Usage

1. **Drop files** into the application or click to browse
2. **Select output format** from available options
3. **Click Convert** to start conversion
4. **Batch convert** multiple files at once

## Supported Conversions

| From | To |
|------|-----|
| Video | Video, Audio, GIF, Text (AI) |
| Audio | Audio, Text (AI) |
| Image | Image, PDF |
| Document | Document |

## Architecture

```
convert-everything/
├── electron/           # Electron main process
│   ├── main.js        # Main entry point
│   ├── preload.js     # Context bridge
│   ├── converters/    # Conversion modules
│   │   ├── video.js   # FFmpeg video processing
│   │   ├── audio.js   # FFmpeg audio processing
│   │   ├── image.js   # Sharp image processing
│   │   ├── document.js# PDF, DOCX conversion
│   │   └── transcription.js # Whisper AI
│   └── utils/
│       └── dependencyManager.js
├── src/               # React frontend
│   ├── App.js
│   ├── components/
│   └── styles/
└── public/
```

## Technologies Used

- **Electron** - Cross-platform desktop app
- **React** - User interface
- **FFmpeg** - Video/audio processing
- **Sharp** - Image processing
- **pdf-lib** - PDF manipulation
- **mammoth** - DOCX parsing
- **OpenAI Whisper** - AI transcription

## License

MIT

---

**Convert Everything to Everything** - Because you should be able to convert anything to anything.
