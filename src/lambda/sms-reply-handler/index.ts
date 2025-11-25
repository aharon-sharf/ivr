/**
 * SMS Reply Handler Lambda
 * 
 * This Lambda function processes inbound SMS replies from recipients.
 * It captures the response, associates it with the contact record, and stores it in the database.
 * 
 * Responsibilities:
 * - Set up webhook for SMS provider (Vonage)
 * - Process inbound SMS messages
 * - Associate reply with contact record
 * - Store reply in database
 * 
 * Validates: Requirements 6.4
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';

// PostgreSQL connection pool
let pool: Pool | null = null;

// Redis client for caching
let redisClient: RedisClientType | null = null;

// Configuration
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'campaigns';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Types
interface InboundSMSPayload {
  from: string;
  to: string;
  text: string;
  messageId: string;
  timestamp: string;
  keyword?: string;
}

interface Contact {
  id: string;
  campaignId: string;
  phoneNumber: string;
  metadata: Record<string, any>;
}

interface SMSReply {
  id: string;
  contactId: string;
  campaignId: string;
  phoneNumber: string;
  replyText: string;
  receivedAt: Date;
  providerMessageId: string;
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
 * Parse inbound SMS payload from Vonage webhook
 */
function parseVonageWebhook(event: APIGatewayProxyEvent): InboundSMSPayload | null {
  try {
    // Vonage sends data as query parameters or form-encoded body
    const params = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    
    // Merge params and body (params take precedence for Vonage)
    const data = { ...body, ...params };
    
    if (!data.msisdn || !data.to || !data.text) {
      console.error('Missing required fields in webhook payload');
      return null;
    }
    
    return {
      from: data.msisdn, // Sender's phone number
      to: data.to, // Recipient's phone number (our number)
      text: data.text, // Message text
      messageId: data['message-id'] || data.messageId || '',
      timestamp: data['message-timestamp'] || data.timestamp || new Date().toISOString(),
      keyword: data.keyword,
    };
  } catch (error) {
    console.error('Error parsing webhook payload:', error);
    return null;
  }
}

/**
 * Find contact by phone number
 * 
 * **Feature: mass-voice-campaign-system, Property 26: SMS reply capture and association**
 * For any inbound SMS reply to a campaign message, the system should capture the response 
 * and associate it with the correct contact record.
 */
async function findContactByPhoneNumber(phoneNumber: string): Promise<Contact | null> {
  try {
    // First check Redis cache
    const client = await getRedisClient();
    const cacheKey = `contact:phone:${phoneNumber}`;
    const cached = await client.get(cacheKey);
    
    if (cached) {
      console.log(`Contact found in cache for ${phoneNumber}`);
      return JSON.parse(cached);
    }
    
    // Query database
    const dbPool = getPool();
    const query = `
      SELECT * FROM contacts
      WHERE phone_number = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await dbPool.query(query, [phoneNumber]);
    
    if (result.rows.length === 0) {
      console.log(`No contact found for phone number ${phoneNumber}`);
      return null;
    }
    
    const row = result.rows[0];
    const contact: Contact = {
      id: row.id,
      campaignId: row.campaign_id,
      phoneNumber: row.phone_number,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
    
    // Cache for future lookups
    await client.setEx(cacheKey, 3600, JSON.stringify(contact)); // 1 hour TTL
    
    return contact;
  } catch (error) {
    console.error('Error finding contact:', error);
    return null;
  }
}

/**
 * Store SMS reply in database
 */
async function storeSMSReply(reply: SMSReply): Promise<void> {
  const dbPool = getPool();
  
  const query = `
    INSERT INTO sms_replies (
      id, contact_id, campaign_id, phone_number, reply_text, 
      received_at, provider_message_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  
  await dbPool.query(query, [
    reply.id,
    reply.contactId,
    reply.campaignId,
    reply.phoneNumber,
    reply.replyText,
    reply.receivedAt,
    reply.providerMessageId,
    new Date(),
  ]);
  
  console.log(`SMS reply stored: ${reply.id}`);
}

/**
 * Update contact metadata with reply
 */
async function updateContactWithReply(
  contactId: string,
  replyText: string
): Promise<void> {
  const dbPool = getPool();
  
  // Get current contact
  const getQuery = 'SELECT metadata FROM contacts WHERE id = $1';
  const getResult = await dbPool.query(getQuery, [contactId]);
  
  if (getResult.rows.length === 0) {
    console.warn(`Contact ${contactId} not found for metadata update`);
    return;
  }
  
  const currentMetadata = typeof getResult.rows[0].metadata === 'string' 
    ? JSON.parse(getResult.rows[0].metadata) 
    : getResult.rows[0].metadata;
  
  // Add reply to metadata
  const updatedMetadata = {
    ...currentMetadata,
    lastReply: replyText,
    lastReplyAt: new Date().toISOString(),
    hasReplied: true,
  };
  
  // Update contact
  const updateQuery = `
    UPDATE contacts
    SET metadata = $1, updated_at = $2
    WHERE id = $3
  `;
  
  await dbPool.query(updateQuery, [
    JSON.stringify(updatedMetadata),
    new Date(),
    contactId,
  ]);
  
  console.log(`Contact ${contactId} metadata updated with reply`);
}

/**
 * Increment campaign reply count in Redis
 */
async function incrementReplyCount(campaignId: string): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = `campaign:${campaignId}:replies`;
    await client.incr(key);
    console.log(`Reply count incremented for campaign ${campaignId}`);
  } catch (error) {
    console.error('Error incrementing reply count:', error);
    // Non-critical, don't throw
  }
}

/**
 * Main Lambda handler for inbound SMS webhook
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  console.log('SMS Reply Handler Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse webhook payload
    const payload = parseVonageWebhook(event);
    
    if (!payload) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid webhook payload' }),
      };
    }
    
    console.log(`Received SMS reply from ${payload.from}: ${payload.text}`);
    
    // Find contact by phone number
    const contact = await findContactByPhoneNumber(payload.from);
    
    if (!contact) {
      console.warn(`No contact found for phone number ${payload.from}`);
      // Still return 200 to acknowledge receipt
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'SMS received but no matching contact found',
          phoneNumber: payload.from,
        }),
      };
    }
    
    console.log(`Contact found: ${contact.id} for campaign ${contact.campaignId}`);
    
    // Create SMS reply record
    const reply: SMSReply = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      contactId: contact.id,
      campaignId: contact.campaignId,
      phoneNumber: payload.from,
      replyText: payload.text,
      receivedAt: new Date(payload.timestamp),
      providerMessageId: payload.messageId,
    };
    
    // Store reply in database
    await storeSMSReply(reply);
    
    // Update contact metadata
    await updateContactWithReply(contact.id, payload.text);
    
    // Increment campaign reply count
    await incrementReplyCount(contact.campaignId);
    
    console.log('SMS reply processed successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'SMS reply processed successfully',
        replyId: reply.id,
        contactId: contact.id,
        campaignId: contact.campaignId,
      }),
    };
  } catch (error) {
    console.error('Error processing SMS reply:', error);
    
    // Return 200 to acknowledge receipt even on error
    // This prevents the SMS provider from retrying
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'SMS received but processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
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
