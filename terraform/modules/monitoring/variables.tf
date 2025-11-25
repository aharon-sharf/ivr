# Monitoring Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "lambda_function_names" {
  description = "List of Lambda function names to monitor"
  type        = list(string)
}

variable "sqs_queue_names" {
  description = "List of SQS queue names to monitor"
  type        = list(string)
}

variable "sqs_dlq_names" {
  description = "List of SQS dead letter queue names to monitor"
  type        = list(string)
  default     = []
}

variable "asterisk_instance_id" {
  description = "Asterisk EC2 instance ID"
  type        = string
}

variable "rds_instance_id" {
  description = "RDS instance ID"
  type        = string
}

variable "rds_max_connections" {
  description = "Maximum number of RDS connections"
  type        = number
  default     = 100
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "lambda_timeout_ms" {
  description = "Lambda function timeout in milliseconds"
  type        = number
  default     = 30000
}

variable "alarm_email_endpoints" {
  description = "List of email addresses to receive alarm notifications"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
