# Donation Handler Lambda

## Overview

This Lambda function handles donation events triggered by DTMF input (Press 1) during IVR interactions. It orchestrates the donation flow by sending SMS messages with personalized donation links, handling SMS failures with TTS fallback, and recording all actions in the database.

## Responsibilities

- Process donation-events SNS topic messages
- Generate personalized donation links with tracking parameters
- Trigger SMS sending with donation link via SMS Gateway
- Handle SMS failure and coordinate TTS fallback
- Record donation actions in Redis and database
- Update campaign metrics counters

## Event Flow

1. **Trigger**: SNS donation-events topic receives message when user presses 1 in IVR
2. **Link Generation**: Creates personalized donation link with tracking parameters
3. **SMS Sending**: Publishes SMS request to SMS Gateway topic
4. **Action Recording**: Stores donation action in Redis and database
5. **Metrics Update**: Increments campaign donation counter
6. **Fallback**: SMS Gateway handles TTS fallback if SMS fails

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SMS_GATEWAY_TOPIC_ARN` | ARN of SNS topic for SMS Gateway | Yes |
| `REDIS_HOST` | Redis host for caching and counters | Yes |
| `REDIS_PORT` | Redis port (default: 6379) | No |
| `AWS_REGION` | AWS region (default: us-east-1) | No |
| `DONATION_LINK_BASE_URL` | Base URL for donation links | Yes |
| `DATABASE_API_URL` | API endpoint for database persistence | No |

## Input Event Format

```json
{
  "Records": [
    {
      "Sns": {
        "Message": "{\"callId\":\"call-123\",\"campaignId\":\"campaign-456\",\"contactId\":\"contact-789\",\"phoneNumber\":\"+972501234567\",\"dtmfInput\":\"1\",\"timestamp\":\"2024-01-15T10:30:00Z\",\"metadata\":{\"campaignName\":\"Winter Campaign\"}}"
      }
    }
  ]
}
```

## Donation Action Record

```typescript
interface DonationAction {
  id: string;
  callId: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  actionType: 'donation_sms_sent' | 'donation_sms_failed' | 'donation_tts_fallback';
  donationLink: string;
  smsMessageId?: string;
  ttsFallbackTriggered: boolean;
  timestamp: Date;
  status: 'success' | 'failed';
  failureReason?: string;
}
```

## Redis Keys

- `donation_action:{actionId}` - Donation action record (24h TTL)
- `campaign:{campaignId}:donations` - Campaign donation counter

## Error Handling

- **SMS Failure**: Records failed action, SMS Gateway handles TTS fallback
- **Database Failure**: Non-critical, continues with Redis storage
- **Redis Failure**: Logs error but doesn't block execution
- **Link Generation**: Always succeeds with base64 encoded tracking

## Deployment

```bash
# Build Docker image
docker build -t donation-handler -f src/lambda/donation-handler/Dockerfile .

# Tag for ECR
docker tag donation-handler:latest {account}.dkr.ecr.{region}.amazonaws.com/donation-handler:latest

# Push to ECR
docker push {account}.dkr.ecr.{region}.amazonaws.com/donation-handler:latest

# Update Lambda function
aws lambda update-function-code \
  --function-name donation-handler \
  --image-uri {account}.dkr.ecr.{region}.amazonaws.com/donation-handler:latest
```

## Testing

```bash
# Unit tests
npm test src/lambda/donation-handler/

# Integration test with SNS
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456789012:donation-events \
  --message '{"callId":"test-call","campaignId":"test-campaign","contactId":"test-contact","phoneNumber":"+972501234567","dtmfInput":"1"}'
```

## Monitoring

- **CloudWatch Metrics**: Invocations, Errors, Duration
- **Custom Metrics**: Donation actions created, SMS sent, Failures
- **Logs**: Structured JSON logging with correlation IDs
- **Alarms**: Error rate > 5%, Duration > 10s

## Requirements Validation

- **Requirement 4.2**: DTMF action execution - Processes press 1 donation trigger
- **Requirement 5.1**: SMS delivery - Sends SMS with donation link
- **Property 15**: DTMF action execution - Executes donation action exactly once
- **Property 19**: DTMF-triggered SMS delivery - Sends SMS when triggered by DTMF

## Related Components

- **SMS Gateway Lambda**: Handles actual SMS sending and TTS fallback
- **TTS Fallback Lambda**: Initiates voice call if SMS fails
- **IVR Engine**: Triggers donation event when user presses 1
- **Analytics Service**: Tracks donation conversion metrics
