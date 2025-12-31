/**
 * Campaign Status Checker Lambda
 * Queries campaign progress and calculates completion percentage
 * Invoked by Step Functions state machine during monitoring loop
 */

import { Pool } from 'pg';

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  }
});

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

  const { campaignId, campaignName } = event;

  if (!campaignId) {
    throw new Error('Campaign ID is required');
  }

  try {
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
    
    // Check if campaign should be marked as completed
    let status = campaign.status;
    if (isComplete && status === 'active') {
      await updateCampaignStatus(campaignId, 'completed');
      status = 'completed';
    }

    // Check if campaign end time has passed
    if (campaign.end_time && new Date(campaign.end_time) < new Date()) {
      if (status === 'active') {
        await updateCampaignStatus(campaignId, 'completed');
        status = 'completed';
      }
    }

    // Determine if more contacts need to be dispatched
    const needsMoreContacts = contactStats.pendingContacts > 0 && status === 'active';

    console.log(`Campaign ${campaignId} status: ${status}, completion: ${completionPercentage}%`);

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
  await pool.end();
});
