const path = require('path');
const fs = require('fs');

// This module now only provides voice list for Chatterbox
// Actual TTS is handled by ChatterboxManager

class TextToSpeechConverter {
  constructor() {
    this.supportedInputFormats = ['txt'];
    this.supportedOutputFormats = ['wav', 'mp3'];

    // Chatterbox supported languages (23 languages)
    this.languages = [
      { id: 'en', name: 'English', flag: '🇺🇸' },
      { id: 'tr', name: 'Turkish', flag: '🇹🇷' },
      { id: 'de', name: 'German', flag: '🇩🇪' },
      { id: 'fr', name: 'French', flag: '🇫🇷' },
      { id: 'es', name: 'Spanish', flag: '🇪🇸' },
      { id: 'it', name: 'Italian', flag: '🇮🇹' },
      { id: 'pt', name: 'Portuguese', flag: '🇧🇷' },
      { id: 'ru', name: 'Russian', flag: '🇷🇺' },
      { id: 'ja', name: 'Japanese', flag: '🇯🇵' },
      { id: 'ko', name: 'Korean', flag: '🇰🇷' },
      { id: 'zh', name: 'Chinese', flag: '🇨🇳' },
      { id: 'ar', name: 'Arabic', flag: '🇸🇦' },
      { id: 'hi', name: 'Hindi', flag: '🇮🇳' },
      { id: 'nl', name: 'Dutch', flag: '🇳🇱' },
      { id: 'pl', name: 'Polish', flag: '🇵🇱' },
      { id: 'sv', name: 'Swedish', flag: '🇸🇪' },
      { id: 'da', name: 'Danish', flag: '🇩🇰' },
      { id: 'fi', name: 'Finnish', flag: '🇫🇮' },
      { id: 'no', name: 'Norwegian', flag: '🇳🇴' },
      { id: 'el', name: 'Greek', flag: '🇬🇷' },
      { id: 'he', name: 'Hebrew', flag: '🇮🇱' },
      { id: 'id', name: 'Indonesian', flag: '🇮🇩' },
      { id: 'ms', name: 'Malay', flag: '🇲🇾' }
    ];
  }

  getLanguages() {
    return this.languages;
  }

  // Read text from file
  readTextFile(inputPath) {
    const text = fs.readFileSync(inputPath, 'utf-8');
    if (!text || text.trim().length === 0) {
      throw new Error('Input file is empty');
    }
    return text;
  }
}

module.exports = TextToSpeechConverter;
