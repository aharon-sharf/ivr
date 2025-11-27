# Messaging Module

This module manages SQS queues and SNS topics for the Mass Voice Campaign system.

## Architecture Change: EventBridge Pipes → Lambda Event Source Mapping

**Previous Implementation:**
- Used AWS EventBridge Pipes to connect SQS → Enrichment Lambda → Dialer Worker Lambda
- Not available in all AWS regions (e.g., il-central-1)

**Current Implementation:**
- Direct Lambda Event Source Mapping from SQS to Lambda (to be implemented when Lambda functions are created)
- Enrichment logic will be handled within the Dialer Worker Lambda or as a separate invocation
- Widely available across all AWS regions

## Resources Created

### SQS Queues
- **dial_tasks**: Main queue for dial tasks
- **dial_tasks_dlq**: Dead letter queue for failed messages

### SNS Topics
- **call_events**: Call status updates
- **donation_events**: Donation tracking
- **optout_events**: Opt-out requests
- **campaign_notifications**: Campaign status updates
- **alarms**: CloudWatch alarm notifications

## Integration with Lambda

When Lambda functions are implemented in the compute module, add the following:

1. **Event Source Mapping** (in compute module):
```hcl
resource "aws_lambda_event_source_mapping" "dial_tasks_to_dialer_worker" {
  event_source_arn = var.dial_tasks_queue_arn
  function_name    = aws_lambda_function.dialer_worker.arn
  batch_size       = 10
  maximum_batching_window_in_seconds = 5
  
  filter_criteria {
    filter {
      pattern = jsonencode({
        body = {
          phoneNumber = [{ exists = true }]
        }
      })
    }
  }
  
  function_response_types = ["ReportBatchItemFailures"]
}
```

2. **IAM Permissions** (add to Lambda role):
```hcl
# Permission to read from SQS
{
  Effect = "Allow"
  Action = [
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:GetQueueAttributes",
    "sqs:ChangeMessageVisibility"
  ]
  Resource = var.dial_tasks_queue_arn
}

# Permission to invoke enrichment Lambda
{
  Effect = "Allow"
  Action = ["lambda:InvokeFunction"]
  Resource = var.enrich_dial_task_lambda_arn
}
```

## Variables

- `project_name`: Project name for resource naming
- `environment`: Environment name (dev, staging, production)
- `enrich_dial_task_lambda_arn`: ARN of enrichment Lambda (placeholder)
- `dialer_worker_lambda_arn`: ARN of dialer worker Lambda (placeholder)
- `tags`: Common resource tags

## Outputs

- Queue URLs and ARNs
- SNS Topic ARNs
- Queue names for monitoring
