# Compute Module Outputs

output "validate_campaign_lambda_arn" {
  description = "Validate Campaign Lambda ARN"
  value       = local.placeholder_lambda_arn
}

output "dispatcher_lambda_arn" {
  description = "Dispatcher Lambda ARN"
  value       = local.placeholder_lambda_arn
}

output "campaign_status_lambda_arn" {
  description = "Campaign Status Lambda ARN"
  value       = local.placeholder_lambda_arn
}

output "status_checker_lambda_arn" {
  description = "Status Checker Lambda ARN (alias for campaign_status_lambda_arn)"
  value       = local.placeholder_lambda_arn
}

output "report_generator_lambda_arn" {
  description = "Report Generator Lambda ARN"
  value       = local.placeholder_lambda_arn
}

output "enrich_dial_task_lambda_arn" {
  description = "Enrich Dial Task Lambda ARN"
  value       = local.placeholder_lambda_arn
}

output "dialer_worker_lambda_arn" {
  description = "Dialer Worker Lambda ARN"
  value       = local.placeholder_lambda_arn
}

output "asterisk_instance_id" {
  description = "Asterisk EC2 instance ID"
  value       = aws_instance.asterisk.id
}

output "asterisk_public_ip" {
  description = "Asterisk EC2 Elastic IP"
  value       = aws_eip.asterisk.public_ip
}

output "asterisk_private_ip" {
  description = "Asterisk EC2 private IP"
  value       = aws_instance.asterisk.private_ip
}

output "asterisk_security_group_id" {
  description = "Asterisk security group ID"
  value       = aws_security_group.asterisk.id
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = "https://placeholder.execute-api.${data.aws_region.current.name}.amazonaws.com"
}

output "lambda_function_names" {
  description = "List of Lambda function names for monitoring"
  value       = []
}
