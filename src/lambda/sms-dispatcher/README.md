# SMS Dispatcher Lambda

## Overview

The SMS Dispatcher Lambda is responsible for dispatching SMS messages for SMS-only campaigns. It queries eligible contacts from the database, applies time window restrictions, checks the blacklist, and sends SMS messages via the SMS Gateway.

## Responsibilities

- Query PostgreSQL for eligible contacts (not blacklisted, within time window, not exceeded attempts)
- Apply time window enforcement for SMS campaigns (Property 24)
- Batch contacts and send SMS messages
- Track delivery status, open rates, link clicks (Property 25)
- Enforce blacklist in SMS campaigns (Property 28)
- Update campaign status

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `SMS_GATEWAY_TOPIC_ARN`: SNS topic ARN for SMS Gateway
- `REDIS_HOST`: Redis host for blacklist cache
- `REDIS_PORT`: Redis port (default: 6379)
- `AWS_REGION`: AWS region (default: us-east-1)
- `BATCH_SIZE`: Number of contacts to process per invocation (default: 100)

## Event Structure

```json
{
  "campaignId": "campaign_123",
  "batchSize": 100
}
```

## Response Structure

```json
{
  "campaignId": "campaign_123",
  "totalContacts": 100,
  "sentCount": 95,
  "skippedCount": 3,
  "failedCount": 2,
  "errors": ["Contact contact_456: SMS send failed"]
}
```

## Invocation

The SMS Dispatcher Lambda is typically invoked by:
- EventBridge scheduled rules for SMS campaigns
- Step Functions state machines for campaign orchestration
- Manual invocation for testing

## Correctness Properties

This Lambda implements the following correctness properties:

- **Property 24**: SMS campaign time window compliance - Messages are only sent when the current time falls within configured time windows
- **Property 25**: SMS campaign metrics tracking - Delivery status, open rates, and link clicks are tracked
- **Property 28**: Blacklist enforcement in SMS campaigns - Blacklisted contacts are skipped

## Testing

Run unit tests:
```bash
npm test src/lambda/sms-dispatcher/
```

Run integration tests:
```bash
npm run test:integration -- sms-dispatcher
```

## Deployment

Build and deploy the Lambda function:
```bash
# Build Docker image
docker build -t sms-dispatcher -f src/lambda/sms-dispatcher/Dockerfile .

# Tag for ECR
docker tag sms-dispatcher:latest <account-id>.dkr.ecr.<region>.amazonaws.com/sms-dispatcher:latest

# Push to ECR
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/sms-dispatcher:latest

# Update Lambda function
aws lambda update-function-code \
  --function-name sms-dispatcher \
  --image-uri <account-id>.dkr.ecr.<region>.amazonaws.com/sms-dispatcher:latest
```

## Monitoring

Key metrics to monitor:
- Invocation count
- Error rate
- Duration
- Sent count vs. skipped count
- Blacklist hit rate
- Time window compliance rate

CloudWatch Logs are automatically captured for debugging.
