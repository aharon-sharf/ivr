# Integration Test Environment

This directory contains the integration test environment setup for the Mass Voice Campaign System. The environment includes Docker containers for PostgreSQL, MongoDB, Redis, and LocalStack (for AWS services).

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- At least 4GB of available RAM for containers

## Quick Start

### 1. Start Test Environment

```bash
# Start all test containers
cd tests/integration
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be healthy (about 30 seconds)
docker-compose -f docker-compose.test.yml ps
```

### 2. Initialize LocalStack (Optional)

If you need AWS services for integration tests:

```bash
# Make the script executable
chmod +x setup/localstack-init.sh

# Run the initialization script
./setup/localstack-init.sh
```

### 3. Verify Services

```bash
# Check PostgreSQL
docker exec campaign-test-postgres pg_isready -U postgres

# Check MongoDB
docker exec campaign-test-mongodb mongosh --eval "db.adminCommand('ping')"

# Check Redis
docker exec campaign-test-redis redis-cli -a test_password ping

# Check LocalStack (if running)
curl http://localhost:4566/_localstack/health
```

### 4. Run Integration Tests

```bash
# From project root
npm run test:integration
```

## Services

### PostgreSQL (Port 5433)
- **Image**: postgres:15-alpine
- **Database**: campaign_test
- **User**: postgres
- **Password**: test_password
- **Purpose**: Transactional data (campaigns, contacts, users, blacklist)

**Connection String**:
```
postgresql://postgres:test_password@localhost:5433/campaign_test
```

### MongoDB (Port 27018)
- **Image**: mongo:7.0
- **Database**: campaign_test
- **User**: admin
- **Password**: test_password
- **Purpose**: Call Detail Records (CDRs), event logs, analytics data

**Connection String**:
```
mongodb://admin:test_password@localhost:27018/campaign_test
```

### Redis (Port 6380)
- **Image**: redis:7-alpine
- **Password**: test_password
- **Purpose**: Rate limiting, caching, real-time counters

**Connection String**:
```
redis://:test_password@localhost:6380
```

### LocalStack (Port 4566)
- **Image**: localstack/localstack:latest
- **Services**: S3, SQS, SNS, Lambda, DynamoDB, Secrets Manager
- **Purpose**: Mock AWS services for integration testing

**Endpoint**:
```
http://localhost:4566
```

## Environment Variables

Create a `.env.test` file in the project root:

```bash
# PostgreSQL
TEST_POSTGRES_HOST=localhost
TEST_POSTGRES_PORT=5433
TEST_POSTGRES_DB=campaign_test
TEST_POSTGRES_USER=postgres
TEST_POSTGRES_PASSWORD=test_password

# MongoDB
TEST_MONGODB_URL=mongodb://admin:test_password@localhost:27018
TEST_MONGODB_DB=campaign_test

# Redis
TEST_REDIS_URL=redis://:test_password@localhost:6380

# LocalStack
TEST_LOCALSTACK_ENDPOINT=http://localhost:4566
TEST_AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

## Test Data Fixtures

Test data fixtures are available in `fixtures/test-data.ts`:

```typescript
import { testUsers, testCampaigns, testContacts } from './fixtures/test-data';

// Use in your tests
const user = testUsers[0];
const campaign = testCampaigns[0];
const contacts = testContacts;
```

## Test Environment Setup

Use the test environment utilities in your integration tests:

```typescript
import { setupTestEnvironment, teardownTestEnvironment, cleanTestData } from './setup/test-environment';

describe('Integration Test Suite', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment(env);
  });

  beforeEach(async () => {
    await cleanTestData(env);
  });

  it('should run integration test', async () => {
    // Your test code here
    const client = await env.postgres.getClient();
    // ...
    client.release();
  });
});
```

## Database Schemas

### PostgreSQL Schema

The PostgreSQL schema is automatically initialized from `database/migrations/001_initial_schema.sql` when the container starts.

Tables:
- `users` - User accounts and authentication
- `campaigns` - Campaign configurations
- `contacts` - Contact lists for campaigns
- `blacklist` - Do-Not-Call registry
- `call_records` - Call attempt records
- `sms_records` - SMS delivery records

### MongoDB Collections

MongoDB collections are initialized from `fixtures/mongodb-init.js`:

Collections:
- `call_records` - Detailed call logs with CDR data
- `sms_records` - SMS delivery logs
- `event_logs` - System event logs

## Troubleshooting

### Containers Won't Start

```bash
# Check Docker resources
docker system df

# Clean up old containers and volumes
docker-compose -f docker-compose.test.yml down -v

# Restart
docker-compose -f docker-compose.test.yml up -d
```

### Port Conflicts

If ports are already in use, modify `docker-compose.test.yml`:

```yaml
ports:
  - "5434:5432"  # Change 5433 to 5434
```

Then update your `.env.test` file accordingly.

### Database Connection Errors

```bash
# Check container logs
docker-compose -f docker-compose.test.yml logs postgres
docker-compose -f docker-compose.test.yml logs mongodb
docker-compose -f docker-compose.test.yml logs redis

# Restart specific service
docker-compose -f docker-compose.test.yml restart postgres
```

### LocalStack Issues

```bash
# Check LocalStack logs
docker-compose -f docker-compose.test.yml logs localstack

# Restart LocalStack
docker-compose -f docker-compose.test.yml restart localstack

# Re-run initialization
./setup/localstack-init.sh
```

### Clean Everything and Start Fresh

```bash
# Stop and remove all containers and volumes
docker-compose -f docker-compose.test.yml down -v

# Remove any orphaned containers
docker container prune -f

# Start fresh
docker-compose -f docker-compose.test.yml up -d

# Wait for health checks
sleep 30

# Initialize LocalStack (if needed)
./setup/localstack-init.sh
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Start test environment
        run: |
          cd tests/integration
          docker-compose -f docker-compose.test.yml up -d
          sleep 30
      
      - name: Initialize LocalStack
        run: |
          chmod +x tests/integration/setup/localstack-init.sh
          tests/integration/setup/localstack-init.sh
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          TEST_POSTGRES_HOST: localhost
          TEST_POSTGRES_PORT: 5433
          TEST_MONGODB_URL: mongodb://admin:test_password@localhost:27018
          TEST_REDIS_URL: redis://:test_password@localhost:6380
      
      - name: Cleanup
        if: always()
        run: |
          cd tests/integration
          docker-compose -f docker-compose.test.yml down -v
```

## Performance Considerations

### Resource Limits

The Docker Compose configuration includes resource limits:

- PostgreSQL: 512MB RAM
- MongoDB: 512MB RAM
- Redis: 256MB RAM
- LocalStack: 1GB RAM

Adjust these in `docker-compose.test.yml` if needed.

### Data Persistence

Test data is stored in Docker volumes:
- `postgres-test-data`
- `mongodb-test-data`
- `redis-test-data`
- `localstack-test-data`

To completely reset:
```bash
docker-compose -f docker-compose.test.yml down -v
```

## Best Practices

1. **Always clean test data between tests** - Use `cleanTestData()` in `beforeEach()`
2. **Use transactions for PostgreSQL tests** - Use `withTransaction()` helper
3. **Isolate tests** - Each test should be independent
4. **Use fixtures** - Reuse test data from `fixtures/test-data.ts`
5. **Check service health** - Use `checkServicesHealth()` before running tests
6. **Clean up resources** - Always release database clients and close connections

## Additional Resources

- [PostgreSQL Docker Documentation](https://hub.docker.com/_/postgres)
- [MongoDB Docker Documentation](https://hub.docker.com/_/mongo)
- [Redis Docker Documentation](https://hub.docker.com/_/redis)
- [LocalStack Documentation](https://docs.localstack.cloud/)
