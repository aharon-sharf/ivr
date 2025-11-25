# Orchestration Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "validate_campaign_lambda_arn" {
  description = "Validate Campaign Lambda ARN"
  type        = string
}

variable "dispatcher_lambda_arn" {
  description = "Dispatcher Lambda ARN"
  type        = string
}

variable "status_checker_lambda_arn" {
  description = "Campaign Status Checker Lambda ARN"
  type        = string
}

variable "report_generator_lambda_arn" {
  description = "Report Generator Lambda ARN"
  type        = string
}

variable "dial_tasks_queue_arn" {
  description = "Dial tasks SQS queue ARN"
  type        = string
}

variable "campaign_notifications_topic_arn" {
  description = "Campaign notifications SNS topic ARN"
  type        = string
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
