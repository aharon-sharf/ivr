# Messaging Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

variable "enrich_dial_task_lambda_arn" {
  description = "ARN of the Enrich Dial Task Lambda function"
  type        = string
}

variable "dialer_worker_lambda_arn" {
  description = "ARN of the Dialer Worker Lambda function"
  type        = string
}
