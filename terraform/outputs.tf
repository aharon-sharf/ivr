# Mass Voice Campaign System - Outputs

# Networking Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.networking.private_subnet_ids
}

# Data Outputs
output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.data.rds_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.data.redis_endpoint
  sensitive   = true
}

# Storage Outputs
output "audio_files_bucket" {
  description = "S3 bucket for audio files"
  value       = module.storage.audio_files_bucket
}

output "ml_models_bucket" {
  description = "S3 bucket for ML models"
  value       = module.storage.ml_models_bucket
}

output "campaign_reports_bucket" {
  description = "S3 bucket for campaign reports"
  value       = module.storage.campaign_reports_bucket
}

output "frontend_hosting_bucket" {
  description = "S3 bucket for frontend hosting"
  value       = module.storage.frontend_hosting_bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for frontend"
  value       = module.storage.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.storage.cloudfront_domain_name
}

output "frontend_url" {
  description = "Frontend application URL"
  value       = "https://${module.storage.cloudfront_domain_name}"
}

# Messaging Outputs
output "dial_tasks_queue_url" {
  description = "SQS dial tasks queue URL"
  value       = module.messaging.dial_tasks_queue_url
}

output "sns_topic_arns" {
  description = "SNS topic ARNs"
  value       = module.messaging.sns_topic_arns
}

# Compute Outputs
output "asterisk_public_ip" {
  description = "Asterisk EC2 instance public IP (Elastic IP)"
  value       = module.compute.asterisk_public_ip
}

output "api_gateway_url" {
  description = "API Gateway endpoint URL"
  value       = module.compute.api_gateway_url
}

# Auth Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_app_client_id" {
  description = "Cognito App Client ID"
  value       = module.auth.app_client_id
}

# ML Outputs
output "sagemaker_endpoint_name" {
  description = "SageMaker Serverless Inference endpoint name"
  value       = module.ml.endpoint_name
}

output "sagemaker_endpoint_arn" {
  description = "SageMaker Serverless Inference endpoint ARN"
  value       = module.ml.endpoint_arn
}

output "lambda_sagemaker_invoke_role_arn" {
  description = "IAM role ARN for Lambda to invoke SageMaker endpoint"
  value       = module.ml.lambda_sagemaker_invoke_role_arn
}

# Monitoring Outputs
output "cloudwatch_dashboard_urls" {
  description = "CloudWatch dashboard URLs"
  value       = module.monitoring.dashboard_urls
}

output "campaign_overview_dashboard" {
  description = "Campaign overview dashboard name"
  value       = module.monitoring.campaign_overview_dashboard_name
}

output "system_health_dashboard" {
  description = "System health dashboard name"
  value       = module.monitoring.system_health_dashboard_name
}

output "business_metrics_dashboard" {
  description = "Business metrics dashboard name"
  value       = module.monitoring.business_metrics_dashboard_name
}

output "alarm_topic_arn" {
  description = "SNS topic ARN for monitoring alarms"
  value       = module.monitoring.alarm_topic_arn
}

output "xray_group_arns" {
  description = "X-Ray group ARNs"
  value       = module.monitoring.xray_group_arns
}

output "xray_dashboard" {
  description = "X-Ray metrics dashboard name"
  value       = module.monitoring.xray_dashboard_name
}
