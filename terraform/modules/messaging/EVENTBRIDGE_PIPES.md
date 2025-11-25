# EventBridge Pipes Configuration

## Overview

This module configures an EventBridge Pipe that connects the SQS dial-tasks queue to the Dialer Worker Lambda function. The pipe provides built-in filtering, enrichment, and batching capabilities.

## Architecture

```
SQS Queue (dial-tasks)
    ↓
EventBridge Pipe
    ↓ (Filter: phoneNumber exists)
    ↓
Enrich Dial Task Lambda
    ↓ (Add campaign config)
    ↓
Dialer Worker Lambda
    ↓ (Process batch of 10 messages)
```

## Configuration

### Source Parameters

- **Batch Size**: 10 messages per invocation
- **Batching Window**: 5 seconds maximum wait time
- **Filter Criteria**: Only process messages with `phoneNumber` field

### Enrichment

The pipe uses the Enrich Dial Task Lambda to add campaign configuration to each message before it reaches the Dialer Worker Lambda.

### Target Parameters

- **Invocation Type**: REQUEST_RESPONSE (synchronous)
- **Target**: Dialer Worker Lambda function

## IAM Permissions

The EventBridge Pipe role has the following permissions:

1. **SQS Permissions**:
   - `sqs:ReceiveMessage` - Read messages from dial-tasks queue
   - `sqs:DeleteMessage` - Remove processed messages
   - `sqs:GetQueueAttributes` - Get queue metadata

2. **Lambda Permissions**:
   - `lambda:InvokeFunction` - Invoke enrichment and target Lambda functions

## Message Flow

1. Dispatcher Lambda pushes dial tasks to SQS queue
2. EventBridge Pipe polls the queue with long polling
3. Pipe filters messages (skip if phoneNumber is missing)
4. Pipe batches up to 10 messages or waits 5 seconds
5. Pipe invokes Enrich Dial Task Lambda to add campaign config
6. Pipe invokes Dialer Worker Lambda with enriched batch
7. On success, messages are deleted from queue
8. On failure, messages return to queue (up to 3 retries)
9. After 3 failures, messages move to dead letter queue

## Benefits

- **No Custom Polling Code**: EventBridge Pipes handles SQS polling automatically
- **Built-in Filtering**: Skip invalid messages without Lambda invocation
- **Message Enrichment**: Add campaign config without modifying source messages
- **Automatic Batching**: Reduce Lambda invocations and improve throughput
- **Retry Logic**: Built-in retry with exponential backoff
- **Cost Optimization**: Pay only for processed messages

## Monitoring

Monitor the pipe using CloudWatch metrics:

- `PipeExecutionCount` - Number of pipe executions
- `PipeExecutionFailedCount` - Number of failed executions
- `PipeExecutionThrottledCount` - Number of throttled executions
- `PipeExecutionDuration` - Execution duration

## Deployment

The pipe is created automatically when the messaging module is deployed:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

## Requirements

- Enrich Dial Task Lambda function must be deployed first
- Dialer Worker Lambda function must be deployed first
- SQS dial-tasks queue must exist

## Validation: Requirements 9.1, 9.2

This configuration validates:
- **Requirement 9.1**: System monitors resources in real-time (via batching and rate limiting)
- **Requirement 9.2**: System reduces dialing pace when resources exceed thresholds (via batch processing)
