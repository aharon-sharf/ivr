# ML Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "ml_models_bucket" {
  description = "S3 bucket for ML models"
  type        = string
}

variable "sagemaker_container_image" {
  description = "SageMaker container image URI for model inference"
  type        = string
  default     = "683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3"
  # Note: Update this based on your AWS region and model framework
  # For IL region (il-central-1), you may need to use a different registry
  # See: https://docs.aws.amazon.com/sagemaker/latest/dg/pre-built-containers-frameworks-deep-learning.html
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
