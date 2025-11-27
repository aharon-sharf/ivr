# Complete Deployment Tutorial - Mass Voice Campaign System

**A Step-by-Step Guide from Zero to Production**

This comprehensive tutorial will guide you through deploying the entire Mass Voice Campaign System from scratch. Follow these steps in order for a successful deployment.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: AWS Account Setup](#phase-1-aws-account-setup)
4. [Phase 2: Infrastructure Deployment](#phase-2-infrastructure-deployment)
5. [Phase 3: Database Setup](#phase-3-database-setup)
6. [Phase 4: Lambda Functions Deployment](#phase-4-lambda-functions-deployment)
7. [Phase 5: Asterisk Server Setup](#phase-5-asterisk-server-setup)
8. [Phase 6: Frontend Deployment](#phase-6-frontend-deployment)
9. [Phase 7: Testing & Validation](#phase-7-testing--validation)
10. [Phase 8: Production Deployment](#phase-8-production-deployment)
11. [Troubleshooting](#troubleshooting)
12. [Maintenance](#maintenance)

---

## Overview

### System Architecture

The Mass Voice Campaign System consists of:

- **Frontend**: React dashboard (S3 + CloudFront)
- **Backend**: Serverless Lambda functions
- **Database**: PostgreSQL (RDS) + Redis (ElastiCache)
- **Telephony**: Asterisk server on EC2
- **Orchestration**: AWS Step Functions
- **Messaging**: SQS + SNS
- **ML**: SageMaker for call time optimization
- **Auth**: AWS Cognito

### Deployment Environments

- **Dev**: Development environment (auto-deploy)
- **Staging**: Pre-production testing (auto-deploy)
- **Production**: Live environment (manual approval)


---

## Prerequisites

### Required Tools

Install these tools before starting:

#### 1. AWS CLI

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Download and run: https://awscli.amazonaws.com/AWSCLIV2.msi

# Verify installation
aws --version  # Should show v2.x.x
```

#### 2. Terraform

```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Windows
# Download from: https://www.terraform.io/downloads

# Verify installation
terraform --version  # Should show v1.6.0 or higher
```

#### 3. Node.js & npm

```bash
# macOS
brew install node@18

# Linux (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Windows
# Download from: https://nodejs.org/

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

#### 4. Ansible

```bash
# macOS
brew install ansible

# Linux
sudo apt-get update
sudo apt-get install ansible

# Windows (use WSL)
# Install WSL first, then use Linux commands

# Verify installation
ansible --version  # Should show v2.15 or higher
```


#### 5. Docker (for local testing)

```bash
# macOS
brew install --cask docker

# Linux
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Windows
# Download Docker Desktop from: https://www.docker.com/products/docker-desktop

# Verify installation
docker --version
docker-compose --version
```

#### 6. PostgreSQL Client

```bash
# macOS
brew install postgresql

# Linux
sudo apt-get install postgresql-client

# Windows
# Download from: https://www.postgresql.org/download/windows/

# Verify installation
psql --version
```

### AWS Account Requirements

- Active AWS account with billing enabled
- IAM user with AdministratorAccess (or specific permissions)
- Credit card on file (for AWS charges)
- Service quotas checked (especially for EC2, RDS, Lambda)

### Estimated Costs

**Development Environment:**
- ~$50-100/month (can be stopped when not in use)

**Production Environment:**
- ~$300-500/month (depends on usage)
- Additional costs for calls/SMS based on volume

---

## Phase 1: AWS Account Setup

### Step 1.1: Configure AWS CLI

```bash
# Configure AWS credentials
aws configure

# Enter your credentials:
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]
# Default region name: us-east-1
# Default output format: json

# Verify configuration
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```


### Step 1.2: Create SSH Key Pair

```bash
# Create SSH key for Asterisk EC2 instance
aws ec2 create-key-pair \
  --key-name mass-voice-campaign-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/mass-voice-campaign-key.pem

# Set proper permissions
chmod 400 ~/.ssh/mass-voice-campaign-key.pem

# Verify key was created
aws ec2 describe-key-pairs --key-names mass-voice-campaign-key
```

### Step 1.3: Check Service Quotas

```bash
# Check EC2 instance limits
aws service-quotas get-service-quota \
  --service-code ec2 \
  --quota-code L-1216C47A

# Check RDS instance limits
aws service-quotas get-service-quota \
  --service-code rds \
  --quota-code L-7B6409FD

# Check Lambda concurrent executions
aws service-quotas get-service-quota \
  --service-code lambda \
  --quota-code L-B99A9384
```

If limits are too low, request increases via AWS Console → Service Quotas.

### Step 1.4: Set Up GitHub Actions (Optional but Recommended)

If using CI/CD:

```bash
# Create OIDC provider for GitHub Actions
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Note the ARN - you'll need it for GitHub secrets
```

---

## Phase 2: Infrastructure Deployment

### Step 2.1: Clone Repository

```bash
# Clone the repository
git clone <your-repository-url>
cd mass-voice-campaign-system

# Install dependencies
npm install
```

### Step 2.2: Set Up Terraform Backend

```bash
cd terraform

# Run backend setup script (creates one bucket for all environments)
chmod +x backend-setup.sh
./backend-setup.sh

# Initialize Terraform
terraform init

# Create workspaces for each environment
terraform workspace new dev
terraform workspace new staging
terraform workspace new production

# Verify workspaces
terraform workspace list

# This creates:
# - Single S3 bucket for Terraform state (shared by all environments)
# - S3 native state locking (no DynamoDB required)
# - Separate workspaces for dev/staging/production
```

Expected output:
```
Setting up Terraform remote state backend...
Note: This creates a single S3 bucket for all environments.
Terraform workspaces will separate state files within this bucket.

Creating S3 bucket: mass-voice-campaign-terraform-state
✅ Terraform backend setup complete!

Next steps:
1. Run: terraform init
2. Create workspaces for each environment:
   terraform workspace new dev
   terraform workspace new staging
   terraform workspace new production
```


### Step 2.3: Configure Terraform Variables

```bash
# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit with your preferred editor
nano terraform.tfvars
```

**Required changes:**

```hcl
# terraform.tfvars

# Basic Configuration
aws_region       = "us-east-1"  # or your preferred region
environment      = "dev"
project_name     = "mass-voice-campaign"

# SSH Key (created in Step 1.2)
asterisk_key_name = "mass-voice-campaign-key"

# Networking
vpc_cidr = "10.0.0.0/16"

# Database
db_instance_class = "db.t3.micro"  # Start small for dev
db_allocated_storage = 20

# Redis
redis_node_type = "cache.t3.micro"

# Asterisk EC2
asterisk_instance_type = "t3.small"

# SIP Trunk Configuration (get from your provider)
sip_trunk_host     = "sip.yourprovider.com"
sip_trunk_username = "your-username"
sip_trunk_password = "your-password"  # Will be stored in Secrets Manager

# Tags
tags = {
  Project     = "MassVoiceCampaign"
  Environment = "dev"
  ManagedBy   = "Terraform"
}
```

### Step 2.4: Initialize Terraform

```bash
# Initialize Terraform
terraform init

# Create workspace for dev environment
terraform workspace new dev
terraform workspace select dev
```

Expected output:
```
Initializing modules...
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.x.x...

Terraform has been successfully initialized!
```

### Step 2.5: Plan Infrastructure

```bash
# Review what will be created
terraform plan -out=tfplan

# Review the output carefully
# Should show ~80-100 resources to be created
```


### Step 2.6: Deploy Infrastructure

```bash
# Apply the plan
terraform apply tfplan

# This will take 15-20 minutes
# Terraform will create:
# - VPC with public/private subnets
# - RDS PostgreSQL database
# - ElastiCache Redis cluster
# - EC2 instance for Asterisk
# - Lambda functions (placeholder)
# - S3 buckets
# - SQS queues
# - SNS topics
# - Step Functions state machines
# - CloudWatch log groups
# - IAM roles and policies
# - Cognito User Pool
# - API Gateway
```

### Step 2.7: Save Terraform Outputs

```bash
# Save all outputs to a file
terraform output > ../terraform-outputs.txt

# Display important outputs
echo "=== RDS Endpoint ==="
terraform output rds_endpoint

echo "=== Redis Endpoint ==="
terraform output redis_endpoint

echo "=== Asterisk Public IP ==="
terraform output asterisk_public_ip

echo "=== API Gateway URL ==="
terraform output api_gateway_url

echo "=== Cognito User Pool ID ==="
terraform output cognito_user_pool_id

echo "=== Cognito Client ID ==="
terraform output cognito_client_id

echo "=== S3 Buckets ==="
terraform output s3_audio_bucket
terraform output s3_reports_bucket
terraform output s3_frontend_bucket

echo "=== CloudFront Distribution ==="
terraform output cloudfront_distribution_id
terraform output cloudfront_domain_name
```

**Save these outputs - you'll need them in later steps!**

---

## Phase 3: Database Setup

### Step 3.1: Retrieve Database Credentials

```bash
# Get RDS password from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id mass-voice-campaign-rds-password-dev \
  --query SecretString \
  --output text | jq -r .password

# Save this password - you'll need it
export DB_PASSWORD="<password-from-above>"
export DB_ENDPOINT=$(cd terraform && terraform output -raw rds_endpoint)
```


### Step 3.2: Test Database Connection

```bash
# Test connection (from your local machine)
psql -h $DB_ENDPOINT -U admin -d campaign_system

# If connection fails, check:
# 1. Security group allows your IP
# 2. Database is in "available" state
# 3. Credentials are correct

# Add your IP to security group if needed
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress \
  --group-id $(cd terraform && terraform output -raw rds_security_group_id) \
  --protocol tcp \
  --port 5432 \
  --cidr $MY_IP/32
```

### Step 3.3: Run Database Migrations

```bash
# Navigate back to project root
cd ..

# Run initial schema migration
psql -h $DB_ENDPOINT -U admin -d campaign_system \
  -f database/migrations/001_initial_schema.sql

# Run SMS replies table migration
psql -h $DB_ENDPOINT -U admin -d campaign_system \
  -f database/migrations/002_sms_replies_table.sql
```

Expected output:
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
...
CREATE INDEX
CREATE TRIGGER
```

### Step 3.4: Verify Database Schema

```bash
# Connect to database
psql -h $DB_ENDPOINT -U admin -d campaign_system

# List all tables
\dt

# Should show:
# - users
# - campaigns
# - contacts
# - blacklist
# - call_records
# - sms_records
# - sms_replies
# - donations

# Check a table structure
\d campaigns

# Exit
\q
```

### Step 3.5: Create Initial Admin User

```bash
# Create admin user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id $(cd terraform && terraform output -raw cognito_user_pool_id) \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password "TempPassword123!" \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $(cd terraform && terraform output -raw cognito_user_pool_id) \
  --username admin@example.com \
  --password "YourSecurePassword123!" \
  --permanent
```


---

## Phase 4: Lambda Functions Deployment

### Step 4.1: Build Lambda Docker Images

The system uses Docker containers for Lambda functions. Build all images:

```bash
# Navigate to lambda directory
cd src/lambda

# Build all Lambda functions
for dir in */; do
  echo "Building ${dir%/}..."
  cd "$dir"
  docker build -t "${dir%/}:latest" .
  cd ..
done

# Or build individually:
cd api-handler
docker build -t api-handler:latest .
cd ..
```

### Step 4.2: Push Images to ECR

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com

# Get ECR repository URLs from Terraform
cd ../../terraform
export ECR_REGISTRY=$(terraform output -raw ecr_registry_url)

# Tag and push each image
cd ../src/lambda

for dir in */; do
  FUNCTION_NAME="${dir%/}"
  echo "Pushing $FUNCTION_NAME..."
  
  docker tag "$FUNCTION_NAME:latest" "$ECR_REGISTRY/$FUNCTION_NAME:latest"
  docker push "$ECR_REGISTRY/$FUNCTION_NAME:latest"
done
```

### Step 4.3: Update Lambda Functions

```bash
# Update all Lambda functions with new images
for dir in */; do
  FUNCTION_NAME="${dir%/}"
  echo "Updating Lambda function: $FUNCTION_NAME-dev..."
  
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME-dev" \
    --image-uri "$ECR_REGISTRY/$FUNCTION_NAME:latest"
done

# Wait for updates to complete
aws lambda wait function-updated \
  --function-name api-handler-dev
```

### Step 4.4: Configure Lambda Environment Variables

```bash
# Set environment variables for Lambda functions
cd ../../terraform

# Get all necessary values
export RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
export REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)
export AUDIO_BUCKET=$(terraform output -raw s3_audio_bucket)
export REPORTS_BUCKET=$(terraform output -raw s3_reports_bucket)

# Update API handler Lambda
aws lambda update-function-configuration \
  --function-name api-handler-dev \
  --environment "Variables={
    DB_HOST=$RDS_ENDPOINT,
    REDIS_HOST=$REDIS_ENDPOINT,
    AUDIO_BUCKET=$AUDIO_BUCKET,
    REPORTS_BUCKET=$REPORTS_BUCKET,
    NODE_ENV=development
  }"
```


### Step 4.5: Test Lambda Functions

```bash
# Test API handler
aws lambda invoke \
  --function-name api-handler-dev \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  response.json

# Check response
cat response.json

# Should show: {"statusCode":200,"body":"{\"status\":\"healthy\"}"}

# Test other functions
aws lambda invoke \
  --function-name campaign-orchestrator-dev \
  --payload '{"test":true}' \
  response.json

# View logs
aws logs tail /aws/lambda/api-handler-dev --follow
```

---

## Phase 5: Asterisk Server Setup

### Step 5.1: Connect to Asterisk EC2 Instance

```bash
# Get Asterisk public IP
cd terraform
export ASTERISK_IP=$(terraform output -raw asterisk_public_ip)

# SSH into the instance
ssh -i ~/.ssh/mass-voice-campaign-key.pem ubuntu@$ASTERISK_IP

# You should now be connected to the Asterisk server
```

### Step 5.2: Run Ansible Playbooks

From your local machine (not the Asterisk server):

```bash
# Navigate to ansible directory
cd ../ansible

# Update inventory with Asterisk IP
cat > inventory/hosts.ini << EOF
[asterisk]
asterisk-dev ansible_host=$ASTERISK_IP ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/mass-voice-campaign-key.pem

[asterisk:vars]
ansible_python_interpreter=/usr/bin/python3
EOF

# Run Asterisk setup playbook
ansible-playbook -i inventory/hosts.ini asterisk-setup.yml

# This will:
# - Install Asterisk
# - Configure SIP trunk
# - Set up dialplan
# - Install Node.js worker
```

Expected output:
```
PLAY [Install and configure Asterisk] *****

TASK [Update apt cache] ********************
ok: [asterisk-dev]

TASK [Install Asterisk] ********************
changed: [asterisk-dev]

...

PLAY RECAP *********************************
asterisk-dev : ok=15 changed=10 unreachable=0 failed=0
```


### Step 5.3: Configure Asterisk Worker

```bash
# Run worker configuration playbook
ansible-playbook -i inventory/hosts.ini asterisk-configure.yml

# Deploy Node.js worker
ansible-playbook -i inventory/hosts.ini nodejs-worker-deploy.yml
```

### Step 5.4: Verify Asterisk Installation

```bash
# SSH back into Asterisk server
ssh -i ~/.ssh/mass-voice-campaign-key.pem ubuntu@$ASTERISK_IP

# Check Asterisk status
sudo systemctl status asterisk

# Should show: active (running)

# Check Asterisk CLI
sudo asterisk -rx "core show version"
sudo asterisk -rx "sip show peers"
sudo asterisk -rx "sip show registry"

# Check worker service
sudo systemctl status asterisk-worker

# View worker logs
sudo journalctl -u asterisk-worker -f

# Exit SSH
exit
```

### Step 5.5: Test SIP Trunk

```bash
# From Asterisk server
sudo asterisk -rx "sip show registry"

# Should show your SIP trunk registered
# If not registered, check:
# 1. SIP credentials in terraform.tfvars
# 2. Firewall rules (port 5060 UDP)
# 3. SIP provider status

# Test outbound call (if you have a test number)
sudo asterisk -rx "originate SIP/your-trunk/+1234567890 application Playback demo-congrats"
```

---

## Phase 6: Frontend Deployment

### Step 6.1: Configure Frontend Environment

```bash
# Navigate to frontend directory
cd ../frontend

# Create production environment file
cat > .env.production << EOF
# API Configuration
VITE_API_URL=$(cd ../terraform && terraform output -raw api_gateway_url)

# Cognito Configuration
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=$(cd ../terraform && terraform output -raw cognito_user_pool_id)
VITE_COGNITO_CLIENT_ID=$(cd ../terraform && terraform output -raw cognito_client_id)

# WebSocket Configuration (if applicable)
VITE_WS_URL=wss://your-websocket-url

# Feature Flags
VITE_ENABLE_ML_OPTIMIZATION=true
VITE_ENABLE_SMS=true
EOF
```


### Step 6.2: Build Frontend

```bash
# Install dependencies
npm ci

# Build for production
npm run build

# Verify build
ls -lh dist/
# Should show index.html, assets/, etc.
```

### Step 6.3: Deploy to S3

```bash
# Get S3 bucket name
cd ../terraform
export FRONTEND_BUCKET=$(terraform output -raw s3_frontend_bucket)
export CLOUDFRONT_ID=$(terraform output -raw cloudfront_distribution_id)

# Deploy using the deployment script
cd ../frontend
chmod +x deploy.sh
./deploy.sh dev

# Or manually:
aws s3 sync dist/ s3://$FRONTEND_BUCKET/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# Upload index.html with no-cache
aws s3 cp dist/index.html s3://$FRONTEND_BUCKET/index.html \
  --cache-control "no-cache,no-store,must-revalidate"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*"
```

### Step 6.4: Get Frontend URL

```bash
# Get CloudFront URL
cd ../terraform
terraform output cloudfront_domain_name

# Example output: d1234567890abc.cloudfront.net
# Your dashboard is now available at: https://d1234567890abc.cloudfront.net
```

---

## Phase 7: Testing & Validation

### Step 7.1: Run Automated Tests

```bash
# Navigate to project root
cd ..

# Run unit tests
npm test

# Run property-based tests
npm run test:unit

# Run integration tests (requires Docker)
cd tests/integration
./setup.sh
npm run test:integration
```

### Step 7.2: Smoke Tests

Create a smoke test script:

```bash
cat > smoke-test.sh << 'EOF'
#!/bin/bash

echo "🧪 Running smoke tests..."

# Test API health endpoint
echo "Testing API health..."
API_URL=$(cd terraform && terraform output -raw api_gateway_url)
curl -f "$API_URL/health" || exit 1
echo "✅ API health check passed"

# Test database connection
echo "Testing database..."
DB_ENDPOINT=$(cd terraform && terraform output -raw rds_endpoint)
psql -h $DB_ENDPOINT -U admin -d campaign_system -c "SELECT 1;" || exit 1
echo "✅ Database connection passed"

# Test Redis connection
echo "Testing Redis..."
REDIS_ENDPOINT=$(cd terraform && terraform output -raw redis_endpoint)
redis-cli -h $REDIS_ENDPOINT PING || exit 1
echo "✅ Redis connection passed"

# Test Asterisk
echo "Testing Asterisk..."
ASTERISK_IP=$(cd terraform && terraform output -raw asterisk_public_ip)
ssh -i ~/.ssh/mass-voice-campaign-key.pem ubuntu@$ASTERISK_IP \
  "sudo asterisk -rx 'core show version'" || exit 1
echo "✅ Asterisk check passed"

echo "🎉 All smoke tests passed!"
EOF

chmod +x smoke-test.sh
./smoke-test.sh
```


### Step 7.3: Manual Testing Checklist

Open your frontend URL and test:

- [ ] **Login Page**
  - [ ] Can access login page
  - [ ] Can log in with admin credentials
  - [ ] Redirects to dashboard after login

- [ ] **Dashboard**
  - [ ] Dashboard loads without errors
  - [ ] Shows campaign statistics
  - [ ] Real-time metrics update

- [ ] **Campaign Management**
  - [ ] Can create new campaign
  - [ ] Can upload contacts (CSV/Excel)
  - [ ] Can schedule campaign
  - [ ] Can view campaign details
  - [ ] Can pause/resume campaign

- [ ] **Audio Management**
  - [ ] Can upload audio files
  - [ ] Can record audio via browser
  - [ ] Can preview audio
  - [ ] Audio files appear in library

- [ ] **IVR Flow Builder**
  - [ ] Can create IVR flow
  - [ ] Can add nodes (play, input, branch)
  - [ ] Can connect nodes
  - [ ] Can save flow

- [ ] **Blacklist Management**
  - [ ] Can add numbers to blacklist
  - [ ] Can upload blacklist CSV
  - [ ] Can remove numbers
  - [ ] Blacklist enforced in campaigns

- [ ] **Analytics**
  - [ ] Analytics page loads
  - [ ] Shows call statistics
  - [ ] Shows SMS statistics
  - [ ] Can export reports

### Step 7.4: End-to-End Test Campaign

Create a test campaign:

```bash
# 1. Log into dashboard
# 2. Create new campaign:
#    - Name: "Test Campaign"
#    - Type: Voice
#    - Upload test contacts (your own phone number)
#    - Upload or record test audio
#    - Schedule for immediate execution

# 3. Monitor execution:
#    - Watch real-time dashboard
#    - Check CloudWatch logs
#    - Verify you receive the call

# 4. Check call record in database:
psql -h $DB_ENDPOINT -U admin -d campaign_system \
  -c "SELECT * FROM call_records ORDER BY created_at DESC LIMIT 5;"
```

---

## Phase 8: Production Deployment

### Step 8.1: Create Production Environment

```bash
cd terraform

# Create production workspace
terraform workspace new production
terraform workspace select production

# Copy and modify production variables
cp terraform.tfvars terraform.tfvars.production

# Edit production variables
nano terraform.tfvars.production
```

**Production configuration changes:**

```hcl
environment = "production"

# Use larger instances
db_instance_class = "db.r5.large"
db_allocated_storage = 100
redis_node_type = "cache.r5.large"
asterisk_instance_type = "t3.large"

# Enable Multi-AZ
db_multi_az = true
redis_num_cache_nodes = 2

# Longer retention
log_retention_days = 30

# Production domain
custom_domain = "dashboard.yourcompany.com"
```


### Step 8.2: Deploy Production Infrastructure

```bash
# Plan production deployment
terraform plan -var-file=terraform.tfvars.production -out=prod.tfplan

# Review carefully - this is production!

# Apply
terraform apply prod.tfplan

# Save outputs
terraform output > ../production-outputs.txt
```

### Step 8.3: Production Database Setup

```bash
# Get production credentials
export PROD_DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id mass-voice-campaign-rds-password-production \
  --query SecretString --output text | jq -r .password)

export PROD_DB_ENDPOINT=$(terraform output -raw rds_endpoint)

# Run migrations
psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -f ../database/migrations/001_initial_schema.sql

psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -f ../database/migrations/002_sms_replies_table.sql

# Create production admin user
aws cognito-idp admin-create-user \
  --user-pool-id $(terraform output -raw cognito_user_pool_id) \
  --username admin@yourcompany.com \
  --user-attributes Name=email,Value=admin@yourcompany.com Name=email_verified,Value=true \
  --temporary-password "TempPassword123!" \
  --message-action SUPPRESS
```

### Step 8.4: Deploy Production Lambda Functions

```bash
# Build and push production images
cd ../src/lambda

for dir in */; do
  FUNCTION_NAME="${dir%/}"
  echo "Deploying $FUNCTION_NAME to production..."
  
  # Tag as production
  docker tag "$FUNCTION_NAME:latest" "$ECR_REGISTRY/$FUNCTION_NAME:production"
  docker push "$ECR_REGISTRY/$FUNCTION_NAME:production"
  
  # Update Lambda
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME-production" \
    --image-uri "$ECR_REGISTRY/$FUNCTION_NAME:production"
done
```

### Step 8.5: Deploy Production Frontend

```bash
cd ../../frontend

# Create production environment file
cat > .env.production << EOF
VITE_API_URL=$(cd ../terraform && terraform output -raw api_gateway_url)
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=$(cd ../terraform && terraform output -raw cognito_user_pool_id)
VITE_COGNITO_CLIENT_ID=$(cd ../terraform && terraform output -raw cognito_client_id)
VITE_ENABLE_ML_OPTIMIZATION=true
VITE_ENABLE_SMS=true
EOF

# Build and deploy
npm run build
./deploy.sh production
```

### Step 8.6: Configure Custom Domain (Optional)

If using a custom domain:

```bash
# 1. Request SSL certificate in ACM (us-east-1 region)
aws acm request-certificate \
  --domain-name dashboard.yourcompany.com \
  --validation-method DNS \
  --region us-east-1

# 2. Add DNS validation records to your domain

# 3. Wait for certificate validation
aws acm wait certificate-validated \
  --certificate-arn <certificate-arn> \
  --region us-east-1

# 4. Update CloudFront distribution with custom domain
# (This requires Terraform changes - see frontend/DEPLOYMENT.md)

# 5. Create DNS CNAME record
# dashboard.yourcompany.com -> d1234567890abc.cloudfront.net
```


### Step 8.7: Production Monitoring Setup

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name mass-voice-campaign-production \
  --dashboard-body file://monitoring-dashboard.json

# Set up alarms
aws cloudwatch put-metric-alarm \
  --alarm-name high-lambda-errors-production \
  --alarm-description "Alert when Lambda error rate is high" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Set up SNS topic for alerts
aws sns create-topic --name campaign-alerts-production
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:campaign-alerts-production \
  --protocol email \
  --notification-endpoint ops@yourcompany.com
```

### Step 8.8: Production Validation

Run the smoke tests on production:

```bash
# Update smoke-test.sh to use production workspace
terraform workspace select production
./smoke-test.sh

# Run production health checks
curl https://api.yourcompany.com/health

# Check all services
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `production`)].FunctionName'

# Verify all are in "Active" state
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Terraform State Lock

**Symptom:** `Error: Error acquiring the state lock`

**Solution:**
```bash
# Check for lock file in S3
# With S3 native locking, wait 20 seconds for automatic expiration
aws s3 ls s3://mass-voice-campaign-terraform-state/env:/dev/.terraform.lock

# If it's a stale lock, force unlock
# First, make sure you're in the correct workspace
terraform workspace select dev
terraform force-unlock <LOCK_ID>
```

#### Issue 2: Lambda Function Not Updating

**Symptom:** Lambda shows old code after deployment

**Solution:**
```bash
# Check function state
aws lambda get-function --function-name api-handler-dev

# If state is "Pending", wait for it
aws lambda wait function-updated --function-name api-handler-dev

# Force update with new image
aws lambda update-function-code \
  --function-name api-handler-dev \
  --image-uri $ECR_REGISTRY/api-handler:latest \
  --publish
```

#### Issue 3: Database Connection Timeout

**Symptom:** Lambda functions can't connect to RDS

**Solution:**
```bash
# Check security group rules
aws ec2 describe-security-groups \
  --group-ids $(cd terraform && terraform output -raw rds_security_group_id)

# Verify Lambda is in correct VPC
aws lambda get-function-configuration \
  --function-name api-handler-dev \
  --query 'VpcConfig'

# Test connection from Lambda
aws lambda invoke \
  --function-name api-handler-dev \
  --payload '{"action":"test-db"}' \
  response.json
```


#### Issue 4: Asterisk Not Registering SIP Trunk

**Symptom:** `sip show registry` shows "Unregistered"

**Solution:**
```bash
# SSH to Asterisk server
ssh -i ~/.ssh/mass-voice-campaign-key.pem ubuntu@$ASTERISK_IP

# Check SIP configuration
sudo cat /etc/asterisk/sip.conf

# Check Asterisk logs
sudo tail -f /var/log/asterisk/messages

# Test SIP connectivity
sudo asterisk -rx "sip set debug on"
sudo asterisk -rx "sip reload"

# Check firewall
sudo ufw status
# Ensure port 5060 UDP is open

# Check security group
# Ensure port 5060 UDP is allowed in AWS security group
```

#### Issue 5: Frontend Shows Blank Page

**Symptom:** Dashboard loads but shows blank page

**Solution:**
```bash
# Check browser console for errors
# Common issues:
# 1. CORS errors - check API Gateway CORS settings
# 2. Environment variables not set - check .env.production
# 3. CloudFront cache - invalidate cache

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*"

# Check S3 bucket contents
aws s3 ls s3://$FRONTEND_BUCKET/ --recursive

# Test API directly
curl https://api.yourcompany.com/health
```

#### Issue 6: High Lambda Costs

**Symptom:** Unexpected AWS bill

**Solution:**
```bash
# Check Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=api-handler-dev \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum

# Check for infinite loops or retry storms
aws logs tail /aws/lambda/api-handler-dev --since 1h

# Set reserved concurrency to limit costs
aws lambda put-function-concurrency \
  --function-name api-handler-dev \
  --reserved-concurrent-executions 10
```

#### Issue 7: RDS Storage Full

**Symptom:** Database errors about disk space

**Solution:**
```bash
# Check current storage
aws rds describe-db-instances \
  --db-instance-identifier mass-voice-campaign-postgres-dev \
  --query 'DBInstances[0].AllocatedStorage'

# Increase storage (can't decrease!)
aws rds modify-db-instance \
  --db-instance-identifier mass-voice-campaign-postgres-dev \
  --allocated-storage 50 \
  --apply-immediately

# Or enable autoscaling in Terraform
# max_allocated_storage = 100
```

---

## Maintenance

### Daily Tasks

```bash
# Check system health
./smoke-test.sh

# Review CloudWatch logs for errors
aws logs tail /aws/lambda/api-handler-production --since 1h | grep ERROR

# Check campaign execution status
psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -c "SELECT status, COUNT(*) FROM campaigns GROUP BY status;"
```


### Weekly Tasks

```bash
# Review costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Check database performance
aws rds describe-db-instances \
  --db-instance-identifier mass-voice-campaign-postgres-production \
  --query 'DBInstances[0].[CPUUtilization,FreeableMemory,FreeStorageSpace]'

# Review and rotate logs
aws logs describe-log-groups \
  --query 'logGroups[?contains(logGroupName, `mass-voice-campaign`)].logGroupName'

# Update Lambda functions if needed
cd src/lambda
git pull
# Rebuild and redeploy if changes
```

### Monthly Tasks

```bash
# Database backup verification
aws rds describe-db-snapshots \
  --db-instance-identifier mass-voice-campaign-postgres-production \
  --query 'DBSnapshots[0].[DBSnapshotIdentifier,SnapshotCreateTime,Status]'

# Review security groups
aws ec2 describe-security-groups \
  --filters "Name=tag:Project,Values=MassVoiceCampaign" \
  --query 'SecurityGroups[*].[GroupId,GroupName,IpPermissions]'

# Update dependencies
cd frontend && npm audit
cd ../src/lambda && npm audit

# Review IAM policies
aws iam list-policies \
  --scope Local \
  --query 'Policies[?contains(PolicyName, `mass-voice-campaign`)]'

# Check certificate expiration (if using custom domain)
aws acm describe-certificate \
  --certificate-arn <your-cert-arn> \
  --query 'Certificate.NotAfter'
```

### Backup Strategy

#### Automated Backups

RDS automated backups are enabled by default:

```bash
# Check backup retention
aws rds describe-db-instances \
  --db-instance-identifier mass-voice-campaign-postgres-production \
  --query 'DBInstances[0].BackupRetentionPeriod'

# List recent backups
aws rds describe-db-snapshots \
  --db-instance-identifier mass-voice-campaign-postgres-production
```

#### Manual Backups

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier mass-voice-campaign-postgres-production \
  --db-snapshot-identifier manual-backup-$(date +%Y%m%d-%H%M%S)

# Export to S3 (for long-term storage)
aws rds start-export-task \
  --export-task-identifier export-$(date +%Y%m%d) \
  --source-arn arn:aws:rds:us-east-1:ACCOUNT_ID:snapshot:manual-backup-YYYYMMDD \
  --s3-bucket-name mass-voice-campaign-backups-production \
  --iam-role-arn arn:aws:iam::ACCOUNT_ID:role/rds-export-role \
  --kms-key-id arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_ID
```

### Disaster Recovery

#### Restore from Backup

```bash
# List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier mass-voice-campaign-postgres-production

# Restore to new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier mass-voice-campaign-postgres-restored \
  --db-snapshot-identifier manual-backup-YYYYMMDD-HHMMSS

# Update Lambda environment variables to point to restored instance
# Test thoroughly before switching production traffic
```


### Scaling Considerations

#### Horizontal Scaling

```bash
# Increase Lambda concurrency
aws lambda put-function-concurrency \
  --function-name api-handler-production \
  --reserved-concurrent-executions 100

# Add more Asterisk servers
# 1. Launch new EC2 instance via Terraform
# 2. Run Ansible playbooks
# 3. Add to load balancer or use DNS round-robin

# Scale Redis cluster
# Update terraform.tfvars:
# redis_num_cache_nodes = 3
terraform apply
```

#### Vertical Scaling

```bash
# Upgrade RDS instance
aws rds modify-db-instance \
  --db-instance-identifier mass-voice-campaign-postgres-production \
  --db-instance-class db.r5.xlarge \
  --apply-immediately

# Upgrade Redis nodes
# Update terraform.tfvars:
# redis_node_type = "cache.r5.xlarge"
terraform apply

# Upgrade Asterisk EC2
# Update terraform.tfvars:
# asterisk_instance_type = "t3.xlarge"
terraform apply
```

### Cost Optimization Tips

1. **Stop dev/staging when not in use:**
```bash
# Stop RDS
aws rds stop-db-instance --db-instance-identifier mass-voice-campaign-postgres-dev

# Stop EC2
aws ec2 stop-instances --instance-ids $(cd terraform && terraform output -raw asterisk_instance_id)
```

2. **Use Reserved Instances for production:**
```bash
# Purchase 1-year reserved instance for RDS
aws rds purchase-reserved-db-instances-offering \
  --reserved-db-instances-offering-id <offering-id> \
  --reserved-db-instance-id mass-voice-campaign-reserved
```

3. **Enable S3 lifecycle policies:**
```bash
# Move old audio files to Glacier after 90 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket $AUDIO_BUCKET \
  --lifecycle-configuration file://lifecycle-policy.json
```

4. **Use CloudWatch Logs Insights instead of exporting:**
```bash
# Query logs directly instead of exporting to S3
aws logs start-query \
  --log-group-name /aws/lambda/api-handler-production \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
```

---

## Security Best Practices

### 1. Enable MFA for AWS Root Account

```bash
# Enable MFA via AWS Console:
# 1. Go to IAM → Users → root
# 2. Security credentials → Assign MFA device
# 3. Use authenticator app (Google Authenticator, Authy, etc.)
```

### 2. Rotate Credentials Regularly

```bash
# Rotate RDS password
aws secretsmanager rotate-secret \
  --secret-id mass-voice-campaign-rds-password-production

# Rotate Redis auth token
aws secretsmanager rotate-secret \
  --secret-id mass-voice-campaign-redis-auth-token-production

# Update Lambda environment variables after rotation
```

### 3. Enable CloudTrail

```bash
# Enable CloudTrail for audit logging
aws cloudtrail create-trail \
  --name mass-voice-campaign-audit \
  --s3-bucket-name mass-voice-campaign-cloudtrail

aws cloudtrail start-logging --name mass-voice-campaign-audit
```


### 4. Enable GuardDuty

```bash
# Enable GuardDuty for threat detection
aws guardduty create-detector --enable

# Set up SNS notifications for findings
aws guardduty create-publishing-destination \
  --detector-id <detector-id> \
  --destination-type SNS \
  --destination-properties DestinationArn=arn:aws:sns:us-east-1:ACCOUNT_ID:security-alerts
```

### 5. Regular Security Audits

```bash
# Run AWS Trusted Advisor checks
aws support describe-trusted-advisor-checks \
  --language en

# Check for publicly accessible resources
aws ec2 describe-security-groups \
  --filters "Name=ip-permission.cidr,Values=0.0.0.0/0" \
  --query 'SecurityGroups[*].[GroupId,GroupName]'

# Review IAM policies
aws iam get-account-authorization-details > iam-audit.json
```

---

## Monitoring and Alerting

### CloudWatch Dashboards

Create a comprehensive dashboard:

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", {"stat": "Sum"}],
          [".", "Errors", {"stat": "Sum"}],
          [".", "Duration", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Lambda Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/RDS", "CPUUtilization"],
          [".", "DatabaseConnections"],
          [".", "FreeableMemory"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "RDS Metrics"
      }
    }
  ]
}
```

### Key Metrics to Monitor

1. **Lambda Functions:**
   - Invocations
   - Errors
   - Duration
   - Throttles
   - Concurrent executions

2. **RDS:**
   - CPU utilization
   - Database connections
   - Free storage space
   - Read/Write IOPS

3. **Redis:**
   - CPU utilization
   - Memory usage
   - Cache hit rate
   - Evictions

4. **API Gateway:**
   - Request count
   - 4xx/5xx errors
   - Latency

5. **Step Functions:**
   - Executions started
   - Executions succeeded
   - Executions failed
   - Execution time

### Setting Up Alerts

```bash
# High error rate alert
aws cloudwatch put-metric-alarm \
  --alarm-name lambda-high-errors \
  --alarm-description "Lambda error rate > 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ops-alerts

# Database connection alert
aws cloudwatch put-metric-alarm \
  --alarm-name rds-high-connections \
  --alarm-description "RDS connections > 80% of max" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ops-alerts

# Disk space alert
aws cloudwatch put-metric-alarm \
  --alarm-name rds-low-storage \
  --alarm-description "RDS free storage < 10GB" \
  --metric-name FreeStorageSpace \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 10737418240 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ops-alerts
```


---

## CI/CD Pipeline

### GitHub Actions Workflow

The repository includes automated CI/CD workflows. Here's how to use them:

#### 1. Set Up GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

Add these secrets:
- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_DEPLOY_ROLE_ARN`: ARN of IAM role for deployments
- `SLACK_WEBHOOK_URL`: (Optional) For deployment notifications

#### 2. Workflow Triggers

**Automatic deployments:**
- Push to `develop` → Deploy to dev
- Push to `main` → Deploy to staging
- Create release tag → Deploy to production (with approval)

**Manual deployments:**
```bash
# Deploy specific environment
gh workflow run deploy-lambda.yml -f environment=production

# Deploy infrastructure
gh workflow run terraform-deploy.yml -f environment=production -f action=apply

# Deploy frontend
gh workflow run deploy-frontend.yml -f environment=production
```

#### 3. Deployment Approval

For production deployments:
1. Go to Actions tab
2. Click on the running workflow
3. Review the deployment plan
4. Click "Review deployments"
5. Approve or reject

### Local Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes
# ... edit code ...

# 3. Run tests locally
npm test

# 4. Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 5. Create pull request
gh pr create --title "Add new feature" --body "Description"

# 6. After approval, merge to develop
gh pr merge --squash

# 7. Automatic deployment to dev environment starts
# Monitor at: https://github.com/your-repo/actions
```

---

## Performance Optimization

### Lambda Optimization

```bash
# Increase memory (also increases CPU)
aws lambda update-function-configuration \
  --function-name api-handler-production \
  --memory-size 1024

# Enable provisioned concurrency (reduces cold starts)
aws lambda put-provisioned-concurrency-config \
  --function-name api-handler-production \
  --provisioned-concurrent-executions 5 \
  --qualifier $LATEST

# Use Lambda Layers for shared dependencies
aws lambda publish-layer-version \
  --layer-name nodejs-dependencies \
  --zip-file fileb://layer.zip \
  --compatible-runtimes nodejs18.x
```

### Database Optimization

```bash
# Enable Performance Insights
aws rds modify-db-instance \
  --db-instance-identifier mass-voice-campaign-postgres-production \
  --enable-performance-insights \
  --performance-insights-retention-period 7

# Create read replica for analytics queries
aws rds create-db-instance-read-replica \
  --db-instance-identifier mass-voice-campaign-postgres-read-replica \
  --source-db-instance-identifier mass-voice-campaign-postgres-production

# Analyze slow queries
psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -c "SELECT query, calls, total_time, mean_time 
      FROM pg_stat_statements 
      ORDER BY mean_time DESC 
      LIMIT 10;"
```

### Redis Optimization

```bash
# Monitor cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --dimensions Name=CacheClusterId,Value=mass-voice-campaign-redis-dev \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# If hit rate is low, increase cache size or adjust TTL
```


---

## Compliance and Regulations

### TCPA Compliance (US)

The system includes features for TCPA compliance:

1. **Do-Not-Call Registry:**
   - Blacklist management built-in
   - Automatic enforcement before dialing
   - Import DNC lists via CSV

2. **Consent Management:**
   - Track consent in contact metadata
   - Opt-out handling via SMS replies
   - Audit trail in database

3. **Time Restrictions:**
   - Configure calling hours per timezone
   - Automatic scheduling within allowed times
   - Holiday calendar support

### GDPR Compliance (EU)

For EU customers:

1. **Data Retention:**
```bash
# Set retention policies
aws rds modify-db-instance \
  --db-instance-identifier mass-voice-campaign-postgres-production \
  --backup-retention-period 30

# Implement data deletion after retention period
psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -c "DELETE FROM call_records WHERE created_at < NOW() - INTERVAL '2 years';"
```

2. **Data Export:**
```bash
# Export user data for GDPR requests
psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -c "COPY (SELECT * FROM contacts WHERE user_id = 'USER_ID') TO STDOUT CSV HEADER;" \
  > user_data_export.csv
```

3. **Right to be Forgotten:**
```bash
# Delete user data
psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system << EOF
BEGIN;
DELETE FROM call_records WHERE contact_id IN (SELECT id FROM contacts WHERE user_id = 'USER_ID');
DELETE FROM sms_records WHERE contact_id IN (SELECT id FROM contacts WHERE user_id = 'USER_ID');
DELETE FROM contacts WHERE user_id = 'USER_ID';
COMMIT;
EOF
```

### Audit Logging

```bash
# Enable RDS audit logging
aws rds modify-db-instance \
  --db-instance-identifier mass-voice-campaign-postgres-production \
  --cloudwatch-logs-export-configuration '{"EnableLogTypes":["postgresql"]}'

# Query audit logs
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/mass-voice-campaign-postgres-production/postgresql \
  --filter-pattern "DELETE FROM contacts" \
  --start-time $(date -d '7 days ago' +%s)000
```

---

## Upgrading and Updates

### System Updates

#### Update Node.js Dependencies

```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Update major versions (carefully!)
npm install package-name@latest

# Run tests after updates
npm test

# Rebuild and redeploy Lambda functions
cd src/lambda
# ... rebuild and push images ...
```

#### Update Terraform Providers

```bash
cd terraform

# Update provider versions in versions.tf
# Then run:
terraform init -upgrade

# Review changes
terraform plan

# Apply if safe
terraform apply
```

#### Update Asterisk

```bash
# SSH to Asterisk server
ssh -i ~/.ssh/mass-voice-campaign-key.pem ubuntu@$ASTERISK_IP

# Update system packages
sudo apt-get update
sudo apt-get upgrade

# Update Asterisk (if needed)
# Check current version
sudo asterisk -V

# Follow Asterisk upgrade guide for major versions
# https://wiki.asterisk.org/wiki/display/AST/Upgrading+Asterisk
```


### Database Schema Updates

```bash
# Create new migration file
cat > database/migrations/003_add_new_feature.sql << 'EOF'
-- Migration: Add new feature
-- Date: 2024-01-15
-- Author: Your Name

BEGIN;

-- Add new columns
ALTER TABLE campaigns ADD COLUMN new_field VARCHAR(255);
ALTER TABLE campaigns ADD COLUMN created_by_name VARCHAR(255);

-- Create new indexes
CREATE INDEX idx_campaigns_new_field ON campaigns(new_field);

-- Update existing data if needed
UPDATE campaigns SET new_field = 'default_value' WHERE new_field IS NULL;

COMMIT;
EOF

# Test in dev first
psql -h $DEV_DB_ENDPOINT -U admin -d campaign_system \
  -f database/migrations/003_add_new_feature.sql

# Verify changes
psql -h $DEV_DB_ENDPOINT -U admin -d campaign_system \
  -c "\d campaigns"

# If successful, apply to staging
psql -h $STAGING_DB_ENDPOINT -U admin -d campaign_system \
  -f database/migrations/003_add_new_feature.sql

# Finally, apply to production (during maintenance window)
psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -f database/migrations/003_add_new_feature.sql
```

---

## Decommissioning

### Graceful Shutdown

If you need to decommission the system:

#### 1. Stop New Campaigns

```bash
# Disable campaign creation in frontend
# Or update Lambda to reject new campaigns

# Wait for active campaigns to complete
psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -c "SELECT id, name, status FROM campaigns WHERE status IN ('active', 'scheduled');"
```

#### 2. Export Data

```bash
# Export all data
pg_dump -h $PROD_DB_ENDPOINT -U admin campaign_system > full_backup.sql

# Export to CSV for archival
psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system << 'EOF'
\copy campaigns TO 'campaigns.csv' CSV HEADER;
\copy contacts TO 'contacts.csv' CSV HEADER;
\copy call_records TO 'call_records.csv' CSV HEADER;
\copy sms_records TO 'sms_records.csv' CSV HEADER;
EOF

# Upload to S3 for long-term storage
aws s3 cp full_backup.sql s3://archive-bucket/mass-voice-campaign/
aws s3 cp *.csv s3://archive-bucket/mass-voice-campaign/
```

#### 3. Destroy Infrastructure

```bash
cd terraform

# Disable deletion protection on RDS
aws rds modify-db-instance \
  --db-instance-identifier mass-voice-campaign-postgres-production \
  --no-deletion-protection

# Destroy all resources
terraform destroy -var-file=terraform.tfvars.production

# Confirm by typing: yes

# Clean up Terraform state for this workspace
# Note: With S3 native locking, no DynamoDB table to delete
# This removes only the production workspace state
aws s3 rm s3://mass-voice-campaign-terraform-state/env:/production/ --recursive

# To delete the entire bucket (all environments):
# aws s3 rb s3://mass-voice-campaign-terraform-state --force
```

---

## Quick Reference

### Essential Commands

```bash
# Check system health
./smoke-test.sh

# View Lambda logs
aws logs tail /aws/lambda/api-handler-production --follow

# Connect to database
psql -h $(cd terraform && terraform output -raw rds_endpoint) -U admin -d campaign_system

# SSH to Asterisk
ssh -i ~/.ssh/mass-voice-campaign-key.pem ubuntu@$(cd terraform && terraform output -raw asterisk_public_ip)

# Deploy frontend
cd frontend && ./deploy.sh production

# Update Lambda function
aws lambda update-function-code \
  --function-name FUNCTION_NAME-production \
  --image-uri $ECR_REGISTRY/FUNCTION_NAME:latest

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $(cd terraform && terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```


### Important URLs

```bash
# Get all important URLs
cd terraform

echo "Frontend: https://$(terraform output -raw cloudfront_domain_name)"
echo "API: $(terraform output -raw api_gateway_url)"
echo "Cognito Console: https://console.aws.amazon.com/cognito/users/?region=us-east-1#/pool/$(terraform output -raw cognito_user_pool_id)"
echo "RDS Console: https://console.aws.amazon.com/rds/home?region=us-east-1#database:id=mass-voice-campaign-postgres-production"
echo "CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups"
```

### Environment Variables Reference

**Lambda Functions:**
- `DB_HOST`: RDS endpoint
- `DB_PORT`: 5432
- `DB_NAME`: campaign_system
- `DB_USER`: admin
- `DB_PASSWORD`: (from Secrets Manager)
- `REDIS_HOST`: Redis endpoint
- `REDIS_PORT`: 6379
- `AUDIO_BUCKET`: S3 bucket for audio files
- `REPORTS_BUCKET`: S3 bucket for reports
- `NODE_ENV`: development/staging/production

**Frontend:**
- `VITE_API_URL`: API Gateway URL
- `VITE_COGNITO_REGION`: us-east-1
- `VITE_COGNITO_USER_POOL_ID`: Cognito User Pool ID
- `VITE_COGNITO_CLIENT_ID`: Cognito Client ID

### Cost Breakdown (Estimated)

**Development Environment (~$50-100/month):**
- RDS db.t3.micro: ~$15
- ElastiCache cache.t3.micro: ~$12
- EC2 t3.small (Asterisk): ~$15
- Lambda (low usage): ~$5
- S3 + CloudFront: ~$5
- Other services: ~$10

**Production Environment (~$300-500/month):**
- RDS db.r5.large Multi-AZ: ~$180
- ElastiCache cache.r5.large: ~$80
- EC2 t3.large (Asterisk): ~$60
- Lambda (moderate usage): ~$50
- S3 + CloudFront: ~$30
- Step Functions: ~$20
- SageMaker Serverless: ~$30
- Other services: ~$50

**Variable Costs:**
- Outbound calls: Depends on SIP provider
- SMS messages: ~$0.0075 per message
- Data transfer: ~$0.09/GB

---

## Support and Resources

### Documentation

- **Main README**: [README.md](README.md)
- **Terraform Guide**: [terraform/README.md](terraform/README.md)
- **Frontend Deployment**: [frontend/DEPLOYMENT.md](frontend/DEPLOYMENT.md)
- **Ansible Playbooks**: [ansible/README.md](ansible/README.md)
- **Testing Guide**: [tests/README.md](tests/README.md)
- **Integration Tests**: [tests/integration/TESTING_GUIDE.md](tests/integration/TESTING_GUIDE.md)

### AWS Documentation

- [AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [Amazon RDS](https://docs.aws.amazon.com/rds/)
- [Amazon ElastiCache](https://docs.aws.amazon.com/elasticache/)
- [AWS Step Functions](https://docs.aws.amazon.com/step-functions/)
- [Amazon Cognito](https://docs.aws.amazon.com/cognito/)
- [Amazon CloudFront](https://docs.aws.amazon.com/cloudfront/)

### Third-Party Documentation

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Ansible](https://docs.ansible.com/)
- [Asterisk](https://wiki.asterisk.org/)
- [React](https://react.dev/)
- [Vitest](https://vitest.dev/)

### Community

- GitHub Issues: Report bugs and request features
- GitHub Discussions: Ask questions and share ideas
- Stack Overflow: Tag questions with `mass-voice-campaign`

---

## Conclusion

Congratulations! You've successfully deployed the Mass Voice Campaign System. 

### Next Steps

1. **Familiarize yourself with the dashboard**
   - Create test campaigns
   - Upload contacts
   - Test IVR flows

2. **Set up monitoring**
   - Configure CloudWatch alarms
   - Set up SNS notifications
   - Create custom dashboards

3. **Plan for production**
   - Review security settings
   - Set up backup procedures
   - Document runbooks

4. **Optimize costs**
   - Review usage patterns
   - Adjust instance sizes
   - Enable auto-scaling

5. **Train your team**
   - Share this documentation
   - Conduct training sessions
   - Create internal guides

### Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review CloudWatch logs
3. Search GitHub issues
4. Create a new issue with:
   - Environment (dev/staging/production)
   - Steps to reproduce
   - Error messages
   - Relevant logs

### Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

**Happy Campaigning! 🎉**

*Last Updated: 2024-01-15*
*Version: 1.0.0*
