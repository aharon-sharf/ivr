/**
 * Analytics Lambda
 * Provides real-time campaign metrics for the dashboard
 * 
 * Responsibilities:
 * - Query Redis for live metrics (active calls, queue depth, dialing rate)
 * - Query PostgreSQL for campaign progress
 * - Calculate answer rate, conversion rate, opt-out rate
 * - Return metrics to API Gateway
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from 'redis';
import { Pool } from 'pg';

// Redis client for live metrics
let redisClient: ReturnType<typeof createClient> | null = null;

// PostgreSQL connection pool
let pgPool: Pool | null = null;

/**
 * Initialize Redis client
 */
async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    await redisClient.connect();
  }
  return redisClient;
}

/**
 * Initialize PostgreSQL pool
 */
function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'campaign_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pgPool;
}

/**
 * Campaign metrics interface
 */
export interface CampaignMetrics {
  campaignId: string;
  campaignName?: string;
  activeCalls: number;
  queueDepth: number;
  dialingRate: number;
  totalAttempts: number;
  answered: number;
  busy: number;
  failed: number;
  converted: number;
  optOuts: number;
  answerRate: number;
  conversionRate: number;
  optOutRate: number;
}

/**
 * System-wide metrics interface
 */
export interface SystemMetrics {
  totalActiveCalls: number;
  totalQueueDepth: number;
  systemDialingRate: number;
  activeCampaigns: number;
  campaigns: CampaignMetrics[];
}

/**
 * Get live metrics from Redis
 */
async function getLiveMetrics(campaignId: string): Promise<Partial<CampaignMetrics>> {
  const redis = await getRedisClient();
  
  // Get active calls count
  const activeCalls = await redis.get(`campaign:${campaignId}:active_calls`);
  
  // Get queue depth
  const queueDepth = await redis.get(`campaign:${campaignId}:queue_depth`);
  
  // Get dialing rate (calls per second in last minute)
  const dialingRate = await redis.get(`campaign:${campaignId}:dialing_rate`);
  
  return {
    activeCalls: parseInt(activeCalls || '0'),
    queueDepth: parseInt(queueDepth || '0'),
    dialingRate: parseFloat(dialingRate || '0'),
  };
}

/**
 * Get campaign progress from PostgreSQL
 */
async function getCampaignProgress(campaignId: string): Promise<Partial<CampaignMetrics>> {
  const pool = getPgPool();
  
  const query = `
    SELECT 
      c.name as campaign_name,
      COUNT(*) as total_attempts,
      SUM(CASE WHEN cr.status = 'answered' THEN 1 ELSE 0 END) as answered,
      SUM(CASE WHEN cr.status = 'busy' THEN 1 ELSE 0 END) as busy,
      SUM(CASE WHEN cr.status = 'failed' OR cr.status = 'no_answer' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN cr.outcome = 'converted' THEN 1 ELSE 0 END) as converted,
      SUM(CASE WHEN cr.outcome = 'opted_out' THEN 1 ELSE 0 END) as opt_outs
    FROM call_records cr
    JOIN campaigns c ON c.id = cr.campaign_id
    WHERE cr.campaign_id = $1
    GROUP BY c.name
  `;
  
  const result = await pool.query(query, [campaignId]);
  
  if (result.rows.length === 0) {
    return {
      campaignName: 'Unknown',
      totalAttempts: 0,
      answered: 0,
      busy: 0,
      failed: 0,
      converted: 0,
      optOuts: 0,
    };
  }
  
  const row = result.rows[0];
  
  return {
    campaignName: row.campaign_name,
    totalAttempts: parseInt(row.total_attempts),
    answered: parseInt(row.answered),
    busy: parseInt(row.busy),
    failed: parseInt(row.failed),
    converted: parseInt(row.converted),
    optOuts: parseInt(row.opt_outs),
  };
}

/**
 * Calculate derived metrics
 */
function calculateRates(metrics: Partial<CampaignMetrics>): Partial<CampaignMetrics> {
  const totalAttempts = metrics.totalAttempts || 0;
  const answered = metrics.answered || 0;
  const converted = metrics.converted || 0;
  const optOuts = metrics.optOuts || 0;
  
  return {
    answerRate: totalAttempts > 0 ? (answered / totalAttempts) * 100 : 0,
    conversionRate: answered > 0 ? (converted / answered) * 100 : 0,
    optOutRate: totalAttempts > 0 ? (optOuts / totalAttempts) * 100 : 0,
  };
}

/**
 * Get complete metrics for a campaign
 */
async function getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  // Get live metrics from Redis
  const liveMetrics = await getLiveMetrics(campaignId);
  
  // Get campaign progress from PostgreSQL
  const progressMetrics = await getCampaignProgress(campaignId);
  
  // Calculate rates
  const rates = calculateRates(progressMetrics);
  
  // Combine all metrics
  return {
    campaignId,
    campaignName: progressMetrics.campaignName || 'Unknown',
    activeCalls: liveMetrics.activeCalls || 0,
    queueDepth: liveMetrics.queueDepth || 0,
    dialingRate: liveMetrics.dialingRate || 0,
    totalAttempts: progressMetrics.totalAttempts || 0,
    answered: progressMetrics.answered || 0,
    busy: progressMetrics.busy || 0,
    failed: progressMetrics.failed || 0,
    converted: progressMetrics.converted || 0,
    optOuts: progressMetrics.optOuts || 0,
    answerRate: rates.answerRate || 0,
    conversionRate: rates.conversionRate || 0,
    optOutRate: rates.optOutRate || 0,
  };
}

/**
 * Get system-wide metrics for all active campaigns
 */
async function getSystemMetrics(): Promise<SystemMetrics> {
  const pool = getPgPool();
  
  // Get all active campaigns
  const campaignsQuery = `
    SELECT id, name 
    FROM campaigns 
    WHERE status = 'active'
  `;
  
  const campaignsResult = await pool.query(campaignsQuery);
  
  // Get metrics for each campaign
  const campaignMetrics = await Promise.all(
    campaignsResult.rows.map(row => getCampaignMetrics(row.id))
  );
  
  // Calculate system-wide totals
  const totalActiveCalls = campaignMetrics.reduce((sum, m) => sum + m.activeCalls, 0);
  const totalQueueDepth = campaignMetrics.reduce((sum, m) => sum + m.queueDepth, 0);
  const systemDialingRate = campaignMetrics.reduce((sum, m) => sum + m.dialingRate, 0);
  
  return {
    totalActiveCalls,
    totalQueueDepth,
    systemDialingRate,
    activeCampaigns: campaignMetrics.length,
    campaigns: campaignMetrics,
  };
}

/**
 * Lambda handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const path = event.path;
    const campaignId = event.pathParameters?.campaignId;
    
    // Route based on path
    if (path.includes('/campaigns/') && campaignId) {
      // Get metrics for specific campaign
      const metrics = await getCampaignMetrics(campaignId);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(metrics),
      };
    } else if (path.includes('/system')) {
      // Get system-wide metrics
      const metrics = await getSystemMetrics();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(metrics),
      };
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Invalid path. Use /campaigns/{id} or /system' }),
      };
    }
  } catch (error) {
    console.error('Error getting analytics:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Failed to retrieve analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanup() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}
