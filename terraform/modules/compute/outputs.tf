# Compute Module Outputs

output "validate_campaign_lambda_arn" {
  description = "Validate Campaign Lambda ARN"
  value       = data.aws_lambda_function.validate_campaign.arn
}

output "dispatcher_lambda_arn" {
  description = "Dispatcher Lambda ARN"
  value       = data.aws_lambda_function.dispatcher.arn
}

output "campaign_status_lambda_arn" {
  description = "Campaign Status Lambda ARN"
  value       = data.aws_lambda_function.status_checker.arn
}

output "status_checker_lambda_arn" {
  description = "Status Checker Lambda ARN (alias for campaign_status_lambda_arn)"
  value       = data.aws_lambda_function.status_checker.arn
}

output "report_generator_lambda_arn" {
  description = "Report Generator Lambda ARN"
  value       = data.aws_lambda_function.report_generator.arn
}

output "enrich_dial_task_lambda_arn" {
  description = "Enrich Dial Task Lambda ARN"
  value       = data.aws_lambda_function.enrich_dial_task.arn
}

output "dialer_worker_lambda_arn" {
  description = "Dialer Worker Lambda ARN"
  value       = data.aws_lambda_function.dialer_worker.arn
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

# Redis outputs (self-hosted on Asterisk server)
output "redis_endpoint" {
  description = "Redis endpoint (Asterisk server private IP)"
  value       = aws_instance.asterisk.private_ip
}

output "redis_port" {
  description = "Redis port"
  value       = 6379
}

output "redis_password_secret_arn" {
  description = "ARN of the secret containing Redis password"
  value       = aws_secretsmanager_secret.redis_password.arn
}
