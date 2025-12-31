/**
 * Validate Campaign Lambda
 * Validates campaign configuration before execution
 * Invoked by Step Functions state machine
 */

import { Campaign, validateCampaign } from '../../models/Campaign';
import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// AWS Secrets Manager client
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Configuration
const DB_SECRET_ARN = process.env.DB_SECRET_ARN || '';
const RDS_PROXY_ENDPOINT = process.env.RDS_PROXY_ENDPOINT || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'campaign_system';
const DB_USER = process.env.DB_USER || 'iadmin';

// Database connection pool (will be initialized lazily)
let pool: Pool | null = null;

interface ValidateCampaignInput {
  campaignId: string;
  executionSource?: string;
}

interface ValidateCampaignOutput {
  valid: boolean;
  errors?: string[];
  campaign?: Campaign;
  campaignId: string;
  campaignName?: string;
}

/**
 * Get database password from AWS Secrets Manager
 */
async function getDbPassword(): Promise<string> {
  try {
    console.log('Retrieving database password from Secrets Manager');
    const command = new GetSecretValueCommand({ SecretId: DB_SECRET_ARN });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret string is empty');
    }

    const secret = JSON.parse(response.SecretString);
    return secret.password;
  } catch (error) {
    console.error('Error retrieving database password:', error);
    throw error;
  }
}

/**
 * Initialize database connection pool
 */
async function initializePool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  try {
    const password = await getDbPassword();
    
    console.log(`Connecting to database: ${RDS_PROXY_ENDPOINT}:${DB_PORT}/${DB_NAME} as ${DB_USER}`);
    
    pool = new Pool({
      host: RDS_PROXY_ENDPOINT,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: password,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: false
      }
    });

    return pool;
  } catch (error) {
    console.error('Error initializing database pool:', error);
    throw error;
  }
}

/**
 * Main Lambda handler
 */
export async function handler(event: ValidateCampaignInput): Promise<ValidateCampaignOutput> {
  console.log('Validating campaign:', JSON.stringify(event, null, 2));
  console.log('Environment variables:', {
    DB_SECRET_ARN: DB_SECRET_ARN ? 'SET' : 'NOT SET',
    RDS_PROXY_ENDPOINT: RDS_PROXY_ENDPOINT,
    DB_PORT: DB_PORT,
    DB_NAME: DB_NAME,
    DB_USER: DB_USER,
  });

  const { campaignId } = event;

  if (!campaignId) {
    return {
      valid: false,
      errors: ['Campaign ID is required'],
      campaignId: '',
    };
  }

  try {
    // Fetch campaign from database
    const campaign = await getCampaign(campaignId);

    if (!campaign) {
      return {
        valid: false,
        errors: ['Campaign not found'],
        campaignId,
      };
    }

    // Validate campaign configuration
    const validationErrors = validateCampaign(campaign);

    // Additional runtime validations
    const runtimeErrors = await performRuntimeValidations(campaign);
    const allErrors = [...validationErrors, ...runtimeErrors];

    if (allErrors.length > 0) {
      console.error('Campaign validation failed:', allErrors);
      return {
        valid: false,
        errors: allErrors,
        campaignId,
        campaignName: campaign.name,
      };
    }

    console.log('Campaign validation successful');
    return {
      valid: true,
      campaign,
      campaignId,
      campaignName: campaign.name,
    };
  } catch (error) {
    console.error('Error validating campaign:', error);
    throw error;
  }
}

/**
 * Fetch campaign from database
 */
async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const dbPool = await initializePool();
  const client = await dbPool.connect();
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

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      config: row.config,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } finally {
    client.release();
  }
}

/**
 * Perform runtime validations that require external checks
 */
async function performRuntimeValidations(campaign: Campaign): Promise<string[]> {
  const errors: string[] = [];

  // Validate campaign status
  if (campaign.status !== 'scheduled' && campaign.status !== 'draft') {
    errors.push(`Campaign status must be 'scheduled' or 'draft', got '${campaign.status}'`);
  }

  // Validate time range
  if (campaign.startTime && campaign.endTime) {
    const now = new Date();
    const startTime = new Date(campaign.startTime);
    const endTime = new Date(campaign.endTime);

    if (endTime < now) {
      errors.push('Campaign end time is in the past');
    }

    if (startTime >= endTime) {
      errors.push('Campaign start time must be before end time');
    }
  }

  // Validate audio files exist (for voice campaigns)
  if (campaign.type === 'voice' || campaign.type === 'hybrid') {
    if (campaign.config.audioFileUrl) {
      const audioExists = await validateAudioFile(campaign.config.audioFileUrl);
      if (!audioExists) {
        errors.push(`Audio file not found: ${campaign.config.audioFileUrl}`);
      }
    }

    // Validate IVR flow if present
    if (campaign.config.ivrFlow) {
      const ivrErrors = validateIVRFlow(campaign.config.ivrFlow);
      errors.push(...ivrErrors);
    }
  }

  // Validate SMS template (for SMS campaigns)
  if (campaign.type === 'sms' || campaign.type === 'hybrid') {
    if (!campaign.config.smsTemplate || campaign.config.smsTemplate.trim().length === 0) {
      errors.push('SMS template is required for SMS campaigns');
    }
  }

  // Validate calling windows
  if (!campaign.config.callingWindows || campaign.config.callingWindows.length === 0) {
    errors.push('At least one calling window is required');
  }

  // Check if campaign has contacts
  const hasContacts = await checkCampaignHasContacts(campaign.id);
  if (!hasContacts) {
    errors.push('Campaign has no contacts');
  }

  return errors;
}

/**
 * Validate audio file exists in S3
 */
async function validateAudioFile(audioUrl: string): Promise<boolean> {
  // For now, just check if URL is valid
  // In production, this would check S3 bucket
  try {
    const url = new URL(audioUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validate IVR flow definition
 */
function validateIVRFlow(ivrFlow: any): string[] {
  const errors: string[] = [];

  if (!ivrFlow.nodes || !Array.isArray(ivrFlow.nodes)) {
    errors.push('IVR flow must have nodes array');
    return errors;
  }

  if (!ivrFlow.startNodeId) {
    errors.push('IVR flow must have startNodeId');
    return errors;
  }

  // Check if start node exists
  const startNode = ivrFlow.nodes.find((n: any) => n.id === ivrFlow.startNodeId);
  if (!startNode) {
    errors.push(`Start node '${ivrFlow.startNodeId}' not found in IVR flow`);
  }

  // Validate each node
  ivrFlow.nodes.forEach((node: any, index: number) => {
    if (!node.id) {
      errors.push(`Node at index ${index} missing id`);
    }

    if (!node.type || !['play_audio', 'capture_input', 'action', 'menu'].includes(node.type)) {
      errors.push(`Node '${node.id}' has invalid type: ${node.type}`);
    }

    // Validate play_audio nodes have audioUrl
    if (node.type === 'play_audio' && !node.audioUrl) {
      errors.push(`Node '${node.id}' of type 'play_audio' must have audioUrl`);
    }

    // Validate capture_input nodes have validInputs
    if (node.type === 'capture_input' && (!node.validInputs || node.validInputs.length === 0)) {
      errors.push(`Node '${node.id}' of type 'capture_input' must have validInputs`);
    }
  });

  return errors;
}

/**
 * Check if campaign has any contacts
 */
async function checkCampaignHasContacts(campaignId: string): Promise<boolean> {
  const dbPool = await initializePool();
  const client = await dbPool.connect();
  try {
    const result = await client.query(
      'SELECT COUNT(*) as count FROM contacts WHERE campaign_id = $1',
      [campaignId]
    );
    return parseInt(result.rows[0].count) > 0;
  } finally {
    client.release();
  }
}

// Cleanup on Lambda shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database pool');
  if (pool) {
    await pool.end();
  }
});
