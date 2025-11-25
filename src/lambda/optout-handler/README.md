# Opt-Out Handler Lambda

## Overview

This Lambda function handles opt-out events triggered by DTMF input (Press 9) during IVR interactions. It immediately adds phone numbers to the blacklist, updates Redis cache for fast lookups, and terminates active calls to ensure compliance with Do-Not-Call regulations.

## Responsibilities

- Process optout-events SNS topic messages
- Add phone number to blacklist database with timestamp
- Update Redis cache for fast blacklist lookups
- Terminate active call gracefully
- Record opt-out actions for audit trail
- Update campaign opt-out metrics

## Event Flow

1. **Trigger**: SNS optout-events topic receives message when user presses 9 in IVR
2. **Blacklist Addition**: Adds phone number to database blacklist table
3. **Cache Update**: Updates Redis blacklist set for fast pre-dial checks
4. **Call Termination**: Sends termination request to Asterisk Worker
5. **Action Recording**: Stores opt-out action in Redis and database
6. **Metrics Update**: Increments campaign opt-out counter

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REDIS_HOST` | Redis host for blacklist cache | Yes |
| `REDIS_PORT` | Redis port (default: 6379) | No |
| `DATABASE_API_URL` | API endpoint for database operations | Yes |
| `ASTERISK_WORKER_URL` | URL of Asterisk Worker for call termination | Yes |

## Input Event Format

```json
{
  "Records": [
    {
      "Sns": {
        "Message": "{\"callId\":\"call-123\",\"campaignId\":\"campaign-456\",\"contactId\":\"contact-789\",\"phoneNumber\":\"+972501234567\",\"dtmfInput\":\"9\",\"timestamp\":\"2024-01-15T10:30:00Z\"}"
      }
    }
  ]
}
```

## Blacklist Entry Format

```typescript
interface BlacklistEntry {
  phoneNumber: string;
  addedAt: Date;
  reason: string;
  source: 'user_optout' | 'admin_import' | 'compliance';
  metadata?: {
    callId: string;
    campaignId: string;
    contactId: string;
    timestamp: string;
  };
}
```

## Redis Keys

- `blacklist:numbers` - Set of all blacklisted phone numbers (permanent)
- `blacklist:{phoneNumber}` - Detailed blacklist entry (permanent)
- `optout_action:{actionId}` - Opt-out action record (24h TTL)
- `campaign:{campaignId}:optouts` - Campaign opt-out counter

## Blacklist Enforcement

Once a phone number is added to the blacklist:

1. **Immediate Effect**: Redis cache updated instantly
2. **Pre-Dial Check**: All future dial attempts check Redis blacklist set
3. **Permanent Storage**: Database entry persists indefinitely
4. **Active Campaign**: Number excluded from all active and future campaigns
5. **Audit Trail**: Complete history of opt-out with timestamp and reason

## Error Handling

- **Database Failure**: Critical error, throws exception
- **Redis Failure**: Non-critical, continues if database succeeded
- **Call Termination Failure**: Non-critical, call may have ended naturally
- **Action Recording Failure**: Non-critical, logs error but continues

## Deployment

```bash
# Build Docker image
docker build -t optout-handler -f src/lambda/optout-handler/Dockerfile .

# Tag for ECR
docker tag optout-handler:latest {account}.dkr.ecr.{region}.amazonaws.com/optout-handler:latest

# Push to ECR
docker push {account}.dkr.ecr.{region}.amazonaws.com/optout-handler:latest

# Update Lambda function
aws lambda update-function-code \
  --function-name optout-handler \
  --image-uri {account}.dkr.ecr.{region}.amazonaws.com/optout-handler:latest
```

## Testing

```bash
# Unit tests
npm test src/lambda/optout-handler/

# Integration test with SNS
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456789012:optout-events \
  --message '{"callId":"test-call","campaignId":"test-campaign","contactId":"test-contact","phoneNumber":"+972501234567","dtmfInput":"9"}'

# Verify blacklist entry
redis-cli SISMEMBER blacklist:numbers "+972501234567"
```

## Monitoring

- **CloudWatch Metrics**: Invocations, Errors, Duration
- **Custom Metrics**: Opt-outs processed, Blacklist additions, Call terminations
- **Logs**: Structured JSON logging with phone numbers (masked in production)
- **Alarms**: Error rate > 1%, Duration > 5s

## Compliance

This Lambda is critical for TCPA compliance:

- **Immediate Opt-Out**: Processes opt-out requests within seconds
- **Permanent Blacklist**: Never contacts opted-out numbers again
- **Audit Trail**: Complete history for compliance reporting
- **Call Termination**: Stops communication immediately upon request

## Requirements Validation

- **Requirement 3.3**: DTMF opt-out - Adds number to blacklist when user presses 9
- **Requirement 4.3**: Call termination - Terminates call after opt-out
- **Property 12**: DTMF opt-out immediate effect - Immediate blacklist and termination
- **Property 14**: Blacklist persistence - Permanent storage with timestamp

## Related Components

- **IVR Engine**: Triggers opt-out event when user presses 9
- **Asterisk Worker**: Terminates active calls
- **Dispatcher Lambda**: Checks blacklist before dialing
- **API Handler**: Provides blacklist management endpoints
- **Analytics Service**: Tracks opt-out rates and trends
