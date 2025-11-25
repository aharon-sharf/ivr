# Step Functions Orchestration Module

## Overview

This module provisions the AWS Step Functions state machine that orchestrates campaign execution. The state machine coordinates the entire campaign lifecycle from validation through completion and reporting.

## Architecture

### Campaign Execution Workflow

```
┌─────────────────────┐
│ ValidateCampaign    │
│ (Lambda)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ CheckValidation     │
│ (Choice)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ QueryEligible       │
│ Contacts            │
│ (Dispatcher Lambda) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ CheckContacts       │
│ Available (Choice)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ MonitorProgress     │
│ (Wait 60s)          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ CheckCampaign       │
│ Status (Lambda)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ IsCampaignComplete  │
│ (Choice)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ GenerateReport      │
│ (Lambda)            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ NotifyUser          │
│ (SNS)               │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ CampaignCompleted   │
│ (Succeed)           │
└─────────────────────┘
```

## State Machine States

### 1. ValidateCampaign (Task)
- **Purpose**: Validates campaign configuration before execution
- **Lambda**: validate-campaign
- **Timeout**: 30 seconds
- **Retry**: 3 attempts with exponential backoff
- **Validates**:
  - Campaign exists and is in correct status
  - Time windows are valid
  - Audio files exist (for voice campaigns)
  - IVR flow is valid
  - Campaign has contacts

### 2. CheckValidation (Choice)
- **Purpose**: Determines if validation passed
- **Paths**:
  - `valid === true` → QueryEligibleContacts
  - `valid === false` → ValidationFailed

### 3. QueryEligibleContacts (Task)
- **Purpose**: Queries eligible contacts and pushes to SQS
- **Lambda**: dispatcher
- **Timeout**: 300 seconds (5 minutes)
- **Retry**: 3 attempts with exponential backoff
- **Actions**:
  - Queries contacts not blacklisted, within time window
  - Applies ML-based prioritization
  - Pushes contacts to SQS dial-tasks queue
  - Updates campaign status to 'active'

### 4. CheckContactsAvailable (Choice)
- **Purpose**: Determines if any contacts were dispatched
- **Paths**:
  - `contactCount > 0` → MonitorProgress
  - `contactCount === 0` → NoContactsToProcess

### 5. MonitorProgress (Wait)
- **Purpose**: Wait before checking campaign progress
- **Duration**: 60 seconds
- **Next**: CheckCampaignStatus

### 6. CheckCampaignStatus (Task)
- **Purpose**: Queries campaign progress and calculates completion
- **Lambda**: status-checker
- **Timeout**: 30 seconds
- **Retry**: 3 attempts with exponential backoff
- **Returns**:
  - Campaign status
  - Contact statistics
  - Completion percentage
  - Call metrics

### 7. IsCampaignComplete (Choice)
- **Purpose**: Determines next action based on campaign status
- **Paths**:
  - `status === 'completed'` → GenerateReport
  - `status === 'paused'` → CampaignPaused
  - `status === 'cancelled'` → CampaignCancelled
  - `needsMoreContacts === true` → QueryEligibleContacts
  - Default → MonitorProgress

### 8. GenerateReport (Task)
- **Purpose**: Generates comprehensive campaign report
- **Lambda**: report-generator
- **Timeout**: 120 seconds (2 minutes)
- **Retry**: 2 attempts with exponential backoff
- **Catch**: If report generation fails, continues to NotifyUser with error

### 9. NotifyUser (Task)
- **Purpose**: Sends notification to user via SNS
- **Service**: SNS Publish
- **Topic**: campaign-notifications
- **Message**: Campaign results with report URL

### 10. CampaignCompleted (Succeed)
- **Purpose**: Marks successful completion of workflow

## Error Handling

### Retry Strategy
All Lambda tasks use exponential backoff retry:
- **Interval**: 2 seconds (first retry)
- **Max Attempts**: 3
- **Backoff Rate**: 2.0 (doubles each retry)

### Error States
- **ValidationFailed**: Campaign validation failed
- **CampaignFailed**: Unrecoverable error during execution
- **ReportGenerationFailed**: Report generation failed (non-fatal)

### Catch Blocks
All Lambda tasks have catch blocks that:
1. Capture error details in `$.error`
2. Route to appropriate failure state
3. Send notification to user with error details

## Monitoring

### CloudWatch Logs
- Log Group: `/aws/stepfunctions/{project_name}-campaign-execution`
- Retention: Configurable (default: 7 days)
- Includes execution data: Yes
- Level: ALL

### X-Ray Tracing
- Enabled: Yes
- Provides distributed tracing across Lambda invocations

### CloudWatch Alarms
1. **ExecutionsFailed**: Alerts when executions fail
2. **ExecutionTime**: Alerts when execution exceeds 1 hour

## IAM Permissions

### Step Functions Role
- **Lambda Invoke**: All campaign Lambda functions
- **SNS Publish**: campaign-notifications topic
- **CloudWatch Logs**: Create log groups, streams, put events
- **X-Ray**: Put trace segments and telemetry

### EventBridge Role
- **Step Functions**: Start execution of state machine

## EventBridge Integration

### Campaign Scheduler Rule
- **Name**: `{project_name}-campaign-scheduler`
- **Schedule**: Rate(1 minute) - placeholder for dynamic rules
- **Target**: Campaign execution state machine
- **Input Transformer**: Extracts campaignId from event

### Dynamic Scheduling
In production, campaigns create individual EventBridge rules with specific schedule expressions:
```json
{
  "scheduleExpression": "at(2024-01-15T10:00:00)",
  "input": {
    "campaignId": "uuid",
    "executionSource": "scheduled"
  }
}
```

## Input Format

```json
{
  "campaignId": "uuid",
  "executionSource": "scheduled"
}
```

## Output Format

### Success
```json
{
  "campaignId": "uuid",
  "campaignName": "Campaign Name",
  "statusResult": {
    "status": "completed",
    "totalContacts": 1000,
    "completedContacts": 1000,
    "completionPercentage": 100,
    "metrics": { ... }
  },
  "reportResult": {
    "Payload": {
      "reportUrl": "https://s3.../report.pdf"
    }
  }
}
```

### Failure
```json
{
  "error": {
    "Error": "CampaignValidationFailed",
    "Cause": "Campaign configuration validation failed"
  }
}
```

## Deployment

### Terraform Apply
```bash
cd terraform
terraform apply -target=module.orchestration
```

### Manual Execution
```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:REGION:ACCOUNT:stateMachine:campaign-execution \
  --input '{"campaignId":"uuid","executionSource":"manual"}'
```

### View Execution
```bash
aws stepfunctions describe-execution \
  --execution-arn arn:aws:states:REGION:ACCOUNT:execution:campaign-execution:uuid
```

## Cost Optimization

### State Transitions
- **Cost**: $0.025 per 1,000 state transitions
- **Typical Campaign**: ~10-15 state transitions
- **1,000 Campaigns**: ~$0.25

### Execution Time
- No charge for execution time
- Only charged for state transitions

### Optimization Tips
1. Adjust monitoring wait time (currently 60s) based on campaign size
2. Batch contact dispatch to reduce dispatcher invocations
3. Use Express Workflows for high-volume, short-duration campaigns

## Requirements Validated

- **Requirement 2.1**: Campaign scheduling and time window management
- **Requirement 2.2**: Calling window enforcement
- **Requirement 2.3**: Campaign end time handling

## Related Components

- **Lambda Functions**:
  - validate-campaign
  - dispatcher
  - status-checker
  - report-generator (to be implemented)
  
- **SQS Queues**:
  - dial-tasks queue
  
- **SNS Topics**:
  - campaign-notifications

## Troubleshooting

### Execution Stuck in MonitorProgress Loop
- Check if contacts are being processed by dialer workers
- Verify SQS queue is being consumed
- Check contact status in database

### Validation Failures
- Review campaign configuration
- Check audio file URLs
- Verify IVR flow structure
- Ensure campaign has contacts

### Report Generation Failures
- Check report-generator Lambda logs
- Verify S3 bucket permissions
- Check if campaign data exists in database
