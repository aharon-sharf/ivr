# Mass Voice Campaign System - Main Terraform Configuration
# This file orchestrates all infrastructure modules

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state backend configuration
  # Note: Terraform workspaces automatically append workspace name to the key
  # State files will be stored as: env:/WORKSPACE_NAME/terraform.tfstate
  backend "s3" {
    bucket       = "mass-voice-campaign-terraform-state"
    key          = "terraform.tfstate"
    region       = "il-central-1"
    use_lockfile = true
    encrypt      = true
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "MassVoiceCampaign"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Local variables
locals {
  project_name = "mass-voice-campaign"
  common_tags = {
    Project     = "MassVoiceCampaign"
    Environment = var.environment
  }
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  project_name = local.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr

  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones

  tags = local.common_tags
}

# Data Module (RDS, Redis, MongoDB)
module "data" {
  source = "./modules/data"

  project_name = local.project_name
  environment  = var.environment

  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

  # RDS PostgreSQL Configuration
  rds_instance_class    = var.rds_instance_class
  rds_allocated_storage = var.rds_allocated_storage
  rds_multi_az          = var.rds_multi_az

  # ElastiCache Redis Configuration
  redis_node_type       = var.redis_node_type
  redis_num_cache_nodes = var.redis_num_cache_nodes

  tags = local.common_tags
}

# Storage Module (S3 Buckets)
module "storage" {
  source = "./modules/storage"

  project_name = local.project_name
  environment  = var.environment

  tags = local.common_tags
}

# Messaging Module (SQS, SNS)
module "messaging" {
  source = "./modules/messaging"

  project_name = local.project_name
  environment  = var.environment

  # Lambda ARNs for EventBridge Pipes
  enrich_dial_task_lambda_arn = module.compute.enrich_dial_task_lambda_arn
  dialer_worker_lambda_arn    = module.compute.dialer_worker_lambda_arn

  tags = local.common_tags
}

# Compute Module (Lambda, EC2 for Asterisk)
module "compute" {
  source = "./modules/compute"

  project_name = local.project_name
  environment  = var.environment

  vpc_id            = module.networking.vpc_id
  vpc_cidr          = var.vpc_cidr
  public_subnet_ids = module.networking.public_subnet_ids

  # Asterisk EC2 Configuration
  asterisk_instance_type = var.asterisk_instance_type
  asterisk_key_name      = var.asterisk_key_name

  # Lambda Configuration
  dial_tasks_queue_arn = module.messaging.dial_tasks_queue_arn

  # Database endpoints
  rds_endpoint   = module.data.rds_endpoint
  redis_endpoint = module.data.redis_endpoint

  # S3 buckets
  audio_files_bucket = module.storage.audio_files_bucket
  ml_models_bucket   = module.storage.ml_models_bucket

  tags = local.common_tags
}

# Orchestration Module (Step Functions, EventBridge)
module "orchestration" {
  source = "./modules/orchestration"

  project_name = local.project_name
  environment  = var.environment

  # Lambda function ARNs
  validate_campaign_lambda_arn = module.compute.validate_campaign_lambda_arn
  dispatcher_lambda_arn        = module.compute.dispatcher_lambda_arn
  status_checker_lambda_arn    = module.compute.status_checker_lambda_arn
  report_generator_lambda_arn  = module.compute.report_generator_lambda_arn

  # SQS Queue
  dial_tasks_queue_arn = module.messaging.dial_tasks_queue_arn

  # SNS Topics
  campaign_notifications_topic_arn = module.messaging.campaign_notifications_topic_arn
  alarm_sns_topic_arn              = module.messaging.alarm_sns_topic_arn

  tags = local.common_tags
}

# Authentication Module (Cognito)
module "auth" {
  source = "./modules/auth"

  project_name = local.project_name
  environment  = var.environment

  tags = local.common_tags
}

# ML Module (SageMaker)
module "ml" {
  source = "./modules/ml"

  project_name = local.project_name
  environment  = var.environment

  ml_models_bucket          = module.storage.ml_models_bucket
  sagemaker_container_image = var.sagemaker_container_image

  tags = local.common_tags
}

# Monitoring Module (CloudWatch)
module "monitoring" {
  source = "./modules/monitoring"

  project_name = local.project_name
  environment  = var.environment

  # Resources to monitor
  lambda_function_names = module.compute.lambda_function_names
  sqs_queue_names       = module.messaging.sqs_queue_names
  asterisk_instance_id  = module.compute.asterisk_instance_id
  rds_instance_id       = module.data.rds_instance_id

  tags = local.common_tags
}
