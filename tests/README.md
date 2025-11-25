# Testing Guide

This directory contains property-based tests, unit tests, and integration tests for the Mass Voice Campaign System.

## Test Types

### Unit Tests
- Located in `tests/database/` and `tests/models/`
- Test individual components in isolation
- Use property-based testing with fast-check
- Run with: `npm run test:unit`

### Integration Tests
- Located in `tests/integration/`
- Test interactions between multiple components
- Use real databases (PostgreSQL, MongoDB, Redis)
- Run with: `npm run test:integration`
- See [Integration Testing Guide](./integration/TESTING_GUIDE.md) for details

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Docker and Docker Compose** - Required for integration tests
3. **PostgreSQL** (v14 or higher) - Required for unit database tests
4. **npm** or **yarn**

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Test Database

You can use Docker to run a PostgreSQL instance for testing:

```bash
docker run -d \
  --name campaign-test-db \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=campaign_test \
  postgres:15
```

### 3. Apply Database Schema

```bash
psql -h localhost -U postgres -d campaign_test -f database/migrations/001_initial_schema.sql
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and update with your database credentials:

```bash
cp .env.example .env
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests

```bash
# First, start the test environment
npm run docker:test:up

# Wait for services to be ready (about 30 seconds)
# Or run the setup script: cd tests/integration && ./setup.sh

# Run integration tests
npm run test:integration

# Stop test environment when done
npm run docker:test:down
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run with Coverage

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npm test tests/database/schema-integrity.test.ts
```

## Property-Based Tests

Property-based tests use the `fast-check` library to generate random test data and verify that properties hold across all inputs.

### Configuration

- Each property test runs **100 iterations** by default (as specified in the design document)
- Tests are tagged with the property number and requirement they validate
- Format: `**Feature: mass-voice-campaign-system, Property {number}: {property_text}**`

### Database Tests

The database property tests require a running PostgreSQL instance. They test:

1. **Property 2: Database synchronization consistency** - Verifies that contact records remain consistent after synchronization
2. **Foreign key constraint integrity** - Ensures referential integrity is maintained
3. **Unique constraint enforcement** - Prevents duplicate phone numbers per campaign

### Test Isolation

- Each test runs in a transaction that is rolled back after completion
- Test data is cleaned up before and after test runs
- Tests use unique identifiers to avoid conflicts

## Troubleshooting

### Database Connection Errors

If you see connection errors, verify:
- PostgreSQL is running: `docker ps` or `systemctl status postgresql`
- Database exists: `psql -h localhost -U postgres -l`
- Credentials are correct in `.env` file

### Schema Not Found Errors

If tables don't exist, apply the migration:
```bash
psql -h localhost -U postgres -d campaign_test -f database/migrations/001_initial_schema.sql
```

### Port Already in Use

If port 5432 is already in use, either:
- Stop the existing PostgreSQL instance
- Use a different port in `.env` and Docker command

## Integration Test Environment

For detailed information about integration tests, see:
- [Integration Test README](./integration/README.md)
- [Integration Testing Guide](./integration/TESTING_GUIDE.md)

Quick setup:

```bash
cd tests/integration
./setup.sh
```

## CI/CD Integration

These tests are designed to run in CI/CD pipelines. Example GitHub Actions workflow:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: campaign_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: psql -h localhost -U postgres -d campaign_test -f database/migrations/001_initial_schema.sql
        env:
          PGPASSWORD: postgres
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - name: Start test environment
        run: |
          cd tests/integration
          docker-compose -f docker-compose.test.yml up -d
          sleep 30
      - name: Run integration tests
        run: npm run test:integration
      - name: Cleanup
        if: always()
        run: |
          cd tests/integration
          docker-compose -f docker-compose.test.yml down -v
```
