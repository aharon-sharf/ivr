/**
 * Campaign Status Checker Lambda
 * Queries campaign progress and calculates completion percentage
 * Invoked by Step Functions state machine during monitoring loop
 */

import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// AWS Secrets Manager client
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Configuration
const DB_SECRET_ARN = process.env.DB_SECRET_ARN || '';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;

let pool: Pool | null = null;

/**
 * Get database password from AWS Secrets Manager
 */
async function getDatabasePassword(): Promise<string> {
  try {
    console.log('Retrieving database password from Secrets Manager');
    const command = new GetSecretValueCommand({ SecretId: DB_SECRET_ARN });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
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

  const password = await getDatabasePassword();

  pool = new Pool({
    host: DB_HOST,
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
}

interface StatusCheckerInput {
  campaignId: string;
  campaignName?: string;
}

interface StatusCheckerOutput {
  campaignId: string;
  campaignName?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  totalContacts: number;
  completedContacts: number;
  pendingContacts: number;
  inProgressContacts: number;
  failedContacts: number;
  blacklistedContacts: number;
  completionPercentage: number;
  needsMoreContacts: boolean;
  metrics: {
    answered: number;
    busy: number;
    noAnswer: number;
    failed: number;
    converted: number;
    optedOut: number;
  };
}

/**
 * Main Lambda handler
 */
export async function handler(event: StatusCheckerInput): Promise<StatusCheckerOutput> {
  console.log('Checking campaign status:', JSON.stringify(event, null, 2));
  console.log('Environment variables:', {
    DB_SECRET_ARN: DB_SECRET_ARN ? 'SET' : 'NOT SET',
    DB_HOST: DB_HOST,
    DB_PORT: DB_PORT,
    DB_NAME: DB_NAME ? 'SET' : 'NOT SET',
    DB_USER: DB_USER ? 'SET' : 'NOT SET'
  });

  const { campaignId, campaignName } = event;

  if (!campaignId) {
    throw new Error('Campaign ID is required');
  }

  try {
    // Initialize database connection pool
    await initializePool();

    // Clean up stale in-progress contacts (safety mechanism)
    await cleanupStaleContacts(campaignId);

    // Fetch campaign status from database
    const campaign = await getCampaign(campaignId);
    
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Get contact statistics
    const contactStats = await getContactStatistics(campaignId);

    // Get call outcome metrics
    const metrics = await getCallMetrics(campaignId);

    // Calculate completion percentage
    const completionPercentage = contactStats.totalContacts > 0
      ? Math.round((contactStats.completedContacts / contactStats.totalContacts) * 100)
      : 0;

    // Determine if campaign is complete
    const isComplete = contactStats.pendingContacts === 0 && contactStats.inProgressContacts === 0;
    
    // Special case: If there are no contacts at all, campaign should be completed
    const hasNoContacts = contactStats.totalContacts === 0;
    
    // Special case: If end time has passed, campaign should be completed regardless of contact status
    const endTimePassed = campaign.end_time && new Date(campaign.end_time) < new Date();
    
    // Check if campaign has been running too long (safety mechanism)
    const maxMonitoringHours = 24; // Maximum 24 hours of monitoring
    const campaignStartTime = new Date(campaign.created_at);
    const hoursRunning = (new Date().getTime() - campaignStartTime.getTime()) / (1000 * 60 * 60);
    const hasExceededMaxDuration = hoursRunning > maxMonitoringHours;
    
    // Check if campaign should be marked as completed
    let status = campaign.status;
    let completionReason = '';
    
    // Priority 1: Check if campaign end time has passed
    if (endTimePassed && status === 'active') {
      completionReason = `end time passed (${campaign.end_time})`;
      console.log(`Marking campaign ${campaignId} as completed: ${completionReason}`);
      await updateCampaignStatus(campaignId, 'completed');
      status = 'completed';
    }
    // Priority 2: Check if there are no contacts at all
    else if (hasNoContacts && status === 'active') {
      completionReason = 'no contacts to process';
      console.log(`Marking campaign ${campaignId} as completed: ${completionReason}`);
      await updateCampaignStatus(campaignId, 'completed');
      status = 'completed';
    }
    // Priority 3: Check if all contacts are processed
    else if (isComplete && status === 'active') {
      completionReason = 'all contacts processed';
      console.log(`Marking campaign ${campaignId} as completed: ${completionReason}`);
      await updateCampaignStatus(campaignId, 'completed');
      status = 'completed';
    }
    // Priority 4: Safety mechanism for long-running campaigns
    else if (hasExceededMaxDuration && status === 'active') {
      completionReason = `maximum monitoring duration exceeded (${hoursRunning.toFixed(2)} hours)`;
      console.log(`Marking campaign ${campaignId} as completed: ${completionReason}`);
      await updateCampaignStatus(campaignId, 'completed');
      status = 'completed';
    }

    // Determine if more contacts need to be dispatched
    const needsMoreContacts = contactStats.pendingContacts > 0 && status === 'active';

    console.log(`Campaign ${campaignId} status check:`, {
      campaignStatus: status,
      totalContacts: contactStats.totalContacts,
      completedContacts: contactStats.completedContacts,
      pendingContacts: contactStats.pendingContacts,
      inProgressContacts: contactStats.inProgressContacts,
      failedContacts: contactStats.failedContacts,
      completionPercentage,
      isComplete,
      hasNoContacts,
      endTimePassed,
      needsMoreContacts,
      endTime: campaign.end_time,
      currentTime: new Date().toISOString(),
      hoursRunning: hoursRunning.toFixed(2),
      completionReason: completionReason || 'none'
    });

    return {
      campaignId,
      campaignName: campaignName || campaign.name,
      status,
      totalContacts: contactStats.totalContacts,
      completedContacts: contactStats.completedContacts,
      pendingContacts: contactStats.pendingContacts,
      inProgressContacts: contactStats.inProgressContacts,
      failedContacts: contactStats.failedContacts,
      blacklistedContacts: contactStats.blacklistedContacts,
      completionPercentage,
      needsMoreContacts,
      metrics,
    };
  } catch (error) {
    console.error('Error checking campaign status:', error);
    throw error;
  }
}

/**
 * Clean up contacts that have been in 'in_progress' state for too long
 */
async function cleanupStaleContacts(campaignId: string): Promise<void> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  
  const client = await pool.connect();
  try {
    // Mark contacts as failed if they've been in_progress for more than 30 minutes
    const result = await client.query(
      `UPDATE contacts 
       SET status = 'failed', 
           updated_at = NOW()
       WHERE campaign_id = $1 
         AND status = 'in_progress' 
         AND updated_at < NOW() - INTERVAL '30 minutes'`,
      [campaignId]
    );
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`Cleaned up ${result.rowCount} stale in_progress contacts for campaign ${campaignId}`);
    }
  } finally {
    client.release();
  }
}

/**
 * Fetch campaign from database
 */
async function getCampaign(campaignId: string): Promise<any> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  
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
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  
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
 * Get contact statistics for campaign
 */
async function getContactStatistics(campaignId: string): Promise<{
  totalContacts: number;
  completedContacts: number;
  pendingContacts: number;
  inProgressContacts: number;
  failedContacts: number;
  blacklistedContacts: number;
}> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        COUNT(*) as total_contacts,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_contacts,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_contacts,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_contacts,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_contacts,
        COUNT(*) FILTER (WHERE status = 'blacklisted') as blacklisted_contacts
      FROM contacts 
      WHERE campaign_id = $1`,
      [campaignId]
    );

    const row = result.rows[0];
    return {
      totalContacts: parseInt(row.total_contacts),
      completedContacts: parseInt(row.completed_contacts),
      pendingContacts: parseInt(row.pending_contacts),
      inProgressContacts: parseInt(row.in_progress_contacts),
      failedContacts: parseInt(row.failed_contacts),
      blacklistedContacts: parseInt(row.blacklisted_contacts),
    };
  } finally {
    client.release();
  }
}

/**
 * Get call outcome metrics for campaign
 */
async function getCallMetrics(campaignId: string): Promise<{
  answered: number;
  busy: number;
  noAnswer: number;
  failed: number;
  converted: number;
  optedOut: number;
}> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'answered') as answered,
        COUNT(*) FILTER (WHERE status = 'busy') as busy,
        COUNT(*) FILTER (WHERE status = 'no_answer') as no_answer,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE outcome LIKE '%converted%') as converted,
        COUNT(*) FILTER (WHERE outcome LIKE '%opted_out%') as opted_out
      FROM call_records 
      WHERE campaign_id = $1`,
      [campaignId]
    );

    if (result.rows.length === 0) {
      return {
        answered: 0,
        busy: 0,
        noAnswer: 0,
        failed: 0,
        converted: 0,
        optedOut: 0,
      };
    }

    const row = result.rows[0];
    return {
      answered: parseInt(row.answered) || 0,
      busy: parseInt(row.busy) || 0,
      noAnswer: parseInt(row.no_answer) || 0,
      failed: parseInt(row.failed) || 0,
      converted: parseInt(row.converted) || 0,
      optedOut: parseInt(row.opted_out) || 0,
    };
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
