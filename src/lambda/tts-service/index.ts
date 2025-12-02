/**
 * TTS Service Lambda
 * 
 * This Lambda function provides Text-to-Speech functionality using Amazon Polly.
 * It supports Hebrew and English voices (neural engine), implements audio caching
 * in S3 (hash text content for cache key), and returns S3 URL for generated audio.
 * 
 * Responsibilities:
 * - Create function to call Polly synthesizeSpeech API
 * - Support Hebrew and English voices (neural engine)
 * - Implement audio caching in S3 (hash text content for cache key)
 * - Return S3 URL for generated audio
 * 
 * Validates: Requirements 7.2, 7.5
 */

import { Context } from 'aws-lambda';
import { 
  PollyClient, 
  SynthesizeSpeechCommand,
  Engine,
  OutputFormat,
  VoiceId 
} from '@aws-sdk/client-polly';
import { 
  S3Client, 
  PutObjectCommand, 
  HeadObjectCommand 
} from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { Readable } from 'stream';

// Polly client
let pollyClient: PollyClient | null = null;

// S3 client
let s3Client: S3Client | null = null;

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_AUDIO_BUCKET || 'campaign-audio-files';
const S3_PREFIX = 'tts-generated/';
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false';

// Types
interface PollyOptions {
  voiceId: VoiceId;
  languageCode: string;
  engine: Engine;
  outputFormat: OutputFormat;
  sampleRate: string;
}

interface AudioFile {
  url: string;
  duration: number;
  format: string;
  textHash: string;
  cached: boolean;
}

interface TTSRequest {
  text: string;
  language?: 'hebrew' | 'english' | 'arabic';
  voiceId?: string;
  engine?: 'standard' | 'neural';
  outputFormat?: 'mp3' | 'ogg_vorbis' | 'pcm';
  sampleRate?: string;
}

/**
 * Initialize Polly client
 */
function getPollyClient(): PollyClient {
  if (!pollyClient) {
    pollyClient = new PollyClient({ region: AWS_REGION });
    console.log('Polly client initialized');
  }
  return pollyClient;
}

/**
 * Initialize S3 client
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: AWS_REGION });
    console.log('S3 client initialized');
  }
  return s3Client;
}

/**
 * Generate hash for text content (for cache key)
 */
function generateTextHash(text: string, options: PollyOptions): string {
  const content = `${text}|${options.voiceId}|${options.languageCode}|${options.engine}|${options.outputFormat}|${options.sampleRate}`;
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get default voice for language
 */
function getDefaultVoice(language: string): { voiceId: VoiceId; languageCode: string } {
  switch (language.toLowerCase()) {
    case 'hebrew':
      // Note: Polly doesn't have native Hebrew voice yet
      // Using Arabic voice as closest alternative
      return { voiceId: 'Zeina' as VoiceId, languageCode: 'arb' };
    
    case 'english':
      return { voiceId: 'Joanna' as VoiceId, languageCode: 'en-US' };
    
    case 'arabic':
      return { voiceId: 'Zeina' as VoiceId, languageCode: 'arb' };
    
    default:
      return { voiceId: 'Joanna' as VoiceId, languageCode: 'en-US' };
  }
}

/**
 * Check if audio file exists in S3 cache
 */
async function checkCache(textHash: string, format: string): Promise<string | null> {
  if (!CACHE_ENABLED) {
    return null;
  }
  
  try {
    const s3 = getS3Client();
    const key = `${S3_PREFIX}${textHash}.${format}`;
    
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    
    await s3.send(command);
    
    // File exists, return URL
    const url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    console.log(`Cache hit: ${url}`);
    return url;
    
  } catch (error: any) {
    if (error.name === 'NotFound') {
      console.log('Cache miss');
      return null;
    }
    console.error('Error checking cache:', error);
    return null;
  }
}

/**
 * Upload audio to S3
 */
async function uploadToS3(
  audioStream: Readable,
  textHash: string,
  format: string,
  contentType: string
): Promise<string> {
  try {
    const s3 = getS3Client();
    const key = `${S3_PREFIX}${textHash}.${format}`;
    
    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'max-age=31536000', // 1 year cache
    });
    
    await s3.send(command);
    
    const url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    console.log(`Audio uploaded to S3: ${url}`);
    return url;
    
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

/**
 * Estimate audio duration based on text length
 * Rough estimate: ~150 words per minute, ~5 characters per word
 */
function estimateDuration(text: string): number {
  const charactersPerSecond = 12.5; // 150 words/min * 5 chars/word / 60 sec
  const duration = Math.ceil(text.length / charactersPerSecond);
  return duration;
}

/**
 * Synthesize speech using Amazon Polly
 * 
 * **Feature: mass-voice-campaign-system, Property 29: TTS text-to-speech conversion**
 * For any text content requiring TTS fallback, the system should convert the text 
 * into synthesized speech audio.
 */
export async function synthesizeSpeech(request: TTSRequest): Promise<AudioFile> {
  try {
    console.log('Synthesizing speech:', request.text.substring(0, 50) + '...');
    
    // Get voice configuration
    const language = request.language || 'english';
    const defaultVoice = getDefaultVoice(language);
    
    const options: PollyOptions = {
      voiceId: (request.voiceId as VoiceId) || defaultVoice.voiceId,
      languageCode: defaultVoice.languageCode,
      engine: (request.engine === 'standard' ? Engine.STANDARD : Engine.NEURAL),
      outputFormat: (request.outputFormat as OutputFormat) || OutputFormat.MP3,
      sampleRate: request.sampleRate || '24000', // High quality for storage, will be downsampled for telephony
    };
    
    console.log('Polly options:', options);
    
    // Generate text hash for caching
    const textHash = generateTextHash(request.text, options);
    console.log('Text hash:', textHash);
    
    // Check cache
    const cachedUrl = await checkCache(textHash, options.outputFormat);
    if (cachedUrl) {
      return {
        url: cachedUrl,
        duration: estimateDuration(request.text),
        format: options.outputFormat,
        textHash,
        cached: true,
      };
    }
    
    // Call Polly to synthesize speech
    const polly = getPollyClient();
    
    const command = new SynthesizeSpeechCommand({
      Text: request.text,
      VoiceId: options.voiceId,
      LanguageCode: options.languageCode as any,
      Engine: options.engine,
      OutputFormat: options.outputFormat,
      SampleRate: options.sampleRate,
    });
    
    console.log('Calling Polly synthesizeSpeech...');
    const response = await polly.send(command);
    
    if (!response.AudioStream) {
      throw new Error('No audio stream returned from Polly');
    }
    
    console.log('Speech synthesized successfully');
    
    // Upload to S3
    const contentType = options.outputFormat === OutputFormat.MP3 
      ? 'audio/mpeg' 
      : options.outputFormat === OutputFormat.OGG_VORBIS 
      ? 'audio/ogg' 
      : 'audio/pcm';
    
    const url = await uploadToS3(
      response.AudioStream as Readable,
      textHash,
      options.outputFormat,
      contentType
    );
    
    return {
      url,
      duration: estimateDuration(request.text),
      format: options.outputFormat,
      textHash,
      cached: false,
    };
    
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    throw error;
  }
}

/**
 * Lambda handler
 * 
 * Accepts TTS requests and returns audio file URLs.
 */
export async function handler(event: any, context: Context): Promise<any> {
  console.log('TTS Service Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse request
    let request: TTSRequest;
    
    if (event.body) {
      // API Gateway request
      request = JSON.parse(event.body);
    } else if (event.text) {
      // Direct invocation
      request = event;
    } else if (event.Records && event.Records[0].Sns) {
      // SNS event
      const message = JSON.parse(event.Records[0].Sns.Message);
      request = {
        text: message.text,
        language: message.language,
      };
    } else {
      throw new Error('Invalid event format');
    }
    
    // Validate request
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Text is required');
    }
    
    // Synthesize speech
    const result = await synthesizeSpeech(request);
    
    console.log('TTS result:', result);
    
    // Return response
    if (event.body) {
      // API Gateway response
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      };
    } else {
      // Direct invocation response
      return result;
    }
    
  } catch (error: any) {
    console.error('Error in TTS Service Lambda:', error);
    
    if (event.body) {
      // API Gateway error response
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: error.message || 'Internal server error',
        }),
      };
    } else {
      // Direct invocation error
      throw error;
    }
  }
}

/**
 * Batch synthesize multiple texts
 * 
 * Useful for pre-generating audio for campaign messages.
 */
export async function batchSynthesize(
  texts: string[],
  options?: Partial<TTSRequest>
): Promise<AudioFile[]> {
  console.log(`Batch synthesizing ${texts.length} texts`);
  
  const results: AudioFile[] = [];
  
  for (const text of texts) {
    try {
      const request: TTSRequest = {
        text,
        ...options,
      };
      
      const result = await synthesizeSpeech(request);
      results.push(result);
      
    } catch (error) {
      console.error(`Error synthesizing text: ${text.substring(0, 50)}...`, error);
      // Continue with other texts
    }
  }
  
  console.log(`Batch synthesis complete: ${results.length}/${texts.length} successful`);
  
  return results;
}
