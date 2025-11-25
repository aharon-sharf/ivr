/**
 * Example Integration Test
 * 
 * This test demonstrates how to use the integration test environment
 * to test interactions between multiple components.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  cleanTestData,
  seedTestData,
  TestEnvironment,
} from './setup/test-environment';
import { testUsers, testCampaigns, testContacts, testBlacklistEntries } from './fixtures/test-data';

describe('Integration Test Environment - Example', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    // Setup test environment with all database connections
    env = await setupTestEnvironment();
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    // Teardown and close all connections
    await teardownTestEnvironment(env);
  });

  beforeEach(async () => {
    // Clean all test data before each test
    await cleanTestData(env);
  });

  it('should connect to all test databases', async () => {
    // Test PostgreSQL connection
    const pgClient = await env.postgres.getClient();
    const pgResult = await pgClient.query('SELECT 1 as value');
    expect(pgResult.rows[0].value).toBe(1);
    pgClient.release();

    // Test MongoDB connection
    const mongoResult = await env.mongodb.db.admin().ping();
    expect(mongoResult.ok).toBe(1);

    // Test Redis connection
    const redisResult = await env.redis.client.ping();
    expect(redisResult).toBe('PONG');
  });

  it('should seed and retrieve test data from PostgreSQL', async () => {
    // Seed test data
    const { userIds, campaignIds, contactIds } = await seedTestData(env, {
      users: [testUsers[0]],
      campaigns: [testCampaigns[0]],
      contacts: testContacts.slice(0, 3),
    });

    expect(userIds).toHaveLength(1);
    expect(campaignIds).toHaveLength(1);
    expect(contactIds).toHaveLength(3);

    // Verify data was inserted
    const pgClient = await env.postgres.getClient();
    
    const userResult = await pgClient.query('SELECT * FROM users WHERE id = $1', [userIds[0]]);
    expect(userResult.rows).toHaveLength(1);
    expect(userResult.rows[0].email).toBe(testUsers[0].email);

    const campaignResult = await pgClient.query('SELECT * FROM campaigns WHERE id = $1', [campaignIds[0]]);
    expect(campaignResult.rows).toHaveLength(1);
    expect(campaignResult.rows[0].name).toBe(testCampaigns[0].name);

    const contactResult = await pgClient.query('SELECT * FROM contacts WHERE campaign_id = $1', [campaignIds[0]]);
    expect(contactResult.rows).toHaveLength(3);

    pgClient.release();
  });

  it('should enforce blacklist in database', async () => {
    // Seed test data including blacklist
    const { campaignIds } = await seedTestData(env, {
      users: [testUsers[0]],
      campaigns: [testCampaigns[0]],
      blacklist: testBlacklistEntries,
    });

    const pgClient = await env.postgres.getClient();

    // Verify blacklist entries exist
    const blacklistResult = await pgClient.query('SELECT * FROM blacklist');
    expect(blacklistResult.rows.length).toBeGreaterThanOrEqual(2);

    // Try to insert a contact with a blacklisted number
    const blacklistedNumber = testBlacklistEntries[0].phoneNumber;
    
    await pgClient.query(
      `INSERT INTO contacts (campaign_id, phone_number, sms_capable)
       VALUES ($1, $2, $3)`,
      [campaignIds[0], blacklistedNumber, true]
    );

    // Query should show the contact exists (blacklist is checked at dial time, not insert time)
    const contactResult = await pgClient.query(
      'SELECT * FROM contacts WHERE phone_number = $1',
      [blacklistedNumber]
    );
    expect(contactResult.rows).toHaveLength(1);

    // But we can verify the number is in the blacklist
    const checkBlacklist = await pgClient.query(
      'SELECT * FROM blacklist WHERE phone_number = $1',
      [blacklistedNumber]
    );
    expect(checkBlacklist.rows).toHaveLength(1);
    expect(checkBlacklist.rows[0].source).toBe(testBlacklistEntries[0].source);

    pgClient.release();
  });

  it('should store and retrieve call records in MongoDB', async () => {
    // Seed PostgreSQL data first
    const { campaignIds, contactIds } = await seedTestData(env, {
      users: [testUsers[0]],
      campaigns: [testCampaigns[0]],
      contacts: [testContacts[0]],
    });

    // Insert call record into MongoDB
    const callRecord = {
      campaignId: campaignIds[0],
      contactId: contactIds[0],
      phoneNumber: testContacts[0].phoneNumber,
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      duration: 120,
      outcome: 'answered',
      dtmfInputs: ['1'],
      actionsTriggered: [{ type: 'send_sms' }],
      cost: 0.05,
    };

    const insertResult = await env.mongodb.db.collection('call_records').insertOne(callRecord);
    expect(insertResult.acknowledged).toBe(true);

    // Retrieve and verify
    const retrievedRecord = await env.mongodb.db
      .collection('call_records')
      .findOne({ _id: insertResult.insertedId });

    expect(retrievedRecord).toBeDefined();
    expect(retrievedRecord?.phoneNumber).toBe(testContacts[0].phoneNumber);
    expect(retrievedRecord?.status).toBe('completed');
    expect(retrievedRecord?.dtmfInputs).toEqual(['1']);
  });

  it('should use Redis for rate limiting', async () => {
    const key = 'test:rate_limit:calls_per_second';
    const maxCPS = 100;

    // Simulate rate limiting
    for (let i = 0; i < 50; i++) {
      await env.redis.client.incr(key);
    }

    // Set expiration (1 second TTL)
    await env.redis.client.expire(key, 1);

    // Check current count
    const count = await env.redis.client.get(key);
    expect(parseInt(count || '0')).toBe(50);

    // Verify we're under the limit
    expect(parseInt(count || '0')).toBeLessThan(maxCPS);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Key should be expired
    const expiredCount = await env.redis.client.get(key);
    expect(expiredCount).toBeNull();
  });

  it('should handle cross-database operations', async () => {
    // This test demonstrates a typical workflow:
    // 1. Create campaign in PostgreSQL
    // 2. Add contacts in PostgreSQL
    // 3. Record call outcomes in MongoDB
    // 4. Update counters in Redis

    // Step 1: Create campaign
    const { campaignIds, contactIds } = await seedTestData(env, {
      users: [testUsers[0]],
      campaigns: [testCampaigns[0]],
      contacts: testContacts.slice(0, 2),
    });

    const campaignId = campaignIds[0];

    // Step 2: Simulate calls and record in MongoDB
    for (let i = 0; i < contactIds.length; i++) {
      const callRecord = {
        campaignId,
        contactId: contactIds[i],
        phoneNumber: testContacts[i].phoneNumber,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        duration: 60 + i * 30,
        outcome: i === 0 ? 'answered' : 'busy',
        dtmfInputs: i === 0 ? ['1'] : [],
        actionsTriggered: [],
        cost: 0.03,
      };

      await env.mongodb.db.collection('call_records').insertOne(callRecord);
    }

    // Step 3: Update Redis counters
    await env.redis.client.incr(`campaign:${campaignId}:total_calls`);
    await env.redis.client.incr(`campaign:${campaignId}:total_calls`);
    await env.redis.client.incr(`campaign:${campaignId}:answered`);

    // Step 4: Verify data across all databases
    
    // PostgreSQL: Campaign exists
    const pgClient = await env.postgres.getClient();
    const campaignResult = await pgClient.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    expect(campaignResult.rows).toHaveLength(1);
    pgClient.release();

    // MongoDB: Call records exist
    const callRecords = await env.mongodb.db
      .collection('call_records')
      .find({ campaignId })
      .toArray();
    expect(callRecords).toHaveLength(2);

    // Redis: Counters are correct
    const totalCalls = await env.redis.client.get(`campaign:${campaignId}:total_calls`);
    const answeredCalls = await env.redis.client.get(`campaign:${campaignId}:answered`);
    expect(parseInt(totalCalls || '0')).toBe(2);
    expect(parseInt(answeredCalls || '0')).toBe(1);
  });

  it('should clean test data between tests', async () => {
    // Insert some data
    await seedTestData(env, {
      users: [testUsers[0]],
      campaigns: [testCampaigns[0]],
      contacts: testContacts.slice(0, 1),
    });

    // Verify data exists
    const pgClient = await env.postgres.getClient();
    const beforeClean = await pgClient.query('SELECT COUNT(*) FROM users');
    expect(parseInt(beforeClean.rows[0].count)).toBeGreaterThan(0);
    pgClient.release();

    // Clean data
    await cleanTestData(env);

    // Verify data is cleaned
    const pgClient2 = await env.postgres.getClient();
    const afterClean = await pgClient2.query("SELECT COUNT(*) FROM users WHERE email LIKE '%@test.com'");
    expect(parseInt(afterClean.rows[0].count)).toBe(0);
    pgClient2.release();

    // MongoDB should also be clean
    const mongoCount = await env.mongodb.db.collection('call_records').countDocuments();
    expect(mongoCount).toBe(0);

    // Redis should be clean
    const redisKeys = await env.redis.client.keys('*');
    expect(redisKeys).toHaveLength(0);
  });
});
