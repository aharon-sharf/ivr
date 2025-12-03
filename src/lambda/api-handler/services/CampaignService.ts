/**
 * Campaign Service
 * Business logic for campaign CRUD operations
 */

import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import {
  Campaign,
  CampaignType,
  CampaignStatus,
  validateCampaign,
} from '../../../models/Campaign';
import {
  CreateCampaignRequest,
  UpdateCampaignRequest,
  ListCampaignsRequest,
  ListCampaignsResponse,
} from '../../../types/api';

// Initialize Secrets Manager client
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
    const secretName = `rds-db-credentials/cluster-${process.env.ENVIRONMENT || 'staging'}-mass-voice-campaign-postgres/dbadmin`;
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);
    
    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      cachedDbPassword = secret.password;
      return cachedDbPassword;
    }
    
    throw new Error('No password found in secret');
  } catch (error) {
    console.error('Error retrieving database password:', error);
    throw new Error('Failed to retrieve database password');
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
    connectionTimeoutMillis: 2000,
  });

  console.log('Database connection pool initialized');
  return pool;
}

export class CampaignService {
  /**
   * Create a new campaign
   */
  async createCampaign(
    request: CreateCampaignRequest,
    userId: string
  ): Promise<Campaign> {
    // Validate campaign data
    const errors = validateCampaign(request as any);
    if (errors.length > 0) {
      throw new Error(`Campaign validation failed: ${errors.join(', ')}`);
    }

    const pool = await getPool();
    const client = await pool.connect();
    try {
      const now = new Date();
      const id = this.generateId();

      const query = `
        INSERT INTO campaigns (
          id, name, type, status, config, start_time, end_time, timezone, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        id,
        request.name,
        request.type,
        'draft',
        JSON.stringify(request.config),
        request.startTime ? new Date(request.startTime) : null,
        request.endTime ? new Date(request.endTime) : null,
        request.timezone || 'UTC',
        userId,
        now,
        now,
      ];

      const result = await client.query(query, values);
      return this.mapRowToCampaign(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get a campaign by ID
   */
  async getCampaign(campaignId: string): Promise<Campaign | null> {
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
   * List campaigns with optional filtering
   */
  async listCampaigns(filters: ListCampaignsRequest): Promise<ListCampaignsResponse> {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build WHERE clause
      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }

      if (filters.type) {
        conditions.push(`type = $${paramIndex++}`);
        values.push(filters.type);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM campaigns ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const query = `
        SELECT * FROM campaigns
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      const result = await client.query(query, [...values, limit, offset]);
      const campaigns = result.rows.map(row => this.mapRowToCampaign(row));

      return {
        campaigns,
        total,
        limit,
        offset,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update a campaign
   */
  async updateCampaign(
    campaignId: string,
    request: UpdateCampaignRequest
  ): Promise<Campaign | null> {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      // First, get the existing campaign
      const existing = await this.getCampaign(campaignId);
      if (!existing) {
        return null;
      }

      // Build update query dynamically based on provided fields
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (request.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(request.name);
      }

      if (request.config !== undefined) {
        // Merge with existing config
        const mergedConfig = { ...existing.config, ...request.config };
        updates.push(`config = $${paramIndex++}`);
        values.push(JSON.stringify(mergedConfig));
      }

      if (request.startTime !== undefined) {
        updates.push(`start_time = $${paramIndex++}`);
        values.push(request.startTime ? new Date(request.startTime) : null);
      }

      if (request.endTime !== undefined) {
        updates.push(`end_time = $${paramIndex++}`);
        values.push(request.endTime ? new Date(request.endTime) : null);
      }

      if (request.timezone !== undefined) {
        updates.push(`timezone = $${paramIndex++}`);
        values.push(request.timezone);
      }

      // Always update updated_at
      updates.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());

      // Add campaign ID as last parameter
      values.push(campaignId);

      const query = `
        UPDATE campaigns
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);
      return this.mapRowToCampaign(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(campaignId: string): Promise<boolean> {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const query = 'DELETE FROM campaigns WHERE id = $1';
      const result = await client.query(query, [campaignId]);
      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to Campaign object
   */
  private mapRowToCampaign(row: any): Campaign {
    return {
      id: row.id,
      name: row.name,
      type: row.type as CampaignType,
      status: row.status as CampaignStatus,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Generate a unique ID for campaigns
   */
  private generateId(): string {
    return `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
