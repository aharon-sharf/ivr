# Integration Testing Guide

This guide explains how to write and run integration tests for the Mass Voice Campaign System.

## Overview

Integration tests verify that multiple components work together correctly. Unlike unit tests that test individual functions in isolation, integration tests:

- Test interactions between services (API → Database → Cache)
- Verify data flows across system boundaries
- Test real database operations (not mocked)
- Validate business workflows end-to-end

## Test Environment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Integration Tests                     │
│                  (TypeScript/Vitest)                     │
└────────────┬────────────┬────────────┬──────────────────┘
             │            │            │
             ▼            ▼            ▼
      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │PostgreSQL│  │ MongoDB  │  │  Redis   │
      │  :5433   │  │  :27018  │  │  :6380   │
      └──────────┘  └──────────┘  └──────────┘
             │            │            │
             └────────────┴────────────┘
                         │
                    ┌──────────┐
                    │LocalStack│ (Optional)
                    │  :4566   │
                    └──────────┘
```

## Writing Integration Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  cleanTestData,
  TestEnvironment,
} from './setup/test-environment';

describe('My Integration Test Suite', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await setupTestEnvironment();
  }, 30000); // 30 second timeout

  afterAll(async () => {
    await teardownTestEnvironment(env);
  });

  beforeEach(async () => {
    await cleanTestData(env);
  });

  it('should test something', async () => {
    // Your test code here
  });
});
```

### Using Test Fixtures

```typescript
import { testUsers, testCampaigns, testContacts } from './fixtures/test-data';
import { seedTestData } from './setup/test-environment';

it('should create a campaign with contacts', async () => {
  // Seed test data
  const { campaignIds, contactIds } = await seedTestData(env, {
    users: [testUsers[0]],
    campaigns: [testCampaigns[0]],
    contacts: testContacts.slice(0, 5),
  });

  // Test your logic
  expect(campaignIds).toHaveLength(1);
  expect(contactIds).toHaveLength(5);
});
```

### Testing PostgreSQL Operations

```typescript
it('should insert and retrieve campaign data', async () => {
  const client = await env.postgres.getClient();
  
  try {
    // Insert data
    const result = await client.query(
      `INSERT INTO campaigns (name, type, status, config, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Test Campaign', 'voice', 'draft', '{}', 'user-id']
    );

    const campaignId = result.rows[0].id;

    // Retrieve data
    const campaign = await client.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [campaignId]
    );

    expect(campaign.rows[0].name).toBe('Test Campaign');
  } finally {
    client.release();
  }
});
```

### Testing MongoDB Operations

```typescript
it('should store call records in MongoDB', async () => {
  const callRecord = {
    campaignId: 'test-campaign-id',
    contactId: 'test-contact-id',
    phoneNumber: '+12125551234',
    status: 'completed',
    startTime: new Date(),
    outcome: 'answered',
    dtmfInputs: ['1'],
    actionsTriggered: [],
    cost: 0.05,
  };

  // Insert
  const result = await env.mongodb.db
    .collection('call_records')
    .insertOne(callRecord);

  expect(result.acknowledged).toBe(true);

  // Retrieve
  const retrieved = await env.mongodb.db
    .collection('call_records')
    .findOne({ _id: result.insertedId });

  expect(retrieved?.phoneNumber).toBe('+12125551234');
});
```

### Testing Redis Operations

```typescript
it('should implement rate limiting with Redis', async () => {
  const key = 'rate_limit:test';
  
  // Increment counter
  await env.redis.client.incr(key);
  await env.redis.client.incr(key);
  
  // Set expiration
  await env.redis.client.expire(key, 1);
  
  // Check value
  const value = await env.redis.client.get(key);
  expect(parseInt(value || '0')).toBe(2);
  
  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  // Should be expired
  const expired = await env.redis.client.get(key);
  expect(expired).toBeNull();
});
```

### Testing Cross-Database Workflows

```typescript
it('should handle complete campaign workflow', async () => {
  // 1. Create campaign in PostgreSQL
  const { campaignIds, contactIds } = await seedTestData(env, {
    users: [testUsers[0]],
    campaigns: [testCampaigns[0]],
    contacts: testContacts.slice(0, 3),
  });

  const campaignId = campaignIds[0];

  // 2. Simulate call and record in MongoDB
  await env.mongodb.db.collection('call_records').insertOne({
    campaignId,
    contactId: contactIds[0],
    phoneNumber: testContacts[0].phoneNumber,
    status: 'completed',
    startTime: new Date(),
    outcome: 'answered',
    dtmfInputs: ['1'],
    actionsTriggered: [],
    cost: 0.05,
  });

  // 3. Update Redis counters
  await env.redis.client.incr(`campaign:${campaignId}:total_calls`);
  await env.redis.client.incr(`campaign:${campaignId}:answered`);

  // 4. Verify data across all databases
  const pgClient = await env.postgres.getClient();
  const campaign = await pgClient.query(
    'SELECT * FROM campaigns WHERE id = $1',
    [campaignId]
  );
  expect(campaign.rows).toHaveLength(1);
  pgClient.release();

  const callRecords = await env.mongodb.db
    .collection('call_records')
    .find({ campaignId })
    .toArray();
  expect(callRecords).toHaveLength(1);

  const totalCalls = await env.redis.client.get(
    `campaign:${campaignId}:total_calls`
  );
  expect(parseInt(totalCalls || '0')).toBe(1);
});
```

## Best Practices

### 1. Test Isolation

Always clean data between tests:

```typescript
beforeEach(async () => {
  await cleanTestData(env);
});
```

### 2. Use Transactions for PostgreSQL

For tests that don't need to commit:

```typescript
import { withTransaction } from './setup/test-environment';

it('should rollback after test', async () => {
  await withTransaction(env, async (client) => {
    // All queries here will be rolled back
    await client.query('INSERT INTO ...');
    // Test assertions
  });
  // Transaction automatically rolled back
});
```

### 3. Deterministic Test Data

Use fixtures instead of random data:

```typescript
// Good
const contact = testContacts[0];

// Avoid
const contact = {
  phoneNumber: `+1${Math.random()}`,
  // ...
};
```

### 4. Proper Cleanup

Always release database clients:

```typescript
const client = await env.postgres.getClient();
try {
  // Your test code
} finally {
  client.release(); // Always release!
}
```

### 5. Meaningful Test Names

```typescript
// Good
it('should prevent duplicate contacts in the same campaign', async () => {
  // ...
});

// Avoid
it('test1', async () => {
  // ...
});
```

### 6. Test One Thing at a Time

```typescript
// Good - focused test
it('should add phone number to blacklist', async () => {
  // Test only blacklist addition
});

it('should prevent calls to blacklisted numbers', async () => {
  // Test only call prevention
});

// Avoid - testing too much
it('should handle blacklist', async () => {
  // Tests addition, removal, call prevention, etc.
});
```

## Common Patterns

### Testing Blacklist Enforcement

```typescript
it('should not dial blacklisted numbers', async () => {
  // Seed blacklist
  await seedTestData(env, {
    users: [testUsers[0]],
    campaigns: [testCampaigns[0]],
    blacklist: [{ phoneNumber: '+12125559999', reason: 'test', source: 'user_optout' }],
  });

  // Verify blacklist check
  const pgClient = await env.postgres.getClient();
  const result = await pgClient.query(
    'SELECT EXISTS(SELECT 1 FROM blacklist WHERE phone_number = $1)',
    ['+12125559999']
  );
  expect(result.rows[0].exists).toBe(true);
  pgClient.release();
});
```

### Testing Time Window Enforcement

```typescript
it('should respect calling time windows', async () => {
  const now = new Date();
  const currentHour = now.getHours();

  // Create campaign with time window that excludes current hour
  const campaign = {
    ...testCampaigns[0],
    config: {
      ...testCampaigns[0].config,
      callingWindows: [{
        dayOfWeek: [1, 2, 3, 4, 5],
        startHour: (currentHour + 2) % 24,
        endHour: (currentHour + 4) % 24,
      }],
    },
  };

  // Test that calls are not initiated outside window
  // Your logic here
});
```

### Testing Rate Limiting

```typescript
it('should enforce calls per second limit', async () => {
  const maxCPS = 10;
  const key = 'test:cps';

  // Simulate rapid calls
  for (let i = 0; i < 15; i++) {
    const current = await env.redis.client.get(key);
    const count = parseInt(current || '0');

    if (count < maxCPS) {
      await env.redis.client.incr(key);
      await env.redis.client.expire(key, 1);
    } else {
      // Rate limit exceeded
      break;
    }
  }

  const finalCount = await env.redis.client.get(key);
  expect(parseInt(finalCount || '0')).toBeLessThanOrEqual(maxCPS);
});
```

## Debugging Tests

### View Container Logs

```bash
# All services
npm run docker:test:logs

# Specific service
docker logs campaign-test-postgres
docker logs campaign-test-mongodb
docker logs campaign-test-redis
```

### Connect to Databases Manually

```bash
# PostgreSQL
docker exec -it campaign-test-postgres psql -U postgres -d campaign_test

# MongoDB
docker exec -it campaign-test-mongodb mongosh -u admin -p test_password

# Redis
docker exec -it campaign-test-redis redis-cli -a test_password
```

### Check Service Health

```bash
npx tsx tests/integration/health-check.ts
```

### Run Single Test File

```bash
npm run test:integration -- tests/integration/example.integration.test.ts
```

### Enable Verbose Logging

```typescript
// In your test file
import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.DEBUG = 'true';
});
```

## Performance Considerations

### Test Execution Time

- Setup/teardown: ~2-5 seconds
- Single test: ~100-500ms
- Full suite: Depends on number of tests

### Optimize Slow Tests

```typescript
// Use Promise.all for parallel operations
await Promise.all([
  env.postgres.getClient(),
  env.mongodb.db.collection('test').insertOne({}),
  env.redis.client.set('key', 'value'),
]);

// Batch database operations
await client.query('BEGIN');
for (const item of items) {
  await client.query('INSERT INTO ...', [item]);
}
await client.query('COMMIT');
```

### Resource Limits

Docker containers have resource limits:
- PostgreSQL: 512MB RAM
- MongoDB: 512MB RAM
- Redis: 256MB RAM

Adjust in `docker-compose.test.yml` if needed.

## Troubleshooting

### "Connection refused" errors

Services may not be ready yet. Wait longer or check health:

```bash
npx tsx tests/integration/health-check.ts
```

### "Out of memory" errors

Increase Docker memory limits or reduce test data size.

### Tests pass locally but fail in CI

Ensure CI has enough resources and proper service startup order.

### Flaky tests

- Avoid time-dependent tests
- Use `waitFor()` helper for async operations
- Ensure proper cleanup between tests

## CI/CD Integration

See `tests/integration/README.md` for GitHub Actions configuration.

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [PostgreSQL Testing Best Practices](https://www.postgresql.org/docs/current/regress.html)
- [MongoDB Testing Guide](https://www.mongodb.com/docs/manual/tutorial/test-mongodb/)
- [Redis Testing Patterns](https://redis.io/docs/manual/patterns/)
