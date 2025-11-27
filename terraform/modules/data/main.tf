# Data Module - RDS PostgreSQL, ElastiCache Redis

# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
    description = "PostgreSQL from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-rds-sg-${var.environment}"
    }
  )
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-db-subnet-group-${var.environment}"
    }
  )
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-postgres-${var.environment}"
  engine         = "postgres"
  engine_version = "16"

  instance_class    = var.rds_instance_class
  allocated_storage = var.rds_allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name                     = "campaign_system"
  username                    = "iadmin"
  manage_master_user_password = true
  # password = random_password.rds_password.result

  multi_az               = var.rds_multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"

  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-postgres-final-${var.environment}" : null

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-postgres-${var.environment}"
    }
  )
}

# # Random password for RDS
# resource "random_password" "rds_password" {
#   length  = 32
#   special = true
# }
# 
# # Store RDS password in Secrets Manager
# resource "aws_secretsmanager_secret" "rds_password" {
#   name = "${var.project_name}-rds-password-${var.environment}"
# 
#   tags = merge(
#     var.tags,
#     {
#       Name = "${var.project_name}-rds-password-${var.environment}"
#     }
#   )
# }
# 
# resource "aws_secretsmanager_secret_version" "rds_password" {
#   secret_id = aws_secretsmanager_secret.rds_password.id
#   secret_string = jsonencode({
#     username = aws_db_instance.postgres.username
#     password = random_password.rds_password.result
#     endpoint = aws_db_instance.postgres.endpoint
#     database = aws_db_instance.postgres.db_name
#   })
# }

# Security Group for Redis
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg-${var.environment}"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
    description = "Redis from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-redis-sg-${var.environment}"
    }
  )
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-redis-subnet-group-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-redis-subnet-group-${var.environment}"
    }
  )
}

# ElastiCache Redis Cluster
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-redis-${var.environment}"
  description          = "Redis cluster for Mass Voice Campaign System"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  num_cache_clusters   = var.redis_num_cache_nodes
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  automatic_failover_enabled = var.redis_num_cache_nodes > 1
  multi_az_enabled           = var.redis_num_cache_nodes > 1

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  snapshot_retention_limit = 5
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "mon:05:00-mon:07:00"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-redis-${var.environment}"
    }
  )
}

# Random auth token for Redis
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
}

# Store Redis auth token in Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name = "${var.project_name}-redis-auth-token-${var.environment}"

  recovery_window_in_days = 0

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-redis-auth-token-${var.environment}"
    }
  )
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth_token.result
    endpoint   = aws_elasticache_replication_group.redis.primary_endpoint_address
  })
}

# Data source for VPC
data "aws_vpc" "main" {
  id = var.vpc_id
}
