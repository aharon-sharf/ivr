/**
 * SMS Gateway Lambda
 * 
 * This Lambda function sends SMS messages via Vonage/Local provider.
 * It handles template variable substitution, tracks delivery status,
 * detects SMS capability failures (landline detection), and triggers
 * TTS fallback on failure.
 * 
 * Responsibilities:
 * - Send SMS messages via Vonage/Local provider
 * - Implement sendSMS function with template variable substitution
 * - Track delivery status via webhook
 * - Detect SMS capability failures (landline detection)
 * - Trigger TTS fallback on failure
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 7.1
 */

import { SNSEvent, Context } from 'aws-lambda';
import { Vonage } from '@vonage/server-sdk';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { createClient, RedisClientType } from 'redis';
import axios from 'axios';

// Vonage client
let vonageClient: Vonage | null = null;

// SNS client for TTS fallback
let snsClient: SNSClient | null = null;

// Redis client for tracking
let redisClient: RedisClientType | null = null;

// Configuration
const VONAGE_API_KEY = process.env.VONAGE_API_KEY || '';
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET || '';
const VONAGE_FROM_NUMBER = process.env.VONAGE_FROM_NUMBER || '';
const TTS_FALLBACK_TOPIC_ARN = process.env.TTS_FALLBACK_TOPIC_ARN || '';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Types
interface SMSRequest {
  phoneNumber: string;
  message: string;
  campaignId: string;
  contactId: string;
  templateVariables?: Record<string, string>;
}

interface SMSResult {
  messageId: string;
  status: 'sent' | 'failed' | 'queued';
  failureReason?: string;
  requiresTTSFallback: boolean;
  timestamp: Date;
}

enum SMSDeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  UNDELIVERED = 'undelivered'
}

interface SMSRecord {
  id: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  message: string;
  status: SMSDeliveryStatus;
  sentAt: Date;
  deliveredAt?: Date;
  failureReason?: string;
  ttsFallbackTriggered: boolean;
  cost: number;
}

/**
 * Initialize Vonage client
 */
function getVonageClient(): Vonage {
  if (!vonageClient) {
    vonageClient = new Vonage({
      apiKey: VONAGE_API_KEY,
      apiSecret: VONAGE_API_SECRET,
    });
    console.log('Vonage client initialized');
  }
  return vonageClient;
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
 * Substitute template variables in message
 * 
 * **Feature: mass-voice-campaign-system, Property 22: SMS template variable substitution**
 * For any SMS template containing dynamic variables, all placeholders should be replaced 
 * with the correct recipient-specific data before sending.
 */
function substituteTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let message = template;
  
  // Replace all {{variable}} placeholders with actual values
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    message = message.replace(new RegExp(placeholder, 'g'), value);
  }
  
  // Check for any remaining unsubstituted variables
  const remainingPlaceholders = message.match(/\{\{[^}]+\}\}/g);
  if (remainingPlaceholders) {
    console.warn('Unsubstituted template variables found:', remainingPlaceholders);
  }
  
  return message;
}

/**
 * Detect if phone number is a landline (SMS not supported)
 * 
 * This is a simplified implementation. In production, you would use
 * Vonage Number Insight API or similar service to detect landlines.
 */
function isLandline(phoneNumber: string): boolean {
  // Placeholder implementation
  // In production, call Vonage Number Insight API
  // For now, we'll detect based on response from SMS send attempt
  return false;
}

/**
 * Send SMS message via Vonage
 * 
 * **Feature: mass-voice-campaign-system, Property 19: DTMF-triggered SMS delivery**
 * For any IVR session where a recipient triggers an SMS action, the configured SMS 
 * message should be sent to the recipient's phone number.
 */
async function sendSMS(request: SMSRequest): Promise<SMSResult> {
  try {
    console.log(`Sending SMS to ${request.phoneNumber} for campaign ${request.campaignId}`);
    
    // Substitute template variables if provided
    let message = request.message;
    if (request.templateVariables) {
      message = substituteTemplateVariables(message, request.templateVariables);
      console.log('Template variables substituted');
    }
    
    // Check if landline (would require Number Insight API in production)
    if (isLandline(request.phoneNumber)) {
      console.warn(`Phone number ${request.phoneNumber} is a landline, triggering TTS fallback`);
      return {
        messageId: '',
        status: 'failed',
        failureReason: 'Landline detected - SMS not supported',
        requiresTTSFallback: true,
        timestamp: new Date(),
      };
    }
    
    // Send SMS via Vonage
    const vonage = getVonageClient();
    
    const response = await vonage.sms.send({
      to: request.phoneNumber,
      from: VONAGE_FROM_NUMBER,
      text: message,
    });
    
    console.log('Vonage response:', JSON.stringify(response));
    
    // Check response status
    const messageStatus = response.messages[0];
    
    if (messageStatus.status === '0') {
      // Success
      console.log(`SMS sent successfully, message ID: ${messageStatus['message-id']}`);
      
      // Store SMS record in Redis for tracking
      await storeSMSRecord({
        id: messageStatus['message-id'],
        campaignId: request.campaignId,
        contactId: request.contactId,
        phoneNumber: request.phoneNumber,
        message: message,
        status: SMSDeliveryStatus.SENT,
        sentAt: new Date(),
        ttsFallbackTriggered: false,
        cost: parseFloat(messageStatus['message-price'] || '0'),
      });
      
      return {
        messageId: messageStatus['message-id'],
        status: 'sent',
        requiresTTSFallback: false,
        timestamp: new Date(),
      };
    } else {
      // Failure
      const errorText = (messageStatus as any).errorText || (messageStatus as any)['error-text'] || 'Unknown error';
      console.error(`SMS send failed: ${errorText}`);
      
      // Check if failure indicates SMS not supported (landline, etc.)
      const requiresTTSFallback = 
        errorText.toLowerCase().includes('landline') ||
        errorText.toLowerCase().includes('not supported') ||
        errorText.toLowerCase().includes('invalid destination') ||
        messageStatus.status === '9'; // Vonage status 9 = Partner quota exceeded or invalid destination
      
      if (requiresTTSFallback) {
        console.warn('SMS failure indicates TTS fallback required');
      }
      
      return {
        messageId: messageStatus['message-id'] || '',
        status: 'failed',
        failureReason: errorText,
        requiresTTSFallback,
        timestamp: new Date(),
      };
    }
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    
    return {
      messageId: '',
      status: 'failed',
      failureReason: error.message || 'Unknown error',
      requiresTTSFallback: true, // On error, trigger TTS fallback
      timestamp: new Date(),
    };
  }
}

/**
 * Store SMS record in Redis for tracking
 * 
 * **Feature: mass-voice-campaign-system, Property 20: SMS delivery status recording**
 * For any SMS message sent, when delivery succeeds, the system should record the 
 * delivery status with an accurate timestamp.
 */
async function storeSMSRecord(record: SMSRecord): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = `sms:${record.id}`;
    
    await client.setEx(
      key,
      86400, // 24 hour TTL
      JSON.stringify(record)
    );
    
    console.log(`SMS record stored in Redis: ${key}`);
  } catch (error) {
    console.error('Error storing SMS record in Redis:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Trigger TTS fallback via SNS
 * 
 * **Feature: mass-voice-campaign-system, Property 21: SMS failure triggers TTS fallback**
 * For any SMS delivery failure indicating lack of SMS support, the system should 
 * automatically initiate a TTS fallback call.
 */
async function triggerTTSFallback(request: SMSRequest, smsResult: SMSResult): Promise<void> {
  try {
    console.log(`Triggering TTS fallback for ${request.phoneNumber}`);
    
    const sns = getSNSClient();
    
    const message = {
      phoneNumber: request.phoneNumber,
      text: request.message,
      campaignId: request.campaignId,
      contactId: request.contactId,
      smsFailureReason: smsResult.failureReason,
      timestamp: new Date().toISOString(),
    };
    
    const command = new PublishCommand({
      TopicArn: TTS_FALLBACK_TOPIC_ARN,
      Message: JSON.stringify(message),
      Subject: 'TTS Fallback Required',
    });
    
    await sns.send(command);
    
    console.log('TTS fallback triggered successfully');
    
    // Update SMS record to indicate TTS fallback was triggered
    if (smsResult.messageId) {
      const client = await getRedisClient();
      const key = `sms:${smsResult.messageId}`;
      const recordStr = await client.get(key);
      
      if (recordStr) {
        const record: SMSRecord = JSON.parse(recordStr);
        record.ttsFallbackTriggered = true;
        await client.setEx(key, 86400, JSON.stringify(record));
      }
    }
  } catch (error) {
    console.error('Error triggering TTS fallback:', error);
    throw error;
  }
}

/**
 * Lambda handler for SNS events
 * 
 * This handler is triggered by SNS events (e.g., donation-events topic)
 * when a recipient triggers an SMS action via DTMF input.
 */
export async function handler(event: SNSEvent, context: Context): Promise<void> {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('SMS Gateway Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Process each SNS record
    for (const record of event.Records) {
      const message = JSON.parse(record.Sns.Message);
      
      console.log('Processing SMS request:', message);
      
      // Extract SMS request from SNS message
      const smsRequest: SMSRequest = {
        phoneNumber: message.phoneNumber,
        message: message.message || message.text,
        campaignId: message.campaignId,
        contactId: message.contactId,
        templateVariables: message.templateVariables,
      };
      
      // Send SMS
      const result = await sendSMS(smsRequest);
      
      console.log('SMS result:', result);
      
      // If SMS failed and requires TTS fallback, trigger it
      if (result.requiresTTSFallback) {
        console.log('SMS failed, triggering TTS fallback');
        await triggerTTSFallback(smsRequest, result);
      }
    }
    
    console.log('SMS Gateway Lambda completed successfully');
  } catch (error) {
    console.error('Error in SMS Gateway Lambda:', error);
    throw error;
  }
}

/**
 * Webhook handler for SMS delivery status updates
 * 
 * This handler is called by Vonage when SMS delivery status changes.
 * It updates the SMS record in Redis with the new status.
 */
export async function webhookHandler(event: any, context: Context): Promise<any> {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('SMS webhook handler invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse webhook payload from Vonage
    const body = JSON.parse(event.body || '{}');
    
    const messageId = body.messageId || body['message-id'];
    const status = body.status;
    const errorCode = body['err-code'];
    
    console.log(`Webhook: Message ${messageId} status: ${status}`);
    
    // Update SMS record in Redis
    const client = await getRedisClient();
    const key = `sms:${messageId}`;
    const recordStr = await client.get(key);
    
    if (recordStr) {
      const record: SMSRecord = JSON.parse(recordStr);
      
      // Update status
      if (status === 'delivered') {
        record.status = SMSDeliveryStatus.DELIVERED;
        record.deliveredAt = new Date();
      } else if (status === 'failed' || status === 'rejected') {
        record.status = SMSDeliveryStatus.FAILED;
        record.failureReason = errorCode || 'Delivery failed';
      }
      
      await client.setEx(key, 86400, JSON.stringify(record));
      
      console.log(`SMS record updated: ${key}`);
    } else {
      console.warn(`SMS record not found for message ${messageId}`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
    };
  } catch (error) {
    console.error('Error in webhook handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections');
  if (redisClient) {
    await redisClient.quit();
  }
});
