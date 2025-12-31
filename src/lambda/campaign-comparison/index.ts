/**
 * Campaign Comparison Lambda
 * Provides side-by-side comparison of multiple campaigns
 * 
 * Responsibilities:
 * - Query multiple campaigns from database
 * - Calculate side-by-side metrics
 * - Return comparison data to frontend
 * 
 * Requirements: 11.5
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';

// PostgreSQL connection pool
let pgPool: Pool | null = null;

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
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pgPool;
}

/**
 * Campaign comparison metrics interface
 */
export interface CampaignComparisonMetrics {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  totalContacts: number;
  totalAttempts: number;
  answered: number;
  busy: number;
  failed: number;
  noAnswer: number;
  converted: number;
  optOuts: number;
  answerRate: number;
  conversionRate: number;
  optOutRate: number;
  totalCost: number;
  costPerContact: number;
  costPerConversion: number;
  averageCallDuration: number;
}

/**
 * Comparison result interface
 */
export interface ComparisonResult {
  campaigns: CampaignComparisonMetrics[];
  summary: {
    totalCampaigns: number;
    bestAnswerRate: {
      campaignId: string;
      campaignName: string;
      rate: number;
    };
    bestConversionRate: {
      campaignId: string;
      campaignName: string;
      rate: number;
    };
    lowestCostPerConversion: {
      campaignId: string;
      campaignName: string;
      cost: number;
    };
    totalContactsAcrossAll: number;
    totalAttemptsAcrossAll: number;
    totalConversionsAcrossAll: number;
    averageAnswerRate: number;
    averageConversionRate: number;
  };
}

/**
 * Get metrics for a single campaign
 */
async function getCampaignMetrics(campaignId: string): Promise<CampaignComparisonMetrics> {
  const pool = getPgPool();
  
  // Get campaign metadata
  const campaignQuery = `
    SELECT 
      id,
      name,
      type,
      status,
      created_at as start_time,
      updated_at as end_time
    FROM campaigns
    WHERE id = $1
  `;
  
  const campaignResult = await pool.query(campaignQuery, [campaignId]);
  
  if (campaignResult.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  
  const campaign = campaignResult.rows[0];
  
  // Get contact count
  const contactCountQuery = `
    SELECT COUNT(*) as total_contacts
    FROM contacts
    WHERE campaign_id = $1
  `;
  
  const contactCountResult = await pool.query(contactCountQuery, [campaignId]);
  const totalContacts = parseInt(contactCountResult.rows[0].total_contacts);
  
  // Get call statistics
  const statsQuery = `
    SELECT 
      COUNT(*) as total_attempts,
      SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) as answered,
      SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busy,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'no_answer' THEN 1 ELSE 0 END) as no_answer,
      SUM(CASE WHEN outcome = 'converted' THEN 1 ELSE 0 END) as converted,
      SUM(CASE WHEN outcome = 'opted_out' THEN 1 ELSE 0 END) as opt_outs,
      SUM(cost) as total_cost,
      AVG(duration) as avg_duration
    FROM call_records
    WHERE campaign_id = $1
  `;
  
  const statsResult = await pool.query(statsQuery, [campaignId]);
  const stats = statsResult.rows[0];
  
  const totalAttempts = parseInt(stats.total_attempts);
  const answered = parseInt(stats.answered);
  const converted = parseInt(stats.converted);
  const optOuts = parseInt(stats.opt_outs);
  const totalCost = parseFloat(stats.total_cost || '0');
  
  // Calculate rates
  const answerRate = totalAttempts > 0 ? (answered / totalAttempts) * 100 : 0;
  const conversionRate = answered > 0 ? (converted / answered) * 100 : 0;
  const optOutRate = totalAttempts > 0 ? (optOuts / totalAttempts) * 100 : 0;
  
  // Calculate costs
  const costPerContact = totalContacts > 0 ? totalCost / totalContacts : 0;
  const costPerConversion = converted > 0 ? totalCost / converted : 0;
  
  return {
    campaignId,
    campaignName: campaign.name,
    campaignType: campaign.type,
    status: campaign.status,
    startTime: campaign.start_time,
    endTime: campaign.end_time,
    totalContacts,
    totalAttempts,
    answered,
    busy: parseInt(stats.busy),
    failed: parseInt(stats.failed),
    noAnswer: parseInt(stats.no_answer),
    converted,
    optOuts,
    answerRate,
    conversionRate,
    optOutRate,
    totalCost,
    costPerContact,
    costPerConversion,
    averageCallDuration: parseFloat(stats.avg_duration || '0'),
  };
}

/**
 * Compare multiple campaigns
 */
async function compareCampaigns(campaignIds: string[]): Promise<ComparisonResult> {
  // Get metrics for each campaign
  const campaigns = await Promise.all(
    campaignIds.map(id => getCampaignMetrics(id))
  );
  
  // Calculate summary statistics
  const totalContactsAcrossAll = campaigns.reduce((sum, c) => sum + c.totalContacts, 0);
  const totalAttemptsAcrossAll = campaigns.reduce((sum, c) => sum + c.totalAttempts, 0);
  const totalConversionsAcrossAll = campaigns.reduce((sum, c) => sum + c.converted, 0);
  
  // Calculate average rates
  const averageAnswerRate = campaigns.length > 0
    ? campaigns.reduce((sum, c) => sum + c.answerRate, 0) / campaigns.length
    : 0;
  
  const averageConversionRate = campaigns.length > 0
    ? campaigns.reduce((sum, c) => sum + c.conversionRate, 0) / campaigns.length
    : 0;
  
  // Find best performers
  const bestAnswerRate = campaigns.reduce((best, current) => 
    current.answerRate > best.answerRate ? current : best
  , campaigns[0]);
  
  const bestConversionRate = campaigns.reduce((best, current) => 
    current.conversionRate > best.conversionRate ? current : best
  , campaigns[0]);
  
  const lowestCostPerConversion = campaigns
    .filter(c => c.costPerConversion > 0)
    .reduce((best, current) => 
      current.costPerConversion < best.costPerConversion ? current : best
    , campaigns.find(c => c.costPerConversion > 0) || campaigns[0]);
  
  return {
    campaigns,
    summary: {
      totalCampaigns: campaigns.length,
      bestAnswerRate: {
        campaignId: bestAnswerRate.campaignId,
        campaignName: bestAnswerRate.campaignName,
        rate: bestAnswerRate.answerRate,
      },
      bestConversionRate: {
        campaignId: bestConversionRate.campaignId,
        campaignName: bestConversionRate.campaignName,
        rate: bestConversionRate.conversionRate,
      },
      lowestCostPerConversion: {
        campaignId: lowestCostPerConversion.campaignId,
        campaignName: lowestCostPerConversion.campaignName,
        cost: lowestCostPerConversion.costPerConversion,
      },
      totalContactsAcrossAll,
      totalAttemptsAcrossAll,
      totalConversionsAcrossAll,
      averageAnswerRate,
      averageConversionRate,
    },
  };
}

/**
 * Lambda handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Get campaign IDs from query parameters
    const campaignIdsParam = event.queryStringParameters?.campaignIds;
    
    if (!campaignIdsParam) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Missing campaignIds parameter',
          message: 'Provide campaignIds as comma-separated list: ?campaignIds=id1,id2,id3',
        }),
      };
    }
    
    // Parse campaign IDs
    const campaignIds = campaignIdsParam.split(',').map(id => id.trim());
    
    if (campaignIds.length < 2) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'At least 2 campaigns required for comparison',
        }),
      };
    }
    
    if (campaignIds.length > 10) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Maximum 10 campaigns can be compared at once',
        }),
      };
    }
    
    // Compare campaigns
    const comparison = await compareCampaigns(campaignIds);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(comparison),
    };
  } catch (error) {
    console.error('Error comparing campaigns:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Failed to compare campaigns',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanup() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}
