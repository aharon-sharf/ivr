/**
 * Opt-Out Handler Lambda
 * 
 * This Lambda function handles opt-out events triggered by DTMF input (Press 9).
 * It adds phone numbers to the blacklist, updates Redis cache for fast lookups,
 * and terminates active calls gracefully.
 * 
 * Responsibilities:
 * - Process optout-events SNS topic messages
 * - Add phone number to blacklist table
 * - Update Redis cache for fast lookups
 * - Terminate active call
 * 
 * Validates: Requirements 3.3, 4.3
 */

import { SNSEvent, Context } from 'aws-lambda';
import { createClient, RedisClientType } from 'redis';
import axios from 'axios';

// Redis client for blacklist cache
let redisClient: RedisClientType | null = null;

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const DATABASE_API_URL = process.env.DATABASE_API_URL || '';
const ASTERISK_WORKER_URL = process.env.ASTERISK_WORKER_URL || '';

// Types
interface OptOutEvent {
  callId: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  dtmfInput: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface BlacklistEntry {
  phoneNumber: string;
  addedAt: Date;
  reason: string;
  source: 'user_optout' | 'admin_import' | 'compliance';
  metadata?: Record<string, any>;
}

interface OptOutAction {
  id: string;
  callId: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  actionType: 'optout_blacklist_added' | 'optout_call_terminated';
  timestamp: Date;
  status: 'success' | 'failed';
  failureReason?: string;
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
 * Add phone number to blacklist in database
 * 
 * **Feature: mass-voice-campaign-system, Property 12: DTMF opt-out immediate effect**
 * For any active call, when the recipient presses 9, the phone number should be 
 * immediately added to the blacklist and the call should terminate.
 */
async function addToBlacklist(
  phoneNumber: string,
  reason: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    console.log(`Adding ${phoneNumber} to blacklist`);
    
    const blacklistEntry: BlacklistEntry = {
      phoneNumber,
      addedAt: new Date(),
      reason,
      source: 'user_optout',
      metadata,
    };
    
    // Persist to database via API
    if (DATABASE_API_URL) {
      try {
        await axios.post(`${DATABASE_API_URL}/blacklist`, blacklistEntry, {
          timeout: 5000,
        });
        console.log('Phone number added to blacklist database');
      } catch (dbError) {
        console.error('Error persisting to blacklist database:', dbError);
        throw new Error('Failed to add to blacklist database');
      }
    } else {
      console.warn('DATABASE_API_URL not configured, skipping database persistence');
    }
    
  } catch (error) {
    console.error('Error adding to blacklist:', error);
    throw error;
  }
}

/**
 * Update Redis blacklist cache for fast lookups
 * 
 * **Feature: mass-voice-campaign-system, Property 10: Blacklist pre-dial check**
 * For any phone number in the blacklist, the system should never initiate a call 
 * to that number.
 */
async function updateBlacklistCache(phoneNumber: string): Promise<void> {
  try {
    console.log(`Updating Redis blacklist cache for ${phoneNumber}`);
    
    const client = await getRedisClient();
    
    // Add to blacklist set (no expiration - permanent)
    const blacklistKey = 'blacklist:numbers';
    await client.sAdd(blacklistKey, phoneNumber);
    
    // Also store detailed entry with metadata
    const entryKey = `blacklist:${phoneNumber}`;
    const entry = {
      phoneNumber,
      addedAt: new Date().toISOString(),
      source: 'user_optout',
    };
    
    await client.set(entryKey, JSON.stringify(entry));
    
    console.log(`Redis blacklist cache updated for ${phoneNumber}`);
    
  } catch (error) {
    console.error('Error updating Redis blacklist cache:', error);
    // Don't throw - this is non-critical if database update succeeded
  }
}

/**
 * Terminate active call
 * 
 * **Feature: mass-voice-campaign-system, Property 12: DTMF opt-out immediate effect**
 * For any active call, when the recipient presses 9, the phone number should be 
 * immediately added to the blacklist and the call should terminate.
 */
async function terminateCall(callId: string): Promise<void> {
  try {
    console.log(`Terminating call ${callId}`);
    
    if (!ASTERISK_WORKER_URL) {
      console.warn('ASTERISK_WORKER_URL not configured, skipping call termination');
      return;
    }
    
    // Send termination request to Asterisk Worker
    await axios.post(
      `${ASTERISK_WORKER_URL}/terminate-call`,
      { callId },
      { timeout: 3000 }
    );
    
    console.log(`Call ${callId} terminated successfully`);
    
  } catch (error) {
    console.error(`Error terminating call ${callId}:`, error);
    // Don't throw - call may have already ended naturally
  }
}

/**
 * Record opt-out action in database
 */
async function recordOptOutAction(action: OptOutAction): Promise<void> {
  try {
    console.log('Recording opt-out action');
    
    // Store in Redis for quick access
    const client = await getRedisClient();
    const key = `optout_action:${action.id}`;
    
    await client.setEx(
      key,
      86400, // 24 hour TTL
      JSON.stringify(action)
    );
    
    console.log(`Opt-out action stored in Redis: ${key}`);
    
    // Also persist to database via API (if configured)
    if (DATABASE_API_URL) {
      try {
        await axios.post(`${DATABASE_API_URL}/actions`, action, {
          timeout: 5000,
        });
        console.log('Opt-out action persisted to database');
      } catch (dbError) {
        console.error('Error persisting to database (non-critical):', dbError);
        // Don't throw - Redis storage is sufficient
      }
    }
    
    // Update campaign metrics counter
    const metricsKey = `campaign:${action.campaignId}:optouts`;
    await client.incr(metricsKey);
    
  } catch (error) {
    console.error('Error recording opt-out action:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Process opt-out event
 * 
 * **Feature: mass-voice-campaign-system, Property 12: DTMF opt-out immediate effect**
 * For any active call, when the recipient presses 9, the phone number should be 
 * immediately added to the blacklist and the call should terminate.
 * 
 * **Feature: mass-voice-campaign-system, Property 14: Blacklist persistence with timestamp**
 * For any number added to the blacklist, the entry should be permanently stored 
 * with an accurate timestamp of when it was added.
 */
async function processOptOutEvent(event: OptOutEvent): Promise<void> {
  console.log(`Processing opt-out event for call ${event.callId}`);
  
  const actionId = `${event.callId}_optout_${Date.now()}`;
  
  try {
    // Step 1: Add phone number to blacklist database
    await addToBlacklist(
      event.phoneNumber,
      'User opted out via DTMF (Press 9)',
      {
        callId: event.callId,
        campaignId: event.campaignId,
        contactId: event.contactId,
        timestamp: event.timestamp,
      }
    );
    
    console.log(`Phone number ${event.phoneNumber} added to blacklist`);
    
    // Step 2: Update Redis cache for fast lookups
    await updateBlacklistCache(event.phoneNumber);
    
    // Step 3: Terminate active call
    await terminateCall(event.callId);
    
    // Step 4: Record opt-out action
    const action: OptOutAction = {
      id: actionId,
      callId: event.callId,
      campaignId: event.campaignId,
      contactId: event.contactId,
      phoneNumber: event.phoneNumber,
      actionType: 'optout_blacklist_added',
      timestamp: new Date(),
      status: 'success',
    };
    
    await recordOptOutAction(action);
    
    console.log(`Opt-out processed successfully for call ${event.callId}`);
    
  } catch (error) {
    console.error(`Error processing opt-out event for call ${event.callId}:`, error);
    
    // Record failed action
    const failedAction: OptOutAction = {
      id: actionId,
      callId: event.callId,
      campaignId: event.campaignId,
      contactId: event.contactId,
      phoneNumber: event.phoneNumber,
      actionType: 'optout_blacklist_added',
      timestamp: new Date(),
      status: 'failed',
      failureReason: error instanceof Error ? error.message : 'Unknown error',
    };
    
    await recordOptOutAction(failedAction);
    
    throw error;
  }
}

/**
 * Lambda handler for opt-out events
 * 
 * This handler is triggered by SNS optout-events topic when a recipient
 * presses 9 during an IVR interaction to opt out of future communications.
 */
export async function handler(event: SNSEvent, context: Context): Promise<void> {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('Opt-Out Handler Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Process each SNS record
    for (const record of event.Records) {
      const message = JSON.parse(record.Sns.Message);
      
      console.log('Processing opt-out event:', message);
      
      // Extract opt-out event from SNS message
      const optOutEvent: OptOutEvent = {
        callId: message.callId,
        campaignId: message.campaignId,
        contactId: message.contactId,
        phoneNumber: message.phoneNumber,
        dtmfInput: message.dtmfInput || '9',
        timestamp: message.timestamp || new Date().toISOString(),
        metadata: message.metadata,
      };
      
      // Process the opt-out event
      await processOptOutEvent(optOutEvent);
    }
    
    console.log('Opt-Out Handler Lambda completed successfully');
  } catch (error) {
    console.error('Error in Opt-Out Handler Lambda:', error);
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
