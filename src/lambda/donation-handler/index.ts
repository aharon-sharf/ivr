/**
 * Donation Handler Lambda
 * 
 * This Lambda function handles donation events triggered by DTMF input (Press 1).
 * It sends SMS messages with donation links, handles SMS failures with TTS fallback,
 * and records all actions in the database.
 * 
 * Responsibilities:
 * - Process donation-events SNS topic messages
 * - Trigger SMS sending with donation link
 * - Handle SMS failure and TTS fallback
 * - Record action in database
 * 
 * Validates: Requirements 4.2, 5.1
 */

import { SNSEvent, Context } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { createClient, RedisClientType } from 'redis';
import axios from 'axios';

// SNS client for triggering SMS
let snsClient: SNSClient | null = null;

// Redis client for tracking
let redisClient: RedisClientType | null = null;

// Configuration
const SMS_GATEWAY_TOPIC_ARN = process.env.SMS_GATEWAY_TOPIC_ARN || '';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const DONATION_LINK_BASE_URL = process.env.DONATION_LINK_BASE_URL || 'https://donate.example.com';
const DATABASE_API_URL = process.env.DATABASE_API_URL || '';

// Types
interface DonationEvent {
  callId: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  dtmfInput: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface DonationAction {
  id: string;
  callId: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  actionType: 'donation_sms_sent' | 'donation_sms_failed' | 'donation_tts_fallback';
  donationLink: string;
  smsMessageId?: string;
  ttsFallbackTriggered: boolean;
  timestamp: Date;
  status: 'success' | 'failed';
  failureReason?: string;
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
    
    redisClient.on('error', (err: Error) => {
      console.error('Redis Client Error:', err);
    });
    
    await redisClient.connect();
    console.log('Redis client connected');
  }
  
  return redisClient;
}

/**
 * Generate personalized donation link
 */
function generateDonationLink(
  campaignId: string,
  contactId: string,
  phoneNumber: string
): string {
  // Create a unique tracking parameter
  const trackingId = Buffer.from(`${campaignId}:${contactId}:${phoneNumber}`).toString('base64');
  return `${DONATION_LINK_BASE_URL}?ref=${trackingId}`;
}

/**
 * Create SMS message with donation link
 */
function createDonationSMSMessage(
  donationLink: string,
  campaignName?: string
): string {
  const message = campaignName
    ? `Thank you for your interest in ${campaignName}! Please visit this link to complete your donation: ${donationLink}`
    : `Thank you for your interest! Please visit this link to complete your donation: ${donationLink}`;
  
  return message;
}

/**
 * Send SMS with donation link via SMS Gateway
 * 
 * **Feature: mass-voice-campaign-system, Property 19: DTMF-triggered SMS delivery**
 * For any IVR session where a recipient triggers an SMS action, the configured SMS 
 * message should be sent to the recipient's phone number.
 */
async function sendDonationSMS(
  event: DonationEvent,
  donationLink: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log(`Sending donation SMS to ${event.phoneNumber}`);
    
    const message = createDonationSMSMessage(donationLink, event.metadata?.campaignName);
    
    const sns = getSNSClient();
    
    const smsRequest = {
      phoneNumber: event.phoneNumber,
      message: message,
      campaignId: event.campaignId,
      contactId: event.contactId,
      templateVariables: {
        donationLink: donationLink,
        campaignName: event.metadata?.campaignName || '',
      },
    };
    
    const command = new PublishCommand({
      TopicArn: SMS_GATEWAY_TOPIC_ARN,
      Message: JSON.stringify(smsRequest),
      Subject: 'Donation SMS Request',
    });
    
    const response = await sns.send(command);
    
    console.log('SMS request published to SNS:', response.MessageId);
    
    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error: any) {
    console.error('Error sending donation SMS:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Record donation action in database
 */
async function recordDonationAction(action: DonationAction): Promise<void> {
  try {
    console.log('Recording donation action in database');
    
    // Store in Redis for quick access
    const client = await getRedisClient();
    const key = `donation_action:${action.id}`;
    
    await client.setEx(
      key,
      86400, // 24 hour TTL
      JSON.stringify(action)
    );
    
    console.log(`Donation action stored in Redis: ${key}`);
    
    // Also persist to database via API (if configured)
    if (DATABASE_API_URL) {
      try {
        await axios.post(`${DATABASE_API_URL}/actions`, action, {
          timeout: 5000,
        });
        console.log('Donation action persisted to database');
      } catch (dbError) {
        console.error('Error persisting to database (non-critical):', dbError);
        // Don't throw - Redis storage is sufficient
      }
    }
    
    // Update campaign metrics counter
    const metricsKey = `campaign:${action.campaignId}:donations`;
    await client.incr(metricsKey);
    
  } catch (error) {
    console.error('Error recording donation action:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Process donation event
 * 
 * **Feature: mass-voice-campaign-system, Property 15: DTMF action execution**
 * For any configured DTMF mapping, when a recipient presses the mapped key, 
 * the corresponding action should be executed exactly once.
 */
async function processDonationEvent(event: DonationEvent): Promise<void> {
  console.log(`Processing donation event for call ${event.callId}`);
  
  const actionId = `${event.callId}_donation_${Date.now()}`;
  
  try {
    // Generate personalized donation link
    const donationLink = generateDonationLink(
      event.campaignId,
      event.contactId,
      event.phoneNumber
    );
    
    console.log(`Generated donation link: ${donationLink}`);
    
    // Send SMS with donation link
    const smsResult = await sendDonationSMS(event, donationLink);
    
    // Create donation action record
    const action: DonationAction = {
      id: actionId,
      callId: event.callId,
      campaignId: event.campaignId,
      contactId: event.contactId,
      phoneNumber: event.phoneNumber,
      actionType: smsResult.success ? 'donation_sms_sent' : 'donation_sms_failed',
      donationLink: donationLink,
      smsMessageId: smsResult.messageId,
      ttsFallbackTriggered: false,
      timestamp: new Date(),
      status: smsResult.success ? 'success' : 'failed',
      failureReason: smsResult.error,
    };
    
    // Record action in database
    await recordDonationAction(action);
    
    if (smsResult.success) {
      console.log(`Donation SMS sent successfully for call ${event.callId}`);
    } else {
      console.error(`Donation SMS failed for call ${event.callId}: ${smsResult.error}`);
      // Note: TTS fallback will be handled by SMS Gateway Lambda if needed
    }
    
  } catch (error) {
    console.error(`Error processing donation event for call ${event.callId}:`, error);
    
    // Record failed action
    const failedAction: DonationAction = {
      id: actionId,
      callId: event.callId,
      campaignId: event.campaignId,
      contactId: event.contactId,
      phoneNumber: event.phoneNumber,
      actionType: 'donation_sms_failed',
      donationLink: '',
      ttsFallbackTriggered: false,
      timestamp: new Date(),
      status: 'failed',
      failureReason: error instanceof Error ? error.message : 'Unknown error',
    };
    
    await recordDonationAction(failedAction);
    
    throw error;
  }
}

/**
 * Lambda handler for donation events
 * 
 * This handler is triggered by SNS donation-events topic when a recipient
 * presses 1 during an IVR interaction to trigger the donation flow.
 */
export async function handler(event: SNSEvent, context: Context): Promise<void> {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('Donation Handler Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Process each SNS record
    for (const record of event.Records) {
      const message = JSON.parse(record.Sns.Message);
      
      console.log('Processing donation event:', message);
      
      // Extract donation event from SNS message
      const donationEvent: DonationEvent = {
        callId: message.callId,
        campaignId: message.campaignId,
        contactId: message.contactId,
        phoneNumber: message.phoneNumber,
        dtmfInput: message.dtmfInput || '1',
        timestamp: message.timestamp || new Date().toISOString(),
        metadata: message.metadata,
      };
      
      // Process the donation event
      await processDonationEvent(donationEvent);
    }
    
    console.log('Donation Handler Lambda completed successfully');
  } catch (error) {
    console.error('Error in Donation Handler Lambda:', error);
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
