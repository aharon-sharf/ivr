# Mass Voice Campaign System - Variables

variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
  default     = "il-central-1"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "dev"
}

# Networking Variables
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "availability_zones" {
  description = "Availability zones for subnet deployment"
  type        = list(string)
  default     = ["il-central-1a", "il-central-1b"]
}

# RDS PostgreSQL Variables
variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 100
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = true
}

# ElastiCache Redis Variables
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.medium"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in Redis cluster"
  type        = number
  default     = 2
}

# Asterisk EC2 Variables
variable "asterisk_instance_type" {
  description = "EC2 instance type for Asterisk server"
  type        = string
  default     = "c5.large"
}

variable "asterisk_key_name" {
  description = "SSH key pair name for Asterisk EC2 instance"
  type        = string
}

# ML Module Feature Flag
variable "enable_ml_module" {
  description = "Enable ML module (SageMaker). Set to false if model artifact is not yet uploaded to S3."
  type        = bool
  default     = false
}

# SageMaker Variables
variable "sagemaker_container_image" {
  description = "SageMaker container image URI for model inference"
  type        = string
  default     = "898809789911.dkr.ecr.il-central-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3"
  # Note: For IL region (il-central-1), you may need to use a different registry
  # Update based on your region and model framework requirements
}
