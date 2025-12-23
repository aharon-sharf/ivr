# Networking Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
}

variable "availability_zones" {
  description = "Availability zones for subnet deployment"
  type        = list(string)
}

variable "rds_subnet_cidrs" {
  description = "CIDR blocks for RDS subnets (requires minimum 2 AZs)"
  type        = list(string)
}

variable "rds_availability_zones" {
  description = "Availability zones for RDS subnets (requires minimum 2 AZs)"
  type        = list(string)
}

variable "nat_instance_type" {
  description = "Instance type for NAT instance"
  type        = string
  default     = "t3.nano"
}

variable "nat_instance_key_name" {
  description = "SSH key pair name for NAT instance"
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
