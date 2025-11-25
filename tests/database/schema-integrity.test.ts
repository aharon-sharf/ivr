/**
 * Property-Based Tests for Database Schema Integrity
 * 
 * Feature: mass-voice-campaign-system, Property 2: Database synchronization consistency
 * Validates: Requirements 1.2
 * 
 * Property: For any external database connection, after synchronization completes,
 * the local contact records should match the remote records exactly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { Pool, PoolClient } from 'pg';

// Database connection configuration
const TEST_DB_CONFIG = {
  host: process.env.TEST_POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_POSTGRES_PORT || process.env.DB_PORT || '5433'),
  database: process.env.TEST_POSTGRES_DB || process.env.DB_NAME || 'campaign_test',
  user: process.env.TEST_POSTGRES_USER || process.env.DB_USER || 'postgres',
  password: process.env.TEST_POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'test_password',
};

let pool: Pool;

beforeAll(async () => {
  pool = new Pool(TEST_DB_CONFIG);
  
  // Ensure test database is clean
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await pool.end();
});

async function cleanupTestData() {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM call_records');
    await client.query('DELETE FROM sms_records');
    await client.query('DELETE FROM contacts');
    await client.query('DELETE FROM campaigns');
    await client.query('DELETE FROM users WHERE email LIKE \'test_%\'');
  } finally {
    client.release();
  }
}

// Arbitraries for generating test data
const phoneNumberArbitrary = fc.string({ minLength: 10, maxLength: 15 })
  .map(s => '+' + s.replace(/[^0-9]/g, '').slice(0, 14));

const contactMetadataArbitrary = fc.record({
  firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  customField: fc.option(fc.string(), { nil: undefined }),
});

const contactRecordArbitrary = fc.record({
  phoneNumber: phoneNumberArbitrary,
  metadata: contactMetadataArbitrary,
  timezone: fc.option(fc.constantFrom('America/New_York', 'Europe/London', 'Asia/Jerusalem', 'UTC'), { nil: undefined }),
  smsCapable: fc.boolean(),
});

const contactListArbitrary = fc.array(contactRecordArbitrary, { minLength: 1, maxLength: 20 });

describe('Database Schema Integrity - Property Tests', () => {
  /**
   * Property 2: Database synchronization consistency
   * 
   * For any set of contact records synchronized from an external source,
   * after the synchronization completes, querying the database should
   * return exactly the same records that were inserted.
   */
  it('should maintain exact consistency after contact synchronization', async () => {
    await fc.assert(
      fc.asyncProperty(contactListArbitrary, async (externalContacts) => {
        const client = await pool.connect();
        
        try {
          await client.query('BEGIN');
          
          // Create a test user
          const userResult = await client.query(
            `INSERT INTO users (email, cognito_user_id, role) 
             VALUES ($1, $2, $3) RETURNING id`,
            [`test_user_${Date.now()}@example.com`, `cognito_${Date.now()}`, 'CampaignManager']
          );
          const userId = userResult.rows[0].id;
          
          // Create a test campaign
          const campaignResult = await client.query(
            `INSERT INTO campaigns (name, type, status, config, created_by) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
              `Test Campaign ${Date.now()}`,
              'voice',
              'draft',
              JSON.stringify({ audioFileUrl: 'https://example.com/audio.mp3' }),
              userId
            ]
          );
          const campaignId = campaignResult.rows[0].id;
          
          // Simulate external database synchronization by inserting contacts
          const insertedContacts = [];
          for (const contact of externalContacts) {
            const result = await client.query(
              `INSERT INTO contacts (campaign_id, phone_number, metadata, timezone, sms_capable)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (campaign_id, phone_number) DO UPDATE
               SET metadata = EXCLUDED.metadata,
                   timezone = EXCLUDED.timezone,
                   sms_capable = EXCLUDED.sms_capable
               RETURNING id, phone_number, metadata, timezone, sms_capable`,
              [
                campaignId,
                contact.phoneNumber,
                JSON.stringify(contact.metadata),
                contact.timezone,
                contact.smsCapable
              ]
            );
            insertedContacts.push(result.rows[0]);
          }
          
          // Query the database to retrieve synchronized contacts
          const queryResult = await client.query(
            `SELECT id, phone_number, metadata, timezone, sms_capable
             FROM contacts
             WHERE campaign_id = $1
             ORDER BY phone_number`,
            [campaignId]
          );
          
          const retrievedContacts = queryResult.rows;
          
          // Verify that the number of records matches
          expect(retrievedContacts.length).toBe(insertedContacts.length);
          
          // Verify that each contact's data matches exactly
          for (let i = 0; i < insertedContacts.length; i++) {
            const inserted = insertedContacts[i];
            const retrieved = retrievedContacts.find(c => c.id === inserted.id);
            
            expect(retrieved).toBeDefined();
            expect(retrieved.phone_number).toBe(inserted.phone_number);
            expect(retrieved.metadata).toEqual(inserted.metadata);
            expect(retrieved.timezone).toBe(inserted.timezone);
            expect(retrieved.sms_capable).toBe(inserted.sms_capable);
          }
          
          await client.query('ROLLBACK');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }),
      { numRuns: 100 } // Run 100 iterations as specified in design doc
    );
  });

  /**
   * Additional property: Foreign key constraint integrity
   * 
   * For any contact record, it must reference a valid campaign.
   * Attempting to insert a contact with an invalid campaign_id should fail.
   */
  it('should enforce foreign key constraints for campaign references', async () => {
    await fc.assert(
      fc.asyncProperty(contactRecordArbitrary, async (contact) => {
        const client = await pool.connect();
        
        try {
          await client.query('BEGIN');
          
          // Generate a random UUID that doesn't exist in campaigns table
          const nonExistentCampaignId = '00000000-0000-0000-0000-000000000000';
          
          // Attempt to insert contact with non-existent campaign_id
          await expect(
            client.query(
              `INSERT INTO contacts (campaign_id, phone_number, metadata, timezone, sms_capable)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                nonExistentCampaignId,
                contact.phoneNumber,
                JSON.stringify(contact.metadata),
                contact.timezone,
                contact.smsCapable
              ]
            )
          ).rejects.toThrow();
          
          await client.query('ROLLBACK');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Unique constraint enforcement
   * 
   * For any campaign, duplicate phone numbers should not be allowed.
   * The unique constraint (campaign_id, phone_number) should be enforced.
   */
  it('should prevent duplicate phone numbers within the same campaign', async () => {
    await fc.assert(
      fc.asyncProperty(phoneNumberArbitrary, async (phoneNumber) => {
        const client = await pool.connect();
        
        try {
          await client.query('BEGIN');
          
          // Create test user and campaign
          const userResult = await client.query(
            `INSERT INTO users (email, cognito_user_id, role) 
             VALUES ($1, $2, $3) RETURNING id`,
            [`test_user_${Date.now()}@example.com`, `cognito_${Date.now()}`, 'CampaignManager']
          );
          const userId = userResult.rows[0].id;
          
          const campaignResult = await client.query(
            `INSERT INTO campaigns (name, type, status, config, created_by) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
              `Test Campaign ${Date.now()}`,
              'voice',
              'draft',
              JSON.stringify({}),
              userId
            ]
          );
          const campaignId = campaignResult.rows[0].id;
          
          // Insert first contact
          await client.query(
            `INSERT INTO contacts (campaign_id, phone_number)
             VALUES ($1, $2)`,
            [campaignId, phoneNumber]
          );
          
          // Attempt to insert duplicate contact - should fail
          await expect(
            client.query(
              `INSERT INTO contacts (campaign_id, phone_number)
               VALUES ($1, $2)`,
              [campaignId, phoneNumber]
            )
          ).rejects.toThrow();
          
          await client.query('ROLLBACK');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }),
      { numRuns: 100 }
    );
  });
});
