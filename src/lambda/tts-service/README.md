# TTS Service Lambda

This Lambda function provides Text-to-Speech functionality using Amazon Polly. It supports Hebrew and English voices (neural engine), implements audio caching in S3 (hash text content for cache key), and returns S3 URL for generated audio.

## Responsibilities

- Create function to call Polly synthesizeSpeech API
- Support Hebrew and English voices (neural engine)
- Implement audio caching in S3 (hash text content for cache key)
- Return S3 URL for generated audio

## Requirements Validated

- **7.2**: TTS text-to-speech conversion
- **7.5**: Landline TTS marking

## Environment Variables

- `AWS_REGION`: AWS region (default: us-east-1)
- `S3_AUDIO_BUCKET`: S3 bucket for storing generated audio files
- `CACHE_ENABLED`: Enable/disable audio caching (default: true)

## Features

### Multi-Language Support

The service supports multiple languages with appropriate voices:

- **Hebrew**: Uses Arabic voice 'Zeina' (closest available, as Polly doesn't have native Hebrew yet)
- **English**: Uses neural voice 'Joanna' (female) or 'Matthew' (male)
- **Arabic**: Uses neural voice 'Zeina'

### Audio Caching

To minimize costs and improve performance, the service implements intelligent caching:

1. **Hash Generation**: Text content + voice settings → SHA-256 hash
2. **Cache Check**: Check if audio file exists in S3 with this hash
3. **Cache Hit**: Return existing S3 URL (no Polly call)
4. **Cache Miss**: Call Polly, upload to S3, return new URL

Cache keys include:
- Text content
- Voice ID
- Language code
- Engine (standard/neural)
- Output format
- Sample rate

This ensures different voice settings generate separate cached files.

### Audio Quality

- **Storage**: 24kHz sample rate, MP3 format (high quality)
- **Telephony**: Audio is downsampled to 8kHz when used in calls
- **Neural Engine**: Uses Polly's neural engine for more natural-sounding speech

## API

### Request Format

```json
{
  "text": "Hello, thank you for your support. Please visit our website to donate.",
  "language": "english",
  "voiceId": "Joanna",
  "engine": "neural",
  "outputFormat": "mp3",
  "sampleRate": "24000"
}
```

### Response Format

```json
{
  "url": "https://campaign-audio-files.s3.us-east-1.amazonaws.com/tts-generated/abc123...xyz.mp3",
  "duration": 8,
  "format": "mp3",
  "textHash": "abc123...xyz",
  "cached": false
}
```

### Supported Voices

**English (Neural)**:
- `Joanna` (Female, US)
- `Matthew` (Male, US)
- `Salli` (Female, US)
- `Kendra` (Female, US)
- `Kimberly` (Female, US)
- `Ivy` (Female, US, child)
- `Joey` (Male, US)
- `Justin` (Male, US, child)
- `Kevin` (Male, US, child)

**Arabic (Neural)**:
- `Zeina` (Female, Arabic)

**Hebrew**:
- Currently using Arabic voice as closest alternative
- Native Hebrew voice expected in future Polly updates

## Integration

### Direct Invocation

```typescript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: 'us-east-1' });

const command = new InvokeCommand({
  FunctionName: 'tts-service',
  Payload: JSON.stringify({
    text: 'Hello world',
    language: 'english',
  }),
});

const response = await lambda.send(command);
const result = JSON.parse(Buffer.from(response.Payload).toString());
console.log('Audio URL:', result.url);
```

### SNS Trigger

The function can be triggered by SNS events (e.g., from SMS Gateway when TTS fallback is needed):

```json
{
  "Records": [
    {
      "Sns": {
        "Message": "{\"text\":\"Your donation link: https://example.com\",\"language\":\"english\"}"
      }
    }
  ]
}
```

### API Gateway

The function can be exposed via API Gateway for direct HTTP access:

```bash
curl -X POST https://api.example.com/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","language":"english"}'
```

## Cost Optimization

### Polly Pricing

- **Neural TTS**: $16 per 1M characters
- **Standard TTS**: $4 per 1M characters
- **Example**: 100-character message = $0.0016 (neural) or $0.0004 (standard)

### Caching Benefits

With caching enabled:
- First request: Polly API call + S3 upload
- Subsequent requests: S3 HEAD request only (free)
- **Savings**: 99%+ cost reduction for repeated messages

### Best Practices

1. **Pre-generate common messages**: Use batch synthesis for frequently used texts
2. **Reuse audio files**: Store campaign audio URLs in database
3. **Cache TTL**: S3 objects have 1-year cache control header
4. **Monitor usage**: Track cache hit rate in CloudWatch

## Deployment

Build and deploy using Docker:

```bash
docker build -t tts-service -f src/lambda/tts-service/Dockerfile .
docker tag tts-service:latest <account-id>.dkr.ecr.<region>.amazonaws.com/tts-service:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/tts-service:latest
```

Update Lambda function:

```bash
aws lambda update-function-code \
  --function-name tts-service \
  --image-uri <account-id>.dkr.ecr.<region>.amazonaws.com/tts-service:latest
```

## Testing

Test the function locally:

```bash
npm test -- src/lambda/tts-service
```

Test with sample event:

```json
{
  "text": "Hello, this is a test message for text-to-speech conversion.",
  "language": "english",
  "engine": "neural"
}
```

## Monitoring

- **CloudWatch Logs**: All synthesis requests and cache hits/misses
- **CloudWatch Metrics**: 
  - Custom metric: `TTSCacheHitRate`
  - Custom metric: `TTSCharactersProcessed`
  - Custom metric: `TTSSynthesisLatency`
- **S3 Metrics**: Storage used, request count

## Limitations

- **Text Length**: Polly supports up to 3,000 characters per request
- **Rate Limits**: Polly has default limit of 100 transactions per second
- **Hebrew Support**: Currently using Arabic voice as workaround
- **Cold Start**: First invocation may take 2-3 seconds

## Future Enhancements

- Support for SSML (Speech Synthesis Markup Language) for advanced control
- Voice customization (speed, pitch, volume)
- Multi-voice conversations (different voices for different parts)
- Real-time streaming synthesis for long texts
- Integration with Amazon Transcribe for voice verification
