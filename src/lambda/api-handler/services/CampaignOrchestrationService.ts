/**
 * Campaign Orchestration Service
 * Handles campaign lifecycle operations: start, schedule, pause, resume
 */

import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { EventBridgeClient, PutRuleCommand, PutTargetsCommand, DeleteRuleCommand, RemoveTargetsCommand, EnableRuleCommand, DisableRuleCommand } from '@aws-sdk/client-eventbridge';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Campaign } from '../../../models/Campaign';

// Initialize AWS clients
const eventBridgeClient = new EventBridgeClient({ region: process.env.AWS_REGION || 'il-central-1' });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'il-central-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'il-central-1' });

// Cache for database password
let cachedDbPassword: string | null = null;

/**
 * Get database password from AWS Secrets Manager
 */
async function getDbPassword(): Promise<string> {
  if (cachedDbPassword) {
    return cachedDbPassword;
  }

  try {
    const secretArn = process.env.DB_SECRET_ARN;
    if (!secretArn) {
      throw new Error('DB_SECRET_ARN environment variable not set');
    }

    console.log('Retrieving database password from Secrets Manager');
    const command = new GetSecretValueCommand({ SecretId: secretArn });
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

// Database connection pool (initialized lazily)
let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const password: string = await getDbPassword();
  
  pool = new Pool({
    host: process.env.RDS_PROXY_ENDPOINT || process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'campaign_system',
    user: process.env.DB_USER || 'dbadmin',
    password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false
    }
  });

  console.log('Database connection pool initialized');
  return pool;
}

export interface CampaignOperationResult {
  success: boolean;
  campaign: Campaign;
  message: string;
  executionArn?: string;
  scheduledAt?: string;
}

export class CampaignOrchestrationService {
  /**
   * Start a campaign immediately
   */
  async startCampaign(campaignId: string): Promise<CampaignOperationResult> {
    console.log(`Starting campaign: ${campaignId}`);

    try {
      // Get campaign details
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Validate campaign can be started
      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        throw new Error(`Campaign cannot be started from status '${campaign.status}'`);
      }

      // Update campaign status to 'active'
      await this.updateCampaignStatus(campaignId, 'active');

      // Invoke campaign orchestrator Lambda to start execution
      const executionArn = await this.invokeCampaignOrchestrator(campaignId, 'start');

      // Get updated campaign
      const updatedCampaign = await this.getCampaign(campaignId);

      return {
        success: true,
        campaign: updatedCampaign!,
        message: 'Campaign started successfully',
        executionArn
      };
    } catch (error) {
      console.error(`Error starting campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Schedule a campaign for future execution
   */
  async scheduleCampaign(campaignId: string, startTime: string): Promise<CampaignOperationResult> {
    console.log(`Scheduling campaign: ${campaignId} for ${startTime}`);

    try {
      // Get campaign details
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Validate start time is in the future
      const scheduledTime = new Date(startTime);
      const now = new Date();
      if (scheduledTime <= now) {
        throw new Error('Start time must be in the future');
      }

      // Update campaign status to 'scheduled' and set start time
      await this.updateCampaignStatusAndTime(campaignId, 'scheduled', scheduledTime);

      // Create EventBridge rule for scheduled execution
      await this.createScheduledRule(campaignId, scheduledTime);

      // Get updated campaign
      const updatedCampaign = await this.getCampaign(campaignId);

      return {
        success: true,
        campaign: updatedCampaign!,
        message: 'Campaign scheduled successfully',
        scheduledAt: scheduledTime.toISOString()
      };
    } catch (error) {
      console.error(`Error scheduling campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Pause an active campaign
   */
  async pauseCampaign(campaignId: string): Promise<CampaignOperationResult> {
    console.log(`Pausing campaign: ${campaignId}`);

    try {
      // Get campaign details
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Validate campaign can be paused
      if (campaign.status !== 'active') {
        throw new Error(`Campaign cannot be paused from status '${campaign.status}'`);
      }

      // Update campaign status to 'paused'
      await this.updateCampaignStatus(campaignId, 'paused');

      // Invoke campaign orchestrator Lambda to pause execution
      await this.invokeCampaignOrchestrator(campaignId, 'pause');

      // Get updated campaign
      const updatedCampaign = await this.getCampaign(campaignId);

      return {
        success: true,
        campaign: updatedCampaign!,
        message: 'Campaign paused successfully'
      };
    } catch (error) {
      console.error(`Error pausing campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: string): Promise<CampaignOperationResult> {
    console.log(`Resuming campaign: ${campaignId}`);

    try {
      // Get campaign details
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Validate campaign can be resumed
      if (campaign.status !== 'paused') {
        throw new Error(`Campaign cannot be resumed from status '${campaign.status}'`);
      }

      // Update campaign status to 'active'
      await this.updateCampaignStatus(campaignId, 'active');

      // Invoke campaign orchestrator Lambda to resume execution
      await this.invokeCampaignOrchestrator(campaignId, 'resume');

      // Get updated campaign
      const updatedCampaign = await this.getCampaign(campaignId);

      return {
        success: true,
        campaign: updatedCampaign!,
        message: 'Campaign resumed successfully'
      };
    } catch (error) {
      console.error(`Error resuming campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Get campaign from database
   */
  private async getCampaign(campaignId: string): Promise<Campaign | null> {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM campaigns WHERE id = $1';
      const result = await client.query(query, [campaignId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCampaign(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Update campaign status
   */
  private async updateCampaignStatus(campaignId: string, status: string): Promise<void> {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const query = `
        UPDATE campaigns 
        SET status = $1, updated_at = NOW() 
        WHERE id = $2
      `;
      await client.query(query, [status, campaignId]);
    } finally {
      client.release();
    }
  }

  /**
   * Update campaign status and start time
   */
  private async updateCampaignStatusAndTime(campaignId: string, status: string, startTime: Date): Promise<void> {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const query = `
        UPDATE campaigns 
        SET status = $1, start_time = $2, updated_at = NOW() 
        WHERE id = $3
      `;
      await client.query(query, [status, startTime, campaignId]);
    } finally {
      client.release();
    }
  }

  /**
   * Create EventBridge rule for scheduled campaign execution
   */
  private async createScheduledRule(campaignId: string, startTime: Date): Promise<void> {
    const ruleName = `campaign-${campaignId}-scheduled`;
    
    try {
      // Create the rule with a one-time schedule
      const scheduleExpression = `at(${startTime.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z')})`;
      
      const putRuleCommand = new PutRuleCommand({
        Name: ruleName,
        Description: `Scheduled execution for campaign ${campaignId}`,
        ScheduleExpression: scheduleExpression,
        State: 'ENABLED'
      });

      await eventBridgeClient.send(putRuleCommand);
      console.log(`Created EventBridge rule: ${ruleName}`);

      // Add target to invoke campaign orchestrator Lambda
      const campaignOrchestratorArn = process.env.CAMPAIGN_ORCHESTRATOR_LAMBDA_ARN;
      if (!campaignOrchestratorArn) {
        throw new Error('CAMPAIGN_ORCHESTRATOR_LAMBDA_ARN environment variable not set');
      }

      const putTargetsCommand = new PutTargetsCommand({
        Rule: ruleName,
        Targets: [
          {
            Id: '1',
            Arn: campaignOrchestratorArn,
            Input: JSON.stringify({
              campaignId,
              action: 'start',
              source: 'scheduled'
            })
          }
        ]
      });

      await eventBridgeClient.send(putTargetsCommand);
      console.log(`Added target to EventBridge rule: ${ruleName}`);
    } catch (error) {
      console.error(`Error creating scheduled rule for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Invoke campaign orchestrator Lambda
   */
  private async invokeCampaignOrchestrator(campaignId: string, action: string): Promise<string> {
    const campaignOrchestratorArn = process.env.CAMPAIGN_ORCHESTRATOR_LAMBDA_ARN;
    if (!campaignOrchestratorArn) {
      throw new Error('CAMPAIGN_ORCHESTRATOR_LAMBDA_ARN environment variable not set');
    }

    try {
      const payload = {
        campaignId,
        action,
        source: 'api'
      };

      const command = new InvokeCommand({
        FunctionName: campaignOrchestratorArn,
        Payload: JSON.stringify(payload),
        InvocationType: 'Event' // Asynchronous invocation
      });

      const response = await lambdaClient.send(command);
      console.log(`Invoked campaign orchestrator for campaign ${campaignId}, action: ${action}`);
      
      return `lambda-execution-${campaignId}-${Date.now()}`;
    } catch (error) {
      console.error(`Error invoking campaign orchestrator for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Map database row to Campaign object
   */
  private mapRowToCampaign(row: any): Campaign {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}