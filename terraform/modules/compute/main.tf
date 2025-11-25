# Compute Module - Lambda Functions and Asterisk EC2

# Placeholder outputs for now
locals {
  placeholder_lambda_arn = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:placeholder"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Get latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
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
  ami                    = data.aws_ami.amazon_linux_2.id
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
              yum update -y
              
              # Install basic tools
              yum install -y wget curl git vim htop
              
              # Install CloudWatch agent
              wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
              rpm -U ./amazon-cloudwatch-agent.rpm
              
              # Install Node.js 18
              curl -sL https://rpm.nodesource.com/setup_18.x | bash -
              yum install -y nodejs
              
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
