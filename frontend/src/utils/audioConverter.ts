/**
 * Audio conversion utilities for browser-side audio processing
 * Converts recorded audio to WAV format compatible with Asterisk
 */

export interface AudioConversionOptions {
  sampleRate?: number;
  numChannels?: number;
  bitDepth?: 16 | 24 | 32;
}

/**
 * Convert audio blob to WAV format
 * @param audioBlob - The original audio blob (WebM, MP3, etc.)
 * @param options - Conversion options
 * @returns Promise<Blob> - WAV formatted audio blob
 */
export async function convertToWav(
  audioBlob: Blob,
  options: AudioConversionOptions = {}
): Promise<Blob> {
  const {
    sampleRate = 8000, // 8kHz is standard for telephony
    numChannels = 1,   // Mono for telephony
    bitDepth = 16      // 16-bit PCM
  } = options;

  // Create audio context with desired sample rate
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate
  });

  try {
    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Resample and convert to mono if needed
    const processedBuffer = await processAudioBuffer(audioBuffer, sampleRate, numChannels);
    
    // Convert to WAV
    const wavBlob = audioBufferToWav(processedBuffer, bitDepth);
    
    return wavBlob;
  } finally {
    // Clean up audio context
    await audioContext.close();
  }
}

/**
 * Process audio buffer - resample and convert to mono
 */
async function processAudioBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate: number,
  targetChannels: number
): Promise<AudioBuffer> {
  const sourceRate = audioBuffer.sampleRate;
  const sourceChannels = audioBuffer.numberOfChannels;
  
  // If no processing needed, return original
  if (sourceRate === targetSampleRate && sourceChannels === targetChannels) {
    return audioBuffer;
  }
  
  // Create offline context for processing
  const offlineContext = new OfflineAudioContext(
    targetChannels,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  );
  
  // Create buffer source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Connect to destination
  source.connect(offlineContext.destination);
  
  // Start processing
  source.start();
  
  // Render the processed audio
  return await offlineContext.startRendering();
}

/**
 * Convert AudioBuffer to WAV blob
 */
function audioBufferToWav(audioBuffer: AudioBuffer, bitDepth: number = 16): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  // WAV header
  let offset = 0;
  
  // RIFF chunk descriptor
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, bufferSize - 8, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;
  
  // fmt sub-chunk
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Sub-chunk size
  view.setUint16(offset, 1, true); offset += 2;  // Audio format (PCM)
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitDepth, true); offset += 2;
  
  // data sub-chunk
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;
  
  // Write audio data
  if (bitDepth === 16) {
    writeAudioData16(view, offset, audioBuffer);
  } else if (bitDepth === 24) {
    writeAudioData24(view, offset, audioBuffer);
  } else if (bitDepth === 32) {
    writeAudioData32(view, offset, audioBuffer);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Write 16-bit audio data
 */
function writeAudioData16(view: DataView, offset: number, audioBuffer: AudioBuffer): void {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
}

/**
 * Write 24-bit audio data
 */
function writeAudioData24(view: DataView, offset: number, audioBuffer: AudioBuffer): void {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const intSample = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
      
      view.setUint8(offset, intSample & 0xFF);
      view.setUint8(offset + 1, (intSample >> 8) & 0xFF);
      view.setUint8(offset + 2, (intSample >> 16) & 0xFF);
      offset += 3;
    }
  }
}

/**
 * Write 32-bit audio data
 */
function writeAudioData32(view: DataView, offset: number, audioBuffer: AudioBuffer): void {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setFloat32(offset, sample, true);
      offset += 4;
    }
  }
}

/**
 * Record audio directly to WAV format using MediaRecorder with custom processing
 */
export class WavRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private options: AudioConversionOptions;

  constructor(options: AudioConversionOptions = {}) {
    this.options = {
      sampleRate: 8000,
      numChannels: 1,
      bitDepth: 16,
      ...options
    };
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        sampleRate: this.options.sampleRate,
        channelCount: this.options.numChannels,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });

    // Use WebM as intermediate format, we'll convert to WAV when stopping
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          // Create WebM blob from chunks
          const webmBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          
          // Convert to WAV
          const wavBlob = await convertToWav(webmBlob, this.options);
          
          // Cleanup
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
          }
          
          resolve(wavBlob);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  get state(): string {
    return this.mediaRecorder?.state || 'inactive';
  }
}