/**
 * Dispatcher Lambda
 * Queries eligible contacts and pushes dial tasks to SQS
 * Invoked by Step Functions state machine
 */

import { Pool } from 'pg';
import { SQSClient, SendMessageBatchCommand, SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';
import { createClient } from 'redis';

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  }
});

// SQS client
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Redis client for blacklist cache
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err: Error) => console.error('Redis Client Error', err));

interface DispatcherInput {
  campaignId: string;
  campaignName?: string;
  campaign?: any;
  batchSize?: number;
}

interface DispatcherOutput {
  contactCount: number;
  batchesPushed: number;
  campaignId: string;
  campaignName?: string;
  needsMoreContacts: boolean;
}

interface Contact {
  id: string;
  campaign_id: string;
  phone_number: string;
  metadata: any;
  timezone?: string;
  optimal_call_time?: any;
  status: string;
  attempts: number;
}

const BATCH_SIZE = 100; // Number of contacts to dispatch per invocation
const MAX_ATTEMPTS = 3; // Maximum call attempts per contact
const SQS_BATCH_SIZE = 10; // SQS SendMessageBatch limit

/**
 * Main Lambda handler
 */
export async function handler(event: DispatcherInput): Promise<DispatcherOutput> {
  console.log('Dispatcher invoked:', JSON.stringify(event, null, 2));

  const { campaignId, campaignName, batchSize = BATCH_SIZE } = event;

  if (!campaignId) {
    throw new Error('Campaign ID is required');
  }

  try {
    // Connect to Redis if not already connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    // Fetch campaign details
    const campaign = event.campaign || await getCampaign(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Update campaign status to 'active' if it's scheduled
    if (campaign.status === 'scheduled') {
      await updateCampaignStatus(campaignId, 'active');
    }

    // Query eligible contacts
    const eligibleContacts = await queryEligibleContacts(
      campaignId,
      campaign,
      batchSize
    );

    console.log(`Found ${eligibleContacts.length} eligible contacts`);

    if (eligibleContacts.length === 0) {
      return {
        contactCount: 0,
        batchesPushed: 0,
        campaignId,
        campaignName: campaignName || campaign.name,
        needsMoreContacts: false,
      };
    }

    // Push contacts to SQS in batches
    const batchesPushed = await pushContactsToQueue(eligibleContacts, campaign);

    // Check if more contacts need to be dispatched
    const totalPending = await countPendingContacts(campaignId);
    const needsMoreContacts = totalPending > 0;

    console.log(`Dispatched ${eligibleContacts.length} contacts in ${batchesPushed} batches`);
    console.log(`Pending contacts remaining: ${totalPending}`);

    return {
      contactCount: eligibleContacts.length,
      batchesPushed,
      campaignId,
      campaignName: campaignName || campaign.name,
      needsMoreContacts,
    };
  } catch (error) {
    console.error('Error in dispatcher:', error);
    throw error;
  }
}

/**
 * Fetch campaign from database
 */
async function getCampaign(campaignId: string): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        id, name, type, status, config, 
        start_time, end_time, timezone,
        created_by, created_at, updated_at
      FROM campaigns 
      WHERE id = $1`,
      [campaignId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Update campaign status
 */
async function updateCampaignStatus(campaignId: string, status: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, campaignId]
    );
    console.log(`Updated campaign ${campaignId} status to ${status}`);
  } finally {
    client.release();
  }
}

/**
 * Query eligible contacts for dialing
 * Filters by:
 * - Not blacklisted
 * - Within calling time window (considering timezone)
 * - Not exceeded max attempts
 * - Status is 'pending' or 'failed' (for retries)
 * Prioritizes by ML-predicted optimal time
 */
async function queryEligibleContacts(
  campaignId: string,
  campaign: any,
  limit: number
): Promise<Contact[]> {
  const client = await pool.connect();
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDayOfWeek = now.getDay();

    // Build calling window filter
    const callingWindows = campaign.config?.callingWindows || [];
    const windowConditions = callingWindows.map((window: any) => {
      const dayCondition = window.dayOfWeek && window.dayOfWeek.length > 0
        ? `EXTRACT(DOW FROM NOW()) = ANY(ARRAY[${window.dayOfWeek.join(',')}])`
        : 'TRUE';
      
      return `(${dayCondition} AND EXTRACT(HOUR FROM NOW()) >= ${window.startHour} AND EXTRACT(HOUR FROM NOW()) < ${window.endHour})`;
    }).join(' OR ');

    const windowFilter = windowConditions || 'TRUE';

    // Query contacts
    const query = `
      SELECT 
        c.id, c.campaign_id, c.phone_number, c.metadata,
        c.timezone, c.optimal_call_time, c.status, c.attempts
      FROM contacts c
      WHERE c.campaign_id = $1
        AND c.status IN ('pending', 'failed')
        AND c.attempts < $2
        AND c.phone_number NOT IN (
          SELECT phone_number FROM blacklist
        )
        AND (${windowFilter})
      ORDER BY 
        -- Prioritize by optimal call time if available
        CASE 
          WHEN c.optimal_call_time IS NOT NULL 
            AND c.optimal_call_time->>'preferredHourRange' IS NOT NULL
          THEN ABS(EXTRACT(HOUR FROM NOW()) - (c.optimal_call_time->>'preferredHourRange')::jsonb->>'start'::int)
          ELSE 999
        END ASC,
        c.created_at ASC
      LIMIT $3
    `;

    const maxAttempts = campaign.config?.maxAttemptsPerContact || MAX_ATTEMPTS;
    const result = await client.query(query, [campaignId, maxAttempts, limit]);

    // Filter out blacklisted numbers from Redis cache
    const contacts = result.rows;
    const filteredContacts: Contact[] = [];

    for (const contact of contacts) {
      const isBlacklisted = await checkBlacklist(contact.phone_number);
      if (!isBlacklisted) {
        filteredContacts.push(contact);
      } else {
        // Update contact status to blacklisted
        await updateContactStatus(contact.id, 'blacklisted');
      }
    }

    return filteredContacts;
  } finally {
    client.release();
  }
}

/**
 * Check if phone number is blacklisted (Redis cache)
 */
async function checkBlacklist(phoneNumber: string): Promise<boolean> {
  try {
    const cached = await redisClient.get(`blacklist:${phoneNumber}`);
    return cached === '1';
  } catch (error) {
    console.error('Error checking blacklist cache:', error);
    // Fall back to database check
    return await checkBlacklistDB(phoneNumber);
  }
}

/**
 * Check if phone number is blacklisted (database fallback)
 */
async function checkBlacklistDB(phoneNumber: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT 1 FROM blacklist WHERE phone_number = $1',
      [phoneNumber]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Update contact status
 */
async function updateContactStatus(contactId: string, status: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE contacts SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, contactId]
    );
  } finally {
    client.release();
  }
}

/**
 * Push contacts to SQS dial-tasks queue
 */
async function pushContactsToQueue(contacts: Contact[], campaign: any): Promise<number> {
  const queueUrl = process.env.DIAL_TASKS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error('DIAL_TASKS_QUEUE_URL environment variable not set');
  }

  let batchesPushed = 0;

  // Split contacts into SQS batches (max 10 per batch)
  for (let i = 0; i < contacts.length; i += SQS_BATCH_SIZE) {
    const batch = contacts.slice(i, i + SQS_BATCH_SIZE);
    
    const entries: SendMessageBatchRequestEntry[] = batch.map((contact, index) => ({
      Id: `${contact.id}-${Date.now()}-${index}`,
      MessageBody: JSON.stringify({
        contactId: contact.id,
        campaignId: contact.campaign_id,
        phoneNumber: contact.phone_number,
        metadata: contact.metadata,
        attempts: contact.attempts,
        timestamp: new Date().toISOString(),
      }),
      MessageAttributes: {
        campaignId: {
          DataType: 'String',
          StringValue: contact.campaign_id,
        },
        contactId: {
          DataType: 'String',
          StringValue: contact.id,
        },
      },
    }));

    try {
      const command = new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      });

      const response = await sqsClient.send(command);
      
      if (response.Failed && response.Failed.length > 0) {
        console.error('Failed to send some messages:', response.Failed);
      }

      batchesPushed++;
      console.log(`Pushed batch ${batchesPushed} with ${entries.length} messages`);

      // Update contact status to 'in_progress'
      await updateContactsStatus(batch.map(c => c.id), 'in_progress');
    } catch (error) {
      console.error('Error pushing batch to SQS:', error);
      throw error;
    }
  }

  return batchesPushed;
}

/**
 * Update multiple contacts status
 */
async function updateContactsStatus(contactIds: string[], status: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE contacts 
       SET status = $1, updated_at = NOW() 
       WHERE id = ANY($2)`,
      [status, contactIds]
    );
  } finally {
    client.release();
  }
}

/**
 * Count pending contacts for campaign
 */
async function countPendingContacts(campaignId: string): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT COUNT(*) as count 
       FROM contacts 
       WHERE campaign_id = $1 
         AND status IN ('pending', 'failed')
         AND attempts < $2`,
      [campaignId, MAX_ATTEMPTS]
    );
    return parseInt(result.rows[0].count);
  } finally {
    client.release();
  }
}

// Cleanup on Lambda shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections');
  await pool.end();
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
});
