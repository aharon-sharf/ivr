# Dispatcher Lambda

## Purpose

Queries PostgreSQL for eligible contacts and pushes dial tasks to the SQS queue. This Lambda is invoked by the Step Functions state machine and handles intelligent contact selection based on multiple criteria.

## Responsibilities

- Query PostgreSQL for eligible contacts (not blacklisted, within time window, not exceeded attempts)
- Apply ML-based prioritization (optimal call times)
- Batch contacts and push to SQS dial-tasks queue
- Update campaign status to "active"
- Track dispatch progress and determine if more contacts need processing

## Input

```json
{
  "campaignId": "uuid",
  "campaignName": "Campaign Name",
  "campaign": { ... },
  "batchSize": 100
}
```

## Output

```json
{
  "contactCount": 100,
  "batchesPushed": 10,
  "campaignId": "uuid",
  "campaignName": "Campaign Name",
  "needsMoreContacts": true
}
```

## Contact Selection Criteria

### Eligibility Filters
1. **Status**: Contact status is 'pending' or 'failed' (for retries)
2. **Blacklist**: Phone number is NOT in blacklist table
3. **Attempts**: Contact has not exceeded max attempts (default: 3)
4. **Time Window**: Current time falls within configured calling windows
5. **Timezone**: Respects contact's local timezone if provided

### Prioritization
Contacts are prioritized by:
1. **ML Optimal Time**: Contacts whose optimal call time matches current hour (closest match first)
2. **Creation Time**: Older contacts first (FIFO)

## Blacklist Checking

The dispatcher performs two-level blacklist checking:
1. **Redis Cache**: Fast lookup for blacklisted numbers
2. **Database Fallback**: If Redis is unavailable, checks PostgreSQL

Contacts found to be blacklisted are marked with status 'blacklisted' and skipped.

## SQS Message Format

Each message pushed to the dial-tasks queue contains:

```json
{
  "contactId": "uuid",
  "campaignId": "uuid",
  "phoneNumber": "+972501234567",
  "metadata": { ... },
  "attempts": 0,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Batch Processing

- Queries up to `batchSize` contacts per invocation (default: 100)
- Pushes to SQS in batches of 10 (SQS limit)
- Returns `needsMoreContacts: true` if pending contacts remain
- Step Functions will re-invoke if more contacts need processing

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `REDIS_URL`: Redis connection URL
- `DIAL_TASKS_QUEUE_URL`: SQS queue URL for dial tasks
- `AWS_REGION`: AWS region

## Error Handling

- Throws exceptions for database connection errors
- Logs failed SQS batch sends but continues processing
- Step Functions will retry on transient failures (3 attempts with exponential backoff)

## Requirements Validated

- **Requirement 2.2**: Calling window enforcement
- **Requirement 2.3**: Campaign end time handling
- **Requirement 2.4**: Timezone-aware calling windows
- **Requirement 3.1**: Blacklist pre-dial check
- **Requirement 8.3**: ML-based prioritization (optimal call times)
