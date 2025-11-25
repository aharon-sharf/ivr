# SMS Gateway Lambda

This Lambda function sends SMS messages via Vonage/Local provider. It handles template variable substitution, tracks delivery status, detects SMS capability failures (landline detection), and triggers TTS fallback on failure.

## Responsibilities

- Send SMS messages via Vonage/Local provider
- Implement sendSMS function with template variable substitution
- Track delivery status via webhook
- Detect SMS capability failures (landline detection)
- Trigger TTS fallback on failure

## Requirements Validated

- **5.1**: DTMF-triggered SMS delivery
- **5.2**: SMS delivery status recording
- **5.3**: SMS failure triggers TTS fallback
- **5.4**: SMS template variable substitution
- **7.1**: TTS fallback initiation

## Environment Variables

- `VONAGE_API_KEY`: Vonage API key
- `VONAGE_API_SECRET`: Vonage API secret
- `VONAGE_FROM_NUMBER`: Sender phone number
- `TTS_FALLBACK_TOPIC_ARN`: SNS topic ARN for TTS fallback
- `REDIS_HOST`: Redis host for SMS record tracking
- `REDIS_PORT`: Redis port (default: 6379)
- `AWS_REGION`: AWS region (default: us-east-1)

## Triggers

- **SNS Topic**: `donation-events` - When a recipient triggers an SMS action via DTMF input
- **API Gateway**: Webhook endpoint for SMS delivery status updates from Vonage

## Integration

### Vonage SMS Provider

The function uses the Vonage Server SDK to send SMS messages. Configure your Vonage account:

1. Sign up at https://dashboard.nexmo.com/
2. Get your API key and secret
3. Purchase a phone number for sending SMS
4. Configure webhook URL for delivery receipts

### Template Variables

SMS messages support template variables in the format `{{variable}}`:

```
Hello {{firstName}}, thank you for your support! 
Donate here: {{donationLink}}
```

Variables are substituted before sending:

```json
{
  "phoneNumber": "+972501234567",
  "message": "Hello {{firstName}}, donate here: {{donationLink}}",
  "templateVariables": {
    "firstName": "John",
    "donationLink": "https://example.com/donate/abc123"
  }
}
```

### TTS Fallback

When SMS delivery fails due to:
- Landline detection
- SMS not supported
- Invalid destination
- Network errors

The function automatically publishes a message to the TTS fallback SNS topic, which triggers the TTS service to make a voice call with the same message.

## Deployment

Build and deploy using Docker:

```bash
docker build -t sms-gateway -f src/lambda/sms-gateway/Dockerfile .
docker tag sms-gateway:latest <account-id>.dkr.ecr.<region>.amazonaws.com/sms-gateway:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/sms-gateway:latest
```

Update Lambda function:

```bash
aws lambda update-function-code \
  --function-name sms-gateway \
  --image-uri <account-id>.dkr.ecr.<region>.amazonaws.com/sms-gateway:latest
```

## Testing

Test the function locally:

```bash
npm test -- src/lambda/sms-gateway
```

Test with sample event:

```json
{
  "Records": [
    {
      "Sns": {
        "Message": "{\"phoneNumber\":\"+972501234567\",\"message\":\"Hello {{firstName}}, donate here: {{donationLink}}\",\"campaignId\":\"camp-123\",\"contactId\":\"contact-456\",\"templateVariables\":{\"firstName\":\"John\",\"donationLink\":\"https://example.com/donate\"}}"
      }
    }
  ]
}
```

## Monitoring

- **CloudWatch Logs**: All SMS send attempts and results
- **CloudWatch Metrics**: Custom metrics for SMS sent, failed, TTS fallback triggered
- **Redis**: SMS records stored for 24 hours for tracking and debugging

## Cost Optimization

- SMS messages cost ~$0.01-0.05 per message depending on destination
- Vonage charges per message sent (not per API call)
- TTS fallback is triggered only when SMS fails
- Redis stores SMS records with 24-hour TTL to minimize storage costs
