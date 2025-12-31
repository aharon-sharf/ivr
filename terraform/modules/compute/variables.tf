# Compute Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs"
  type        = list(string)
}

variable "asterisk_instance_type" {
  description = "EC2 instance type for Asterisk"
  type        = string
}

variable "asterisk_key_name" {
  description = "SSH key pair name for Asterisk EC2"
  type        = string
}

variable "dial_tasks_queue_arn" {
  description = "Dial tasks SQS queue ARN"
  type        = string
}

variable "dial_tasks_queue_url" {
  description = "Dial tasks SQS queue URL"
  type        = string
}

variable "rds_endpoint" {
  description = "RDS endpoint"
  type        = string
}

variable "audio_files_bucket" {
  description = "Audio files S3 bucket name"
  type        = string
}

variable "ml_models_bucket" {
  description = "ML models S3 bucket name"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda functions"
  type        = list(string)
}

variable "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint for Lambda connections"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT validation"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito App Client ID for JWT validation"
  type        = string
}

variable "rds_database_name" {
  description = "RDS database name"
  type        = string
}

variable "rds_username" {
  description = "RDS master username"
  type        = string
}

variable "rds_master_secret_arn" {
  description = "ARN of the secret containing RDS master password"
  type        = string
}

variable "step_functions_state_machine_arn" {
  description = "ARN of the Step Functions state machine for campaign execution"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
