# Integration Tests - Quick Start

Get up and running with integration tests in 5 minutes.

## Step 1: Prerequisites

Ensure you have:
- Docker installed and running
- Docker Compose installed
- Node.js 18+ installed

Check with:
```bash
docker --version
docker-compose --version
node --version
```

## Step 2: Start Test Environment

Run the automated setup script:

```bash
cd tests/integration
chmod +x setup.sh
./setup.sh
```

This will:
- Start PostgreSQL, MongoDB, Redis, and LocalStack containers
- Wait for all services to be healthy
- Initialize databases with schemas
- Create AWS resources in LocalStack
- Generate `.env.test` configuration file

## Step 3: Verify Services

Check that all services are running:

```bash
npx tsx health-check.ts
```

You should see:
```
✓ PostgreSQL: Healthy
✓ MongoDB: Healthy
✓ Redis: Healthy
```

## Step 4: Run Integration Tests

From the project root:

```bash
npm run test:integration
```

Or run in watch mode:

```bash
npm run test:integration:watch
```

## Step 5: View Results

You should see output like:

```
✓ tests/integration/example.integration.test.ts (8)
  ✓ Integration Test Environment - Example (8)
    ✓ should connect to all test databases
    ✓ should seed and retrieve test data from PostgreSQL
    ✓ should enforce blacklist in database
    ✓ should store and retrieve call records in MongoDB
    ✓ should use Redis for rate limiting
    ✓ should handle cross-database operations
    ✓ should clean test data between tests

Test Files  1 passed (1)
     Tests  8 passed (8)
```

## Common Commands

```bash
# Start test environment
npm run docker:test:up

# Stop test environment
npm run docker:test:down

# Clean everything (removes volumes)
npm run docker:test:clean

# View logs
npm run docker:test:logs

# Run integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- tests/integration/example.integration.test.ts

# Check service health
cd tests/integration && npx tsx health-check.ts
```

## Troubleshooting

### Services won't start

```bash
# Clean everything and start fresh
npm run docker:test:clean
cd tests/integration && ./setup.sh
```

### Port conflicts

If ports 5433, 27018, 6380, or 4566 are already in use:

1. Edit `tests/integration/docker-compose.test.yml`
2. Change the port mappings (e.g., `5433:5432` → `5434:5432`)
3. Update `.env.test` with the new ports
4. Restart: `npm run docker:test:down && npm run docker:test:up`

### Connection errors

```bash
# Check container status
docker ps | grep campaign-test

# Check logs
docker logs campaign-test-postgres
docker logs campaign-test-mongodb
docker logs campaign-test-redis

# Restart specific service
docker restart campaign-test-postgres
```

### Tests fail with timeout

Increase timeout in test files:

```typescript
beforeAll(async () => {
  env = await setupTestEnvironment();
}, 60000); // Increase to 60 seconds
```

## Next Steps

- Read the [Integration Testing Guide](./TESTING_GUIDE.md) for detailed examples
- Check out [test fixtures](./fixtures/test-data.ts) for reusable test data
- Review the [example integration test](./example.integration.test.ts)
- See the [main README](./README.md) for complete documentation

## Need Help?

1. Check service health: `npx tsx tests/integration/health-check.ts`
2. View container logs: `npm run docker:test:logs`
3. Restart services: `npm run docker:test:down && npm run docker:test:up`
4. Clean and restart: `npm run docker:test:clean && cd tests/integration && ./setup.sh`
