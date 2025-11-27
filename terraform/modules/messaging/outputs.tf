# Messaging Module Outputs

output "dial_tasks_queue_url" {
  description = "Dial tasks SQS queue URL"
  value       = aws_sqs_queue.dial_tasks.url
}

output "dial_tasks_queue_arn" {
  description = "Dial tasks SQS queue ARN"
  value       = aws_sqs_queue.dial_tasks.arn
}

output "dial_tasks_dlq_arn" {
  description = "Dial tasks dead letter queue ARN"
  value       = aws_sqs_queue.dial_tasks_dlq.arn
}

output "call_events_topic_arn" {
  description = "Call events SNS topic ARN"
  value       = aws_sns_topic.call_events.arn
}

output "donation_events_topic_arn" {
  description = "Donation events SNS topic ARN"
  value       = aws_sns_topic.donation_events.arn
}

output "optout_events_topic_arn" {
  description = "Opt-out events SNS topic ARN"
  value       = aws_sns_topic.optout_events.arn
}

output "campaign_notifications_topic_arn" {
  description = "Campaign notifications SNS topic ARN"
  value       = aws_sns_topic.campaign_notifications.arn
}

output "alarm_sns_topic_arn" {
  description = "CloudWatch alarms SNS topic ARN"
  value       = aws_sns_topic.alarms.arn
}

output "sns_topic_arns" {
  description = "Map of all SNS topic ARNs"
  value = {
    call_events            = aws_sns_topic.call_events.arn
    donation_events        = aws_sns_topic.donation_events.arn
    optout_events          = aws_sns_topic.optout_events.arn
    campaign_notifications = aws_sns_topic.campaign_notifications.arn
    alarms                 = aws_sns_topic.alarms.arn
  }
}

output "sqs_queue_names" {
  description = "List of SQS queue names for monitoring"
  value       = [aws_sqs_queue.dial_tasks.name]
}
