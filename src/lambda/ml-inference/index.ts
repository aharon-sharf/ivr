/**
 * ML Inference Lambda
 * Calls SageMaker Serverless Inference endpoint to predict optimal call times
 * Handles fallback to default patterns when insufficient data
 * Caches predictions in Redis
 */

import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { createClient, RedisClientType } from 'redis';
import { Contact, OptimalTimeWindow } from '../../models/Contact';

// Initialize SageMaker Runtime client
const sagemakerClient = new SageMakerRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// Initialize Redis client
let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`,
    });
    
    redisClient.on('error', (err: Error) => console.error('Redis Client Error', err));
    await redisClient.connect();
  }
  
  return redisClient;
}

interface MLInferenceRequest {
  contacts: Contact[];
  campaignId?: string;
}

interface MLInferenceResponse {
  predictions: Array<{
    contactId: string;
    optimalCallTime: OptimalTimeWindow;
    cached: boolean;
  }>;
  errors: Array<{
    contactId: string;
    error: string;
  }>;
}

interface SageMakerInput {
  phoneNumber: string;
  timezone?: string;
  metadata?: Record<string, any>;
}

interface SageMakerOutput {
  preferredDayOfWeek: number[];
  preferredHourRange: { start: number; end: number };
  confidence: number;
}

/**
 * Main Lambda handler
 */
export async function handler(event: any): Promise<MLInferenceResponse> {
  console.log('ML Inference Lambda invoked:', JSON.stringify(event, null, 2));

  try {
    const request: MLInferenceRequest = typeof event.body === 'string' 
      ? JSON.parse(event.body) 
      : event;

    if (!request.contacts || !Array.isArray(request.contacts)) {
      throw new Error('Invalid request: contacts array is required');
    }

    const redis = await getRedisClient();
    const predictions: MLInferenceResponse['predictions'] = [];
    const errors: MLInferenceResponse['errors'] = [];

    // Process each contact
    for (const contact of request.contacts) {
      try {
        // Check Redis cache first
        const cacheKey = `ml:prediction:${contact.phoneNumber}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
          console.log(`Cache hit for contact ${contact.id}`);
          predictions.push({
            contactId: contact.id,
            optimalCallTime: JSON.parse(cached),
            cached: true,
          });
          continue;
        }

        // Call SageMaker endpoint for prediction
        const prediction = await predictOptimalCallTime(contact);

        // Cache the prediction (TTL: 7 days)
        await redis.setEx(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(prediction));

        predictions.push({
          contactId: contact.id,
          optimalCallTime: prediction,
          cached: false,
        });
      } catch (error) {
        console.error(`Error predicting for contact ${contact.id}:`, error);
        
        // Use fallback default pattern
        const fallbackPrediction = getDefaultOptimalTime(contact);
        
        predictions.push({
          contactId: contact.id,
          optimalCallTime: fallbackPrediction,
          cached: false,
        });

        errors.push({
          contactId: contact.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      predictions,
      errors,
    };
  } catch (error) {
    console.error('Error in ML Inference Lambda:', error);
    throw error;
  }
}

/**
 * Predict optimal call time using SageMaker endpoint
 * **Feature: mass-voice-campaign-system, Property 32: ML prediction completeness**
 */
async function predictOptimalCallTime(contact: Contact): Promise<OptimalTimeWindow> {
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME;
  
  if (!endpointName) {
    console.warn('SageMaker endpoint not configured, using default pattern');
    return getDefaultOptimalTime(contact);
  }

  try {
    // Prepare input for SageMaker
    const input: SageMakerInput = {
      phoneNumber: contact.phoneNumber,
      timezone: contact.timezone,
      metadata: contact.metadata,
    };

    const command = new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: JSON.stringify(input),
    });

    const response = await sagemakerClient.send(command);

    if (!response.Body) {
      throw new Error('Empty response from SageMaker endpoint');
    }

    // Parse response
    const responseBody = JSON.parse(Buffer.from(response.Body).toString('utf-8'));
    const output: SageMakerOutput = responseBody;

    // Validate output
    if (!output.preferredDayOfWeek || !output.preferredHourRange || output.confidence === undefined) {
      throw new Error('Invalid response format from SageMaker endpoint');
    }

    return {
      preferredDayOfWeek: output.preferredDayOfWeek,
      preferredHourRange: output.preferredHourRange,
      confidence: output.confidence,
    };
  } catch (error) {
    console.error('Error calling SageMaker endpoint:', error);
    
    // Fallback to default pattern when SageMaker fails
    return getDefaultOptimalTime(contact);
  }
}

/**
 * Get default optimal call time pattern when ML prediction is unavailable
 * Uses general population patterns based on timezone
 */
function getDefaultOptimalTime(contact: Contact): OptimalTimeWindow {
  // Default pattern: weekdays (Mon-Fri), late morning to early evening
  // This is a general pattern that works for most populations
  
  const timezone = contact.timezone || 'UTC';
  
  // Adjust hours based on timezone if available
  let startHour = 10; // 10 AM
  let endHour = 18;   // 6 PM

  // For Israeli timezone (Asia/Jerusalem), adjust to local preferences
  if (timezone.includes('Jerusalem') || timezone.includes('Israel')) {
    startHour = 9;  // 9 AM
    endHour = 20;   // 8 PM (Israelis tend to be available later)
  }

  return {
    preferredDayOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
    preferredHourRange: {
      start: startHour,
      end: endHour,
    },
    confidence: 0.5, // Low confidence for default pattern
  };
}

/**
 * Batch prediction for multiple contacts
 * Optimizes by batching requests to SageMaker
 */
export async function batchPredict(contacts: Contact[]): Promise<MLInferenceResponse> {
  // For now, process sequentially
  // In production, this could be optimized with parallel processing
  return handler({ contacts });
}

/**
 * Cleanup function for Lambda
 */
export async function cleanup(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
