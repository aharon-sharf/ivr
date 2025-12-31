# Networking Module - VPC, Subnets, NAT Instance

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-vpc-${var.environment}"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-igw-${var.environment}"
    }
  )
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-public-subnet-${count.index + 1}-${var.environment}"
      Type = "Public"
    }
  )
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-private-subnet-${count.index + 1}-${var.environment}"
      Type = "Private"
    }
  )
}

# RDS Subnets (requires minimum 2 AZs)
resource "aws_subnet" "rds" {
  count = length(var.rds_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.rds_subnet_cidrs[count.index]
  availability_zone = var.rds_availability_zones[count.index]

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-rds-subnet-${count.index + 1}-${var.environment}"
      Type = "RDS"
    }
  )
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-public-rt-${var.environment}"
    }
  )
}

# Route Table Associations for Public Subnets
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Security Group for NAT Instance
resource "aws_security_group" "nat_instance" {
  name        = "${var.project_name}-nat-instance-sg-${var.environment}"
  description = "Security group for NAT instance"
  vpc_id      = aws_vpc.main.id

  # Allow all traffic from private subnets (for NAT)
  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = var.private_subnet_cidrs
    description = "All traffic from private subnets"
  }

  # Allow SSH for management (optional)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  # Allow all outbound traffic
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
      Name = "${var.project_name}-nat-instance-sg-${var.environment}"
    }
  )
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

# NAT Instance
resource "aws_instance" "nat_instance" {
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.nat_instance_type
  key_name                    = var.nat_instance_key_name
  vpc_security_group_ids      = [aws_security_group.nat_instance.id]
  subnet_id                   = aws_subnet.public[0].id
  source_dest_check           = false
  associate_public_ip_address = true

  user_data = <<-EOF
              #!/bin/bash
              set -e
              
              # Log all output
              exec > >(tee /var/log/user-data.log) 2>&1
              echo "Starting NAT instance setup at $(date)"
              
              # Update system packages
              dnf update -y
              
              # Install iptables-services
              dnf install -y iptables-services
              
              # Enable IP forwarding immediately
              echo 1 > /proc/sys/net/ipv4/ip_forward
              
              # Make IP forwarding persistent
              cat >> /etc/sysctl.d/99-nat.conf <<SYSCTL
              net.ipv4.ip_forward = 1
              net.ipv4.conf.all.send_redirects = 0
              net.ipv4.conf.default.send_redirects = 0
              SYSCTL
              sysctl -p /etc/sysctl.d/99-nat.conf
              
              # Get the primary network interface name
              INTERFACE=$(ip route | grep default | awk '{print $5}')
              
              # Configure iptables for NAT
              iptables -t nat -F
              iptables -t nat -A POSTROUTING -o $INTERFACE -j MASQUERADE
              
              # Allow forwarding
              iptables -P FORWARD ACCEPT
              iptables -F FORWARD
              iptables -A FORWARD -m state --state RELATED,ESTABLISHED -j ACCEPT
              iptables -A FORWARD -j ACCEPT
              
              # Save iptables rules
              service iptables save
              
              # Enable and start iptables service
              systemctl enable iptables
              systemctl start iptables
              
              echo "NAT instance setup completed at $(date)"
              EOF

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-nat-instance-${var.environment}"
    }
  )
}

# Route Table for Private Subnets
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block           = "0.0.0.0/0"
    network_interface_id = aws_instance.nat_instance.primary_network_interface_id
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-private-rt-${var.environment}"
    }
  )
}

# Route Table Associations for Private Subnets
resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Route Table Associations for RDS Subnets
resource "aws_route_table_association" "rds" {
  count = length(aws_subnet.rds)

  subnet_id      = aws_subnet.rds[count.index].id
  route_table_id = aws_route_table.private.id
}

# S3 Gateway Endpoint (FREE - keep this one)
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${data.aws_region.current.name}.s3"

  route_table_ids = concat(
    [aws_route_table.public.id],
    [aws_route_table.private.id]
  )

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-s3-endpoint-${var.environment}"
    }
  )
}

# Data source for current AWS region
data "aws_region" "current" {}
