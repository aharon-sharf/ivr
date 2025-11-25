# Monitoring Module Outputs

output "campaign_overview_dashboard_name" {
  description = "Campaign overview dashboard name"
  value       = aws_cloudwatch_dashboard.campaign_overview.dashboard_name
}

output "system_health_dashboard_name" {
  description = "System health dashboard name"
  value       = aws_cloudwatch_dashboard.system_health.dashboard_name
}

output "business_metrics_dashboard_name" {
  description = "Business metrics dashboard name"
  value       = aws_cloudwatch_dashboard.business_metrics.dashboard_name
}

output "dashboard_urls" {
  description = "CloudWatch dashboard URLs"
  value = {
    campaign_overview = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.campaign_overview.dashboard_name}"
    system_health     = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.system_health.dashboard_name}"
    business_metrics  = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.business_metrics.dashboard_name}"
  }
}

output "alarm_topic_arn" {
  description = "SNS topic ARN for alarm notifications"
  value       = aws_sns_topic.alarms.arn
}

output "log_group_names" {
  description = "CloudWatch log group names"
  value       = [for lg in aws_cloudwatch_log_group.lambda_logs : lg.name]
}

output "xray_group_arns" {
  description = "X-Ray group ARNs"
  value = {
    campaign_execution = aws_xray_group.campaign_execution.arn
    api_requests       = aws_xray_group.api_requests.arn
    errors             = aws_xray_group.errors.arn
    high_latency       = aws_xray_group.high_latency.arn
  }
}

output "xray_sampling_rules" {
  description = "X-Ray sampling rule names"
  value = {
    default            = aws_xray_sampling_rule.default.rule_name
    critical_functions = aws_xray_sampling_rule.critical_functions.rule_name
    error_traces       = aws_xray_sampling_rule.error_traces.rule_name
  }
}

output "xray_dashboard_name" {
  description = "X-Ray metrics dashboard name"
  value       = aws_cloudwatch_dashboard.xray_metrics.dashboard_name
}
