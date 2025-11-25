# SMS Reply Handler Lambda

## Overview

The SMS Reply Handler Lambda processes inbound SMS replies from campaign recipients. It captures the response, associates it with the contact record, and stores it in the database for analysis and reporting.

## Responsibilities

- Process inbound SMS webhook from Vonage
- Parse SMS reply payload
- Associate reply with contact record (Property 26)
- Store reply in database
- Update contact metadata with reply information
- Track reply metrics for campaigns

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `REDIS_HOST`: Redis host for caching
- `REDIS_PORT`: Redis port (default: 6379)

## Webhook Configuration

### Vonage Webhook Setup

1. Log in to Vonage Dashboard
2. Navigate to your SMS application
3. Set the Inbound Message Webhook URL to:
   ```
   https://<api-gateway-url>/sms/inbound
   ```
4. Set HTTP Method to `POST`
5. Enable webhook for inbound messages

### Webhook Payload (Vonage)

Vonage sends inbound SMS data as query parameters or JSON body:

```
msisdn=447700900001&to=447700900000&messageId=0A0000001234567&text=Hello&type=text&keyword=HELLO&message-timestamp=2024-01-01T12:00:00.000Z
```

Or as JSON:
```json
{
  "msisdn": "447700900001",
  "to": "447700900000",
  "messageId": "0A0000001234567",
  "text": "Hello",
  "type": "text",
  "keyword": "HELLO",
  "message-timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Response Structure

Success response:
```json
{
  "message": "SMS reply processed successfully",
  "replyId": "reply_123",
  "contactId": "contact_456",
  "campaignId": "campaign_789"
}
```

No contact found:
```json
{
  "message": "SMS received but no matching contact found",
  "phoneNumber": "+1234567890"
}
```

## Database Schema

The handler stores replies in the `sms_replies` table:

```sql
CREATE TABLE sms_replies (
  id VARCHAR(255) PRIMARY KEY,
  contact_id VARCHAR(255) NOT NULL,
  campaign_id VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  reply_text TEXT NOT NULL,
  received_at TIMESTAMP NOT NULL,
  provider_message_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Contact Metadata Update

When a reply is received, the contact's metadata is updated with:
- `lastReply`: The text of the most recent reply
- `lastReplyAt`: Timestamp of the most recent reply
- `hasReplied`: Boolean flag indicating the contact has replied

## Correctness Properties

This Lambda implements the following correctness properties:

- **Property 26**: SMS reply capture and association - Inbound SMS replies are captured and associated with the correct contact record

## Testing

### Unit Tests

Run unit tests:
```bash
npm test src/lambda/sms-reply-handler/
```

### Integration Tests

Test with a sample webhook payload:
```bash
curl -X POST https://<api-gateway-url>/sms/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "msisdn": "+1234567890",
    "to": "+0987654321",
    "messageId": "test123",
    "text": "Yes, I am interested",
    "message-timestamp": "2024-01-01T12:00:00.000Z"
  }'
```

### Local Testing

Use AWS SAM or LocalStack to test locally:
```bash
sam local invoke SMSReplyHandler -e test-events/sms-reply.json
```

## Deployment

Build and deploy the Lambda function:
```bash
# Build Docker image
docker build -t sms-reply-handler -f src/lambda/sms-reply-handler/Dockerfile .

# Tag for ECR
docker tag sms-reply-handler:latest <account-id>.dkr.ecr.<region>.amazonaws.com/sms-reply-handler:latest

# Push to ECR
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/sms-reply-handler:latest

# Update Lambda function
aws lambda update-function-code \
  --function-name sms-reply-handler \
  --image-uri <account-id>.dkr.ecr.<region>.amazonaws.com/sms-reply-handler:latest
```

## API Gateway Integration

Create an API Gateway endpoint for the webhook:

```bash
aws apigatewayv2 create-route \
  --api-id <api-id> \
  --route-key "POST /sms/inbound" \
  --target "integrations/<integration-id>"
```

## Monitoring

Key metrics to monitor:
- Invocation count
- Error rate
- Duration
- Reply association success rate
- Unmatched phone numbers (no contact found)

CloudWatch Logs are automatically captured for debugging.

## Security

- The webhook endpoint should be secured with API keys or IP whitelisting
- Validate webhook signatures from Vonage (if available)
- Rate limit the endpoint to prevent abuse
- Always return 200 status to prevent retries, even on errors

## Troubleshooting

### No contact found for phone number

This can happen if:
- The contact was deleted from the database
- The phone number format doesn't match (E.164 vs local format)
- The reply came from a different number than the one we sent to

Solution: Implement phone number normalization and fuzzy matching.

### Duplicate replies

If Vonage retries the webhook, duplicate replies may be stored. Implement idempotency using `provider_message_id` as a unique constraint.

### High latency

If database queries are slow:
- Ensure indexes are created on `phone_number` column
- Increase Redis cache TTL
- Use connection pooling for PostgreSQL
