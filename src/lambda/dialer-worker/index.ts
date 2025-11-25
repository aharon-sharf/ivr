/**
 * Dialer Worker Lambda
 * 
 * This Lambda function processes batches of enriched dial tasks from EventBridge Pipes.
 * It implements rate limiting using Redis and sends dial commands to the Node.js Worker
 * that controls Asterisk.
 * 
 * Responsibilities:
 * - Process batch of dial tasks from EventBridge Pipe
 * - Check Redis for current CPS (calls per second) rate
 * - Increment Redis counter (1-second TTL) if under limit
 * - Send dial command to Node.js Worker via HTTP
 * - Handle rate limit exceeded (return for retry)
 * 
 * Validates: Requirements 9.1, 9.2, 9.4
 */

import { EventBridgeEvent } from 'aws-lambda';
import { createClient, RedisClientType } from 'redis';
import axios from 'axios';

// Redis client
let redisClient: RedisClientType | null = null;

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const NODE_WORKER_URL = process.env.NODE_WORKER_URL || 'http://localhost:3000';
const MAX_CPS = parseInt(process.env.MAX_CPS || '100'); // Maximum calls per second
const REDIS_KEY_PREFIX = 'cps:';
const REDIS_TTL = 1; // 1 second TTL for rate limiting counter

// Types
interface EnrichedDialTask {
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  metadata?: Record<string, any>;
  attempts?: number;
  campaign: {
    id: string;
    name: string;
    type: string;
    status: string;
    config: {
      audioFileUrl?: string;
      smsTemplate?: string;
      ivrFlow?: any;
      callingWindows: any[];
      maxConcurrentCalls?: number;
      maxAttemptsPerContact?: number;
      retryDelayMinutes?: number;
    };
    timezone: string;
  };
  enrichedAt: string;
}

interface DialCommand {
  callId: string;
  phoneNumber: string;
  campaignId: string;
  contactId: string;
  audioFileUrl?: string;
  ivrFlow?: any;
  metadata?: Record<string, any>;
}

interface DialResult {
  success: boolean;
  callId?: string;
  error?: string;
  rateLimitExceeded?: boolean;
}

interface BatchProcessingResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  rateLimited: number;
  errors: Array<{
    contactId: string;
    phoneNumber: string;
    error: string;
  }>;
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
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    await redisClient.connect();
    console.log('Redis client connected');
  }
  
  return redisClient;
}

/**
 * Check if we can make a call based on current CPS rate
 * Returns true if under limit, false if rate limit exceeded
 */
async function checkAndIncrementCPS(): Promise<boolean> {
  const client = await getRedisClient();
  const currentSecond = Math.floor(Date.now() / 1000);
  const key = `${REDIS_KEY_PREFIX}${currentSecond}`;
  
  try {
    // Get current count for this second
    const currentCount = await client.get(key);
    const count = currentCount ? parseInt(currentCount) : 0;
    
    // Check if we're under the limit
    if (count >= MAX_CPS) {
      console.warn(`Rate limit exceeded: ${count}/${MAX_CPS} CPS`);
      return false;
    }
    
    // Increment counter with TTL
    await client.multi()
      .incr(key)
      .expire(key, REDIS_TTL)
      .exec();
    
    console.log(`CPS counter incremented: ${count + 1}/${MAX_CPS}`);
    return true;
  } catch (error) {
    console.error('Error checking CPS rate:', error);
    // On Redis error, allow the call to proceed (fail open)
    return true;
  }
}

/**
 * Get current CPS rate from Redis
 */
async function getCurrentCPS(): Promise<number> {
  const client = await getRedisClient();
  const currentSecond = Math.floor(Date.now() / 1000);
  const key = `${REDIS_KEY_PREFIX}${currentSecond}`;
  
  try {
    const currentCount = await client.get(key);
    return currentCount ? parseInt(currentCount) : 0;
  } catch (error) {
    console.error('Error getting current CPS:', error);
    return 0;
  }
}

/**
 * Send dial command to Node.js Worker
 */
async function sendDialCommand(dialTask: EnrichedDialTask): Promise<DialResult> {
  try {
    // Generate unique call ID
    const callId = `call-${dialTask.campaignId}-${dialTask.contactId}-${Date.now()}`;
    
    // Prepare dial command
    const dialCommand: DialCommand = {
      callId,
      phoneNumber: dialTask.phoneNumber,
      campaignId: dialTask.campaignId,
      contactId: dialTask.contactId,
      audioFileUrl: dialTask.campaign.config.audioFileUrl,
      ivrFlow: dialTask.campaign.config.ivrFlow,
      metadata: dialTask.metadata,
    };
    
    console.log(`Sending dial command for call ${callId} to ${dialTask.phoneNumber}`);
    
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
      console.log(`Dial command sent successfully for call ${callId}`);
      return {
        success: true,
        callId,
      };
    } else {
      console.error(`Dial command failed with status ${response.status}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error: any) {
    console.error('Error sending dial command:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Process a single dial task
 */
async function processDialTask(dialTask: EnrichedDialTask): Promise<DialResult> {
  try {
    // Check rate limit
    const canDial = await checkAndIncrementCPS();
    
    if (!canDial) {
      console.warn(`Rate limit exceeded for contact ${dialTask.contactId}`);
      return {
        success: false,
        rateLimitExceeded: true,
        error: 'Rate limit exceeded',
      };
    }
    
    // Send dial command to Node.js Worker
    const result = await sendDialCommand(dialTask);
    
    return result;
  } catch (error: any) {
    console.error('Error processing dial task:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Lambda handler for EventBridge Pipes target
 * 
 * EventBridge Pipes passes an array of enriched dial tasks.
 * Each task is processed with rate limiting.
 */
export async function handler(event: any): Promise<BatchProcessingResult> {
  console.log('Dialer Worker Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const result: BatchProcessingResult = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    rateLimited: 0,
    errors: [],
  };
  
  try {
    // EventBridge Pipes passes an array of enriched messages
    const dialTasks: EnrichedDialTask[] = Array.isArray(event) ? event : [event];
    
    console.log(`Processing ${dialTasks.length} dial tasks`);
    
    // Get current CPS before processing
    const currentCPS = await getCurrentCPS();
    console.log(`Current CPS: ${currentCPS}/${MAX_CPS}`);
    
    // Process each dial task
    for (const dialTask of dialTasks) {
      result.totalProcessed++;
      
      try {
        const dialResult = await processDialTask(dialTask);
        
        if (dialResult.success) {
          result.successful++;
          console.log(`Successfully processed dial task for contact ${dialTask.contactId}`);
        } else if (dialResult.rateLimitExceeded) {
          result.rateLimited++;
          console.warn(`Rate limited dial task for contact ${dialTask.contactId}`);
          
          // For rate limited tasks, we should throw an error to trigger retry
          // EventBridge Pipes will retry with exponential backoff
          throw new Error('Rate limit exceeded - will retry');
        } else {
          result.failed++;
          result.errors.push({
            contactId: dialTask.contactId,
            phoneNumber: dialTask.phoneNumber,
            error: dialResult.error || 'Unknown error',
          });
          console.error(`Failed to process dial task for contact ${dialTask.contactId}: ${dialResult.error}`);
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          contactId: dialTask.contactId,
          phoneNumber: dialTask.phoneNumber,
          error: error.message || 'Unknown error',
        });
        console.error(`Error processing dial task for contact ${dialTask.contactId}:`, error);
        
        // If rate limit exceeded, throw to trigger retry
        if (error.message.includes('Rate limit exceeded')) {
          throw error;
        }
      }
    }
    
    console.log(`Batch processing complete: ${result.successful} successful, ${result.failed} failed, ${result.rateLimited} rate limited`);
    
    return result;
  } catch (error) {
    console.error('Fatal error in Dialer Worker Lambda:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing Redis connection');
  if (redisClient) {
    await redisClient.quit();
  }
});
