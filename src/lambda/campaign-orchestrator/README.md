# Campaign Orchestrator Lambda

## Overview

The Campaign Orchestrator Lambda manages concurrent campaign execution, ensuring that SMS and voice campaigns run independently without resource conflicts. It routes campaigns to appropriate dispatchers and monitors resource utilization.

## Responsibilities

- Manage concurrent campaign execution
- Ensure SMS and voice campaigns run independently (Property 27)
- Prevent resource conflicts between campaign types
- Route campaigns to appropriate dispatchers (SMS or Voice)
- Monitor campaign progress and resource utilization
- Enforce concurrency limits for each campaign type

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `VOICE_CAMPAIGN_STATE_MACHINE_ARN`: ARN of the Step Functions state machine for voice campaigns
- `SMS_DISPATCHER_FUNCTION_NAME`: Name of the SMS Dispatcher Lambda function
- `REDIS_HOST`: Redis host for resource tracking
- `REDIS_PORT`: Redis port (default: 6379)
- `AWS_REGION`: AWS region (default: us-east-1)
- `MAX_CONCURRENT_VOICE_CAMPAIGNS`: Maximum number of concurrent voice campaigns (default: 5)
- `MAX_CONCURRENT_SMS_CAMPAIGNS`: Maximum number of concurrent SMS campaigns (default: 10)

## Event Structure

```json
{
  "campaignId": "campaign_123",
  "action": "start"
}
```

Actions:
- `start`: Start campaign execution
- `pause`: Pause active campaign
- `resume`: Resume paused campaign
- `stop`: Stop campaign and clean up resources

## Response Structure

```json
{
  "campaignId": "campaign_123",
  "campaignType": "sms",
  "action": "start",
  "success": true,
  "executionArn": "arn:aws:states:...",
  "message": "Campaign started successfully"
}
```

## Campaign Type Routing

### Voice Campaigns
- Routed to Step Functions state machine
- Uses `VOICE_CAMPAIGN_STATE_MACHINE_ARN`
- Orchestrates: Validation → Dispatch → Monitor → Report
- Supports concurrent execution up to `MAX_CONCURRENT_VOICE_CAMPAIGNS`

### SMS Campaigns
- Routed to SMS Dispatcher Lambda
- Uses `SMS_DISPATCHER_FUNCTION_NAME`
- Invoked asynchronously for independent execution
- Supports concurrent execution up to `MAX_CONCURRENT_SMS_CAMPAIGNS`

### Hybrid Campaigns
- Treated as voice campaigns (includes voice components)
- Routed to Step Functions state machine
- SMS actions triggered via SNS during IVR interactions

## Resource Management

The orchestrator tracks active campaigns by type in Redis:
- `campaign:execution:{campaignId}`: Campaign execution details
- `campaign:type:voice:active`: Set of active voice campaign IDs
- `campaign:type:sms:active`: Set of active SMS campaign IDs

This ensures:
- Independent resource pools for each campaign type
- No resource conflicts between SMS and voice campaigns
- Proper concurrency limits enforcement

## Correctness Properties

This Lambda implements the following correctness properties:

- **Property 27**: Campaign type independence - SMS and voice campaigns execute independently without resource conflicts

## Testing

### Unit Tests

Run unit tests:
```bash
npm test src/lambda/campaign-orchestrator/
```

### Integration Tests

Test campaign orchestration:
```bash
# Start voice campaign
aws lambda invoke \
  --function-name campaign-orchestrator \
  --payload '{"campaignId":"campaign_123","action":"start"}' \
  response.json

# Start SMS campaign
aws lambda invoke \
  --function-name campaign-orchestrator \
  --payload '{"campaignId":"campaign_456","action":"start"}' \
  response.json

# Check resource utilization
aws lambda invoke \
  --function-name campaign-orchestrator \
  --payload '{"action":"status"}' \
  response.json
```

### Concurrent Execution Test

Test concurrent campaign execution:
```bash
# Start multiple campaigns simultaneously
for i in {1..10}; do
  aws lambda invoke \
    --function-name campaign-orchestrator \
    --payload "{\"campaignId\":\"campaign_$i\",\"action\":\"start\"}" \
    --invocation-type Event \
    response_$i.json &
done
wait

# Verify no resource conflicts
aws lambda invoke \
  --function-name campaign-orchestrator \
  --payload '{"action":"status"}' \
  status.json
```

## Deployment

Build and deploy the Lambda function:
```bash
# Build Docker image
docker build -t campaign-orchestrator -f src/lambda/campaign-orchestrator/Dockerfile .

# Tag for ECR
docker tag campaign-orchestrator:latest <account-id>.dkr.ecr.<region>.amazonaws.com/campaign-orchestrator:latest

# Push to ECR
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/campaign-orchestrator:latest

# Update Lambda function
aws lambda update-function-code \
  --function-name campaign-orchestrator \
  --image-uri <account-id>.dkr.ecr.<region>.amazonaws.com/campaign-orchestrator:latest
```

## API Gateway Integration

Create API endpoints for campaign management:

```bash
# Start campaign
POST /campaigns/{campaignId}/start

# Pause campaign
POST /campaigns/{campaignId}/pause

# Resume campaign
POST /campaigns/{campaignId}/resume

# Stop campaign
POST /campaigns/{campaignId}/stop
```

## Monitoring

Key metrics to monitor:
- Invocation count
- Error rate
- Duration
- Active voice campaigns
- Active SMS campaigns
- Resource utilization percentage
- Campaign start failures due to resource limits

CloudWatch Logs are automatically captured for debugging.

## Concurrency Limits

Default limits:
- Voice campaigns: 5 concurrent
- SMS campaigns: 10 concurrent

These limits can be adjusted via environment variables based on:
- Available infrastructure capacity
- Cost constraints
- Performance requirements

## Error Handling

The orchestrator handles various error scenarios:
- Campaign not found: Returns error message
- Resource limit reached: Returns reason and suggests retry
- Invalid action: Returns error message
- Dispatcher failure: Logs error and updates campaign status

## Troubleshooting

### Campaign fails to start

Check:
1. Resource utilization - may have reached concurrency limit
2. Campaign status - must be 'scheduled' or 'draft'
3. Step Functions/Lambda permissions
4. Database connectivity

### Resource conflicts

If campaigns interfere with each other:
1. Check Redis tracking keys
2. Verify campaign type routing
3. Review concurrency limits
4. Check for orphaned executions

### High latency

If orchestration is slow:
1. Increase database connection pool size
2. Optimize Redis queries
3. Use Lambda reserved concurrency
4. Review Step Functions execution history
