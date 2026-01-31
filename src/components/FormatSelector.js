import React from 'react';

function FormatSelector({ formats, selectedFormat, onSelect, category }) {
  const formatDescriptions = {
    // Video formats
    mp4: 'Most compatible video',
    avi: 'Windows video',
    mkv: 'High quality container',
    mov: 'Apple QuickTime',
    webm: 'Web video',
    wmv: 'Windows Media',
    flv: 'Flash video',
    m4v: 'iTunes video',
    '3gp': 'Mobile video',
    mpeg: 'MPEG video',
    mpg: 'MPEG video',
    ts: 'Transport stream',
    ogv: 'Ogg video',
    vob: 'DVD video',
    mts: 'AVCHD video',
    m2ts: 'Blu-ray video',
    asf: 'Streaming video',
    divx: 'DivX video',
    f4v: 'Flash MP4',
    '3g2': '3GPP2 video',
    dv: 'Digital video',
    gif: 'Animated GIF',

    // Audio formats
    mp3: 'Universal audio',
    wav: 'Lossless audio',
    flac: 'Lossless compressed',
    aac: 'High efficiency',
    ogg: 'Ogg Vorbis',
    m4a: 'Apple audio',
    wma: 'Windows Media',
    opus: 'Opus codec',
    aiff: 'Apple lossless',
    aif: 'Apple lossless',
    amr: 'Mobile audio',
    ac3: 'Dolby Digital',
    mp2: 'MPEG audio',
    au: 'Sun audio',
    caf: 'Core Audio',
    aifc: 'Compressed AIFF',
    mka: 'Matroska audio',
    oga: 'Ogg audio',
    wv: 'WavPack',
    mid: 'MIDI',
    midi: 'MIDI',
    alac: 'Apple Lossless',
    ape: 'Monkey Audio',
    dts: 'DTS audio',

    // Image formats
    png: 'Lossless with alpha',
    jpg: 'Compressed photo',
    jpeg: 'Compressed photo',
    webp: 'Modern web format',
    bmp: 'Bitmap',
    tiff: 'Print quality',
    tif: 'Print quality',
    ico: 'Icon file',
    avif: 'AV1 image',
    heif: 'High efficiency',
    heic: 'Apple HEIF',
    svg: 'Vector graphics',
    psd: 'Photoshop',
    raw: 'Camera RAW',
    cr2: 'Canon RAW',
    nef: 'Nikon RAW',
    arw: 'Sony RAW',
    dng: 'Adobe RAW',
    jfif: 'JPEG variant',
    jxl: 'JPEG XL',
    tga: 'Targa image',
    eps: 'Vector/print',

    // Document formats
    pdf: 'Portable Document',
    docx: 'Microsoft Word',
    doc: 'Word (legacy)',
    txt: 'Plain text',
    html: 'Web page',
    htm: 'Web page',
    md: 'Markdown',
    rtf: 'Rich Text',
    odt: 'OpenDocument',
    epub: 'E-book',
    mobi: 'Kindle',
    azw3: 'Kindle Format 8',

    // Transcription
    srt: 'SubRip subtitles',
    vtt: 'Web subtitles'
  };

  return (
    <div className="format-selector">
      {formats.map((format) => (
        <button
          key={format}
          className={`format-button ${selectedFormat === format ? 'selected' : ''} ${category}`}
          onClick={() => onSelect(format)}
        >
          <span className="format-name">.{format}</span>
          <span className="format-description">{formatDescriptions[format] || format}</span>
        </button>
      ))}
    </div>
  );
}

export default FormatSelector;
