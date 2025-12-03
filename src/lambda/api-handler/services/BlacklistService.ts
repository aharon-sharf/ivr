/**
 * Blacklist Service
 * Business logic for blacklist management and Do-Not-Call registry
 */

import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createClient, RedisClientType } from 'redis';
import * as XLSX from 'xlsx';
import {
  BlacklistEntry,
  BlacklistSource,
  validateBlacklistEntry,
  createBlacklistEntry,
} from '../../../models/BlacklistEntry';
import {
  AddToBlacklistRequest,
  AddToBlacklistResponse,
  RemoveFromBlacklistRequest,
  RemoveFromBlacklistResponse,
  GetBlacklistResponse,
  ImportBlacklistFileResponse,
} from '../../../types/api';
import { normalizePhoneNumber, validatePhoneNumber } from '../../../models/Contact';

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

  const password = await getDbPassword();
  
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

  return pool;
}

// Initialize Redis client
let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
  }
  return redisClient;
}

export class BlacklistService {
  /**
   * Add phone numbers to blacklist
   */
  async addToBlacklist(request: AddToBlacklistRequest): Promise<AddToBlacklistResponse> {
    const entries: BlacklistEntry[] = [];
    const now = new Date();

    // Validate and normalize phone numbers
    const validNumbers: string[] = [];
    for (const phoneNumber of request.phoneNumbers) {
      try {
        const normalized = normalizePhoneNumber(phoneNumber);
        if (!validatePhoneNumber(normalized)) {
          console.warn(`Invalid phone number skipped: ${phoneNumber}`);
          continue;
        }
        validNumbers.push(normalized);
      } catch (error) {
        console.warn(`Error normalizing phone number ${phoneNumber}:`, error);
      }
    }

    if (validNumbers.length === 0) {
      return { added: 0, entries: [] };
    }

    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const phoneNumber of validNumbers) {
        const entry = createBlacklistEntry(phoneNumber, request.source, request.reason);
        
        // Validate entry
        const errors = validateBlacklistEntry({ ...entry, addedAt: now });
        if (errors.length > 0) {
          console.warn(`Invalid blacklist entry for ${phoneNumber}:`, errors);
          continue;
        }

        // Insert into database
        const query = `
          INSERT INTO blacklist (phone_number, added_at, reason, source, metadata)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (phone_number) DO UPDATE
          SET reason = $3, source = $4, metadata = $5, added_at = $2
          RETURNING *
        `;

        const values = [
          phoneNumber,
          now,
          request.reason,
          request.source,
          JSON.stringify(entry.metadata || {}),
        ];

        const result = await client.query(query, values);
        entries.push(this.mapRowToBlacklistEntry(result.rows[0]));
      }

      await client.query('COMMIT');

      // Update Redis cache
      await this.updateRedisCache(validNumbers, true);

      return {
        added: entries.length,
        entries,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remove phone numbers from blacklist
   */
  async removeFromBlacklist(request: RemoveFromBlacklistRequest): Promise<RemoveFromBlacklistResponse> {
    // Normalize phone numbers
    const normalizedNumbers = request.phoneNumbers
      .map(phone => {
        try {
          return normalizePhoneNumber(phone);
        } catch {
          return null;
        }
      })
      .filter((phone): phone is string => phone !== null);

    if (normalizedNumbers.length === 0) {
      return { removed: 0 };
    }

    const pool = await getPool();
    const client = await pool.connect();
    try {
      const query = `
        DELETE FROM blacklist
        WHERE phone_number = ANY($1)
      `;

      const result = await client.query(query, [normalizedNumbers]);
      const removed = result.rowCount || 0;

      // Update Redis cache
      await this.updateRedisCache(normalizedNumbers, false);

      return { removed };
    } finally {
      client.release();
    }
  }

  /**
   * Get blacklist entries with pagination
   */
  async getBlacklist(
    limit: number = 50,
    offset: number = 0
  ): Promise<GetBlacklistResponse> {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      // Get total count
      const countQuery = 'SELECT COUNT(*) FROM blacklist';
      const countResult = await client.query(countQuery);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const query = `
        SELECT * FROM blacklist
        ORDER BY added_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await client.query(query, [limit, offset]);
      const entries = result.rows.map(row => this.mapRowToBlacklistEntry(row));

      return {
        entries,
        total,
        limit,
        offset,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Import blacklist from CSV file
   */
  async importBlacklistFile(
    fileBuffer: Buffer,
    reason: string,
    source: BlacklistSource = 'admin_import'
  ): Promise<ImportBlacklistFileResponse> {
    const result: ImportBlacklistFileResponse = {
      imported: 0,
      errors: [],
    };

    try {
      // Parse CSV file
      const phoneNumbers = this.parseBlacklistCSV(fileBuffer);

      // Add to blacklist
      const addResult = await this.addToBlacklist({
        phoneNumbers,
        reason,
        source,
      });

      result.imported = addResult.added;

      return result;
    } catch (error) {
      console.error('Error importing blacklist file:', error);
      throw error;
    }
  }

  /**
   * Check if a phone number is blacklisted
   */
  async isBlacklisted(phoneNumber: string): Promise<boolean> {
    try {
      const normalized = normalizePhoneNumber(phoneNumber);
      
      // Check Redis cache first
      const redis = await getRedisClient();
      const cached = await redis.get(`blacklist:${normalized}`);
      
      if (cached !== null) {
        return cached === '1';
      }

      // Check database
      const pool = await getPool();
      const client = await pool.connect();
      try {
        const query = 'SELECT 1 FROM blacklist WHERE phone_number = $1';
        const result = await client.query(query, [normalized]);
        const isBlacklisted = result.rows.length > 0;

        // Update cache
        await redis.setEx(`blacklist:${normalized}`, 3600, isBlacklisted ? '1' : '0');

        return isBlacklisted;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error checking blacklist:', error);
      // Fail safe: if we can't check, assume not blacklisted
      return false;
    }
  }

  /**
   * Parse CSV file and extract phone numbers
   */
  private parseBlacklistCSV(fileBuffer: Buffer): string[] {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (data.length === 0) {
      return [];
    }

    const phoneNumbers: string[] = [];

    // Try to find phone number column
    const headers = data[0] as string[];
    const phoneColumnIndex = this.findPhoneNumberColumn(headers);

    if (phoneColumnIndex !== -1) {
      // Has headers
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const phoneNumber = row[phoneColumnIndex]?.toString().trim();
        if (phoneNumber) {
          phoneNumbers.push(phoneNumber);
        }
      }
    } else {
      // No headers, assume first column is phone numbers
      for (const row of data) {
        const phoneNumber = row[0]?.toString().trim();
        if (phoneNumber) {
          phoneNumbers.push(phoneNumber);
        }
      }
    }

    return phoneNumbers;
  }

  /**
   * Find the column index that contains phone numbers
   */
  private findPhoneNumberColumn(headers: string[]): number {
    const phonePatterns = ['phone', 'number', 'mobile', 'cell', 'telephone', 'tel'];
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      if (phonePatterns.some(pattern => header.includes(pattern))) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Update Redis cache for phone numbers
   */
  private async updateRedisCache(phoneNumbers: string[], isBlacklisted: boolean): Promise<void> {
    try {
      const redis = await getRedisClient();
      const value = isBlacklisted ? '1' : '0';
      
      // Update cache with 1 hour TTL
      for (const phoneNumber of phoneNumbers) {
        await redis.setEx(`blacklist:${phoneNumber}`, 3600, value);
      }
    } catch (error) {
      console.error('Error updating Redis cache:', error);
      // Don't throw - cache update failure shouldn't break the operation
    }
  }

  /**
   * Map database row to BlacklistEntry object
   */
  private mapRowToBlacklistEntry(row: any): BlacklistEntry {
    return {
      phoneNumber: row.phone_number,
      addedAt: row.added_at,
      reason: row.reason,
      source: row.source as BlacklistSource,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    };
  }
}
