/**
 * Campaign Orchestrator Lambda
 * 
 * This Lambda function orchestrates concurrent campaign execution, ensuring that
 * SMS and voice campaigns run independently without resource conflicts.
 * 
 * Responsibilities:
 * - Manage concurrent campaign execution
 * - Ensure SMS and voice campaigns run independently
 * - Prevent resource conflicts between campaign types
 * - Route campaigns to appropriate dispatchers (SMS or Voice)
 * - Monitor campaign progress and resource utilization
 * 
 * Validates: Requirements 6.5
 */

import { Context } from 'aws-lambda';
import { Pool } from 'pg';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createClient, RedisClientType } from 'redis';

// PostgreSQL connection pool
let pool: Pool | null = null;

// Step Functions client
let sfnClient: SFNClient | null = null;

// Lambda client
let lambdaClient: LambdaClient | null = null;

// Redis client for resource tracking
let redisClient: RedisClientType | null = null;

// Secrets Manager client
let secretsClient: SecretsManagerClient | null = null;

// Cache for database password
let cachedDbPassword: string | null = null;

// Configuration
const DB_SECRET_ARN = process.env.DB_SECRET_ARN || '';
const RDS_PROXY_ENDPOINT = process.env.RDS_PROXY_ENDPOINT || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'campaigns';
const DB_USER = process.env.DB_USER || 'postgres';
const VOICE_CAMPAIGN_STATE_MACHINE_ARN = process.env.VOICE_CAMPAIGN_STATE_MACHINE_ARN || '';
const SMS_DISPATCHER_FUNCTION_NAME = process.env.SMS_DISPATCHER_FUNCTION_NAME || '';
const REDIS_ENDPOINT = process.env.REDIS_ENDPOINT || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Resource limits
const MAX_CONCURRENT_VOICE_CAMPAIGNS = parseInt(process.env.MAX_CONCURRENT_VOICE_CAMPAIGNS || '5');
const MAX_CONCURRENT_SMS_CAMPAIGNS = parseInt(process.env.MAX_CONCURRENT_SMS_CAMPAIGNS || '10');

// Types
interface Campaign {
  id: string;
  name: string;
  type: 'voice' | 'sms' | 'hybrid';
  status: string;
  config: any;
  timezone: string;
}

interface CampaignExecutionRequest {
  campaignId: string;
  action: 'start' | 'pause' | 'resume' | 'stop';
}

interface CampaignExecutionResult {
  campaignId: string;
  campaignType: string;
  action: string;
  success: boolean;
  executionArn?: string;
  message: string;
}

interface ResourceUtilization {
  voiceCampaigns: {
    active: number;
    limit: number;
    available: number;
  };
  smsCampaigns: {
    active: number;
    limit: number;
    available: number;
  };
}

/**
 * Get database password from AWS Secrets Manager
 */
async function getDbPassword(): Promise<string> {
  if (cachedDbPassword) {
    return cachedDbPassword;
  }

  if (!secretsClient) {
    secretsClient = new SecretsManagerClient({ region: AWS_REGION });
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
 * Initialize PostgreSQL connection pool
 */
async function getPool(): Promise<Pool> {
  if (!pool) {
    const password = await getDbPassword();
    
    console.log(`Connecting to database: ${RDS_PROXY_ENDPOINT}:${DB_PORT}/${DB_NAME} as ${DB_USER}`);
    
    pool = new Pool({
      host: RDS_PROXY_ENDPOINT,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password,
      max: 5, // Reduced for Lambda
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000, // Increased timeout
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    // Test the connection
    try {
      const client = await pool.connect();
      console.log('Database connection test successful');
      client.release();
    } catch (error) {
      console.error('Database connection test failed:', error);
      throw error;
    }
    
    console.log('PostgreSQL pool initialized successfully');
  }
  return pool;
}

/**
 * Initialize Step Functions client
 */
function getSFNClient(): SFNClient {
  if (!sfnClient) {
    sfnClient = new SFNClient({ region: AWS_REGION });
    console.log('Step Functions client initialized');
  }
  return sfnClient;
}

/**
 * Initialize Lambda client
 */
function getLambdaClient(): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({ region: AWS_REGION });
    console.log('Lambda client initialized');
  }
  return lambdaClient;
}

/**
 * Initialize Redis client
 */
async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      socket: {
        host: REDIS_ENDPOINT,
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
 * Get campaign by ID
 */
async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const dbPool = await getPool();
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
 * Get current resource utilization
 * 
 * **Feature: mass-voice-campaign-system, Property 27: Campaign type independence**
 * For any combination of SMS-only and voice campaigns running concurrently, each campaign 
 * type should execute independently without resource conflicts.
 */
async function getResourceUtilization(): Promise<ResourceUtilization> {
  const dbPool = await getPool();
  
  // Count active voice campaigns
  const voiceQuery = `
    SELECT COUNT(*) as count
    FROM campaigns
    WHERE type IN ('voice', 'hybrid')
      AND status = 'active'
  `;
  const voiceResult = await dbPool.query(voiceQuery);
  const activeVoiceCampaigns = parseInt(voiceResult.rows[0].count);
  
  // Count active SMS campaigns
  const smsQuery = `
    SELECT COUNT(*) as count
    FROM campaigns
    WHERE type = 'sms'
      AND status = 'active'
  `;
  const smsResult = await dbPool.query(smsQuery);
  const activeSMSCampaigns = parseInt(smsResult.rows[0].count);
  
  return {
    voiceCampaigns: {
      active: activeVoiceCampaigns,
      limit: MAX_CONCURRENT_VOICE_CAMPAIGNS,
      available: MAX_CONCURRENT_VOICE_CAMPAIGNS - activeVoiceCampaigns,
    },
    smsCampaigns: {
      active: activeSMSCampaigns,
      limit: MAX_CONCURRENT_SMS_CAMPAIGNS,
      available: MAX_CONCURRENT_SMS_CAMPAIGNS - activeSMSCampaigns,
    },
  };
}

/**
 * Check if campaign can be started based on resource availability
 */
async function canStartCampaign(campaign: Campaign): Promise<{ canStart: boolean; reason?: string }> {
  const utilization = await getResourceUtilization();
  
  if (campaign.type === 'voice' || campaign.type === 'hybrid') {
    if (utilization.voiceCampaigns.available <= 0) {
      return {
        canStart: false,
        reason: `Maximum concurrent voice campaigns (${MAX_CONCURRENT_VOICE_CAMPAIGNS}) reached`,
      };
    }
  }
  
  if (campaign.type === 'sms') {
    if (utilization.smsCampaigns.available <= 0) {
      return {
        canStart: false,
        reason: `Maximum concurrent SMS campaigns (${MAX_CONCURRENT_SMS_CAMPAIGNS}) reached`,
      };
    }
  }
  
  return { canStart: true };
}

/**
 * Start voice campaign via Step Functions
 */
async function startVoiceCampaign(campaign: Campaign): Promise<string> {
  const sfn = getSFNClient();
  
  const input = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignType: campaign.type,
    config: campaign.config,
    timezone: campaign.timezone,
  };
  
  const command = new StartExecutionCommand({
    stateMachineArn: VOICE_CAMPAIGN_STATE_MACHINE_ARN,
    name: `${campaign.id}-${Date.now()}`,
    input: JSON.stringify(input),
  });
  
  const response = await sfn.send(command);
  
  console.log(`Started voice campaign execution: ${response.executionArn}`);
  
  return response.executionArn!;
}

/**
 * Start SMS campaign via Lambda invocation
 */
async function startSMSCampaign(campaign: Campaign): Promise<string> {
  const lambda = getLambdaClient();
  
  const payload = {
    campaignId: campaign.id,
    batchSize: 100,
  };
  
  const command = new InvokeCommand({
    FunctionName: SMS_DISPATCHER_FUNCTION_NAME,
    InvocationType: 'Event', // Async invocation
    Payload: JSON.stringify(payload),
  });
  
  const response = await lambda.send(command);
  
  console.log(`Started SMS campaign execution: ${campaign.id}`);
  
  return `sms-campaign-${campaign.id}-${Date.now()}`;
}

/**
 * Update campaign status
 */
async function updateCampaignStatus(
  campaignId: string,
  status: string
): Promise<void> {
  const dbPool = await getPool();
  
  const query = `
    UPDATE campaigns
    SET status = $1, updated_at = $2
    WHERE id = $3
  `;
  
  await dbPool.query(query, [status, new Date(), campaignId]);
}

/**
 * Track campaign execution in Redis
 */
async function trackCampaignExecution(
  campaignId: string,
  campaignType: string,
  executionArn: string
): Promise<void> {
  const client = await getRedisClient();
  
  const key = `campaign:execution:${campaignId}`;
  const data = {
    campaignId,
    campaignType,
    executionArn,
    startedAt: new Date().toISOString(),
  };
  
  await client.setEx(key, 86400, JSON.stringify(data)); // 24 hour TTL
  
  // Also track by campaign type for resource monitoring
  const typeKey = `campaign:type:${campaignType}:active`;
  await client.sAdd(typeKey, campaignId);
  
  console.log(`Tracked campaign execution: ${campaignId}`);
}

/**
 * Remove campaign execution tracking
 */
async function untrackCampaignExecution(
  campaignId: string,
  campaignType: string
): Promise<void> {
  const client = await getRedisClient();
  
  const key = `campaign:execution:${campaignId}`;
  await client.del(key);
  
  const typeKey = `campaign:type:${campaignType}:active`;
  await client.sRem(typeKey, campaignId);
  
  console.log(`Untracked campaign execution: ${campaignId}`);
}

/**
 * Main Lambda handler for campaign orchestration
 */
export async function handler(
  event: CampaignExecutionRequest,
  context: Context
): Promise<CampaignExecutionResult> {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('Campaign Orchestrator Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Environment variables:', {
    DB_SECRET_ARN: DB_SECRET_ARN ? 'SET' : 'NOT SET',
    RDS_PROXY_ENDPOINT: RDS_PROXY_ENDPOINT,
    DB_PORT: DB_PORT,
    DB_NAME: DB_NAME,
    DB_USER: DB_USER,
    VOICE_CAMPAIGN_STATE_MACHINE_ARN: VOICE_CAMPAIGN_STATE_MACHINE_ARN ? 'SET' : 'NOT SET',
    SMS_DISPATCHER_FUNCTION_NAME: SMS_DISPATCHER_FUNCTION_NAME ? 'SET' : 'NOT SET'
  });
  
  const result: CampaignExecutionResult = {
    campaignId: event.campaignId,
    campaignType: '',
    action: event.action,
    success: false,
    message: '',
  };
  
  try {
    // Get campaign
    const campaign = await getCampaign(event.campaignId);
    
    if (!campaign) {
      throw new Error(`Campaign ${event.campaignId} not found`);
    }
    
    result.campaignType = campaign.type;
    
    console.log(`Processing ${event.action} action for ${campaign.type} campaign: ${campaign.name}`);
    
    // Handle different actions
    switch (event.action) {
      case 'start':
        // Check resource availability
        const canStart = await canStartCampaign(campaign);
        
        if (!canStart.canStart) {
          result.success = false;
          result.message = canStart.reason || 'Cannot start campaign';
          return result;
        }
        
        // Route to appropriate dispatcher based on campaign type
        let executionArn: string;
        
        if (campaign.type === 'voice' || campaign.type === 'hybrid') {
          executionArn = await startVoiceCampaign(campaign);
        } else if (campaign.type === 'sms') {
          executionArn = await startSMSCampaign(campaign);
        } else {
          throw new Error(`Unknown campaign type: ${campaign.type}`);
        }
        
        // Update campaign status
        await updateCampaignStatus(campaign.id, 'active');
        
        // Track execution
        await trackCampaignExecution(campaign.id, campaign.type, executionArn);
        
        result.success = true;
        result.executionArn = executionArn;
        result.message = `Campaign started successfully`;
        break;
      
      case 'pause':
        await updateCampaignStatus(campaign.id, 'paused');
        result.success = true;
        result.message = `Campaign paused successfully`;
        break;
      
      case 'resume':
        await updateCampaignStatus(campaign.id, 'active');
        result.success = true;
        result.message = `Campaign resumed successfully`;
        break;
      
      case 'stop':
        await updateCampaignStatus(campaign.id, 'cancelled');
        await untrackCampaignExecution(campaign.id, campaign.type);
        result.success = true;
        result.message = `Campaign stopped successfully`;
        break;
      
      default:
        throw new Error(`Unknown action: ${event.action}`);
    }
    
    console.log(`Campaign ${event.action} completed: ${result.message}`);
    
    return result;
  } catch (error) {
    console.error('Error in Campaign Orchestrator Lambda:', error);
    result.success = false;
    result.message = error instanceof Error ? error.message : 'Unknown error';
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
