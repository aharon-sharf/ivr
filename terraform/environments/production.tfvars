# Production Environment Configuration

environment  = "production"
project_name = "mass-voice-campaign"

# Networking
vpc_cidr           = "10.2.0.0/16"
availability_zones = ["il-central-1a", "il-central-1b", "il-central-1c"]

# Compute
asterisk_instance_type       = "c5.2xlarge"
enable_asterisk_auto_scaling = true
asterisk_key_name            = "asterisk-deploy-key"
asterisk_min_size            = 2
asterisk_max_size            = 10

# Database
rds_instance_class        = "db.r5.2xlarge"
rds_allocated_storage     = 500
rds_multi_az              = true
rds_backup_retention_days = 30
enable_rds_read_replica   = true

# Cache
redis_node_type       = "cache.r5.xlarge"
redis_num_cache_nodes = 3

# Lambda
lambda_reserved_concurrency = {
  api-handler   = 200
  dispatcher    = 20
  dialer-worker = 2000
}

# SageMaker
sagemaker_serverless_memory_size     = 4096
sagemaker_serverless_max_concurrency = 200

# Monitoring
enable_xray_tracing           = true
cloudwatch_log_retention_days = 30
enable_enhanced_monitoring    = true

# Alarms
enable_critical_alarms = true
alarm_email_endpoints  = ["ops@example.com"]

# Tags
tags = {
  Environment = "production"
  ManagedBy   = "terraform"
  Project     = "mass-voice-campaign"
  CostCenter  = "engineering"
}
