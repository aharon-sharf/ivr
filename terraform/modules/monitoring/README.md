# Monitoring Module

This Terraform module sets up comprehensive monitoring and observability for the Mass Voice Campaign System using AWS CloudWatch and X-Ray.

## Features

### CloudWatch Dashboards

The module creates three main dashboards:

1. **Campaign Overview Dashboard** (`campaign-overview`)
   - Active calls count
   - Queue depth (SQS messages)
   - Dialing rate (calls per minute)
   - Call outcomes breakdown
   - Campaign progress tracking

2. **System Health Dashboard** (`system-health`)
   - Lambda function errors and duration
   - Lambda throttles
   - SQS queue age and backlog
   - EC2 (Asterisk) CPU utilization
   - RDS database connections, CPU, and storage

3. **Business Metrics Dashboard** (`business-metrics`)
   - Answer rate percentage
   - Conversion rate percentage
   - Opt-out trends over time
   - Cost per call metrics
   - Top performing campaigns
   - SMS delivery status
   - TTS fallback usage

### CloudWatch Alarms

#### Critical Alarms (Immediate Action Required)
- **Lambda Error Rate > 5%**: Triggers when any Lambda function error rate exceeds 5%
- **SQS Queue Depth > 10,000**: Triggers when queue backlog exceeds 10,000 messages
- **EC2 CPU > 90%**: Triggers when Asterisk server CPU exceeds 90%
- **Lambda Throttles**: Triggers on any Lambda throttling events

#### Warning Alarms (Investigation Recommended)
- **Answer Rate < 20%**: Triggers when campaign answer rate drops below 20%
- **RDS Connections > 80%**: Triggers when database connections exceed 80% of maximum
- **EC2 CPU > 70%**: Triggers when Asterisk server CPU exceeds 70%
- **RDS Storage < 20%**: Triggers when free storage space drops below 20%
- **Lambda Duration Warning**: Triggers when function duration approaches timeout (80%)
- **Dead Letter Queue Messages**: Triggers when any DLQ receives messages
- **High Opt-Out Rate > 5%**: Triggers when opt-out rate exceeds 5%

All alarms send notifications to the configured SNS topic, which can be subscribed to via email, SMS, or other endpoints.

### AWS X-Ray Tracing

The module configures X-Ray for distributed tracing:

#### Sampling Rules
1. **Default Sampling (5%)**: Samples 5% of all requests for baseline monitoring
2. **Critical Functions (20%)**: Samples 20% of requests for critical Lambda functions (dialer-worker, dispatcher, api-handler)
3. **Error Traces (100%)**: Samples 100% of error traces for complete error visibility

#### X-Ray Groups
- **Campaign Execution**: Traces for campaign dispatch and dialing operations
- **API Requests**: Traces for all API Gateway requests
- **Errors**: All traces with errors or faults
- **High Latency**: Traces with duration >= 5 seconds

#### X-Ray Dashboard
- Traces processed count
- Error traces over time
- API latency distribution (avg, max, p95, p99)
- Service dependencies visualization

## Usage

```hcl
module "monitoring" {
  source = "./modules/monitoring"

  project_name = "voice-campaign"
  environment  = "production"

  lambda_function_names = [
    "voice-campaign-production-api-handler",
    "voice-campaign-production-dispatcher",
    "voice-campaign-production-dialer-worker",
    "voice-campaign-production-status-checker",
    "voice-campaign-production-cdr-logger",
    "voice-campaign-production-sms-gateway",
    "voice-campaign-production-tts-fallback",
    "voice-campaign-production-optout-handler",
    "voice-campaign-production-analytics"
  ]

  sqs_queue_names = [
    "voice-campaign-production-dial-tasks",
    "voice-campaign-production-sms-tasks"
  ]

  sqs_dlq_names = [
    "voice-campaign-production-dial-tasks-dlq",
    "voice-campaign-production-sms-tasks-dlq"
  ]

  asterisk_instance_id = "i-1234567890abcdef0"
  rds_instance_id      = "voice-campaign-production-db"

  rds_max_connections   = 100
  rds_allocated_storage = 100
  lambda_timeout_ms     = 30000

  alarm_email_endpoints = [
    "ops-team@example.com",
    "oncall@example.com"
  ]

  tags = {
    Project     = "VoiceCampaign"
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}
```

## Outputs

- `campaign_overview_dashboard_name`: Name of the campaign overview dashboard
- `system_health_dashboard_name`: Name of the system health dashboard
- `business_metrics_dashboard_name`: Name of the business metrics dashboard
- `dashboard_urls`: Map of dashboard URLs for easy access
- `alarm_topic_arn`: SNS topic ARN for alarm notifications
- `log_group_names`: List of CloudWatch log group names
- `xray_group_arns`: Map of X-Ray group ARNs
- `xray_sampling_rules`: Map of X-Ray sampling rule names
- `xray_dashboard_name`: Name of the X-Ray metrics dashboard

## Accessing Dashboards

After deployment, you can access the dashboards via:

1. **AWS Console**: Navigate to CloudWatch > Dashboards
2. **Direct URLs**: Use the `dashboard_urls` output to get direct links
3. **CLI**: `aws cloudwatch get-dashboard --dashboard-name <name>`

## Alarm Notifications

To receive alarm notifications:

1. Subscribe to the SNS topic created by this module
2. Confirm the subscription via email
3. Configure additional endpoints (SMS, Slack, PagerDuty) as needed

Example SNS subscription:
```bash
aws sns subscribe \
  --topic-arn <alarm_topic_arn> \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## X-Ray Service Map

To view the X-Ray service map:

1. Navigate to AWS X-Ray console
2. Select "Service map" from the left menu
3. Filter by group (campaign-execution, api-requests, etc.)
4. Analyze service dependencies and latency

## Custom Metrics

The module expects custom metrics to be published to CloudWatch:

- `AnsweredCalls`: Count of answered calls
- `TotalCalls`: Total call attempts
- `OptOuts`: Count of opt-outs
- Namespace: `<project_name>/<environment>`

Example publishing custom metrics from Lambda:
```typescript
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

await cloudwatch.putMetricData({
  Namespace: 'voice-campaign/production',
  MetricData: [
    {
      MetricName: 'AnsweredCalls',
      Value: 1,
      Unit: 'Count',
      Timestamp: new Date()
    }
  ]
}).promise();
```

## Log Insights Queries

The dashboards use CloudWatch Logs Insights queries. You can run custom queries:

```
# Find all errors in the last hour
SOURCE '/aws/lambda/voice-campaign-production-dialer-worker'
| fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100

# Calculate answer rate
SOURCE '/aws/lambda/voice-campaign-production-dialer-worker'
| fields @timestamp, outcome
| filter outcome in ["answered", "busy", "failed", "no_answer"]
| stats count() as total, sum(outcome = "answered") as answered
| fields (answered / total * 100) as answer_rate_percent

# Find slow API requests
SOURCE '/aws/lambda/voice-campaign-production-api-handler'
| fields @timestamp, @duration, @requestId
| filter @duration > 1000
| sort @duration desc
| limit 20
```

## Cost Considerations

- **CloudWatch Dashboards**: $3/month per dashboard (3 dashboards = $9/month)
- **CloudWatch Alarms**: $0.10/month per alarm (~15 alarms = $1.50/month)
- **CloudWatch Logs**: $0.50/GB ingested, $0.03/GB stored
- **X-Ray Traces**: $5 per 1M traces recorded, $0.50 per 1M traces retrieved
- **X-Ray Insights**: $0.00001 per trace analyzed

Estimated monthly cost: $20-50 depending on log volume and trace sampling rate.

## Best Practices

1. **Alarm Tuning**: Adjust thresholds based on your baseline metrics
2. **Log Retention**: Set appropriate retention periods (default: 30 days)
3. **Sampling Rate**: Increase sampling for critical functions, decrease for high-volume functions
4. **Dashboard Customization**: Add widgets specific to your use case
5. **Alert Fatigue**: Avoid too many alarms; focus on actionable alerts
6. **Cost Optimization**: Use metric filters instead of Logs Insights for frequent queries

## Troubleshooting

### Dashboards not showing data
- Verify Lambda functions are publishing logs
- Check log group names match the expected format
- Ensure custom metrics are being published

### Alarms not triggering
- Verify SNS topic subscriptions are confirmed
- Check alarm evaluation periods and thresholds
- Review CloudWatch metrics to ensure data is being collected

### X-Ray traces not appearing
- Ensure Lambda functions have X-Ray tracing enabled
- Verify IAM roles have `xray:PutTraceSegments` permission
- Check sampling rules are configured correctly

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| aws | >= 4.0 |

## Providers

| Name | Version |
|------|---------|
| aws | >= 4.0 |
