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
  default     = ["10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24"]
}

# Additional subnet for RDS requirement (minimum 2 AZs)
variable "rds_subnet_cidrs" {
  description = "CIDR blocks for RDS subnets (requires minimum 2 AZs)"
  type        = list(string)
  default     = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "availability_zones" {
  description = "Availability zones for subnet deployment"
  type        = list(string)
  default     = ["il-central-1a"]
}

# Additional AZ for RDS requirement
variable "rds_availability_zones" {
  description = "Availability zones for RDS subnets (requires minimum 2 AZs)"
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
  default     = false
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
  default     = 1
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
  default     = "asterisk-deploy-key"
}

# NAT Instance Variables
variable "nat_instance_type" {
  description = "Instance type for NAT instance"
  type        = string
  default     = "t3.nano"
}

variable "nat_instance_key_name" {
  description = "SSH key pair name for NAT instance (optional)"
  type        = string
  default     = "asterisk-deploy-key"
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
# Twilio SIP Configuration Variables
variable "sip_provider" {
  description = "SIP trunk provider name"
  type        = string
  default     = "twilio"
}

variable "twilio_sip_ip_ranges" {
  description = "Twilio SIP IP ranges for security group"
  type        = list(string)
  default = [
    "54.172.60.0/30",    # North America Virginia
    "54.244.51.0/30",    # North America Oregon
    "54.171.127.0/30",   # Europe Dublin
    "54.65.63.192/30",   # Asia Pacific Singapore
    "54.252.254.64/30",  # Asia Pacific Sydney
    "54.233.167.224/30", # South America São Paulo
    "35.156.191.128/30", # Europe Frankfurt
    "54.199.254.184/30"  # Asia Pacific Tokyo
  ]
}

variable "twilio_media_ip_range" {
  description = "Twilio media IP range (global)"
  type        = string
  default     = "168.86.128.0/18"
}