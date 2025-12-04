/**
 * CDR Logger Lambda
 * 
 * This Lambda function logs Call Detail Records (CDRs) to MongoDB.
 * It processes call events, stores comprehensive CDR data including
 * call ID, timestamps, outcome, DTMF inputs, cost, and updates
 * Redis counters for the live dashboard.
 * 
 * Responsibilities:
 * - Process call events from SNS topic
 * - Write CDR to MongoDB with all call details
 * - Store CDR with call ID, timestamps, outcome, DTMF inputs, cost
 * - Update Redis counters for live dashboard
 * 
 * Validates: Requirements 10.1, 10.2, 11.1
 */

import { SNSEvent, Context } from 'aws-lambda';
import { MongoClient, Db, Collection } from 'mongodb';
import { createClient, RedisClientType } from 'redis';

// MongoDB client
let mongoClient: MongoClient | null = null;
let db: Db | null = null;

// Redis client for counters
let redisClient: RedisClientType | null = null;

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'campaign_system';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Types
interface CallEvent {
  callId: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  eventType: 'call_initiated' | 'call_answered' | 'call_ended' | 'dtmf_pressed' | 'action_triggered';
  status?: string;
  outcome?: string;
  dtmfInput?: string;
  action?: any;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface CDR {
  callId: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  status: string;
  outcome: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  dtmfInputs: string[];
  actionsTriggered: any[];
  cost: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Initialize MongoDB client
 */
async function getMongoClient(): Promise<Db> {
  if (!db) {
    console.log('Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(MONGODB_DATABASE);
    console.log('MongoDB connected');
  }
  return db;
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
 * Get or create CDR document
 */
async function getOrCreateCDR(
  collection: Collection<CDR>,
  callId: string,
  event: CallEvent
): Promise<CDR> {
  // Try to find existing CDR
  let cdr = await collection.findOne({ callId });
  
  if (!cdr) {
    // Create new CDR
    const newCdr = {
      callId: event.callId,
      campaignId: event.campaignId,
      contactId: event.contactId,
      phoneNumber: event.phoneNumber,
      status: event.status || 'initiated',
      outcome: event.outcome || '',
      startTime: new Date(event.timestamp),
      dtmfInputs: [],
      actionsTriggered: [],
      cost: 0,
      metadata: event.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await collection.insertOne(newCdr as any);
    cdr = { ...newCdr, _id: result.insertedId } as any;
    console.log(`Created new CDR for call ${callId}`);
  }
  
  return cdr!;
}

/**
 * Update CDR with call event
 * 
 * **Feature: mass-voice-campaign-system, Property 44: Campaign report completeness**
 * For any completed campaign, the generated report should contain all call outcomes 
 * with accurate timestamps.
 */
async function updateCDR(
  collection: Collection<CDR>,
  callId: string,
  event: CallEvent
): Promise<void> {
  const update: any = {
    $set: {
      updatedAt: new Date(),
    },
  };
  
  // Update based on event type
  switch (event.eventType) {
    case 'call_initiated':
      update.$set.status = 'dialing';
      update.$set.startTime = new Date(event.timestamp);
      break;
      
    case 'call_answered':
      update.$set.status = 'answered';
      break;
      
    case 'call_ended':
      update.$set.status = 'completed';
      update.$set.outcome = event.outcome || 'completed';
      update.$set.endTime = new Date(event.timestamp);
      
      // Calculate duration if we have both start and end times
      const cdr = await collection.findOne({ callId });
      if (cdr && cdr.startTime) {
        const duration = Math.floor(
          (new Date(event.timestamp).getTime() - cdr.startTime.getTime()) / 1000
        );
        update.$set.duration = duration;
        
        // Calculate cost (simplified: $0.01 per minute)
        update.$set.cost = Math.ceil(duration / 60) * 0.01;
      }
      break;
      
    case 'dtmf_pressed':
      if (event.dtmfInput) {
        update.$push = { dtmfInputs: event.dtmfInput };
      }
      break;
      
    case 'action_triggered':
      if (event.action) {
        update.$push = { actionsTriggered: event.action };
      }
      break;
  }
  
  await collection.updateOne({ callId }, update);
  console.log(`Updated CDR for call ${callId}, event: ${event.eventType}`);
}

/**
 * Update Redis counters for live dashboard
 * 
 * **Feature: mass-voice-campaign-system, Property 40: Dashboard real-time metrics display**
 * For any active campaign, the analytics dashboard should display current active call 
 * count, queue depth, and dialing rate with data freshness under 2 seconds.
 * 
 * **Feature: mass-voice-campaign-system, Property 41: Real-time outcome metric updates**
 * For any call outcome recorded, the analytics dashboard metrics (Answered, Busy, 
 * Failed, Converted, Opt-out counts) should update immediately.
 */
async function updateDashboardCounters(event: CallEvent): Promise<void> {
  try {
    const client = await getRedisClient();
    const campaignKey = `campaign:${event.campaignId}`;
    
    // Update counters based on event type
    switch (event.eventType) {
      case 'call_initiated':
        // Increment total attempts
        await client.incr(`${campaignKey}:total_attempts`);
        // Increment active calls
        await client.incr(`${campaignKey}:active_calls`);
        break;
        
      case 'call_answered':
        // Increment answered count
        await client.incr(`${campaignKey}:answered`);
        break;
        
      case 'call_ended':
        // Decrement active calls
        const activeCalls = await client.get(`${campaignKey}:active_calls`);
        if (activeCalls && parseInt(activeCalls) > 0) {
          await client.decr(`${campaignKey}:active_calls`);
        }
        
        // Increment outcome-specific counter
        if (event.outcome) {
          const outcomeKey = `${campaignKey}:${event.outcome.toLowerCase()}`;
          await client.incr(outcomeKey);
        }
        break;
        
      case 'action_triggered':
        // Increment action-specific counter
        if (event.action?.type) {
          const actionKey = `${campaignKey}:${event.action.type}`;
          await client.incr(actionKey);
        }
        break;
    }
    
    // Update last activity timestamp
    await client.set(`${campaignKey}:last_activity`, new Date().toISOString());
    
    console.log(`Updated dashboard counters for campaign ${event.campaignId}`);
    
  } catch (error) {
    console.error('Error updating dashboard counters:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Process call event and log CDR
 */
async function processCallEvent(event: CallEvent): Promise<void> {
  console.log(`Processing call event: ${event.eventType} for call ${event.callId}`);
  
  try {
    // Get MongoDB collection
    const database = await getMongoClient();
    const collection = database.collection<CDR>('call_records');
    
    // Get or create CDR
    await getOrCreateCDR(collection, event.callId, event);
    
    // Update CDR with event data
    await updateCDR(collection, event.callId, event);
    
    // Update Redis counters for dashboard
    await updateDashboardCounters(event);
    
    console.log(`Call event processed successfully for call ${event.callId}`);
    
  } catch (error) {
    console.error(`Error processing call event for call ${event.callId}:`, error);
    throw error;
  }
}

/**
 * Lambda handler for call events
 * 
 * This handler is triggered by SNS call-events topic for all call-related events
 * (initiated, answered, ended, DTMF pressed, action triggered).
 */
export async function handler(event: SNSEvent, context: Context): Promise<void> {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('CDR Logger Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Process each SNS record
    for (const record of event.Records) {
      const message = JSON.parse(record.Sns.Message);
      
      console.log('Processing call event:', message);
      
      // Extract call event from SNS message
      const callEvent: CallEvent = {
        callId: message.callId,
        campaignId: message.campaignId,
        contactId: message.contactId,
        phoneNumber: message.phoneNumber,
        eventType: message.eventType,
        status: message.status,
        outcome: message.outcome,
        dtmfInput: message.dtmfInput,
        action: message.action,
        timestamp: message.timestamp || new Date().toISOString(),
        metadata: message.metadata,
      };
      
      // Process the call event
      await processCallEvent(callEvent);
    }
    
    console.log('CDR Logger Lambda completed successfully');
  } catch (error) {
    console.error('Error in CDR Logger Lambda:', error);
    throw error;
  }
}

/**
 * Query CDRs for a campaign
 * 
 * This function can be called by other services to retrieve CDRs for reporting.
 */
export async function queryCDRs(
  campaignId: string,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    outcome?: string;
    limit?: number;
  }
): Promise<CDR[]> {
  try {
    const database = await getMongoClient();
    const collection = database.collection<CDR>('call_records');
    
    const query: any = { campaignId };
    
    if (filters?.startDate) {
      query.startTime = { $gte: filters.startDate };
    }
    
    if (filters?.endDate) {
      query.startTime = { ...query.startTime, $lte: filters.endDate };
    }
    
    if (filters?.outcome) {
      query.outcome = filters.outcome;
    }
    
    const limit = filters?.limit || 1000;
    
    const cdrs = await collection
      .find(query)
      .sort({ startTime: -1 })
      .limit(limit)
      .toArray();
    
    return cdrs as CDR[];
    
  } catch (error) {
    console.error('Error querying CDRs:', error);
    throw error;
  }
}

/**
 * Get campaign statistics from CDRs
 * 
 * **Feature: mass-voice-campaign-system, Property 45: Report metric calculation accuracy**
 * For any campaign report, the calculated aggregate metrics (total attempts, answer rate, 
 * conversion rate, opt-out rate) should match the actual recorded data.
 */
export async function getCampaignStats(campaignId: string): Promise<{
  totalAttempts: number;
  answered: number;
  busy: number;
  failed: number;
  converted: number;
  optOuts: number;
  answerRate: number;
  conversionRate: number;
  optOutRate: number;
  totalDuration: number;
  totalCost: number;
}> {
  try {
    const database = await getMongoClient();
    const collection = database.collection<CDR>('call_records');
    
    // Aggregate statistics
    const stats = await collection.aggregate([
      { $match: { campaignId } },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 },
          answered: {
            $sum: { $cond: [{ $eq: ['$status', 'answered'] }, 1, 0] }
          },
          busy: {
            $sum: { $cond: [{ $eq: ['$outcome', 'busy'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$outcome', 'failed'] }, 1, 0] }
          },
          converted: {
            $sum: { $cond: [{ $eq: ['$outcome', 'converted'] }, 1, 0] }
          },
          optOuts: {
            $sum: { $cond: [{ $eq: ['$outcome', 'opted_out'] }, 1, 0] }
          },
          totalDuration: { $sum: '$duration' },
          totalCost: { $sum: '$cost' },
        }
      }
    ]).toArray();
    
    if (stats.length === 0) {
      return {
        totalAttempts: 0,
        answered: 0,
        busy: 0,
        failed: 0,
        converted: 0,
        optOuts: 0,
        answerRate: 0,
        conversionRate: 0,
        optOutRate: 0,
        totalDuration: 0,
        totalCost: 0,
      };
    }
    
    const result = stats[0];
    
    return {
      totalAttempts: result.totalAttempts,
      answered: result.answered,
      busy: result.busy,
      failed: result.failed,
      converted: result.converted,
      optOuts: result.optOuts,
      answerRate: result.totalAttempts > 0 
        ? (result.answered / result.totalAttempts) * 100 
        : 0,
      conversionRate: result.answered > 0 
        ? (result.converted / result.answered) * 100 
        : 0,
      optOutRate: result.totalAttempts > 0 
        ? (result.optOuts / result.totalAttempts) * 100 
        : 0,
      totalDuration: result.totalDuration || 0,
      totalCost: result.totalCost || 0,
    };
    
  } catch (error) {
    console.error('Error getting campaign stats:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections');
  if (redisClient) {
    await redisClient.quit();
  }
  if (mongoClient) {
    await mongoClient.close();
  }
});
