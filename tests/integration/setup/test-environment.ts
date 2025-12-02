/**
 * Test Environment Setup and Teardown
 * 
 * This module provides utilities for setting up and tearing down the test environment,
 * including database connections, test data seeding, and cleanup.
 */

import { Pool, PoolClient } from 'pg';
import { MongoClient, Db } from 'mongodb';
import { createClient, RedisClientType } from 'redis';

export interface TestEnvironment {
  postgres: {
    pool: Pool;
    getClient: () => Promise<PoolClient>;
  };
  mongodb: {
    client: MongoClient;
    db: Db;
  };
  redis: {
    client: RedisClientType;
  };
}

/**
 * Database configuration for test environment
 */
export const TEST_CONFIG = {
  postgres: {
    host: process.env.TEST_POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.TEST_POSTGRES_PORT || '5433'),
    database: process.env.TEST_POSTGRES_DB || 'campaign_test',
    user: process.env.TEST_POSTGRES_USER || 'postgres',
    password: process.env.TEST_POSTGRES_PASSWORD || 'test_password',
  },
  mongodb: {
    url: process.env.TEST_MONGODB_URL || 'mongodb://admin:test_password@localhost:27018',
    database: process.env.TEST_MONGODB_DB || 'campaign_test',
  },
  redis: {
    url: process.env.TEST_REDIS_URL || 'redis://:test_password@localhost:6380',
  },
  localstack: {
    endpoint: process.env.TEST_LOCALSTACK_ENDPOINT || 'http://localhost:4566',
    region: process.env.TEST_AWS_REGION || 'us-east-1',
  },
};

/**
 * Initialize test environment with all required connections
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  // Setup PostgreSQL
  const pgPool = new Pool(TEST_CONFIG.postgres);
  
  // Test PostgreSQL connection
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
  } catch (error) {
    throw new Error(`Failed to connect to PostgreSQL: ${error}`);
  }

  // Setup MongoDB
  const mongoClient = new MongoClient(TEST_CONFIG.mongodb.url);
  await mongoClient.connect();
  const mongoDb = mongoClient.db(TEST_CONFIG.mongodb.database);

  // Test MongoDB connection
  try {
    await mongoDb.admin().ping();
  } catch (error) {
    throw new Error(`Failed to connect to MongoDB: ${error}`);
  }

  // Setup Redis
  const redisClient = createClient({
    url: TEST_CONFIG.redis.url,
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  await redisClient.connect();

  // Test Redis connection
  try {
    await redisClient.ping();
  } catch (error) {
    throw new Error(`Failed to connect to Redis: ${error}`);
  }

  return {
    postgres: {
      pool: pgPool,
      getClient: () => pgPool.connect(),
    },
    mongodb: {
      client: mongoClient,
      db: mongoDb,
    },
    redis: {
      client: redisClient as any,
    },
  };
}

/**
 * Teardown test environment and close all connections
 */
export async function teardownTestEnvironment(env: TestEnvironment): Promise<void> {
  // Close PostgreSQL connections
  await env.postgres.pool.end();

  // Close MongoDB connection
  await env.mongodb.client.close();

  // Close Redis connection
  await env.redis.client.quit();
}

/**
 * Clean all test data from databases
 */
export async function cleanTestData(env: TestEnvironment): Promise<void> {
  // Clean PostgreSQL
  const pgClient = await env.postgres.getClient();
  try {
    await pgClient.query('BEGIN');
    
    // Delete in order to respect foreign key constraints
    await pgClient.query('DELETE FROM call_records');
    await pgClient.query('DELETE FROM sms_records');
    await pgClient.query('DELETE FROM contacts');
    await pgClient.query('DELETE FROM blacklist');
    await pgClient.query('DELETE FROM campaigns');
    await pgClient.query("DELETE FROM users WHERE email LIKE 'test_%' OR email LIKE '%@test.com'");
    
    await pgClient.query('COMMIT');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    pgClient.release();
  }

  // Clean MongoDB
  await env.mongodb.db.collection('call_records').deleteMany({});
  await env.mongodb.db.collection('sms_records').deleteMany({});
  await env.mongodb.db.collection('event_logs').deleteMany({});

  // Clean Redis
  await env.redis.client.flushDb();
}

/**
 * Seed test data into databases
 */
export async function seedTestData(
  env: TestEnvironment,
  data: {
    users?: any[];
    campaigns?: any[];
    contacts?: any[];
    blacklist?: any[];
  }
): Promise<{
  userIds: string[];
  campaignIds: string[];
  contactIds: string[];
}> {
  const pgClient = await env.postgres.getClient();
  const userIds: string[] = [];
  const campaignIds: string[] = [];
  const contactIds: string[] = [];

  try {
    await pgClient.query('BEGIN');

    // Insert users
    if (data.users) {
      for (const user of data.users) {
        const result = await pgClient.query(
          `INSERT INTO users (email, cognito_user_id, role)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [user.email, user.cognitoUserId, user.role]
        );
        userIds.push(result.rows[0].id);
      }
    }

    // Insert campaigns
    if (data.campaigns && userIds.length > 0) {
      for (const campaign of data.campaigns) {
        const result = await pgClient.query(
          `INSERT INTO campaigns (name, type, status, config, created_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            campaign.name,
            campaign.type,
            campaign.status,
            JSON.stringify(campaign.config),
            userIds[0], // Use first user as creator
          ]
        );
        campaignIds.push(result.rows[0].id);
      }
    }

    // Insert contacts
    if (data.contacts && campaignIds.length > 0) {
      for (const contact of data.contacts) {
        const result = await pgClient.query(
          `INSERT INTO contacts (campaign_id, phone_number, metadata, timezone, sms_capable)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            campaignIds[0], // Associate with first campaign
            contact.phoneNumber,
            JSON.stringify(contact.metadata),
            contact.timezone,
            contact.smsCapable,
          ]
        );
        contactIds.push(result.rows[0].id);
      }
    }

    // Insert blacklist entries
    if (data.blacklist) {
      for (const entry of data.blacklist) {
        await pgClient.query(
          `INSERT INTO blacklist (phone_number, reason, source)
           VALUES ($1, $2, $3)
           ON CONFLICT (phone_number) DO NOTHING`,
          [entry.phoneNumber, entry.reason, entry.source]
        );
      }
    }

    await pgClient.query('COMMIT');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    pgClient.release();
  }

  return { userIds, campaignIds, contactIds };
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, timeoutMessage = 'Timeout waiting for condition' } = options;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(timeoutMessage);
}

/**
 * Create a test transaction that automatically rolls back
 */
export async function withTransaction<T>(
  env: TestEnvironment,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await env.postgres.getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('ROLLBACK'); // Always rollback in tests
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Helper to check if services are healthy
 */
export async function checkServicesHealth(): Promise<{
  postgres: boolean;
  mongodb: boolean;
  redis: boolean;
}> {
  const health = {
    postgres: false,
    mongodb: false,
    redis: false,
  };

  // Check PostgreSQL
  try {
    const pool = new Pool(TEST_CONFIG.postgres);
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    health.postgres = true;
  } catch (error) {
    console.error('PostgreSQL health check failed:', error);
  }

  // Check MongoDB
  try {
    const client = new MongoClient(TEST_CONFIG.mongodb.url);
    await client.connect();
    await client.db().admin().ping();
    await client.close();
    health.mongodb = true;
  } catch (error) {
    console.error('MongoDB health check failed:', error);
  }

  // Check Redis
  try {
    const client = createClient({ url: TEST_CONFIG.redis.url });
    await client.connect();
    await client.ping();
    await client.quit();
    health.redis = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  return health;
}
