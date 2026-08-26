// Output formats whose encoder actually honours a target bitrate.
// Lossless (wav, flac, aiff, au, caf) and fixed-rate (amr) formats ignore it,
// so the UI must not offer a bitrate choice for them.
export const LOSSY_AUDIO_FORMATS = ['mp3', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'ac3', 'mp2'];

export const AUDIO_BITRATE_PRESETS = [128, 192, 256, 320];

export function isLossyAudioFormat(format) {
  return !!format && LOSSY_AUDIO_FORMATS.includes(String(format).toLowerCase());
}
