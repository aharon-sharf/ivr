# Dialer Worker Lambda

## Overview

This Lambda function processes batches of enriched dial tasks from EventBridge Pipes. It implements rate limiting using Redis and sends dial commands to the Node.js Worker that controls Asterisk.

## Responsibilities

- Process batch of dial tasks from EventBridge Pipe
- Check Redis for current CPS (calls per second) rate
- Increment Redis counter (1-second TTL) if under limit
- Send dial command to Node.js Worker via HTTP
- Handle rate limit exceeded (return for retry)

## Architecture

```
EventBridge Pipe
    ↓ (Batch of 10 enriched dial tasks)
    ↓
Dialer Worker Lambda
    ↓
    ├─→ Redis (Check CPS rate)
    │   ├─→ Under limit: Increment counter
    │   └─→ Over limit: Throw error for retry
    │
    └─→ Node.js Worker (Send dial command)
        └─→ Asterisk (Originate call)
```

## Input

EventBridge Pipes passes an array of enriched dial tasks:

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
        "callingWindows": [...],
        "maxConcurrentCalls": 100
      },
      "timezone": "Asia/Jerusalem"
    },
    "enrichedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

## Output

Returns batch processing result:

```json
{
  "totalProcessed": 10,
  "successful": 8,
  "failed": 1,
  "rateLimited": 1,
  "errors": [
    {
      "contactId": "contact-789",
      "phoneNumber": "+972501234568",
      "error": "Node.js Worker timeout"
    }
  ]
}
```

## Rate Limiting

### Redis-Based CPS Limiting

The function uses Redis to implement calls-per-second (CPS) rate limiting:

1. **Key Format**: `cps:{unix_timestamp_seconds}`
2. **TTL**: 1 second (auto-expires)
3. **Algorithm**:
   - Get current second timestamp
   - Check counter for current second
   - If counter < MAX_CPS, increment and proceed
   - If counter >= MAX_CPS, throw error for retry

### Example

```
Time: 10:30:45
Key: cps:1705318245
Value: 95
MAX_CPS: 100

Action: Increment to 96, allow call
```

```
Time: 10:30:45
Key: cps:1705318245
Value: 100
MAX_CPS: 100

Action: Throw error, EventBridge Pipes will retry
```

### Adaptive Rate Limiting

The MAX_CPS can be adjusted dynamically based on system health:

- **Normal**: 100 CPS
- **High Load**: 50 CPS (CPU > 80%)
- **Critical**: 25 CPS (CPU > 90%)

This is configured via environment variable `MAX_CPS`.

## Node.js Worker Integration

### Dial Command Format

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

### HTTP Request

```bash
POST http://node-worker:3000/dial
Content-Type: application/json

{
  "callId": "...",
  "phoneNumber": "...",
  ...
}
```

### Response

```json
{
  "success": true,
  "callId": "call-campaign-123-contact-456-1705318245000",
  "status": "dialing"
}
```

## Environment Variables

- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `NODE_WORKER_URL` - Node.js Worker URL (default: http://localhost:3000)
- `MAX_CPS` - Maximum calls per second (default: 100)

## Error Handling

### Rate Limit Exceeded

When rate limit is exceeded:

1. Function throws error
2. EventBridge Pipes retries with exponential backoff
3. Message returns to SQS queue
4. After 3 retries, message moves to dead letter queue

### Node.js Worker Timeout

When Node.js Worker doesn't respond:

1. Function logs error
2. Marks dial task as failed
3. Continues processing remaining tasks in batch
4. Returns batch result with errors

### Redis Connection Error

When Redis is unavailable:

1. Function logs error
2. **Fails open** - allows call to proceed
3. Rate limiting is temporarily disabled
4. CloudWatch alarm triggers for Redis connectivity

## Performance

- **Memory**: 256 MB
- **Timeout**: 15 seconds
- **Concurrency**: 1000 (for high burst capacity)
- **Batch Size**: 10 messages per invocation
- **Redis Connection**: Reused across invocations (warm start)

## Monitoring

### CloudWatch Metrics

- `Invocations` - Number of times function is invoked
- `Errors` - Number of errors
- `Duration` - Execution time
- `Throttles` - Number of throttled invocations
- `ConcurrentExecutions` - Number of concurrent executions

### Custom Metrics

- `DialTasksProcessed` - Total dial tasks processed
- `DialTasksSuccessful` - Successful dial commands
- `DialTasksFailed` - Failed dial commands
- `DialTasksRateLimited` - Rate limited dial tasks
- `CurrentCPS` - Current calls per second

### CloudWatch Logs

- Batch processing start/end
- CPS rate checks
- Dial command success/failure
- Rate limit exceeded warnings
- Node.js Worker errors

## Alarms

### Critical Alarms

- **High Error Rate**: Errors > 5% of invocations
- **Redis Unavailable**: Redis connection errors > 10 in 5 minutes
- **Node.js Worker Down**: HTTP errors > 50% of requests

### Warning Alarms

- **High Rate Limiting**: Rate limited tasks > 20% of total
- **Slow Processing**: Duration > 10 seconds
- **High Concurrency**: Concurrent executions > 800

## Deployment

Build and deploy using Docker:

```bash
cd src/lambda/dialer-worker
docker build -t dialer-worker .
docker tag dialer-worker:latest <account-id>.dkr.ecr.<region>.amazonaws.com/dialer-worker:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/dialer-worker:latest
```

Update Lambda function:

```bash
aws lambda update-function-code \
  --function-name dialer-worker \
  --image-uri <account-id>.dkr.ecr.<region>.amazonaws.com/dialer-worker:latest
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

Test with Redis and Node.js Worker:

```bash
docker-compose up -d redis node-worker
npm run test:integration
```

### Load Tests

Test rate limiting with high volume:

```bash
npm run test:load
```

## Validation: Requirements 9.1, 9.2, 9.4

This Lambda validates:

- **Requirement 9.1**: System monitors resources in real-time (via Redis CPS tracking)
- **Requirement 9.2**: System reduces dialing pace when resources exceed thresholds (via MAX_CPS adjustment)
- **Requirement 9.4**: Answer rates below threshold trigger pace reduction (via adaptive MAX_CPS)

## Troubleshooting

### High Rate Limiting

**Symptom**: Many dial tasks are rate limited

**Causes**:
- MAX_CPS too low for campaign volume
- Multiple campaigns running concurrently
- System health degraded

**Solutions**:
- Increase MAX_CPS environment variable
- Pause lower priority campaigns
- Scale up Asterisk instance

### Node.js Worker Timeouts

**Symptom**: Many dial commands fail with timeout

**Causes**:
- Node.js Worker overloaded
- Asterisk not responding
- Network issues

**Solutions**:
- Scale up Node.js Worker
- Check Asterisk health
- Increase timeout value

### Redis Connection Errors

**Symptom**: Redis connection errors in logs

**Causes**:
- Redis instance down
- Network connectivity issues
- Redis max connections reached

**Solutions**:
- Check Redis instance health
- Verify security group rules
- Increase Redis max connections
