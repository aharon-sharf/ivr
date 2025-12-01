# Database Tests

## Overview

This directory contains property-based tests for database schema integrity and operations.

## Test Strategy

### Mock Database (CI/CD)

The tests in this directory use a **mock database implementation** to enable testing in CI/CD environments without requiring external database connections. This approach:

- ✅ Allows tests to run in GitHub Actions without VPC access
- ✅ Maintains fast test execution
- ✅ Validates business logic and constraints
- ✅ Simulates PostgreSQL behavior including:
  - Foreign key constraints
  - Unique constraints
  - Transactions (BEGIN/COMMIT/ROLLBACK)
  - INSERT/SELECT/UPDATE/DELETE operations

### Integration Tests

For testing with real PostgreSQL, MongoDB, and Redis instances, see `tests/integration/`. These tests:

- Require Docker Compose to run locally
- Are excluded from CI/CD by default (configured in `vitest.config.ts`)
- Provide end-to-end validation with actual database services

## Running Tests

```bash
# Run all unit tests (uses mocks, no external dependencies)
npm test

# Run only database tests
npm run test:unit

# Run integration tests (requires Docker)
npm run docker:test:up
npm run test:integration
npm run docker:test:down
```

## Test Files

- `schema-integrity.test.ts` - Property-based tests for database synchronization and constraint enforcement using mock database

## Mock Implementation

The mock database simulates PostgreSQL behavior:

```typescript
// Enforces foreign key constraints
await expect(
  insertContactWithInvalidCampaignId()
).rejects.toThrow();

// Enforces unique constraints
await expect(
  insertDuplicateContact()
).rejects.toThrow();

// Supports transactions
await client.query('BEGIN');
// ... operations ...
await client.query('ROLLBACK');
```

## Property-Based Testing

Tests use `fast-check` to generate random test data and verify properties hold across all inputs:

```typescript
fc.assert(
  fc.asyncProperty(contactListArbitrary, async (contacts) => {
    // Insert contacts
    // Query database
    // Verify data integrity
  }),
  { numRuns: 100 }
);
```

Each test runs 100 iterations with randomly generated data to catch edge cases.
