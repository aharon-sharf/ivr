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

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { createClient, RedisClientType } from 'redis';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Pool } from 'pg';
import axios from 'axios';

// Redis client
let redisClient: RedisClientType | null = null;
let cachedRedisPassword: string | null = null;

// PostgreSQL connection pool
let pool: Pool | null = null;
let cachedDbPassword: string | null = null;

// AWS clients
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Configuration
const REDIS_ENDPOINT = process.env.REDIS_ENDPOINT || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const NODE_WORKER_URL = process.env.NODE_WORKER_URL || 'http://localhost:3000';
const MAX_CPS = parseInt(process.env.MAX_CPS || '100'); // Maximum calls per second
const REDIS_KEY_PREFIX = 'cps:';
const REDIS_TTL = 1; // 1 second TTL for rate limiting counter

// Database configuration
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_SECRET_ARN = process.env.DB_SECRET_ARN;

// Types
interface DialTaskMessage {
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  metadata?: Record<string, any>;
  attempts?: number;
}

interface CampaignConfig {
  audioFileUrl?: string;
  smsTemplate?: string;
  ivrFlow?: any;
  callingWindows: any[];
  maxConcurrentCalls?: number;
  maxAttemptsPerContact?: number;
  retryDelayMinutes?: number;
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  config: CampaignConfig;
  timezone: string;
}

interface EnrichedDialTask extends DialTaskMessage {
  campaign: Campaign;
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
 * Get database password from AWS Secrets Manager
 */
async function getDbPassword(): Promise<string> {
  if (cachedDbPassword) {
    return cachedDbPassword;
  }

  if (!DB_SECRET_ARN) {
    throw new Error('DB_SECRET_ARN environment variable not set');
  }

  try {
    console.log('Retrieving database password from Secrets Manager');
    const command = new GetSecretValueCommand({ SecretId: DB_SECRET_ARN });
    const response = await secretsClient.send(command);
    
    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      cachedDbPassword = secret.password as string;
      console.log('Database password retrieved successfully');
      return cachedDbPassword;
    }
    
    throw new Error('No password found in secret');
  } catch (error) {
    console.error('Error retrieving database password:', error);
    throw new Error(`Failed to retrieve database password: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get PostgreSQL connection pool
 */
async function getPostgreSQLPool(): Promise<Pool> {
  if (!pool) {
    const password = await getDbPassword();
    
    pool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log(`PostgreSQL pool initialized for ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  }
  return pool;
}

/**
 * Fetch campaign configuration from PostgreSQL
 */
async function getCampaignConfig(campaignId: string): Promise<Campaign | null> {
  const pgPool = await getPostgreSQLPool();
  const client = await pgPool.connect();
  
  try {
    const query = `
      SELECT 
        id,
        name,
        type,
        status,
        config,
        timezone,
        created_at,
        updated_at
      FROM campaigns
      WHERE id = $1
    `;
    
    const result = await client.query(query, [campaignId]);
    
    if (result.rows.length === 0) {
      console.warn(`Campaign not found: ${campaignId}`);
      return null;
    }
    
    const row = result.rows[0];
    
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      config: row.config,
      timezone: row.timezone,
    };
  } catch (error) {
    console.error('Error fetching campaign config:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Enrich a dial task message with campaign configuration
 */
async function enrichDialTask(message: DialTaskMessage): Promise<EnrichedDialTask | null> {
  try {
    // Validate required fields
    if (!message.campaignId || !message.contactId || !message.phoneNumber) {
      console.error('Invalid dial task message - missing required fields:', message);
      return null;
    }
    
    // Fetch campaign configuration
    const campaign = await getCampaignConfig(message.campaignId);
    
    if (!campaign) {
      console.error(`Campaign not found for dial task: ${message.campaignId}`);
      return null;
    }
    
    // Check if campaign is active
    if (campaign.status !== 'active') {
      console.warn(`Campaign is not active: ${campaign.id} (status: ${campaign.status})`);
      return null;
    }
    
    // Create enriched message
    const enrichedMessage: EnrichedDialTask = {
      ...message,
      campaign,
      enrichedAt: new Date().toISOString(),
    };
    
    console.log(`Enriched dial task for contact ${message.contactId} in campaign ${campaign.name}`);
    
    return enrichedMessage;
  } catch (error) {
    console.error('Error enriching dial task:', error);
    throw error;
  }
}

/**
 * Get Redis password from AWS Secrets Manager
 */
async function getRedisPassword(): Promise<string> {
  if (cachedRedisPassword) {
    return cachedRedisPassword;
  }

  try {
    const secretArn = process.env.REDIS_PASSWORD_SECRET;

    if (!secretArn) {
      console.warn('REDIS_PASSWORD_SECRET not set, connecting without password');
      return '';
    }

    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await secretsClient.send(command);

    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      cachedRedisPassword = secret.password as string;
      return cachedRedisPassword;
    }
    
    return '';
  } catch (error) {
    console.error('Error retrieving Redis password:', error);
    return '';
  }
}

/**
 * Initialize Redis client
 */
async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    try {
      const redisPassword = await getRedisPassword();
      
      const redisUrl = redisPassword
        ? `redis://:${redisPassword}@${REDIS_ENDPOINT}:${REDIS_PORT}`
        : `redis://${REDIS_ENDPOINT}:${REDIS_PORT}`;
      
      console.log(`Connecting to Redis at ${REDIS_ENDPOINT}:${REDIS_PORT}`);
      
      redisClient = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
        },
      });
      
      redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });
      
      await redisClient.connect();
      console.log('Redis client connected');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
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
    // Validate that campaign data exists
    if (!dialTask.campaign) {
      throw new Error('Campaign data is missing from enriched dial task');
    }
    
    if (!dialTask.campaign.config) {
      throw new Error('Campaign config is missing from enriched dial task');
    }
    
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
export async function handler(event: SQSEvent): Promise<any> {
  console.log('Dialer Worker Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const result: BatchProcessingResult = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    rateLimited: 0,
    errors: [],
  };

  // For SQS partial batch failure reporting
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  
  try {
    // SQS passes records in event.Records
    const dialTasks: Array<{ task: EnrichedDialTask; messageId: string }> = [];
    
    for (const record of event.Records) {
      try {
        const parsedMessage = JSON.parse(record.body);
        console.log(`Parsed message for record ${record.messageId}:`, JSON.stringify(parsedMessage, null, 2));
        
        let enrichedTask: EnrichedDialTask | null = null;
        
        // Check if message is already enriched (has campaign property)
        if (parsedMessage.campaign && parsedMessage.campaign.config) {
          console.log(`Message ${record.messageId} is already enriched`);
          enrichedTask = parsedMessage as EnrichedDialTask;
        } else {
          console.log(`Message ${record.messageId} needs enrichment`);
          // Treat as raw dial task message and enrich it
          enrichedTask = await enrichDialTask(parsedMessage as DialTaskMessage);
        }
        
        if (enrichedTask) {
          dialTasks.push({
            task: enrichedTask,
            messageId: record.messageId
          });
        } else {
          console.warn(`Failed to enrich or invalid message for record ${record.messageId}`);
          // Don't add to batch failures - let invalid messages be discarded
        }
      } catch (error) {
        console.error('Failed to parse or enrich SQS record:', record.body, error);
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
    
    console.log(`Processing ${dialTasks.length} dial tasks`);
    
    // Get current CPS before processing
    const currentCPS = await getCurrentCPS();
    console.log(`Current CPS: ${currentCPS}/${MAX_CPS}`);
    
    // Process each dial task
    for (const { task: dialTask, messageId } of dialTasks) {
      result.totalProcessed++;
      
      try {
        const dialResult = await processDialTask(dialTask);
        
        if (dialResult.success) {
          result.successful++;
          console.log(`Successfully processed dial task for contact ${dialTask.contactId}`);
        } else if (dialResult.rateLimitExceeded) {
          result.rateLimited++;
          console.warn(`Rate limited dial task for contact ${dialTask.contactId}`);
          
          // For rate limited tasks, add to failures for retry
          batchItemFailures.push({ itemIdentifier: messageId });
        } else {
          result.failed++;
          result.errors.push({
            contactId: dialTask.contactId,
            phoneNumber: dialTask.phoneNumber,
            error: dialResult.error || 'Unknown error',
          });
          console.error(`Failed to process dial task for contact ${dialTask.contactId}: ${dialResult.error}`);
          // Don't retry failed tasks, let them complete
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          contactId: dialTask.contactId,
          phoneNumber: dialTask.phoneNumber,
          error: error.message || 'Unknown error',
        });
        console.error(`Error processing dial task for contact ${dialTask.contactId}:`, error);
        
        // Add to failures for retry
        batchItemFailures.push({ itemIdentifier: messageId });
      }
    }
    
    console.log(`Batch processing complete: ${result.successful} successful, ${result.failed} failed, ${result.rateLimited} rate limited`);
    
    // Return partial batch failure response for SQS
    return {
      batchItemFailures: batchItemFailures
    };
  } catch (error) {
    console.error('Fatal error in Dialer Worker Lambda:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections');
  if (redisClient) {
    await redisClient.quit();
  }
  if (pool) {
    await pool.end();
  }
});
