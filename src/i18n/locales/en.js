// English source strings. This file is the single source of truth:
// every other locale must contain exactly these keys (see scripts/check-locales.js).
export default {
  common: {
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    remove: 'Remove',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    retry: 'Try again',
    copy: 'Copy',
    copied: 'Copied',
    loading: 'Loading…',
    settings: 'Settings',
    language: 'Language',
    file: 'File',
    files: 'files',
    output: 'Output',
    quality: 'Quality',
    format: 'Format',
    success: 'Succeeded',
    failed: 'Failed'
  },

  header: {
    tagline: 'Offline • Fast • Private • Unlimited',
    upgrade: 'Upgrade',
    upgradeTitle: 'Upgrade to Pro',
    trialDays: 'Trial · {days}d',
    pro: 'PRO',
    help: 'Help',
    helpTitle: 'Open the user guide',
    languageTitle: 'Change language'
  },

  sidebar: {
    convert: 'Convert',
    tools: 'Tools',
    utilities: 'Utilities',
    history: 'History',
    settings: 'Settings',
    convertVideo: 'Video Converter',
    convertAudio: 'Audio Converter',
    convertImage: 'Image Converter',
    convertDocument: 'Document Converter',
    convertEbook: 'Ebook Converter',
    convertArchive: 'Archive Converter',
    toolsVideo: 'Video Tools',
    toolsImage: 'Image Tools',
    toolsAudio: 'Audio Tools',
    toolsGif: 'GIF Tools',
    toolsPdf: 'PDF Tools',
    toolsTts: 'Text to Speech',
    toolsWatch: 'Automation',
    utilUnit: 'Unit Converter',
    utilColor: 'Color Converter',
    utilText: 'Text Converter',
    utilEncoding: 'Encoding Tools',
    utilNumber: 'Number Base',
    utilTimestamp: 'Timestamp',
    utilData: 'Data Converter',
    utilSubtitle: 'Subtitle Converter',
    utilIcon: 'Icon Converter',
    utilMarkdown: 'Markdown Converter',
    utilFont: 'Font Converter',
    utilHtml: 'HTML Beautifier'
  },

  dropzone: {
    dragFilesHere: 'Drag files here',
    orClickToSelect: 'or click to select',
    filesSelected: 'files selected',
    dragToReorder: 'Drag to reorder',
    addMore: 'Add More',
    addFile: 'Add File',
    dropFilesHere: 'Drop files here',
    removeFile: 'Remove file'
  },

  conversion: {
    title: 'Select Output Format',
    subtitle: 'Choose the format you want to convert to',
    videoFormats: 'Video Formats',
    audioFormats: 'Audio Formats',
    imageFormats: 'Image Formats',
    documentFormats: 'Document Formats',
    transcription: 'AI Transcription',
    transcriptionHint: 'Convert speech to text using AI (Whisper)',
    convertNow: 'Convert Now',
    convertAll: 'Convert All ({count} files)',
    converting: 'Converting {progress}%…',
    mergeIntoSinglePdf: 'Merge into single PDF',
    createSeparatePdfs: 'Create separate PDFs',
    mergeHint: '{count} images will be merged into a single PDF file (by order)',
    separateHint: 'Each image will be saved as a separate PDF file',
    mergeBadge: 'Merge'
  },

  bitrate: {
    title: 'Audio quality',
    unit: 'kbps',
    hintHighest: 'Highest quality, largest file size.',
    hintHigh: 'High quality, moderate file size.',
    hintStandard: 'Standard quality — a good balance.',
    hintLow: 'Smallest file size, audible quality loss.',
    losslessNote: 'The target format is lossless, so no bitrate applies.'
  },

  history: {
    title: 'Conversion History',
    clear: 'Clear History',
    emptyTitle: 'No conversion history yet',
    emptyHint: 'Your converted files will appear here'
  },

  license: {
    continueTrial: 'Continue trial',
    haveKey: 'I already have a license key',
    activate: 'Activate',
    keyPlaceholder: 'Your license key'
  },

  help: {
    title: 'User Guide',
    subtitle: 'Everything Convert Everything can do, and how to get the result you want.',
    searchPlaceholder: 'Search the guide…',
    noResults: 'No section matches your search.',

    gettingStartedTitle: 'Getting started',
    gettingStartedBody: 'Convert Everything works entirely on your own computer. Nothing is uploaded, there is no account, and there is no file size limit.\n\n1. Pick a category in the left sidebar, for example Audio Converter.\n2. Drag your files into the window, or click the drop area to browse for them.\n3. Choose the output format.\n4. Set the quality options that appear for that format.\n5. Click Convert Now.\n\nThe converted file is saved next to the original, with "_converted" added to the name. You can find every result again under History.',

    batchTitle: 'Converting several files at once',
    batchBody: 'Drop as many files as you like. When more than one file is selected the button becomes Convert All, and every file is converted with the same settings.\n\nDrag the file cards to change their order. The order matters when you merge images into a single PDF, because the pages follow the order shown on screen.',

    audioTitle: 'Audio quality and bitrate',
    audioBody: 'When you convert to a lossy format (MP3, AAC, M4A, OGG, Opus, WMA, AC3, MP2) a quality selector appears with 128, 192, 256 and 320 kbps.\n\n320 kbps is the highest bitrate MP3 supports and is the right choice when converting from a lossless source such as FLAC or WAV. The setting is applied as a constant bitrate, so the finished file really is the bitrate you picked.\n\nLossless targets — FLAC, WAV, AIFF, AU, CAF — have no bitrate selector, because their quality is fixed by the format rather than by a bitrate.\n\nOne thing worth knowing: converting a lossy file to a higher bitrate does not restore quality that was already lost. Going from a 128 kbps MP3 to a 320 kbps MP3 only makes the file bigger. Start from the lossless original whenever you have it.',

    videoTitle: 'Video conversion and tools',
    videoBody: 'Video Converter changes the container and codec, for example MKV to MP4. Video Tools adds compressing, trimming, cropping, extracting the audio track and adding a watermark.\n\nExtracting audio: select a video file and choose an audio output format. The audio track is copied out and encoded at the bitrate you select.',

    imageTitle: 'Images and PDF',
    imageBody: 'Image Converter handles PNG, JPG, WebP, GIF, BMP, TIFF and more. Image Tools adds resizing, compressing, background removal and the built-in editor.\n\nTo turn images into a PDF, select the images, choose PDF as the output and decide whether you want one merged document or a separate PDF per image. PDF Tools covers merging, splitting, removing and extracting pages, and annotating.',

    transcriptionTitle: 'AI transcription',
    transcriptionBody: 'Select an audio or video file and choose TXT, SRT or VTT as the output format to transcribe speech to text with Whisper. The model runs on your own machine, so the first run downloads it once and everything after that works offline.',

    automationTitle: 'Automation and watch folders',
    automationBody: 'Under Automation you can point the app at a folder. Any file placed in that folder is converted automatically using the rule you set, which is useful for recordings or scans that always need the same treatment.',

    dependenciesTitle: 'Missing tools',
    dependenciesBody: 'A few conversions rely on external tools that are not bundled. If one is missing the app tells you which it is and how to install it. Everything to do with audio, video and images works without any extra installation.',

    troubleshootingTitle: 'When something goes wrong',
    troubleshootingBody: 'The file is not the quality I expected — check the quality selector before converting; it remembers the last value you used.\n\nThe conversion failed — open History and click the entry to see the error message. The most common causes are a damaged source file or a format the source codec cannot be written to.\n\nI cannot find the output — it is saved in the same folder as the source file. Clicking an item in History opens it.\n\nThe app asks for a tool I do not have — see Missing tools above.',

    privacyTitle: 'Privacy',
    privacyBody: 'All conversions run locally. Your files never leave your computer, the app needs no internet connection to convert, and no usage data about your files is collected.'
  }
};
