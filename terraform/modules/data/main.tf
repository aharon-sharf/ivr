# Data Module - RDS PostgreSQL only (Redis moved to Asterisk server)

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
  subnet_ids = var.rds_subnet_ids

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

# NOTE: Redis has been moved to the Asterisk EC2 server to save costs
# ElastiCache resources removed - see terraform/modules/compute/main.tf for Redis configuration

# RDS Proxy for Lambda connection pooling
# Security Group for RDS Proxy
resource "aws_security_group" "rds_proxy" {
  name        = "${var.project_name}-rds-proxy-sg-${var.environment}"
  description = "Security group for RDS Proxy"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
    description = "PostgreSQL from VPC (Lambda functions)"
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
      Name = "${var.project_name}-rds-proxy-sg-${var.environment}"
    }
  )
}

# IAM Role for RDS Proxy
resource "aws_iam_role" "rds_proxy" {
  name = "${var.project_name}-rds-proxy-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-rds-proxy-role-${var.environment}"
    }
  )
}

# IAM Policy for RDS Proxy to access Secrets Manager
resource "aws_iam_role_policy" "rds_proxy_secrets" {
  name = "${var.project_name}-rds-proxy-secrets-${var.environment}"
  role = aws_iam_role.rds_proxy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_db_instance.postgres.master_user_secret[0].secret_arn
      }
    ]
  })
}

# RDS Proxy
resource "aws_db_proxy" "main" {
  name          = "${var.project_name}-postgres-proxy-${var.environment}"
  engine_family = "POSTGRESQL"
  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_db_instance.postgres.master_user_secret[0].secret_arn
  }

  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = var.rds_subnet_ids
  vpc_security_group_ids = [aws_security_group.rds_proxy.id]
  require_tls            = true

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-postgres-proxy-${var.environment}"
    }
  )
}

# RDS Proxy Target Group
resource "aws_db_proxy_default_target_group" "main" {
  db_proxy_name = aws_db_proxy.main.name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 100
    max_idle_connections_percent = 50
  }
}

# RDS Proxy Target
resource "aws_db_proxy_target" "main" {
  db_instance_identifier = aws_db_instance.postgres.identifier
  db_proxy_name          = aws_db_proxy.main.name
  target_group_name      = aws_db_proxy_default_target_group.main.name
}

# Data source for VPC
data "aws_vpc" "main" {
  id = var.vpc_id
}
