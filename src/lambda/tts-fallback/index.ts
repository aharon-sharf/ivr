/**
 * TTS Fallback Lambda
 * 
 * This Lambda function handles TTS fallback when SMS delivery fails.
 * It triggers TTS call when SMS fails, calls Polly to generate speech,
 * sends dial command to Node.js Worker with TTS audio URL, and tracks
 * TTS fallback outcome.
 * 
 * Responsibilities:
 * - Trigger TTS call when SMS fails
 * - Call Polly to generate speech
 * - Send dial command to Node.js Worker with TTS audio URL
 * - Track TTS fallback outcome
 * 
 * Validates: Requirements 7.1, 7.4
 */

import { SNSEvent, Context } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { createClient, RedisClientType } from 'redis';
import axios from 'axios';

// Lambda client for invoking TTS service
let lambdaClient: LambdaClient | null = null;

// Redis client for tracking
let redisClient: RedisClientType | null = null;

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const TTS_SERVICE_FUNCTION = process.env.TTS_SERVICE_FUNCTION || 'tts-service';
const NODE_WORKER_URL = process.env.NODE_WORKER_URL || 'http://localhost:3000';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Types
interface TTSFallbackRequest {
  phoneNumber: string;
  text: string;
  campaignId: string;
  contactId: string;
  smsFailureReason?: string;
  language?: 'hebrew' | 'english' | 'arabic';
}

interface TTSAudioFile {
  url: string;
  duration: number;
  format: string;
  textHash: string;
  cached: boolean;
}

interface DialCommand {
  callId: string;
  phoneNumber: string;
  campaignId: string;
  contactId: string;
  audioFileUrl: string;
  isTTSFallback: boolean;
  metadata?: Record<string, any>;
}

interface TTSFallbackResult {
  success: boolean;
  callId?: string;
  audioUrl?: string;
  error?: string;
  outcome: 'TTS Fallback Delivered' | 'TTS Fallback Failed';
}

interface TTSFallbackRecord {
  id: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  text: string;
  audioUrl?: string;
  outcome: string;
  smsFailureReason?: string;
  initiatedAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Initialize Lambda client
 */
function getLambdaClient(): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({ region: AWS_REGION });
    console.log('Lambda client initialized');
  }
  return lambdaClient;
}

/**
 * Initialize Redis client
 */
async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
    });
    
    redisClient.on('error', (err: Error) => {
      console.error('Redis Client Error:', err);
    });
    
    await redisClient.connect();
    console.log('Redis client connected');
  }
  
  return redisClient;
}

/**
 * Generate speech audio using TTS service
 * 
 * **Feature: mass-voice-campaign-system, Property 29: TTS text-to-speech conversion**
 * For any text content requiring TTS fallback, the system should convert the text 
 * into synthesized speech audio.
 */
async function generateSpeech(
  text: string,
  language?: string
): Promise<TTSAudioFile> {
  try {
    console.log('Generating speech for text:', text.substring(0, 50) + '...');
    
    const lambda = getLambdaClient();
    
    const payload = {
      text,
      language: language || 'english',
      engine: 'neural',
      outputFormat: 'mp3',
      sampleRate: '8000', // 8kHz for telephony
    };
    
    const command = new InvokeCommand({
      FunctionName: TTS_SERVICE_FUNCTION,
      Payload: JSON.stringify(payload),
    });
    
    console.log('Invoking TTS service...');
    const response = await lambda.send(command);
    
    if (!response.Payload) {
      throw new Error('No payload returned from TTS service');
    }
    
    const result = JSON.parse(Buffer.from(response.Payload).toString());
    
    if (result.errorMessage) {
      throw new Error(result.errorMessage);
    }
    
    console.log('Speech generated successfully:', result.url);
    
    return result as TTSAudioFile;
    
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}

/**
 * Send dial command to Node.js Worker for TTS fallback call
 */
async function initiateCall(
  request: TTSFallbackRequest,
  audioUrl: string
): Promise<{ success: boolean; callId?: string; error?: string }> {
  try {
    // Generate unique call ID
    const callId = `tts-fallback-${request.campaignId}-${request.contactId}-${Date.now()}`;
    
    // Prepare dial command
    const dialCommand: DialCommand = {
      callId,
      phoneNumber: request.phoneNumber,
      campaignId: request.campaignId,
      contactId: request.contactId,
      audioFileUrl: audioUrl,
      isTTSFallback: true,
      metadata: {
        smsFailureReason: request.smsFailureReason,
        originalText: request.text,
      },
    };
    
    console.log(`Sending TTS fallback dial command for call ${callId} to ${request.phoneNumber}`);
    
    // Send HTTP request to Node.js Worker
    const response = await axios.post(
      `${NODE_WORKER_URL}/dial`,
      dialCommand,
      {
        timeout: 5000, // 5 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (response.status === 200) {
      console.log(`TTS fallback dial command sent successfully for call ${callId}`);
      return {
        success: true,
        callId,
      };
    } else {
      console.error(`TTS fallback dial command failed with status ${response.status}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error: any) {
    console.error('Error sending TTS fallback dial command:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Store TTS fallback record in Redis
 * 
 * **Feature: mass-voice-campaign-system, Property 30: TTS fallback outcome recording**
 * For any TTS fallback call, the system should record the outcome as either 
 * "TTS Fallback Delivered" or "TTS Fallback Failed".
 */
async function storeTTSFallbackRecord(record: TTSFallbackRecord): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = `tts-fallback:${record.id}`;
    
    await client.setEx(
      key,
      86400, // 24 hour TTL
      JSON.stringify(record)
    );
    
    console.log(`TTS fallback record stored in Redis: ${key}`);
  } catch (error) {
    console.error('Error storing TTS fallback record in Redis:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Process TTS fallback request
 * 
 * **Feature: mass-voice-campaign-system, Property 21: SMS failure triggers TTS fallback**
 * For any SMS delivery failure indicating lack of SMS support, the system should 
 * automatically initiate a TTS fallback call.
 */
async function processTTSFallback(request: TTSFallbackRequest): Promise<TTSFallbackResult> {
  const recordId = `${request.campaignId}-${request.contactId}-${Date.now()}`;
  
  try {
    console.log('Processing TTS fallback for:', request.phoneNumber);
    
    // Step 1: Generate speech audio using TTS service
    const audioFile = await generateSpeech(request.text, request.language);
    
    console.log('Audio generated:', audioFile.url);
    
    // Step 2: Initiate call with TTS audio
    const callResult = await initiateCall(request, audioFile.url);
    
    if (!callResult.success) {
      // Call initiation failed
      console.error('TTS fallback call initiation failed:', callResult.error);
      
      const record: TTSFallbackRecord = {
        id: recordId,
        campaignId: request.campaignId,
        contactId: request.contactId,
        phoneNumber: request.phoneNumber,
        text: request.text,
        audioUrl: audioFile.url,
        outcome: 'TTS Fallback Failed',
        smsFailureReason: request.smsFailureReason,
        initiatedAt: new Date(),
        completedAt: new Date(),
        error: callResult.error,
      };
      
      await storeTTSFallbackRecord(record);
      
      return {
        success: false,
        audioUrl: audioFile.url,
        error: callResult.error,
        outcome: 'TTS Fallback Failed',
      };
    }
    
    // Call initiated successfully
    console.log('TTS fallback call initiated successfully:', callResult.callId);
    
    const record: TTSFallbackRecord = {
      id: recordId,
      campaignId: request.campaignId,
      contactId: request.contactId,
      phoneNumber: request.phoneNumber,
      text: request.text,
      audioUrl: audioFile.url,
      outcome: 'TTS Fallback Delivered',
      smsFailureReason: request.smsFailureReason,
      initiatedAt: new Date(),
      completedAt: new Date(),
    };
    
    await storeTTSFallbackRecord(record);
    
    return {
      success: true,
      callId: callResult.callId,
      audioUrl: audioFile.url,
      outcome: 'TTS Fallback Delivered',
    };
    
  } catch (error: any) {
    console.error('Error processing TTS fallback:', error);
    
    const record: TTSFallbackRecord = {
      id: recordId,
      campaignId: request.campaignId,
      contactId: request.contactId,
      phoneNumber: request.phoneNumber,
      text: request.text,
      outcome: 'TTS Fallback Failed',
      smsFailureReason: request.smsFailureReason,
      initiatedAt: new Date(),
      completedAt: new Date(),
      error: error.message || 'Unknown error',
    };
    
    await storeTTSFallbackRecord(record);
    
    return {
      success: false,
      error: error.message || 'Unknown error',
      outcome: 'TTS Fallback Failed',
    };
  }
}

/**
 * Lambda handler for SNS events
 * 
 * This handler is triggered by SNS events from the SMS Gateway
 * when SMS delivery fails and TTS fallback is required.
 */
export async function handler(event: SNSEvent, context: Context): Promise<void> {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('TTS Fallback Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Process each SNS record
    for (const record of event.Records) {
      const message = JSON.parse(record.Sns.Message);
      
      console.log('Processing TTS fallback request:', message);
      
      // Extract TTS fallback request from SNS message
      const request: TTSFallbackRequest = {
        phoneNumber: message.phoneNumber,
        text: message.text,
        campaignId: message.campaignId,
        contactId: message.contactId,
        smsFailureReason: message.smsFailureReason,
        language: message.language,
      };
      
      // Process TTS fallback
      const result = await processTTSFallback(request);
      
      console.log('TTS fallback result:', result);
      
      if (result.success) {
        console.log(`TTS fallback successful for ${request.phoneNumber}, call ID: ${result.callId}`);
      } else {
        console.error(`TTS fallback failed for ${request.phoneNumber}: ${result.error}`);
      }
    }
    
    console.log('TTS Fallback Lambda completed successfully');
  } catch (error) {
    console.error('Error in TTS Fallback Lambda:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections');
  if (redisClient) {
    await redisClient.quit();
  }
});
