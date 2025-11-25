# CDR Logger Lambda

## Overview

This Lambda function logs Call Detail Records (CDRs) to MongoDB for comprehensive call tracking and analytics. It processes all call events, maintains detailed CDR documents, and updates Redis counters for real-time dashboard metrics.

## Responsibilities

- Process call events from SNS call-events topic
- Create and update CDR documents in MongoDB
- Store comprehensive call data: ID, timestamps, outcome, DTMF inputs, cost
- Update Redis counters for live dashboard metrics
- Provide query functions for reporting and analytics
- Calculate campaign statistics and aggregate metrics

## Event Flow

1. **Trigger**: SNS call-events topic receives call event messages
2. **CDR Creation**: Creates new CDR document on first event for a call
3. **CDR Update**: Updates CDR with event-specific data
4. **Counter Update**: Updates Redis counters for dashboard
5. **Metrics Calculation**: Aggregates statistics for reporting

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `MONGODB_DATABASE` | MongoDB database name (default: campaign_system) | No |
| `REDIS_HOST` | Redis host for counters | Yes |
| `REDIS_PORT` | Redis port (default: 6379) | No |

## Call Event Types

### call_initiated
- Creates new CDR document
- Sets status to 'dialing'
- Records start time
- Increments total attempts counter
- Increments active calls counter

### call_answered
- Updates status to 'answered'
- Increments answered counter

### call_ended
- Updates status to 'completed'
- Records end time and outcome
- Calculates duration and cost
- Decrements active calls counter
- Increments outcome-specific counter

### dtmf_pressed
- Appends DTMF digit to dtmfInputs array
- Records timestamp of input

### action_triggered
- Appends action to actionsTriggered array
- Records action type and parameters
- Increments action-specific counter

## Input Event Format

```json
{
  "Records": [
    {
      "Sns": {
        "Message": "{\"callId\":\"call-123\",\"campaignId\":\"campaign-456\",\"contactId\":\"contact-789\",\"phoneNumber\":\"+972501234567\",\"eventType\":\"call_ended\",\"outcome\":\"answered\",\"timestamp\":\"2024-01-15T10:35:00Z\"}"
      }
    }
  ]
}
```

## CDR Document Schema

```typescript
interface CDR {
  callId: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  status: string;
  outcome: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  dtmfInputs: string[];
  actionsTriggered: any[];
  cost: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

## Redis Counters

Dashboard metrics updated in real-time:

- `campaign:{campaignId}:total_attempts` - Total call attempts
- `campaign:{campaignId}:active_calls` - Currently active calls
- `campaign:{campaignId}:answered` - Answered calls
- `campaign:{campaignId}:busy` - Busy outcomes
- `campaign:{campaignId}:failed` - Failed outcomes
- `campaign:{campaignId}:converted` - Converted outcomes
- `campaign:{campaignId}:opted_out` - Opt-out outcomes
- `campaign:{campaignId}:last_activity` - Last activity timestamp

## MongoDB Collections

### call_records
Primary collection for CDR storage:
- Indexed on: `callId` (unique), `campaignId`, `startTime`
- Retention: Configurable (default: 1 year)
- Size: ~1KB per CDR

## Query Functions

### queryCDRs(campaignId, filters)
Retrieve CDRs for a campaign with optional filters:
```typescript
const cdrs = await queryCDRs('campaign-123', {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  outcome: 'answered',
  limit: 1000
});
```

### getCampaignStats(campaignId)
Get aggregate statistics for a campaign:
```typescript
const stats = await getCampaignStats('campaign-123');
// Returns: totalAttempts, answered, answerRate, conversionRate, etc.
```

## Cost Calculation

Simplified cost model (customize for your carrier):
- Base: $0.01 per minute
- Rounded up to nearest minute
- Stored in CDR.cost field

## Performance Considerations

- **Batch Processing**: Processes multiple events in single invocation
- **Upsert Pattern**: Creates or updates CDR atomically
- **Index Strategy**: Compound indexes on campaignId + startTime
- **Connection Pooling**: Reuses MongoDB and Redis connections
- **Async Updates**: Dashboard counters updated asynchronously

## Error Handling

- **MongoDB Failure**: Critical error, throws exception
- **Redis Failure**: Non-critical, logs error but continues
- **Invalid Event**: Logs warning, skips event
- **Duplicate Event**: Idempotent updates, no duplicate CDRs

## Deployment

```bash
# Build Docker image
docker build -t cdr-logger -f src/lambda/cdr-logger/Dockerfile .

# Tag for ECR
docker tag cdr-logger:latest {account}.dkr.ecr.{region}.amazonaws.com/cdr-logger:latest

# Push to ECR
docker push {account}.dkr.ecr.{region}.amazonaws.com/cdr-logger:latest

# Update Lambda function
aws lambda update-function-code \
  --function-name cdr-logger \
  --image-uri {account}.dkr.ecr.{region}.amazonaws.com/cdr-logger:latest
```

## Testing

```bash
# Unit tests
npm test src/lambda/cdr-logger/

# Integration test with SNS
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456789012:call-events \
  --message '{"callId":"test-call","campaignId":"test-campaign","contactId":"test-contact","phoneNumber":"+972501234567","eventType":"call_ended","outcome":"answered","timestamp":"2024-01-15T10:35:00Z"}'

# Query CDRs from MongoDB
mongo campaign_system --eval 'db.call_records.find({campaignId: "test-campaign"}).pretty()'

# Check Redis counters
redis-cli GET campaign:test-campaign:total_attempts
```

## Monitoring

- **CloudWatch Metrics**: Invocations, Errors, Duration, Throttles
- **Custom Metrics**: CDRs written, Events processed, Query latency
- **Logs**: Structured JSON logging with call IDs
- **Alarms**: Error rate > 1%, Duration > 5s, MongoDB connection failures

## Data Retention

Configure MongoDB TTL index for automatic cleanup:
```javascript
db.call_records.createIndex(
  { "createdAt": 1 },
  { expireAfterSeconds: 31536000 } // 1 year
)
```

## Analytics Use Cases

1. **Real-Time Dashboard**: Redis counters provide instant metrics
2. **Campaign Reports**: MongoDB aggregation for detailed reports
3. **Historical Analysis**: Query CDRs by date range and outcome
4. **Cost Tracking**: Sum CDR.cost for billing and budgeting
5. **Performance Optimization**: Analyze answer rates by time of day
6. **Compliance Auditing**: Complete call history with timestamps

## Requirements Validation

- **Requirement 10.1**: Real-time metrics - Updates Redis counters immediately
- **Requirement 10.2**: Outcome tracking - Records all call outcomes
- **Requirement 11.1**: Campaign reports - Stores complete CDR data
- **Property 40**: Dashboard real-time metrics - Updates within 2 seconds
- **Property 41**: Real-time outcome updates - Immediate counter updates
- **Property 44**: Campaign report completeness - All outcomes with timestamps
- **Property 45**: Report metric accuracy - Accurate aggregate calculations

## Related Components

- **Asterisk Worker**: Publishes call events to SNS
- **Analytics Service**: Queries CDRs for reporting
- **Dashboard**: Reads Redis counters for real-time display
- **Report Generator**: Uses getCampaignStats for reports
- **Billing Service**: Uses CDR.cost for invoicing
