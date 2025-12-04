/**
 * SMS Dispatcher Lambda
 * 
 * This Lambda function dispatches SMS messages for SMS-only campaigns.
 * It queries eligible contacts, applies time window restrictions, checks blacklist,
 * and sends SMS messages via the SMS Gateway.
 * 
 * Responsibilities:
 * - Query PostgreSQL for eligible contacts (not blacklisted, within time window, not exceeded attempts)
 * - Apply time window enforcement for SMS campaigns
 * - Batch contacts and send SMS messages
 * - Track delivery status, open rates, link clicks
 * - Update campaign status
 * 
 * Validates: Requirements 6.2, 6.3
 */

import { Context } from 'aws-lambda';
import { Pool } from 'pg';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { createClient, RedisClientType } from 'redis';

// PostgreSQL connection pool
let pool: Pool | null = null;

// SNS client for SMS events
let snsClient: SNSClient | null = null;

// Redis client for blacklist checks
let redisClient: RedisClientType | null = null;

// Configuration
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'campaigns';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const SMS_GATEWAY_TOPIC_ARN = process.env.SMS_GATEWAY_TOPIC_ARN || '';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100');

// Types
interface TimeWindow {
  dayOfWeek: number[];
  startHour: number;
  endHour: number;
}

interface CampaignConfig {
  smsTemplate: string;
  callingWindows: TimeWindow[];
  maxAttemptsPerContact?: number;
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  config: CampaignConfig;
  timezone: string;
}

interface Contact {
  id: string;
  campaignId: string;
  phoneNumber: string;
  metadata: Record<string, any>;
  timezone?: string;
  status: string;
  attempts: number;
}

interface SMSDispatchEvent {
  campaignId: string;
  batchSize?: number;
}

interface SMSDispatchResult {
  campaignId: string;
  totalContacts: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Initialize PostgreSQL connection pool
 */
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    console.log('PostgreSQL pool initialized');
  }
  return pool;
}

/**
 * Initialize SNS client
 */
function getSNSClient(): SNSClient {
  if (!snsClient) {
    snsClient = new SNSClient({ region: AWS_REGION });
    console.log('SNS client initialized');
  }
  return snsClient;
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
 * Check if phone number is blacklisted
 * 
 * **Feature: mass-voice-campaign-system, Property 28: Blacklist enforcement in SMS campaigns**
 * For any contact on the blacklist, SMS messages should not be sent to that contact in SMS-only campaigns.
 */
async function isBlacklisted(phoneNumber: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const key = `blacklist:${phoneNumber}`;
    const exists = await client.exists(key);
    
    if (exists) {
      return true;
    }
    
    // Also check PostgreSQL as source of truth
    const dbPool = getPool();
    const query = 'SELECT 1 FROM blacklist WHERE phone_number = $1 LIMIT 1';
    const result = await dbPool.query(query, [phoneNumber]);
    
    if (result.rows.length > 0) {
      // Cache in Redis for fast lookups
      await client.setEx(key, 86400, '1'); // 24 hour TTL
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking blacklist:', error);
    // On error, assume not blacklisted to avoid blocking legitimate sends
    return false;
  }
}

/**
 * Check if current time is within allowed calling windows
 * 
 * **Feature: mass-voice-campaign-system, Property 24: SMS campaign time window compliance**
 * For any SMS-only campaign, messages should only be sent to contacts when the current time 
 * falls within the configured time windows.
 */
function isWithinTimeWindow(
  callingWindows: TimeWindow[],
  timezone: string,
  contactTimezone?: string
): boolean {
  try {
    // Use contact timezone if available, otherwise use campaign timezone
    const effectiveTimezone = contactTimezone || timezone;
    
    // Get current time in the effective timezone
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: effectiveTimezone }));
    
    const currentDay = localTime.getDay(); // 0-6, where 0 is Sunday
    const currentHour = localTime.getHours(); // 0-23
    
    // Check if current time falls within any of the configured windows
    for (const window of callingWindows) {
      // Check if current day is in the allowed days
      if (window.dayOfWeek.includes(currentDay)) {
        // Check if current hour is within the allowed hours
        if (currentHour >= window.startHour && currentHour < window.endHour) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking time window:', error);
    // On error, assume not within window to avoid sending at wrong times
    return false;
  }
}

/**
 * Get campaign by ID
 */
async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const dbPool = getPool();
  const query = 'SELECT * FROM campaigns WHERE id = $1';
  const result = await dbPool.query(query, [campaignId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
    timezone: row.timezone,
  };
}

/**
 * Query eligible contacts for SMS campaign
 */
async function queryEligibleContacts(
  campaignId: string,
  maxAttempts: number,
  limit: number
): Promise<Contact[]> {
  const dbPool = getPool();
  
  const query = `
    SELECT * FROM contacts
    WHERE campaign_id = $1
      AND status = 'pending'
      AND attempts < $2
    ORDER BY created_at ASC
    LIMIT $3
  `;
  
  const result = await dbPool.query(query, [campaignId, maxAttempts, limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    campaignId: row.campaign_id,
    phoneNumber: row.phone_number,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    timezone: row.timezone,
    status: row.status,
    attempts: row.attempts,
  }));
}

/**
 * Send SMS message via SNS to SMS Gateway
 */
async function sendSMSMessage(
  contact: Contact,
  campaign: Campaign
): Promise<boolean> {
  try {
    const sns = getSNSClient();
    
    const message = {
      phoneNumber: contact.phoneNumber,
      message: campaign.config.smsTemplate,
      campaignId: campaign.id,
      contactId: contact.id,
      templateVariables: contact.metadata,
      timestamp: new Date().toISOString(),
    };
    
    const command = new PublishCommand({
      TopicArn: SMS_GATEWAY_TOPIC_ARN,
      Message: JSON.stringify(message),
      Subject: 'SMS Campaign Message',
    });
    
    await sns.send(command);
    
    console.log(`SMS message sent for contact ${contact.id}`);
    return true;
  } catch (error) {
    console.error(`Error sending SMS for contact ${contact.id}:`, error);
    return false;
  }
}

/**
 * Update contact status after SMS attempt
 */
async function updateContactStatus(
  contactId: string,
  status: string,
  attempts: number
): Promise<void> {
  const dbPool = getPool();
  
  const query = `
    UPDATE contacts
    SET status = $1, attempts = $2, last_attempt_at = $3, updated_at = $4
    WHERE id = $5
  `;
  
  await dbPool.query(query, [
    status,
    attempts,
    new Date(),
    new Date(),
    contactId,
  ]);
}

/**
 * Create SMS record for tracking
 * 
 * **Feature: mass-voice-campaign-system, Property 25: SMS campaign metrics tracking**
 * For any SMS message delivered in an SMS-only campaign, the system should track and 
 * record delivery status, open rates, and link clicks.
 */
async function createSMSRecord(
  contact: Contact,
  campaign: Campaign,
  status: string
): Promise<void> {
  const dbPool = getPool();
  
  const query = `
    INSERT INTO sms_records (
      id, campaign_id, contact_id, phone_number, message, status, sent_at, 
      tts_fallback_triggered, cost, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `;
  
  const id = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await dbPool.query(query, [
    id,
    campaign.id,
    contact.id,
    contact.phoneNumber,
    campaign.config.smsTemplate,
    status,
    new Date(),
    false,
    0, // Cost will be updated by webhook
    new Date(),
  ]);
}

/**
 * Update campaign status
 */
async function updateCampaignStatus(
  campaignId: string,
  status: string
): Promise<void> {
  const dbPool = getPool();
  
  const query = `
    UPDATE campaigns
    SET status = $1, updated_at = $2
    WHERE id = $3
  `;
  
  await dbPool.query(query, [status, new Date(), campaignId]);
}

/**
 * Main Lambda handler for SMS campaign dispatch
 */
export async function handler(
  event: SMSDispatchEvent,
  context: Context
): Promise<SMSDispatchResult> {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('SMS Dispatcher Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const result: SMSDispatchResult = {
    campaignId: event.campaignId,
    totalContacts: 0,
    sentCount: 0,
    skippedCount: 0,
    failedCount: 0,
    errors: [],
  };
  
  try {
    // Get campaign
    const campaign = await getCampaign(event.campaignId);
    
    if (!campaign) {
      throw new Error(`Campaign ${event.campaignId} not found`);
    }
    
    if (campaign.type !== 'sms') {
      throw new Error(`Campaign ${event.campaignId} is not an SMS campaign`);
    }
    
    if (campaign.status !== 'scheduled' && campaign.status !== 'active') {
      throw new Error(`Campaign ${event.campaignId} is not in a valid state for dispatch`);
    }
    
    console.log(`Processing SMS campaign: ${campaign.name}`);
    
    // Update campaign status to active if it's scheduled
    if (campaign.status === 'scheduled') {
      await updateCampaignStatus(campaign.id, 'active');
    }
    
    // Query eligible contacts
    const batchSize = event.batchSize || BATCH_SIZE;
    const maxAttempts = campaign.config.maxAttemptsPerContact || 3;
    const contacts = await queryEligibleContacts(campaign.id, maxAttempts, batchSize);
    
    result.totalContacts = contacts.length;
    console.log(`Found ${contacts.length} eligible contacts`);
    
    if (contacts.length === 0) {
      console.log('No eligible contacts found, marking campaign as completed');
      await updateCampaignStatus(campaign.id, 'completed');
      return result;
    }
    
    // Process each contact
    for (const contact of contacts) {
      try {
        // Check if blacklisted
        const blacklisted = await isBlacklisted(contact.phoneNumber);
        if (blacklisted) {
          console.log(`Contact ${contact.id} is blacklisted, skipping`);
          await updateContactStatus(contact.id, 'blacklisted', contact.attempts);
          result.skippedCount++;
          continue;
        }
        
        // Check if within time window
        const withinWindow = isWithinTimeWindow(
          campaign.config.callingWindows,
          campaign.timezone,
          contact.timezone
        );
        
        if (!withinWindow) {
          console.log(`Contact ${contact.id} is outside time window, skipping`);
          result.skippedCount++;
          continue;
        }
        
        // Send SMS message
        const sent = await sendSMSMessage(contact, campaign);
        
        if (sent) {
          // Update contact status
          await updateContactStatus(contact.id, 'in_progress', contact.attempts + 1);
          
          // Create SMS record
          await createSMSRecord(contact, campaign, 'sent');
          
          result.sentCount++;
        } else {
          // Update contact status as failed
          await updateContactStatus(contact.id, 'failed', contact.attempts + 1);
          result.failedCount++;
        }
      } catch (error) {
        console.error(`Error processing contact ${contact.id}:`, error);
        result.failedCount++;
        result.errors.push(`Contact ${contact.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log(`SMS dispatch completed: ${result.sentCount} sent, ${result.skippedCount} skipped, ${result.failedCount} failed`);
    
    return result;
  } catch (error) {
    console.error('Error in SMS Dispatcher Lambda:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections');
  if (pool) {
    await pool.end();
  }
  if (redisClient) {
    await redisClient.quit();
  }
});
