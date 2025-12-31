/**
 * Enrich Dial Task Lambda
 * 
 * This Lambda function is invoked by EventBridge Pipes to enrich dial task messages
 * with campaign configuration before they reach the Dialer Worker Lambda.
 * 
 * Responsibilities:
 * - Fetch campaign configuration from PostgreSQL
 * - Add IVR flow, audio URLs, and settings to message
 * - Return enriched message to EventBridge Pipe
 * 
 * Validates: Requirements 4.1
 */

import { EventBridgeEvent } from 'aws-lambda';
import { Pool } from 'pg';

// PostgreSQL connection pool
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

/**
 * Fetch campaign configuration from PostgreSQL
 */
async function getCampaignConfig(campaignId: string): Promise<Campaign | null> {
  const client = await pool.connect();
  
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
 * Enrich a single dial task message with campaign configuration
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
 * Lambda handler for EventBridge Pipes enrichment
 * 
 * EventBridge Pipes passes an array of messages to the enrichment function.
 * Each message is enriched with campaign configuration.
 */
export async function handler(event: any): Promise<any[]> {
  console.log('Enrich Dial Task Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // EventBridge Pipes passes an array of messages
    const messages: DialTaskMessage[] = Array.isArray(event) ? event : [event];
    
    console.log(`Processing ${messages.length} dial task messages`);
    
    // Enrich each message
    const enrichedMessages = await Promise.all(
      messages.map(async (message) => {
        try {
          const enriched = await enrichDialTask(message);
          return enriched;
        } catch (error) {
          console.error('Error enriching message:', error);
          // Return null for failed enrichments - they will be filtered out
          return null;
        }
      })
    );
    
    // Filter out null values (failed enrichments)
    const validEnrichedMessages = enrichedMessages.filter(
      (msg): msg is EnrichedDialTask => msg !== null
    );
    
    console.log(`Successfully enriched ${validEnrichedMessages.length} out of ${messages.length} messages`);
    
    return validEnrichedMessages;
  } catch (error) {
    console.error('Fatal error in Enrich Dial Task Lambda:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connections');
  await pool.end();
});
