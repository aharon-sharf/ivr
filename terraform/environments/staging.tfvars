# Staging Environment Configuration

environment = "staging"
# project_name = "mass-voice-campaign"

# Networking
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["il-central-1a", "il-central-1b"]

# Compute
asterisk_instance_type = "c5.xlarge"
# enable_asterisk_auto_scaling = false
asterisk_key_name = "asterisk-deploy-key"

# Database
rds_instance_class    = "db.t4g.medium"
rds_allocated_storage = 100
rds_multi_az          = true
# rds_backup_retention_days = 14

# Cache
redis_node_type       = "cache.r5.large"
redis_num_cache_nodes = 2

# Lambda
# lambda_reserved_concurrency = {
#   api-handler   = 100
#   dispatcher    = 10
#   dialer-worker = 1000
# }

# SageMaker
# Set to true after uploading model artifact to S3
# See terraform/ML_MODULE_SETUP.md for instructions
enable_ml_module = false
# sagemaker_serverless_memory_size     = 2048
# sagemaker_serverless_max_concurrency = 100

# Monitoring
# enable_xray_tracing           = true
# cloudwatch_log_retention_days = 14

# Tags
# tags = {
#   Environment = "staging"
#   ManagedBy   = "terraform"
#   Project     = "mass-voice-campaign"
# }
