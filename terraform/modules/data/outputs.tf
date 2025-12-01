# Data Module Outputs

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (direct connection)"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint (use this for Lambda functions)"
  value       = aws_db_proxy.main.endpoint
}

output "rds_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.postgres.id
}

output "rds_proxy_arn" {
  description = "RDS Proxy ARN"
  value       = aws_db_proxy.main.arn
}

output "rds_master_secret_arn" {
  description = "ARN of the secret containing RDS master password"
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
}

# Redis has been moved to Asterisk EC2 server - see compute module outputs
