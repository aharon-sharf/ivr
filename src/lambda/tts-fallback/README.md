# TTS Fallback Lambda

This Lambda function handles TTS fallback when SMS delivery fails. It triggers TTS call when SMS fails, calls Polly to generate speech, sends dial command to Node.js Worker with TTS audio URL, and tracks TTS fallback outcome.

## Responsibilities

- Trigger TTS call when SMS fails
- Call Polly to generate speech via TTS Service Lambda
- Send dial command to Node.js Worker with TTS audio URL
- Track TTS fallback outcome

## Requirements Validated

- **7.1**: TTS fallback initiation when SMS fails
- **7.4**: TTS fallback outcome recording

## Environment Variables

- `AWS_REGION`: AWS region (default: us-east-1)
- `TTS_SERVICE_FUNCTION`: Name of TTS Service Lambda function
- `NODE_WORKER_URL`: URL of Node.js Worker for Asterisk control
- `REDIS_HOST`: Redis host for tracking TTS fallback records
- `REDIS_PORT`: Redis port (default: 6379)

## Architecture

```
SMS Gateway (SMS fails)
    ↓
SNS Topic (tts-fallback-topic)
    ↓
TTS Fallback Lambda
    ↓
    ├─→ TTS Service Lambda (generate audio)
    │       ↓
    │   Amazon Polly → S3 (audio file)
    │       ↓
    │   Return audio URL
    ↓
Node.js Worker (initiate call with TTS audio)
    ↓
Asterisk (make call, play TTS audio)
    ↓
Redis (store outcome: "TTS Fallback Delivered" or "TTS Fallback Failed")
```

## Flow

1. **SMS Failure Detection**: SMS Gateway detects SMS delivery failure (landline, not supported, etc.)
2. **SNS Trigger**: SMS Gateway publishes message to TTS fallback SNS topic
3. **TTS Fallback Lambda Invoked**: This Lambda receives SNS event
4. **Generate Speech**: Invokes TTS Service Lambda to convert text to audio
5. **Audio Caching**: TTS Service checks cache, generates if needed, uploads to S3
6. **Initiate Call**: Sends dial command to Node.js Worker with TTS audio URL
7. **Track Outcome**: Stores outcome in Redis ("TTS Fallback Delivered" or "TTS Fallback Failed")

## SNS Message Format

The SMS Gateway publishes messages in this format:

```json
{
  "phoneNumber": "+972501234567",
  "text": "Hello John, thank you for your support. Visit https://example.com/donate to contribute.",
  "campaignId": "camp-123",
  "contactId": "contact-456",
  "smsFailureReason": "Landline detected - SMS not supported",
  "language": "english"
}
```

## TTS Fallback Record

The function stores a record in Redis for each TTS fallback attempt:

```json
{
  "id": "camp-123-contact-456-1234567890",
  "campaignId": "camp-123",
  "contactId": "contact-456",
  "phoneNumber": "+972501234567",
  "text": "Hello John, thank you for your support...",
  "audioUrl": "https://bucket.s3.amazonaws.com/tts-generated/abc123.mp3",
  "outcome": "TTS Fallback Delivered",
  "smsFailureReason": "Landline detected - SMS not supported",
  "initiatedAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:30:05Z"
}
```

## Outcomes

The function tracks two possible outcomes:

1. **TTS Fallback Delivered**: 
   - Speech audio generated successfully
   - Dial command sent to Node.js Worker successfully
   - Call initiated (actual delivery tracked separately by call records)

2. **TTS Fallback Failed**:
   - Speech generation failed (Polly error, S3 error)
   - Dial command failed (Node.js Worker unreachable, network error)
   - Any other error in the process

## Integration with TTS Service

The function invokes the TTS Service Lambda synchronously:

```typescript
const lambda = new LambdaClient({ region: 'us-east-1' });

const command = new InvokeCommand({
  FunctionName: 'tts-service',
  Payload: JSON.stringify({
    text: 'Hello world',
    language: 'english',
    engine: 'neural',
    outputFormat: 'mp3',
    sampleRate: '8000', // 8kHz for telephony
  }),
});

const response = await lambda.send(command);
const result = JSON.parse(Buffer.from(response.Payload).toString());
// result.url = S3 URL of generated audio
```

## Integration with Node.js Worker

The function sends a dial command to the Node.js Worker:

```typescript
const dialCommand = {
  callId: 'tts-fallback-camp-123-contact-456-1234567890',
  phoneNumber: '+972501234567',
  campaignId: 'camp-123',
  contactId: 'contact-456',
  audioFileUrl: 'https://bucket.s3.amazonaws.com/tts-generated/abc123.mp3',
  isTTSFallback: true,
  metadata: {
    smsFailureReason: 'Landline detected',
    originalText: 'Hello John...',
  },
};

await axios.post('http://node-worker:3000/dial', dialCommand);
```

The Node.js Worker then:
1. Generates Asterisk call file or uses AMI/ARI
2. Asterisk dials the number
3. On answer, plays the TTS audio from S3 URL
4. Tracks call outcome

## Error Handling

The function implements comprehensive error handling:

1. **TTS Service Errors**: If speech generation fails, outcome is "TTS Fallback Failed"
2. **Network Errors**: If Node.js Worker is unreachable, outcome is "TTS Fallback Failed"
3. **Partial Failures**: Audio generated but call failed → Still recorded as "TTS Fallback Failed"
4. **Redis Errors**: Non-critical, logged but doesn't fail the function

## Monitoring

- **CloudWatch Logs**: All TTS fallback attempts, successes, and failures
- **CloudWatch Metrics**:
  - Custom metric: `TTSFallbackAttempts`
  - Custom metric: `TTSFallbackSuccessRate`
  - Custom metric: `TTSFallbackLatency`
- **Redis**: TTS fallback records stored for 24 hours

## Cost Optimization

- **TTS Caching**: Repeated messages use cached audio (no Polly cost)
- **Async Processing**: SNS trigger allows SMS Gateway to continue without waiting
- **Batch Processing**: Multiple TTS fallbacks can be processed in parallel
- **8kHz Audio**: Lower sample rate reduces S3 storage and bandwidth costs

## Deployment

Build and deploy using Docker:

```bash
docker build -t tts-fallback -f src/lambda/tts-fallback/Dockerfile .
docker tag tts-fallback:latest <account-id>.dkr.ecr.<region>.amazonaws.com/tts-fallback:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/tts-fallback:latest
```

Update Lambda function:

```bash
aws lambda update-function-code \
  --function-name tts-fallback \
  --image-uri <account-id>.dkr.ecr.<region>.amazonaws.com/tts-fallback:latest
```

## Testing

Test the function locally:

```bash
npm test -- src/lambda/tts-fallback
```

Test with sample SNS event:

```json
{
  "Records": [
    {
      "Sns": {
        "Message": "{\"phoneNumber\":\"+972501234567\",\"text\":\"Hello, thank you for your support. Visit our website to donate.\",\"campaignId\":\"camp-123\",\"contactId\":\"contact-456\",\"smsFailureReason\":\"Landline detected\",\"language\":\"english\"}"
      }
    }
  ]
}
```

## Performance

- **Cold Start**: 2-3 seconds (includes Lambda initialization)
- **Warm Execution**: 
  - TTS Service invocation: 1-2 seconds (cached) or 3-5 seconds (new audio)
  - Dial command: 100-200ms
  - Total: 1-5 seconds depending on cache hit
- **Concurrency**: Can process multiple TTS fallbacks in parallel

## Best Practices

1. **Pre-generate Common Messages**: Use TTS Service batch synthesis for frequently used texts
2. **Monitor Failure Rate**: High TTS fallback rate may indicate SMS provider issues
3. **Optimize Text Length**: Shorter messages = faster synthesis and lower cost
4. **Use Appropriate Voice**: Match voice to campaign language and audience
5. **Track Outcomes**: Monitor "TTS Fallback Delivered" vs "TTS Fallback Failed" ratio
