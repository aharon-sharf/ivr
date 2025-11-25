# Audio Recording Features

This document describes the audio recording and management features implemented for the Mass Voice Campaign System.

## Overview

The audio recording system provides multiple ways for users to create and manage audio messages for their campaigns:

1. **In-Browser Recording** - Record directly using the browser's MediaRecorder API
2. **File Upload** - Upload pre-recorded audio files (MP3, WAV, OGG, WebM)
3. **Phone-In Recording** - Call a dedicated number to record messages
4. **Audio Library** - Manage and reuse previously recorded audio files

## Components

### AudioRecorder

Records audio directly in the browser using the MediaRecorder API.

**Features:**
- Real-time recording with pause/resume functionality
- Visual recording timer with progress bar
- Maximum duration enforcement (default: 5 minutes)
- Audio preview player
- Microphone permission handling
- Recording deletion and re-recording

**Props:**
```typescript
interface AudioRecorderProps {
  onAudioReady: (audioBlob: Blob, audioUrl: string) => void;
  onError?: (error: string) => void;
  maxDurationSeconds?: number; // Default: 300 (5 minutes)
}
```

**Usage:**
```tsx
<AudioRecorder
  onAudioReady={(blob, url) => {
    console.log('Recording ready:', url);
  }}
  onError={(error) => console.error(error)}
  maxDurationSeconds={300}
/>
```

### AudioUpload

Handles audio file uploads with drag-and-drop support.

**Features:**
- Drag-and-drop file upload
- File validation (format and size)
- Upload progress indicator
- Audio preview player
- Supported formats: MP3, WAV, OGG, WebM
- Maximum file size: 10MB (configurable)

**Props:**
```typescript
interface AudioUploadProps {
  onAudioReady: (file: File, audioUrl: string) => void;
  onError?: (error: string) => void;
  maxSizeMB?: number; // Default: 10
  acceptedFormats?: string[];
}
```

**Usage:**
```tsx
<AudioUpload
  onAudioReady={(file, url) => {
    console.log('File uploaded:', file.name);
  }}
  onError={(error) => console.error(error)}
  maxSizeMB={10}
/>
```

### PhoneInRecording

Displays instructions for recording via phone call.

**Features:**
- Step-by-step recording instructions
- Dedicated phone number display
- Recording tips and best practices
- Status tracking (waiting, recording, completed)

**Props:**
```typescript
interface PhoneInRecordingProps {
  phoneNumber?: string; // Default: '+972-3-123-4567'
  recordingId?: string;
  onRecordingComplete?: (recordingId: string) => void;
}
```

**Usage:**
```tsx
<PhoneInRecording
  phoneNumber="+972-3-123-4567"
  onRecordingComplete={(id) => {
    console.log('Recording completed:', id);
  }}
/>
```

### AudioLibrary

Manages a library of reusable audio recordings.

**Features:**
- List view of all saved audio files
- Audio preview player
- Edit metadata (name, description, tags)
- Delete audio files
- Select audio for campaigns
- Tag-based organization
- File information display (duration, size, date)

**Props:**
```typescript
interface AudioLibraryProps {
  onSelectAudio: (audio: AudioItem) => void;
  selectedAudioId?: string;
}
```

**Usage:**
```tsx
<AudioLibrary
  onSelectAudio={(audio) => {
    console.log('Selected audio:', audio.name);
  }}
  selectedAudioId="audio-123"
/>
```

### AudioManager

Unified component that combines all audio recording methods in a tabbed interface.

**Features:**
- Tabbed interface for all recording methods
- Consistent audio selection handling
- Current audio status display
- Seamless switching between methods

**Props:**
```typescript
interface AudioManagerProps {
  onAudioSelected: (audioUrl: string, audioSource: string) => void;
  currentAudioUrl?: string;
}
```

**Usage:**
```tsx
<AudioManager
  onAudioSelected={(url, source) => {
    console.log('Audio selected from:', source);
    // Update campaign configuration
  }}
  currentAudioUrl={campaign.audioFileUrl}
/>
```

## API Integration

The `audio.ts` API module provides methods for:

- Getting presigned S3 upload URLs
- Uploading audio to S3
- Managing audio library metadata
- Tracking phone recording status

**Key Methods:**
```typescript
// Upload audio file
const audio = await audioApi.uploadAudio(file, {
  name: 'Campaign Message',
  description: 'Welcome message for donors',
  tags: ['welcome', 'donation'],
});

// Get audio library
const library = await audioApi.getLibrary();

// Update audio metadata
await audioApi.updateAudio(audioId, {
  name: 'Updated Name',
  tags: ['updated', 'tag'],
});

// Delete audio
await audioApi.deleteAudio(audioId);
```

## Integration with Campaign Creation

The AudioManager is integrated into the Campaign Creation flow (step 2: Configuration):

```tsx
// In CampaignCreatePage.tsx
{(formData.type === 'voice' || formData.type === 'hybrid') && (
  <Grid item xs={12}>
    <AudioManager
      onAudioSelected={(audioUrl, audioSource) => {
        updateFormData('audioFileUrl', audioUrl);
      }}
      currentAudioUrl={formData.audioFileUrl}
    />
  </Grid>
)}
```

## Browser Compatibility

### MediaRecorder API Support
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Supported (iOS 14.3+)
- Opera: ✅ Full support

### Audio Formats
- **WebM**: Primary format for browser recording (Opus codec)
- **MP3**: Widely supported for playback and upload
- **WAV**: Uncompressed, high quality
- **OGG**: Open format with good compression

## Security Considerations

1. **Microphone Permissions**: Users must grant microphone access for in-browser recording
2. **File Validation**: All uploads are validated for format and size
3. **S3 Presigned URLs**: Secure, time-limited upload URLs
4. **Authentication**: All API calls require valid JWT tokens

## Performance Optimization

1. **Audio Compression**: WebM format provides good quality with small file sizes
2. **Lazy Loading**: Audio files are loaded on-demand
3. **Caching**: Audio URLs are cached to avoid re-fetching
4. **Progress Indicators**: Visual feedback during upload/recording

## Error Handling

All components include comprehensive error handling:

- Microphone permission denied
- File size/format validation errors
- Network upload failures
- Audio playback errors
- Browser compatibility issues

## Future Enhancements

1. **Audio Editing**: Trim, fade in/out, volume adjustment
2. **Text-to-Speech**: Generate audio from text using Amazon Polly
3. **Audio Templates**: Pre-built message templates
4. **Multi-language Support**: Record in multiple languages
5. **Audio Analytics**: Track which recordings perform best
6. **Batch Upload**: Upload multiple files at once
7. **Audio Waveform Visualization**: Visual representation of audio

## Testing

To test the audio recording features:

1. **In-Browser Recording**:
   - Grant microphone permission
   - Click "Start Recording"
   - Speak into microphone
   - Click "Stop" and verify playback

2. **File Upload**:
   - Drag and drop an audio file
   - Verify file validation
   - Check preview playback

3. **Phone-In Recording**:
   - Note the phone number
   - Follow instructions
   - Verify recording appears in dashboard

4. **Audio Library**:
   - Add audio to library
   - Edit metadata
   - Select for campaign
   - Delete audio

## Requirements Validation

This implementation satisfies **Requirement 4.1** from the design document:

> "WHEN a recipient answers a call, THEN the IVR SHALL play the configured pre-recorded audio message"

The audio recording features provide multiple methods for users to create and manage these pre-recorded messages, ensuring campaigns have high-quality audio content.
