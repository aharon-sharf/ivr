# Compute Module - Lambda Functions and Asterisk EC2

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# IAM Role for Lambda Functions
resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-lambda-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Lambda execution policy
resource "aws_iam_role_policy" "lambda_execution" {
  name = "${var.project_name}-lambda-execution-policy-${var.environment}"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.audio_files_bucket}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "polly:SynthesizeSpeech"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "states:StartExecution",
          "states:DescribeExecution"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutRule",
          "events:PutTargets",
          "events:DeleteRule",
          "events:RemoveTargets",
          "events:EnableRule",
          "events:DisableRule"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "rds-db:connect"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda Functions - These will be created with placeholder images
# GitHub Actions will update them with actual code

resource "aws_lambda_function" "validate_campaign" {
  function_name = "validate-campaign-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/validate-campaign:latest"
  timeout       = 30
  memory_size   = 512

  environment {
    variables = {
      ENVIRONMENT        = var.environment
      DB_SECRET_ARN      = var.rds_master_secret_arn
      RDS_PROXY_ENDPOINT = var.rds_proxy_endpoint
      DB_PORT            = "5432"
      DB_NAME            = var.rds_database_name
      DB_USER            = var.rds_username
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function" "dispatcher" {
  function_name = "dispatcher-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/dispatcher:latest"
  timeout       = 60
  memory_size   = 512

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      DB_HOST              = var.rds_proxy_endpoint
      DB_PORT              = "5432"
      DB_NAME              = var.rds_database_name
      DB_USER              = var.rds_username
      DB_SECRET_ARN        = var.rds_master_secret_arn
      REDIS_URL            = "redis://${aws_instance.asterisk.private_ip}:6379"
      DIAL_TASKS_QUEUE_URL = var.dial_tasks_queue_url
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function" "status_checker" {
  function_name = "status-checker-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/status-checker:latest"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function" "report_generator" {
  function_name = "report-generator-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/report-generator:latest"
  timeout       = 300
  memory_size   = 1024

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function" "campaign_orchestrator" {
  function_name = "campaign-orchestrator-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/campaign-orchestrator:latest"
  timeout       = 300
  memory_size   = 1024

  environment {
    variables = {
      ENVIRONMENT                      = var.environment
      DB_SECRET_ARN                    = var.rds_master_secret_arn
      RDS_PROXY_ENDPOINT               = var.rds_proxy_endpoint
      DB_PORT                          = "5432"
      DB_NAME                          = var.rds_database_name
      DB_USER                          = var.rds_username
      REDIS_ENDPOINT                   = aws_instance.asterisk.private_ip
      REDIS_PORT                       = "6379"
      VOICE_CAMPAIGN_STATE_MACHINE_ARN = var.step_functions_state_machine_arn
      SMS_DISPATCHER_FUNCTION_NAME     = aws_lambda_function.sms_dispatcher.function_name
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function" "enrich_dial_task" {
  function_name = "enrich-dial-task-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/enrich-dial-task:latest"
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function" "dialer_worker" {
  function_name = "dialer-worker-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/dialer-worker:latest"
  timeout       = 60
  memory_size   = 512

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [image_uri]
  }
}

resource "aws_lambda_function" "sms_dispatcher" {
  function_name = "sms-dispatcher-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/sms-dispatcher:latest"
  timeout       = 300
  memory_size   = 1024

  environment {
    variables = {
      ENVIRONMENT   = var.environment
      DB_HOST       = var.rds_proxy_endpoint
      DB_PORT       = "5432"
      DB_NAME       = var.rds_database_name
      DB_USER       = var.rds_username
      DB_SECRET_ARN = var.rds_master_secret_arn
      REDIS_HOST    = aws_instance.asterisk.private_ip
      REDIS_PORT    = "6379"
      BATCH_SIZE    = "100"
      # SMS_GATEWAY_TOPIC_ARN will be added when SMS gateway is implemented
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [image_uri]
  }
}

# Get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security Group for Asterisk EC2
resource "aws_security_group" "asterisk" {
  name        = "${var.project_name}-asterisk-sg-${var.environment}"
  description = "Security group for Asterisk telephony server"
  vpc_id      = var.vpc_id

  # SSH access (restrict to your IP in production)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  # SIP signaling (UDP)
  ingress {
    from_port   = 5060
    to_port     = 5060
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SIP signaling UDP"
  }

  # SIP signaling (TCP)
  ingress {
    from_port   = 5060
    to_port     = 5060
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SIP signaling TCP"
  }

  # SIP TLS
  ingress {
    from_port   = 5061
    to_port     = 5061
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SIP TLS"
  }

  # RTP media streams
  ingress {
    from_port   = 10000
    to_port     = 20000
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "RTP media streams"
  }

  # Asterisk Manager Interface (AMI)
  ingress {
    from_port   = 5038
    to_port     = 5038
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Asterisk Manager Interface (AMI)"
  }

  # HTTP for Node.js Worker API
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Node.js Worker API"
  }

  # Asterisk REST Interface (ARI)
  ingress {
    from_port   = 8088
    to_port     = 8088
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Asterisk REST Interface (ARI)"
  }

  # Redis (self-hosted on Asterisk server)
  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Redis cache from VPC"
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-asterisk-sg-${var.environment}"
    }
  )
}

# IAM Role for Asterisk EC2
resource "aws_iam_role" "asterisk" {
  name = "${var.project_name}-asterisk-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-asterisk-role-${var.environment}"
    }
  )
}

# IAM Policy for Asterisk EC2
resource "aws_iam_role_policy" "asterisk" {
  name = "${var.project_name}-asterisk-policy-${var.environment}"
  role = aws_iam_role.asterisk.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.audio_files_bucket}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "polly:SynthesizeSpeech"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach CloudWatch Agent policy
resource "aws_iam_role_policy_attachment" "asterisk_cloudwatch" {
  role       = aws_iam_role.asterisk.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Attach SSM policy for Systems Manager access
resource "aws_iam_role_policy_attachment" "asterisk_ssm" {
  role       = aws_iam_role.asterisk.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "asterisk" {
  name = "${var.project_name}-asterisk-profile-${var.environment}"
  role = aws_iam_role.asterisk.name

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-asterisk-profile-${var.environment}"
    }
  )
}

# Elastic IP for Asterisk (required for SIP trunk whitelisting)
resource "aws_eip" "asterisk" {
  domain = "vpc"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-asterisk-eip-${var.environment}"
    }
  )
}

# Asterisk EC2 Instance
resource "aws_instance" "asterisk" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.asterisk_instance_type
  key_name               = var.asterisk_key_name
  subnet_id              = var.public_subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.asterisk.id]
  iam_instance_profile   = aws_iam_instance_profile.asterisk.name

  # Enhanced networking
  ebs_optimized = true

  # Root volume
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    delete_on_termination = true
    encrypted             = true

    tags = merge(
      var.tags,
      {
        Name = "${var.project_name}-asterisk-root-${var.environment}"
      }
    )
  }

  # User data script for initial setup
  user_data = <<-EOF
              #!/bin/bash
              set -e
              
              # Update system
              dnf update -y
              
              # Install basic tools
              dnf install -y wget git vim htop
              dnf install -y curl --allowerasing
              
              # Install CloudWatch agent
              wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
              dnf install -y ./amazon-cloudwatch-agent.rpm
              
              # Install Node.js latest
              dnf install -y nodejs24
              
              # Redis will be installed and configured by Ansible

              # Create application directory
              mkdir -p /opt/asterisk-worker
              chown ec2-user:ec2-user /opt/asterisk-worker
              
              # Set hostname
              hostnamectl set-hostname ${var.project_name}-asterisk-${var.environment}
              
              # Create marker file to indicate initial setup is complete
              touch /var/log/user-data-complete.log
              echo "User data script completed at $(date)" >> /var/log/user-data-complete.log
              EOF

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-asterisk-${var.environment}"
      Role = "Telephony"
    }
  )

  lifecycle {
    ignore_changes = [ami]
  }
}

# Associate Elastic IP with Asterisk instance
resource "aws_eip_association" "asterisk" {
  instance_id   = aws_instance.asterisk.id
  allocation_id = aws_eip.asterisk.id
}

# CloudWatch Log Group for Asterisk
resource "aws_cloudwatch_log_group" "asterisk" {
  name              = "/aws/ec2/${var.project_name}-asterisk-${var.environment}"
  retention_in_days = 7

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-asterisk-logs-${var.environment}"
    }
  )
}

# Redis Configuration (self-hosted on Asterisk server)
# Random auth password for Redis
resource "random_password" "redis_password" {
  length  = 32
  special = false
}

# Store Redis password in Secrets Manager
resource "aws_secretsmanager_secret" "redis_password" {
  name = "${var.project_name}-redis-password-${var.environment}"

  recovery_window_in_days = 0

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-redis-password-${var.environment}"
    }
  )
}

resource "aws_secretsmanager_secret_version" "redis_password" {
  secret_id = aws_secretsmanager_secret.redis_password.id
  secret_string = jsonencode({
    password = random_password.redis_password.result
    endpoint = aws_instance.asterisk.private_ip
    port     = 6379
  })
}
