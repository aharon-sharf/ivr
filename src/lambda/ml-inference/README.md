# ML Inference Lambda

This Lambda function provides machine learning-based predictions for optimal call times. It integrates with AWS SageMaker Serverless Inference endpoints and uses Redis for caching predictions.

## Features

- **SageMaker Integration**: Calls SageMaker Serverless Inference endpoint for predictions
- **Redis Caching**: Caches predictions for 7 days to reduce inference costs
- **Fallback Logic**: Uses default population patterns when ML is unavailable
- **Batch Processing**: Supports batch predictions for multiple contacts

## Environment Variables

- `AWS_REGION`: AWS region for SageMaker (default: us-east-1)
- `SAGEMAKER_ENDPOINT_NAME`: Name of the SageMaker Serverless Inference endpoint
- `REDIS_HOST`: Redis host for caching predictions
- `REDIS_PORT`: Redis port (default: 6379)

## Input Format

```json
{
  "contacts": [
    {
      "id": "contact_123",
      "phoneNumber": "+972501234567",
      "timezone": "Asia/Jerusalem",
      "metadata": {
        "name": "John Doe",
        "age": 35
      }
    }
  ]
}
```

## Output Format

```json
{
  "predictions": [
    {
      "contactId": "contact_123",
      "optimalCallTime": {
        "preferredDayOfWeek": [1, 2, 3, 4, 5],
        "preferredHourRange": {
          "start": 10,
          "end": 18
        },
        "confidence": 0.85
      },
      "cached": false
    }
  ],
  "errors": []
}
```

## SageMaker Endpoint Requirements

The SageMaker endpoint should accept the following input format:

```json
{
  "phoneNumber": "+972501234567",
  "timezone": "Asia/Jerusalem",
  "metadata": {}
}
```

And return:

```json
{
  "preferredDayOfWeek": [1, 2, 3, 4, 5],
  "preferredHourRange": {
    "start": 10,
    "end": 18
  },
  "confidence": 0.85
}
```

## Fallback Behavior

When the SageMaker endpoint is unavailable or returns an error, the Lambda falls back to default patterns:

- **Weekdays**: Monday to Friday (1-5)
- **Hours**: 10 AM to 6 PM (adjusted for timezone)
- **Confidence**: 0.5 (low confidence for default pattern)

## Caching Strategy

Predictions are cached in Redis with a 7-day TTL using the key format:
```
ml:prediction:{phoneNumber}
```

This reduces SageMaker inference costs and improves response times for repeated predictions.

## Deployment

Build and deploy using Docker:

```bash
# Build Docker image
docker build -t ml-inference-lambda -f src/lambda/ml-inference/Dockerfile .

# Tag for ECR
docker tag ml-inference-lambda:latest {account}.dkr.ecr.{region}.amazonaws.com/ml-inference-lambda:latest

# Push to ECR
docker push {account}.dkr.ecr.{region}.amazonaws.com/ml-inference-lambda:latest

# Update Lambda function
aws lambda update-function-code \
  --function-name ml-inference-lambda \
  --image-uri {account}.dkr.ecr.{region}.amazonaws.com/ml-inference-lambda:latest
```

## Testing

```bash
# Invoke Lambda locally
aws lambda invoke \
  --function-name ml-inference-lambda \
  --payload '{"contacts":[{"id":"test","phoneNumber":"+972501234567"}]}' \
  response.json

# Check response
cat response.json
```

## Cost Optimization

- **Caching**: 7-day cache reduces repeated inference calls
- **Serverless Inference**: Pay only for actual inference time
- **Fallback**: Avoids unnecessary SageMaker calls when endpoint is unavailable

## Requirements Validation

This Lambda implements:
- **Property 32**: ML prediction completeness (Requirements 8.2, 8.4)
- Generates predictions for all contacts
- Falls back to default patterns when insufficient data
