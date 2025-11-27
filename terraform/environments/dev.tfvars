# Development Environment Configuration

environment  = "dev"
project_name = "mass-voice-campaign"

# Networking
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["il-central-1a", "il-central-1b"]

# Compute
asterisk_instance_type       = "t3.micro"
enable_asterisk_auto_scaling = false
asterisk_key_name = "asterisk-deploy-key"

# Database
rds_instance_class        = "db.t3.micro"
rds_allocated_storage     = 20
rds_multi_az              = false
rds_backup_retention_days = 7

# Cache
redis_node_type       = "cache.t3.micro"
redis_num_cache_nodes = 1

# Lambda
lambda_reserved_concurrency = {
  api-handler   = 50
  dispatcher    = 5
  dialer-worker = 500
}

# SageMaker
sagemaker_serverless_memory_size     = 1024
sagemaker_serverless_max_concurrency = 50

# Monitoring
enable_xray_tracing           = true
cloudwatch_log_retention_days = 7

# Tags
tags = {
  Environment = "dev"
  ManagedBy   = "terraform"
  Project     = "mass-voice-campaign"
}
