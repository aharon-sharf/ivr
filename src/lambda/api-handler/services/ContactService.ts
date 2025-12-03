/**
 * Contact Service
 * Business logic for contact list upload, parsing, and management
 */

import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as XLSX from 'xlsx';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import {
  Contact,
  validatePhoneNumber,
  normalizePhoneNumber,
  createContact,
  OptimalTimeWindow,
} from '../../../models/Contact';
import {
  ImportResult,
  UploadContactListRequest,
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
      cachedDbPassword = secret.password as string;
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

  return pool;
}

// Initialize Lambda client for ML Inference
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

interface ParsedContact {
  phoneNumber: string;
  metadata: Record<string, any>;
  row: number;
}

export class ContactService {
  /**
   * Upload and parse contact list from Excel or CSV file
   */
  async uploadContactList(
    campaignId: string,
    fileBuffer: Buffer,
    fileType: 'excel' | 'csv'
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRecords: 0,
      successfulImports: 0,
      duplicatesRemoved: 0,
      validationFailures: 0,
      errors: [],
    };

    try {
      // Parse file based on type
      const parsedContacts = fileType === 'excel'
        ? this.parseExcelFile(fileBuffer)
        : this.parseCSVFile(fileBuffer);

      result.totalRecords = parsedContacts.length;

      // Validate and normalize phone numbers
      const validContacts: ParsedContact[] = [];
      for (const contact of parsedContacts) {
        try {
          const normalized = normalizePhoneNumber(contact.phoneNumber);
          if (!validatePhoneNumber(normalized)) {
            result.validationFailures++;
            result.errors.push({
              row: contact.row,
              phoneNumber: contact.phoneNumber,
              error: 'Invalid phone number format (must be E.164: +[country code][number])',
            });
            continue;
          }

          validContacts.push({
            ...contact,
            phoneNumber: normalized,
          });
        } catch (error) {
          result.validationFailures++;
          result.errors.push({
            row: contact.row,
            phoneNumber: contact.phoneNumber,
            error: error instanceof Error ? error.message : 'Unknown validation error',
          });
        }
      }

      // Detect and remove duplicates
      const { unique, duplicates } = this.deduplicateContacts(validContacts);
      result.duplicatesRemoved = duplicates;

      // Insert contacts into database
      const insertedContactIds = await this.insertContacts(campaignId, unique);
      result.successfulImports = insertedContactIds.length;

      // Get ML predictions for inserted contacts (async, non-blocking)
      if (insertedContactIds.length > 0) {
        this.enrichContactsWithMLPredictions(insertedContactIds).catch(error => {
          console.error('Error enriching contacts with ML predictions:', error);
          // Don't fail the upload if ML predictions fail
        });
      }

      return result;
    } catch (error) {
      console.error('Error uploading contact list:', error);
      throw error;
    }
  }

  /**
   * Parse Excel file and extract contacts
   */
  private parseExcelFile(fileBuffer: Buffer): ParsedContact[] {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (data.length === 0) {
      return [];
    }

    // First row is headers
    const headers = data[0] as string[];
    const phoneNumberColumn = this.findPhoneNumberColumn(headers);

    if (phoneNumberColumn === -1) {
      throw new Error('Could not find phone number column. Expected column name containing "phone" or "number"');
    }

    const contacts: ParsedContact[] = [];

    // Process data rows (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const phoneNumber = row[phoneNumberColumn]?.toString().trim();

      if (!phoneNumber) {
        continue; // Skip empty rows
      }

      // Extract metadata from other columns
      const metadata: Record<string, any> = {};
      headers.forEach((header, index) => {
        if (index !== phoneNumberColumn && row[index] !== undefined) {
          metadata[header] = row[index];
        }
      });

      contacts.push({
        phoneNumber,
        metadata,
        row: i + 1, // +1 for 1-based row numbering
      });
    }

    return contacts;
  }

  /**
   * Parse CSV file and extract contacts
   */
  private parseCSVFile(fileBuffer: Buffer): ParsedContact[] {
    // Use XLSX library to parse CSV (it supports CSV as well)
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (data.length === 0) {
      return [];
    }

    const headers = data[0] as string[];
    const phoneNumberColumn = this.findPhoneNumberColumn(headers);

    if (phoneNumberColumn === -1) {
      throw new Error('Could not find phone number column. Expected column name containing "phone" or "number"');
    }

    const contacts: ParsedContact[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const phoneNumber = row[phoneNumberColumn]?.toString().trim();

      if (!phoneNumber) {
        continue;
      }

      const metadata: Record<string, any> = {};
      headers.forEach((header, index) => {
        if (index !== phoneNumberColumn && row[index] !== undefined) {
          metadata[header] = row[index];
        }
      });

      contacts.push({
        phoneNumber,
        metadata,
        row: i + 1,
      });
    }

    return contacts;
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
   * Deduplicate contacts based on phone number
   * Keeps the first occurrence and merges metadata
   */
  private deduplicateContacts(contacts: ParsedContact[]): {
    unique: ParsedContact[];
    duplicates: number;
  } {
    const seen = new Map<string, ParsedContact>();
    let duplicates = 0;

    for (const contact of contacts) {
      const existing = seen.get(contact.phoneNumber);
      
      if (existing) {
        // Merge metadata (keep first occurrence's data, add new fields)
        existing.metadata = {
          ...existing.metadata,
          ...contact.metadata,
        };
        duplicates++;
      } else {
        seen.set(contact.phoneNumber, contact);
      }
    }

    return {
      unique: Array.from(seen.values()),
      duplicates,
    };
  }

  /**
   * Insert contacts into database
   * Returns array of inserted contact IDs
   */
  private async insertContacts(
    campaignId: string,
    contacts: ParsedContact[]
  ): Promise<string[]> {
    if (contacts.length === 0) {
      return [];
    }

    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertedIds: string[] = [];
      const now = new Date();

      for (const contact of contacts) {
        try {
          const id = this.generateId();
          
          const query = `
            INSERT INTO contacts (
              id, campaign_id, phone_number, metadata, timezone, sms_capable,
              status, attempts, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (campaign_id, phone_number) DO NOTHING
            RETURNING id
          `;

          const values = [
            id,
            campaignId,
            contact.phoneNumber,
            JSON.stringify(contact.metadata),
            contact.metadata.timezone || null,
            true, // Default to SMS capable
            'pending',
            0,
            now,
            now,
          ];

          const result = await client.query(query, values);
          if (result.rowCount && result.rowCount > 0) {
            insertedIds.push(id);
          }
        } catch (error) {
          console.error('Error inserting contact:', error);
          // Continue with other contacts
        }
      }

      await client.query('COMMIT');
      return insertedIds;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId: string): Promise<Contact | null> {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM contacts WHERE id = $1';
      const result = await client.query(query, [contactId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToContact(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * List contacts for a campaign
   */
  async listContacts(
    campaignId: string,
    filters: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ contacts: Contact[]; total: number }> {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const conditions = ['campaign_id = $1'];
      const values: any[] = [campaignId];
      let paramIndex = 2;

      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM contacts WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const query = `
        SELECT * FROM contacts
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      const result = await client.query(query, [...values, limit, offset]);
      const contacts = result.rows.map(row => this.mapRowToContact(row));

      return { contacts, total };
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to Contact object
   */
  private mapRowToContact(row: any): Contact {
    return {
      id: row.id,
      campaignId: row.campaign_id,
      phoneNumber: row.phone_number,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      timezone: row.timezone,
      smsCapable: row.sms_capable,
      optimalCallTime: row.optimal_call_time
        ? typeof row.optimal_call_time === 'string'
          ? JSON.parse(row.optimal_call_time)
          : row.optimal_call_time
        : undefined,
      status: row.status,
      attempts: row.attempts,
      lastAttemptAt: row.last_attempt_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Generate a unique ID for contacts
   */
  private generateId(): string {
    return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enrich contacts with ML predictions for optimal call times
   * Calls ML Inference Lambda and updates contacts table
   * **Feature: mass-voice-campaign-system, Property 33: Optimal time scheduling priority**
   */
  private async enrichContactsWithMLPredictions(contactIds: string[]): Promise<void> {
    if (contactIds.length === 0) {
      return;
    }

    const mlLambdaName = process.env.ML_INFERENCE_LAMBDA_NAME;
    if (!mlLambdaName) {
      console.warn('ML_INFERENCE_LAMBDA_NAME not configured, skipping ML predictions');
      return;
    }

    try {
      // Fetch contacts from database
      const contacts = await this.getContactsByIds(contactIds);

      if (contacts.length === 0) {
        return;
      }

      // Process in batches to avoid Lambda payload limits (6MB)
      const batchSize = 100;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        await this.processBatchMLPredictions(batch, mlLambdaName);
      }

      console.log(`Successfully enriched ${contacts.length} contacts with ML predictions`);
    } catch (error) {
      console.error('Error enriching contacts with ML predictions:', error);
      throw error;
    }
  }

  /**
   * Process a batch of contacts for ML predictions
   */
  private async processBatchMLPredictions(
    contacts: Contact[],
    mlLambdaName: string
  ): Promise<void> {
    try {
      // Invoke ML Inference Lambda
      const payload = {
        contacts: contacts.map(c => ({
          id: c.id,
          phoneNumber: c.phoneNumber,
          timezone: c.timezone,
          metadata: c.metadata,
        })),
      };

      const command = new InvokeCommand({
        FunctionName: mlLambdaName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(payload),
      });

      const response = await lambdaClient.send(command);

      if (!response.Payload) {
        throw new Error('Empty response from ML Inference Lambda');
      }

      const result = JSON.parse(Buffer.from(response.Payload).toString('utf-8'));

      // Update contacts with predictions
      await this.updateContactsWithPredictions(result.predictions);
    } catch (error) {
      console.error('Error processing batch ML predictions:', error);
      throw error;
    }
  }

  /**
   * Update contacts table with ML predictions
   */
  private async updateContactsWithPredictions(
    predictions: Array<{
      contactId: string;
      optimalCallTime: OptimalTimeWindow;
      cached: boolean;
    }>
  ): Promise<void> {
    if (predictions.length === 0) {
      return;
    }

    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const prediction of predictions) {
        try {
          const query = `
            UPDATE contacts
            SET optimal_call_time = $1, updated_at = $2
            WHERE id = $3
          `;

          const values = [
            JSON.stringify(prediction.optimalCallTime),
            new Date(),
            prediction.contactId,
          ];

          await client.query(query, values);
        } catch (error) {
          console.error(`Error updating contact ${prediction.contactId}:`, error);
          // Continue with other predictions
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get contacts by IDs
   */
  private async getContactsByIds(contactIds: string[]): Promise<Contact[]> {
    if (contactIds.length === 0) {
      return [];
    }

    const pool = await getPool();
    const client = await pool.connect();
    try {
      const placeholders = contactIds.map((_, i) => `$${i + 1}`).join(',');
      const query = `SELECT * FROM contacts WHERE id IN (${placeholders})`;
      const result = await client.query(query, contactIds);

      return result.rows.map(row => this.mapRowToContact(row));
    } finally {
      client.release();
    }
  }
}
