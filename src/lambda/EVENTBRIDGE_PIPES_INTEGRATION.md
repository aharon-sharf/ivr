# EventBridge Pipes Integration

## Overview

This document describes how EventBridge Pipes integrates the SQS dial-tasks queue with the Dialer Worker Lambda through the Enrich Dial Task Lambda.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Campaign Execution Flow                          │
└─────────────────────────────────────────────────────────────────────────┘

Step Functions State Machine
    ↓
Dispatcher Lambda
    ↓ (Query eligible contacts)
    ↓ (Push dial tasks to SQS)
    ↓
┌───────────────────────────────────────────────────────────────────────┐
│                         SQS Queue: dial-tasks                          │
│  Message: { campaignId, contactId, phoneNumber, metadata, attempts }  │
└───────────────────────────────────────────────────────────────────────┘
    ↓
    ↓ (EventBridge Pipe polls queue)
    ↓
┌───────────────────────────────────────────────────────────────────────┐
│                        EventBridge Pipe                                │
│  - Batch: 10 messages, 5 second window                                │
│  - Filter: phoneNumber exists                                          │
│  - Enrichment: Enrich Dial Task Lambda                                 │
│  - Target: Dialer Worker Lambda                                        │
└───────────────────────────────────────────────────────────────────────┘
    ↓
    ↓ (Invoke enrichment Lambda)
    ↓
┌───────────────────────────────────────────────────────────────────────┐
│                    Enrich Dial Task Lambda                             │
│  - Fetch campaign config from PostgreSQL                               │
│  - Add IVR flow, audio URLs, settings                                  │
│  - Return enriched messages                                            │
└───────────────────────────────────────────────────────────────────────┘
    ↓
    ↓ (Enriched messages)
    ↓
┌───────────────────────────────────────────────────────────────────────┐
│                      Dialer Worker Lambda                              │
│  - Check Redis CPS rate                                                │
│  - Increment counter if under limit                                    │
│  - Send dial command to Node.js Worker                                 │
│  - Handle rate limit exceeded (retry)                                  │
└───────────────────────────────────────────────────────────────────────┘
    ↓
    ↓ (HTTP POST /dial)
    ↓
┌───────────────────────────────────────────────────────────────────────┐
│                       Node.js Worker (AMI/ARI)                         │
│  - Receive dial command                                                │
│  - Originate call via Asterisk                                         │
│  - Return call status                                                  │
└───────────────────────────────────────────────────────────────────────┘
    ↓
    ↓ (AMI/ARI commands)
    ↓
┌───────────────────────────────────────────────────────────────────────┐
│                          Asterisk Server                               │
│  - Dial phone number via SIP trunk                                     │
│  - Play IVR audio                                                      │
│  - Capture DTMF input                                                  │
│  - Execute actions                                                     │
└───────────────────────────────────────────────────────────────────────┘
```

## Message Flow

### 1. Initial Message (SQS)

```json
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
```

### 2. Enriched Message (After Enrich Lambda)

```json
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
        "nodes": [
          {
            "id": "node-1",
            "type": "play_audio",
            "audioUrl": "https://s3.amazonaws.com/bucket/audio.mp3",
            "nextNodeId": "node-2"
          },
          {
            "id": "node-2",
            "type": "capture_input",
            "timeout": 10,
            "validInputs": ["1", "9"],
            "actions": {
              "1": {
                "type": "trigger_donation",
                "parameters": {}
              },
              "9": {
                "type": "add_to_blacklist",
                "parameters": {}
              }
            }
          }
        ],
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
```

### 3. Dial Command (To Node.js Worker)

```json
{
  "callId": "call-campaign-123-contact-456-1705318245000",
  "phoneNumber": "+972501234567",
  "campaignId": "campaign-123",
  "contactId": "contact-456",
  "audioFileUrl": "https://s3.amazonaws.com/bucket/audio.mp3",
  "ivrFlow": {
    "nodes": [...],
    "startNodeId": "node-1"
  },
  "metadata": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

## Rate Limiting

### Redis-Based CPS Tracking

The Dialer Worker Lambda uses Redis to track calls per second (CPS):

```
Key: cps:1705318245 (unix timestamp in seconds)
Value: 95 (current call count)
TTL: 1 second (auto-expires)
```

### Rate Limiting Algorithm

```typescript
async function checkAndIncrementCPS(): Promise<boolean> {
  const currentSecond = Math.floor(Date.now() / 1000);
  const key = `cps:${currentSecond}`;
  
  // Get current count
  const count = await redis.get(key) || 0;
  
  // Check limit
  if (count >= MAX_CPS) {
    return false; // Rate limit exceeded
  }
  
  // Increment with TTL
  await redis.multi()
    .incr(key)
    .expire(key, 1)
    .exec();
  
  return true; // OK to proceed
}
```

### Adaptive Rate Limiting

The MAX_CPS can be adjusted based on system health:

| System State | CPU Usage | MAX_CPS | Action |
|--------------|-----------|---------|--------|
| Normal       | < 70%     | 100     | Full speed |
| High Load    | 70-85%    | 50      | Reduce pace |
| Critical     | > 85%     | 25      | Minimal pace |

This is implemented by updating the `MAX_CPS` environment variable dynamically.

## Error Handling

### Scenario 1: Rate Limit Exceeded

```
1. Dialer Worker checks Redis: count = 100, MAX_CPS = 100
2. Rate limit exceeded
3. Dialer Worker throws error
4. EventBridge Pipes retries with exponential backoff
5. Message returns to SQS queue
6. After 3 retries, message moves to DLQ
```

### Scenario 2: Campaign Not Found

```
1. Enrich Lambda queries PostgreSQL
2. Campaign not found
3. Enrich Lambda returns null for that message
4. EventBridge Pipes filters out null messages
5. Message is deleted from SQS (not retried)
```

### Scenario 3: Node.js Worker Timeout

```
1. Dialer Worker sends HTTP request to Node.js Worker
2. Request times out after 5 seconds
3. Dialer Worker logs error
4. Marks dial task as failed
5. Continues processing remaining tasks in batch
6. Returns batch result with errors
```

### Scenario 4: Redis Connection Error

```
1. Dialer Worker tries to connect to Redis
2. Connection fails
3. Dialer Worker logs error
4. Fails open - allows call to proceed
5. Rate limiting temporarily disabled
6. CloudWatch alarm triggers
```

## Performance Optimization

### Batching

EventBridge Pipes batches messages to reduce Lambda invocations:

- **Batch Size**: 10 messages
- **Batching Window**: 5 seconds
- **Cost Savings**: 10x fewer Lambda invocations

Example:
- Without batching: 1000 messages = 1000 Lambda invocations
- With batching: 1000 messages = 100 Lambda invocations (10 per batch)

### Connection Pooling

Both Lambda functions reuse connections across invocations:

- **Enrich Lambda**: PostgreSQL connection pool (max 10 connections)
- **Dialer Worker**: Redis client (single connection, reused)

This reduces cold start time and improves performance.

### Filtering

EventBridge Pipes filters messages before invoking Lambda:

```json
{
  "filterCriteria": {
    "filter": {
      "pattern": "{\"phoneNumber\": [{\"exists\": true}]}"
    }
  }
}
```

This skips invalid messages without Lambda invocation, saving cost.

## Monitoring

### CloudWatch Metrics

| Metric | Description | Alarm Threshold |
|--------|-------------|-----------------|
| `PipeExecutionCount` | Pipe executions | N/A |
| `PipeExecutionFailedCount` | Failed executions | > 5% |
| `PipeExecutionThrottledCount` | Throttled executions | > 10 |
| `EnrichLambdaErrors` | Enrich Lambda errors | > 5% |
| `DialerWorkerErrors` | Dialer Worker errors | > 5% |
| `CurrentCPS` | Calls per second | > 90 (warning) |
| `RateLimitedTasks` | Rate limited tasks | > 20% |

### CloudWatch Logs

Each component logs structured JSON:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "component": "dialer-worker",
  "message": "Dial command sent successfully",
  "callId": "call-campaign-123-contact-456-1705318245000",
  "phoneNumber": "+972501234567",
  "campaignId": "campaign-123",
  "contactId": "contact-456"
}
```

### X-Ray Tracing

Enable X-Ray for distributed tracing:

```
EventBridge Pipe → Enrich Lambda → PostgreSQL
                ↓
            Dialer Worker → Redis
                ↓
            Node.js Worker → Asterisk
```

## Cost Analysis

### Without EventBridge Pipes (Custom Polling)

```
Lambda polling SQS:
- 1 Lambda invocation per second (empty receives)
- 86,400 invocations per day
- $0.20 per 1M requests = $0.017/day
- Plus compute time for polling

Total: ~$10-20/month for polling alone
```

### With EventBridge Pipes

```
EventBridge Pipes:
- No polling Lambda needed
- Pay only for processed messages
- $0.40 per 1M messages processed

For 1M messages/month:
- EventBridge Pipes: $0.40
- Lambda invocations (100K batches): $0.02
- Total: $0.42/month

Savings: ~$10-20/month
```

## Deployment

### Prerequisites

1. Deploy Enrich Dial Task Lambda
2. Deploy Dialer Worker Lambda
3. Create SQS dial-tasks queue
4. Deploy EventBridge Pipe (Terraform)

### Terraform Deployment

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### Verify Deployment

```bash
# Check EventBridge Pipe status
aws pipes describe-pipe --name dial-tasks-to-dialer-worker

# Check Lambda functions
aws lambda get-function --function-name enrich-dial-task
aws lambda get-function --function-name dialer-worker

# Check SQS queue
aws sqs get-queue-attributes --queue-url <queue-url>
```

## Testing

### End-to-End Test

1. Push test message to SQS:

```bash
aws sqs send-message \
  --queue-url <queue-url> \
  --message-body '{
    "campaignId": "test-campaign",
    "contactId": "test-contact",
    "phoneNumber": "+972501234567",
    "metadata": {},
    "attempts": 0
  }'
```

2. Monitor CloudWatch Logs:

```bash
# Enrich Lambda logs
aws logs tail /aws/lambda/enrich-dial-task --follow

# Dialer Worker logs
aws logs tail /aws/lambda/dialer-worker --follow
```

3. Check Redis:

```bash
redis-cli
> GET cps:1705318245
"1"
```

4. Verify Node.js Worker received dial command

### Load Test

```bash
# Send 1000 messages to SQS
for i in {1..1000}; do
  aws sqs send-message \
    --queue-url <queue-url> \
    --message-body "{\"campaignId\":\"test\",\"contactId\":\"$i\",\"phoneNumber\":\"+97250123456$i\",\"attempts\":0}"
done

# Monitor CPS rate
watch -n 1 'redis-cli GET cps:$(date +%s)'
```

## Troubleshooting

### Issue: Messages stuck in SQS

**Symptoms**:
- Messages in queue but not processed
- No Lambda invocations

**Causes**:
- EventBridge Pipe disabled
- Lambda function errors
- IAM permissions missing

**Solutions**:
- Check pipe status: `aws pipes describe-pipe`
- Check Lambda logs
- Verify IAM role permissions

### Issue: High rate limiting

**Symptoms**:
- Many messages rate limited
- Low throughput

**Causes**:
- MAX_CPS too low
- Multiple campaigns running
- System overloaded

**Solutions**:
- Increase MAX_CPS
- Pause lower priority campaigns
- Scale up infrastructure

### Issue: Enrichment failures

**Symptoms**:
- Messages filtered out
- Campaign config missing

**Causes**:
- PostgreSQL connection issues
- Campaign not found
- Database query errors

**Solutions**:
- Check PostgreSQL connectivity
- Verify campaign exists
- Check Enrich Lambda logs

## Validation: Requirements 9.1, 9.2, 9.4

This integration validates:

- **Requirement 9.1**: System monitors resources in real-time
  - Redis tracks CPS rate every second
  - CloudWatch metrics updated in real-time
  
- **Requirement 9.2**: System reduces dialing pace when resources exceed thresholds
  - MAX_CPS adjusted based on system health
  - Rate limiting prevents overload
  
- **Requirement 9.4**: Answer rates below threshold trigger pace reduction
  - Adaptive MAX_CPS based on answer rates
  - Automatic pace adjustment
