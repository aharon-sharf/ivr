# Enrich Dial Task Lambda

## Overview

This Lambda function is invoked by EventBridge Pipes to enrich dial task messages with campaign configuration before they reach the Dialer Worker Lambda.

## Responsibilities

- Fetch campaign configuration from PostgreSQL
- Add IVR flow, audio URLs, and settings to message
- Return enriched message to EventBridge Pipe
- Filter out messages for inactive campaigns

## Input

EventBridge Pipes passes an array of dial task messages:

```json
[
  {
    "campaignId": "campaign-123",
    "contactId": "contact-456",
    "phoneNumber": "+972501234567",
    "metadata": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "attempts": 0
  }
]
```

## Output

Returns an array of enriched dial task messages:

```json
[
  {
    "campaignId": "campaign-123",
    "contactId": "contact-456",
    "phoneNumber": "+972501234567",
    "metadata": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "attempts": 0,
    "campaign": {
      "id": "campaign-123",
      "name": "Donation Drive 2024",
      "type": "voice",
      "status": "active",
      "config": {
        "audioFileUrl": "https://s3.amazonaws.com/bucket/audio.mp3",
        "ivrFlow": {
          "nodes": [...],
          "startNodeId": "node-1"
        },
        "callingWindows": [
          {
            "dayOfWeek": [0, 1, 2, 3, 4],
            "startHour": 9,
            "endHour": 17
          }
        ],
        "maxConcurrentCalls": 100,
        "maxAttemptsPerContact": 3
      },
      "timezone": "Asia/Jerusalem"
    },
    "enrichedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

## Database Schema

The function queries the `campaigns` table:

```sql
SELECT 
  id,
  name,
  type,
  status,
  config,
  timezone,
  created_at,
  updated_at
FROM campaigns
WHERE id = $1
```

## Environment Variables

- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password

## Error Handling

- **Campaign Not Found**: Returns null for that message (filtered out)
- **Inactive Campaign**: Returns null for that message (filtered out)
- **Database Error**: Throws error, EventBridge Pipes will retry
- **Invalid Message**: Returns null for that message (filtered out)

## Performance

- **Memory**: 128 MB
- **Timeout**: 5 seconds
- **Concurrency**: 100
- **Connection Pooling**: Max 10 connections to PostgreSQL

## Monitoring

CloudWatch metrics:

- `Invocations` - Number of times function is invoked
- `Errors` - Number of errors
- `Duration` - Execution time
- `Throttles` - Number of throttled invocations

Custom logs:

- Campaign fetch success/failure
- Message enrichment success/failure
- Invalid message warnings

## Deployment

Build and deploy using Docker:

```bash
cd src/lambda/enrich-dial-task
docker build -t enrich-dial-task .
docker tag enrich-dial-task:latest <account-id>.dkr.ecr.<region>.amazonaws.com/enrich-dial-task:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/enrich-dial-task:latest
```

Update Lambda function:

```bash
aws lambda update-function-code \
  --function-name enrich-dial-task \
  --image-uri <account-id>.dkr.ecr.<region>.amazonaws.com/enrich-dial-task:latest
```

## Testing

Test locally with sample event:

```bash
npm test
```

Test in AWS:

```bash
aws lambda invoke \
  --function-name enrich-dial-task \
  --payload file://test-event.json \
  response.json
```

## Validation: Requirements 4.1

This Lambda validates:
- **Requirement 4.1**: IVR plays configured pre-recorded audio message (by providing audio URL in enriched message)
