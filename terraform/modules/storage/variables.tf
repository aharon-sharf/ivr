# Storage Module Variables

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

# Optional: Custom domain configuration for CloudFront
# Uncomment and configure these variables to use a custom domain

# variable "custom_domain" {
#   description = "Custom domain for frontend (e.g., dashboard.example.com)"
#   type        = string
#   default     = ""
# }

# variable "acm_certificate_arn" {
#   description = "ACM certificate ARN for custom domain (must be in us-east-1)"
#   type        = string
#   default     = ""
# }
