# Audio Recording for Telephony Systems

This guide explains the audio recording and conversion features designed specifically for telephony systems like Asterisk.

## Problem Solved

Asterisk and other telephony systems have specific audio format requirements:
- **Sample Rate**: 8kHz (telephony standard)
- **Channels**: Mono (single channel)
- **Format**: WAV with PCM encoding
- **Bit Depth**: 16-bit

Browser recording typically produces:
- **Sample Rate**: 44.1kHz or 48kHz
- **Channels**: Stereo (dual channel)
- **Format**: WebM, MP3, or other compressed formats

## Components

### AudioRecorder Component

The `AudioRecorder` component now automatically converts recorded audio to telephony-compatible WAV format:

```typescript
import { AudioRecorder } from '../components/AudioRecorder';

<AudioRecorder
  onAudioReady={(audioBlob, s3Url) => {
    // audioBlob is now a WAV file optimized for telephony
    console.log('Audio ready:', s3Url);
  }}
  maxDurationSeconds={300}
/>
```

**Features:**
- Records directly to WAV format (8kHz, mono, 16-bit)
- Real-time conversion during recording
- Automatic upload to S3 with correct MIME type
- Compatible with Asterisk playback

### AudioUpload Component

The `AudioUpload` component supports optional conversion of uploaded files:

```typescript
import { AudioUpload } from '../components/AudioUpload';

<AudioUpload
  convertToWavFormat={true} // Enable WAV conversion
  onAudioReady={(file, s3Url) => {
    // file is converted to WAV if needed
    console.log('Audio uploaded:', s3Url);
  }}
/>
```

**Features:**
- Toggle for WAV conversion
- Supports MP3, WebM, OGG input formats
- Converts to telephony-optimized WAV
- Preserves original for preview playback

## Audio Conversion Utilities

### convertToWav Function

Converts any audio blob to WAV format:

```typescript
import { convertToWav } from '../utils/audioConverter';

const wavBlob = await convertToWav(originalBlob, {
  sampleRate: 8000,  // 8kHz for telephony
  numChannels: 1,    // Mono
  bitDepth: 16       // 16-bit PCM
});
```

### WavRecorder Class

Direct WAV recording with telephony optimization:

```typescript
import { WavRecorder } from '../utils/audioConverter';

const recorder = new WavRecorder({
  sampleRate: 8000,
  numChannels: 1,
  bitDepth: 16
});

await recorder.start();
// ... recording ...
const wavBlob = await recorder.stop();
```

## Asterisk Compatibility

The generated WAV files are compatible with Asterisk's requirements:

- **Format**: WAV (RIFF header)
- **Encoding**: PCM (uncompressed)
- **Sample Rate**: 8000 Hz
- **Channels**: 1 (mono)
- **Bit Depth**: 16-bit
- **Byte Order**: Little-endian

## File Naming Convention

- Recorded files: `recording-{timestamp}.wav`
- Uploaded files: `{original-name}.wav` (extension replaced)

## Browser Support

Requires modern browsers with:
- Web Audio API
- MediaRecorder API
- getUserMedia API

Supported browsers:
- Chrome 66+
- Firefox 60+
- Safari 14.1+
- Edge 79+

## Performance Considerations

- Conversion happens in browser (no server load)
- Uses OfflineAudioContext for efficient processing
- Automatic cleanup of audio contexts
- Memory-efficient streaming for large files

## Error Handling

Common errors and solutions:

1. **Microphone Permission Denied**
   - Solution: Request permission explicitly
   - Fallback: Show permission instructions

2. **Unsupported Audio Format**
   - Solution: Use convertToWav utility
   - Fallback: Show format requirements

3. **Audio Context Creation Failed**
   - Solution: Check browser compatibility
   - Fallback: Disable conversion features

## Testing

Run audio conversion tests:

```bash
npm test audioConverter.test.ts
```

Note: Tests require jsdom environment with Web Audio API mocks.

## Integration with Campaign System

The converted WAV files work seamlessly with:
- Asterisk IVR playback
- Campaign audio messages
- Phone call audio prompts
- Voicemail systems

Example Asterisk dialplan usage:
```
exten => s,1,Playback(https://your-s3-bucket.com/audio/recording-123456.wav)
```

## Troubleshooting

### Asterisk Playback Issues

If Asterisk still can't play the file:

1. Check file permissions on S3
2. Verify CORS settings for S3 bucket
3. Test file format with `file` command:
   ```bash
   file recording.wav
   # Should show: RIFF (little-endian) data, WAVE audio, Microsoft PCM, 16 bit, mono 8000 Hz
   ```

### Browser Recording Issues

1. **No audio recorded**: Check microphone permissions
2. **Poor quality**: Adjust sample rate settings
3. **Large file size**: Use compression or shorter recordings

### Conversion Errors

1. **Out of memory**: Process smaller chunks
2. **Slow conversion**: Use Web Workers for large files
3. **Format not supported**: Check input file format