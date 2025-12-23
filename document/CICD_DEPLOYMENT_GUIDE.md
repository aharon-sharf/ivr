# CI/CD Deployment Guide - Mass Voice Campaign System

**Complete Guide for Automated Deployment via GitHub Actions**

This guide covers deploying the entire Mass Voice Campaign System using GitHub Actions CI/CD pipelines instead of manual deployment.

> **Note**: This project uses Terraform workspaces to manage multiple environments with a single S3 bucket. See [Terraform Workspaces Guide](TERRAFORM_WORKSPACE_GUIDE.md) for details.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [GitHub Actions Workflows](#github-actions-workflows)
5. [Deployment Strategies](#deployment-strategies)
6. [Step-by-Step CI/CD Deployment](#step-by-step-cicd-deployment)
7. [Monitoring Deployments](#monitoring-deployments)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Overview

### CI/CD Architecture

The system uses GitHub Actions for automated deployment with the following workflows:

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├─── Push to develop
                              │    └─→ Auto-deploy to DEV
                              │
                              ├─── Push to main
                              │    └─→ Auto-deploy to STAGING
                              │
                              └─── Manual trigger
                                   └─→ Deploy to PRODUCTION (with approval)
```

### Workflows

1. **test.yml** - Runs tests on every PR and push
2. **terraform-deploy.yml** - Manages infrastructure
3. **deploy-lambda.yml** - Deploys Lambda functions
4. **deploy-frontend.yml** - Deploys React dashboard
5. **deploy-asterisk.yml** - Configures Asterisk servers
6. **security-scan.yml** - Scans for vulnerabilities

---

## Prerequisites

### 1. AWS Account Setup

You need an AWS account with proper permissions. The CI/CD uses OIDC (OpenID Connect) for secure authentication without long-lived credentials.

### 2. Required Tools (Local Machine)

- **Git** - Version control
- **GitHub CLI** (optional) - For triggering workflows
- **AWS CLI** - For initial setup only

```bash
# Install GitHub CLI (optional)
# macOS
brew install gh

# Linux
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Authenticate
gh auth login
```


---

## Initial Setup

### Step 1: Fork/Clone Repository

```bash
# Clone your repository
git clone https://github.com/YOUR_ORG/mass-voice-campaign-system.git
cd mass-voice-campaign-system

# Create develop branch if it doesn't exist
git checkout -b develop
git push -u origin develop
```

### Step 2: AWS OIDC Provider Setup

Create an OIDC provider in AWS for GitHub Actions:

```bash
# Configure AWS CLI
aws configure

# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Note the ARN - you'll need it for the next step
# Example: arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com
# arn:aws:iam::851725253826:oidc-provider/token.actions.githubusercontent.com
```

### Step 3: Create IAM Role for GitHub Actions

Create a trust policy file:

```bash
cat > github-actions-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
        }
      }
    }
  ]
}
EOF

# Replace YOUR_ACCOUNT_ID, YOUR_ORG, and YOUR_REPO
sed -i 's/YOUR_ACCOUNT_ID/851725253826/g' github-actions-trust-policy.json
sed -i 's/YOUR_ORG/aharon-sharf/g' github-actions-trust-policy.json
sed -i 's/YOUR_REPO/ivr/g' github-actions-trust-policy.json

# Create the IAM role
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://github-actions-trust-policy.json \
  --description "Role for GitHub Actions to deploy Mass Voice Campaign System"

# Attach necessary policies
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# For production, create a more restrictive custom policy
# admin policy  : arn:aws:iam::aws:policy/AdministratorAccess
# See: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create.html
```

**Note:** `PowerUserAccess` is used for simplicity. For production, create a custom policy with only required permissions.

### Step 4: Create SSH Key for Asterisk

```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/asterisk-deploy-key -N ""

# Create key pair in AWS
aws ec2 import-key-pair \
  --key-name asterisk-deploy-key \
  --public-key-material fileb://~/.ssh/asterisk-deploy-key.pub

# Save the private key - you'll add it to GitHub Secrets
cat ~/.ssh/asterisk-deploy-key
```


### Step 5: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following **Repository Secrets**:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AWS_ACCOUNT_ID` | `123456789012` | Your AWS account ID |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::123456789012:role/GitHubActionsDeployRole` | IAM role ARN from Step 3 |
| `ASTERISK_SSH_PRIVATE_KEY` | `-----BEGIN RSA PRIVATE KEY-----...` | Private key from Step 4 |
| `ASTERISK_HOST` | `asterisk-dev.example.com` | Asterisk server hostname (for SSH key scanning) |

**To add secrets:**

```bash
# Using GitHub CLI
gh secret set AWS_ACCOUNT_ID --body "123456789012"
gh secret set AWS_DEPLOY_ROLE_ARN --body "arn:aws:iam::123456789012:role/GitHubActionsDeployRole"
gh secret set ASTERISK_SSH_PRIVATE_KEY < ~/.ssh/asterisk-deploy-key
gh secret set ASTERISK_HOST --body "asterisk-dev.example.com"

# Or manually via GitHub UI:
# 1. Go to Settings → Secrets and variables → Actions
# 2. Click "New repository secret"
# 3. Enter name and value
# 4. Click "Add secret"
```

### Step 6: Configure GitHub Environments

Create environments with protection rules:

1. Go to Settings → Environments
2. Create three environments:
   - **dev** (no protection rules)
   - **staging** (no protection rules)
   - **production** (with protection rules)
   - **production-destroy** (with protection rules)

**For production environment:**
- ✅ Required reviewers: Add team members who must approve
- ✅ Wait timer: 0 minutes (or add delay if needed)
- ✅ Deployment branches: Only `main` branch

**Using GitHub CLI:**

```bash
# Create environments (requires GitHub CLI with admin permissions)
gh api repos/:owner/:repo/environments/dev -X PUT
gh api repos/:owner/:repo/environments/staging -X PUT
gh api repos/:owner/:repo/environments/production -X PUT
gh api repos/:owner/:repo/environments/production-destroy -X PUT

# Add protection rules to production (via UI is easier)
```

### Step 7: Initialize Terraform Backend

Run the backend setup script once to create the shared S3 bucket:

```bash
cd terraform

# Setup backend (creates one S3 bucket for all environments)
./backend-setup.sh

# Initialize Terraform
terraform init

# Create workspaces for each environment
terraform workspace new dev
terraform workspace new staging
terraform workspace new production

# Verify workspaces
terraform workspace list

cd ..
```

This creates:
- One S3 bucket for Terraform state (shared by all environments)
- S3 native state locking (no DynamoDB required)
- Separate Terraform workspaces for dev/staging/production
- Each workspace maintains its own state file within the same bucket

### Step 8: Create Environment-Specific Terraform Variables

Create tfvars files for each environment:

```bash
cd terraform/environments

# Create dev.tfvars
cat > dev.tfvars << 'EOF'
environment = "dev"
aws_region = "us-east-1"

# Smaller instances for dev
db_instance_class = "db.t3.micro"
redis_node_type = "cache.t3.micro"
asterisk_instance_type = "t3.small"

# Single AZ for dev
db_multi_az = false
redis_num_cache_nodes = 1

# Shorter retention for dev
log_retention_days = 7

# SSH key
asterisk_key_name = "asterisk-deploy-key"

# SIP trunk (use test credentials for dev)
sip_trunk_host = "sip-test.provider.com"
sip_trunk_username = "test-user"
sip_trunk_password = "test-password"
EOF

# Create staging.tfvars
cat > staging.tfvars << 'EOF'
environment = "staging"
aws_region = "us-east-1"

# Production-like instances
db_instance_class = "db.t3.medium"
redis_node_type = "cache.t3.medium"
asterisk_instance_type = "t3.medium"

# Multi-AZ for staging
db_multi_az = true
redis_num_cache_nodes = 2

# Medium retention for staging
log_retention_days = 14

# SSH key
asterisk_key_name = "asterisk-deploy-key"

# SIP trunk (use staging credentials)
sip_trunk_host = "sip-staging.provider.com"
sip_trunk_username = "staging-user"
sip_trunk_password = "staging-password"
EOF

# Create production.tfvars
cat > production.tfvars << 'EOF'
environment = "production"
aws_region = "us-east-1"

# Large instances for production
db_instance_class = "db.r5.large"
redis_node_type = "cache.r5.large"
asterisk_instance_type = "t3.large"

# Multi-AZ for production
db_multi_az = true
redis_num_cache_nodes = 3

# Long retention for production
log_retention_days = 30

# SSH key
asterisk_key_name = "asterisk-deploy-key"

# SIP trunk (use production credentials)
sip_trunk_host = "sip.provider.com"
sip_trunk_username = "prod-user"
sip_trunk_password = "prod-password"

# Custom domain
custom_domain = "dashboard.yourcompany.com"
EOF

cd ../..
```

### Step 9: Commit and Push Configuration

```bash
# Add all configuration files
git add .
git commit -m "Configure CI/CD pipeline"

# Push to develop branch
git push origin develop
```


---

## GitHub Actions Workflows

### Workflow 1: Test Pipeline (test.yml)

**Triggers:**
- Every pull request
- Every push to `main` or `develop`

**What it does:**
1. Runs unit tests
2. Runs property-based tests
3. Lints code
4. Tests frontend build
5. Generates coverage reports

**No manual action required** - runs automatically.

### Workflow 2: Terraform Infrastructure (terraform-deploy.yml)

**Triggers:**
- Push to `main` or `develop` (when Terraform files change)
- Pull requests (plan only)
- Manual workflow dispatch

**Deployment Flow:**
```
develop branch → Auto-deploy to DEV
main branch → Auto-deploy to STAGING
Manual trigger → Deploy to PRODUCTION (requires approval)
```

**Manual Deployment:**
```bash
# Plan production changes
gh workflow run terraform-deploy.yml \
  -f environment=production \
  -f action=plan

# Apply production changes (requires approval in GitHub UI)
gh workflow run terraform-deploy.yml \
  -f environment=production \
  -f action=apply

# Destroy infrastructure (use with caution!)
gh workflow run terraform-deploy.yml \
  -f environment=dev \
  -f action=destroy
```

### Workflow 3: Lambda Functions (deploy-lambda.yml)

**Triggers:**
- Push to `main` or `develop` (when Lambda code changes)
- Manual workflow dispatch

**What it does:**
1. Runs tests
2. Builds Docker images for all Lambda functions
3. Pushes images to ECR
4. Updates Lambda function code
5. Runs smoke tests
6. Runs integration tests

**Manual Deployment:**
```bash
# Deploy all functions to dev
gh workflow run deploy-lambda.yml -f environment=dev

# Deploy specific functions to staging
gh workflow run deploy-lambda.yml \
  -f environment=staging \
  -f functions="api-handler,dispatcher"

# Deploy to production
gh workflow run deploy-lambda.yml -f environment=production
```

### Workflow 4: Frontend (deploy-frontend.yml)

**Triggers:**
- Push to `main` or `develop` (when frontend code changes)
- Manual workflow dispatch

**What it does:**
1. Installs dependencies
2. Runs linter
3. Builds React application
4. Uploads to S3
5. Invalidates CloudFront cache

**Manual Deployment:**
```bash
# Deploy to dev
gh workflow run deploy-frontend.yml -f environment=dev

# Deploy to production
gh workflow run deploy-frontend.yml -f environment=production
```

### Workflow 5: Asterisk Configuration (deploy-asterisk.yml)

**Triggers:**
- Push to `main` or `develop` (when Ansible or worker code changes)
- Manual workflow dispatch

**What it does:**
1. Validates Ansible playbooks
2. Builds Node.js worker
3. Discovers Asterisk EC2 instances
4. Runs Ansible playbooks
5. Restarts services
6. Runs health checks

**Manual Deployment:**
```bash
# Full deployment
gh workflow run deploy-asterisk.yml \
  -f environment=dev \
  -f playbook=site.yml

# Update only Node.js worker
gh workflow run deploy-asterisk.yml \
  -f environment=staging \
  -f playbook=nodejs-worker-deploy.yml

# Skip health checks
gh workflow run deploy-asterisk.yml \
  -f environment=dev \
  -f skip_health_check=true
```


---

## Deployment Strategies

### Strategy 1: Automatic Deployment (Recommended)

**For Development:**
```bash
# 1. Create feature branch
git checkout develop
git pull
git checkout -b feature/new-feature

# 2. Make changes
# ... edit code ...

# 3. Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 4. Create pull request
gh pr create --base develop --title "Add new feature"

# 5. After PR approval, merge to develop
gh pr merge --squash

# 6. Automatic deployment to DEV starts
# Monitor at: https://github.com/YOUR_ORG/YOUR_REPO/actions
```

**For Staging:**
```bash
# 1. Merge develop to main
git checkout main
git pull
git merge develop
git push origin main

# 2. Automatic deployment to STAGING starts
# Monitor at: https://github.com/YOUR_ORG/YOUR_REPO/actions
```

**For Production:**
```bash
# 1. Validate in staging first
# 2. Manually trigger production deployment
gh workflow run terraform-deploy.yml -f environment=production -f action=apply
gh workflow run deploy-lambda.yml -f environment=production
gh workflow run deploy-frontend.yml -f environment=production
gh workflow run deploy-asterisk.yml -f environment=production -f playbook=site.yml

# 3. Approve deployment in GitHub UI
# Go to: Actions → Select workflow run → Review deployments → Approve

# 4. Monitor deployment
# Watch CloudWatch logs and metrics
```

### Strategy 2: Manual Deployment

For complete control, trigger all workflows manually:

```bash
# 1. Deploy infrastructure
gh workflow run terraform-deploy.yml \
  -f environment=production \
  -f action=apply

# Wait for approval and completion

# 2. Deploy Lambda functions
gh workflow run deploy-lambda.yml \
  -f environment=production

# 3. Deploy frontend
gh workflow run deploy-frontend.yml \
  -f environment=production

# 4. Configure Asterisk
gh workflow run deploy-asterisk.yml \
  -f environment=production \
  -f playbook=site.yml

# 5. Monitor all deployments
gh run list --limit 10
```

### Strategy 3: Hotfix Deployment

For urgent production fixes:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/critical-bug

# 2. Make fix
# ... edit code ...

# 3. Test locally
npm test

# 4. Commit and push
git add .
git commit -m "Fix critical bug"
git push origin hotfix/critical-bug

# 5. Create PR to main
gh pr create --base main --title "Hotfix: Critical bug"

# 6. Get expedited review and merge
gh pr merge --squash

# 7. Deploy to staging first
# (Automatic via main branch push)

# 8. Validate in staging
# Run smoke tests

# 9. Deploy to production
gh workflow run deploy-lambda.yml -f environment=production
gh workflow run deploy-frontend.yml -f environment=production

# 10. Approve and monitor
```


---

## Step-by-Step CI/CD Deployment

### Phase 1: Initial Infrastructure Deployment

#### Step 1.1: Deploy Dev Infrastructure

```bash
# Trigger Terraform deployment for dev
gh workflow run terraform-deploy.yml \
  -f environment=dev \
  -f action=apply

# Monitor deployment
gh run watch

# Or view in browser
open "https://github.com/YOUR_ORG/YOUR_REPO/actions"
```

**Expected Duration:** 15-20 minutes

**What gets created:**
- VPC with subnets
- RDS PostgreSQL
- ElastiCache Redis
- EC2 for Asterisk
- Lambda functions (placeholder)
- S3 buckets
- CloudFront distribution
- Cognito User Pool
- API Gateway

#### Step 1.2: Verify Infrastructure

```bash
# Check workflow status
gh run list --workflow=terraform-deploy.yml --limit 5

# View logs
gh run view --log

# Check AWS resources (optional)
aws ec2 describe-instances --filters "Name=tag:Environment,Values=dev"
aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier, `dev`)]'
```

### Phase 2: Database Setup

After infrastructure is deployed, set up the database:

```bash
# Get RDS endpoint from Terraform outputs
# This requires AWS CLI access
aws secretsmanager get-secret-value \
  --secret-id mass-voice-campaign-rds-password-dev \
  --query SecretString \
  --output text | jq -r .password

# Get RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier mass-voice-campaign-postgres-dev \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# Run migrations

## Option 1: Direct Connection (if RDS is publicly accessible)
export DB_ENDPOINT="<endpoint-from-above>"
export DB_PASSWORD="<password-from-above>"

psql -h $DB_ENDPOINT -U admin -d campaign_system \
  -f database/migrations/001_initial_schema.sql

psql -h $DB_ENDPOINT -U admin -d campaign_system \
  -f database/migrations/002_sms_replies_table.sql

## Option 2: SSH Tunnel via Bastion/Jump Server (if RDS is in private subnet)
# This allows you to run migrations from your local machine through a bastion host

# 1. Create SSH tunnel through bastion (run in one terminal)
ssh -i your-key.pem -L 5433:your-rds-endpoint:5432 ec2-user@bastion-ip -N

# 2. In another terminal, run migrations through the tunnel
export PGPASSWORD="<password-from-above>"

psql -h localhost -p 5433 -U admin -d campaign_system \
  -f database/migrations/001_initial_schema.sql

psql -h localhost -p 5433 -U admin -d campaign_system \
  -f database/migrations/002_sms_replies_table.sql

# Note: Keep the SSH tunnel running while executing migrations
# Press Ctrl+C in the first terminal to close the tunnel when done

# Create admin user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id $(aws cognito-idp list-user-pools --max-results 10 --query 'UserPools[?Name==`mass-voice-campaign-user-pool-dev`].Id' --output text) \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password "TempPassword123!" \
  --message-action SUPPRESS
```

**Note:** Database migrations are not automated in CI/CD to prevent accidental data loss. Always run migrations manually.

### Phase 3: Deploy Lambda Functions

```bash
# Deploy all Lambda functions to dev
gh workflow run deploy-lambda.yml -f environment=dev

# Monitor deployment
gh run watch

# Check deployment status
gh run list --workflow=deploy-lambda.yml --limit 5
```

**Expected Duration:** 10-15 minutes

**What happens:**
1. Tests run
2. Docker images built for all functions
3. Images pushed to ECR
4. Lambda functions updated
5. Smoke tests run

### Phase 4: Deploy Frontend

```bash
# Deploy frontend to dev
gh workflow run deploy-frontend.yml -f environment=dev

# Monitor deployment
gh run watch

# Get frontend URL
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Comment, `dev`)].DomainName' \
  --output text
```

**Expected Duration:** 5-10 minutes

**What happens:**
1. Dependencies installed
2. Linter runs
3. React app built
4. Files uploaded to S3
5. CloudFront cache invalidated

### Phase 5: Configure Asterisk

```bash
# Deploy Asterisk configuration
gh workflow run deploy-asterisk.yml \
  -f environment=dev \
  -f playbook=site.yml

# Monitor deployment
gh run watch
```

**Expected Duration:** 10-15 minutes

**What happens:**
1. Ansible playbooks validated
2. Node.js worker built
3. Asterisk EC2 instances discovered
4. Configuration deployed
5. Services restarted
6. Health checks run

### Phase 6: Validation

After all deployments complete:

```bash
# Check all workflow runs
gh run list --limit 10

# View deployment summary
gh run view <run-id>

# Test the system
# 1. Open frontend URL in browser
# 2. Log in with admin credentials
# 3. Create test campaign
# 4. Verify all features work
```


### Phase 7: Deploy to Staging

Once dev is validated:

```bash
# Merge develop to main
git checkout main
git pull
git merge develop
git push origin main

# This automatically triggers:
# - Terraform deployment to staging
# - Lambda deployment to staging
# - Frontend deployment to staging
# - Asterisk configuration to staging

# Monitor all workflows
gh run list --limit 20

# Wait for all to complete
gh run watch
```

### Phase 8: Deploy to Production

After staging validation:

```bash
# 1. Deploy infrastructure
gh workflow run terraform-deploy.yml \
  -f environment=production \
  -f action=apply

# 2. Go to GitHub Actions UI and approve
open "https://github.com/YOUR_ORG/YOUR_REPO/actions"
# Click on the workflow run → Review deployments → Approve

# 3. Wait for infrastructure deployment to complete
gh run watch

# 4. Run database migrations
export PROD_DB_ENDPOINT="<production-rds-endpoint>"
export PROD_DB_PASSWORD="<production-password>"

psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -f database/migrations/001_initial_schema.sql

psql -h $PROD_DB_ENDPOINT -U admin -d campaign_system \
  -f database/migrations/002_sms_replies_table.sql

# 5. Deploy Lambda functions
gh workflow run deploy-lambda.yml -f environment=production

# Approve in GitHub UI
# Wait for completion

# 6. Deploy frontend
gh workflow run deploy-frontend.yml -f environment=production

# Approve in GitHub UI
# Wait for completion

# 7. Configure Asterisk
gh workflow run deploy-asterisk.yml \
  -f environment=production \
  -f playbook=site.yml

# Approve in GitHub UI
# Wait for completion

# 8. Validate production
# - Test frontend
# - Check CloudWatch logs
# - Monitor metrics
# - Run smoke tests
```

---

## Monitoring Deployments

### GitHub Actions UI

**View all workflows:**
```bash
# List recent runs
gh run list --limit 20

# View specific workflow
gh run list --workflow=deploy-lambda.yml

# Watch a running workflow
gh run watch <run-id>

# View logs
gh run view <run-id> --log

# Download logs
gh run download <run-id>
```

**In Browser:**
1. Go to repository → Actions tab
2. Select workflow from left sidebar
3. Click on a run to view details
4. Click on a job to view logs

### Deployment Summaries

Each workflow generates a summary with:
- Environment and commit info
- Test results
- Deployment status
- Next steps
- Links to deployed resources

**View summary:**
```bash
gh run view <run-id>
```

### Real-Time Monitoring

**CloudWatch Logs:**
```bash
# Lambda logs
aws logs tail /aws/lambda/api-handler-dev --follow

# Multiple functions
aws logs tail /aws/lambda/api-handler-dev /aws/lambda/dispatcher-dev --follow

# Filter for errors
aws logs tail /aws/lambda/api-handler-dev --follow --filter-pattern "ERROR"
```

**CloudWatch Metrics:**
```bash
# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=api-handler-dev \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# Lambda errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=api-handler-dev \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum
```

### Notifications

**Set up Slack notifications:**

1. Create Slack webhook
2. Add to GitHub secrets:
```bash
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

3. Add to workflow (example):
```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Email notifications:**
- Go to GitHub → Settings → Notifications
- Enable "Actions" notifications
- Choose email preferences


---

## Troubleshooting

### Common Issues

#### Issue 1: Workflow Fails with "Unable to assume role"

**Symptom:**
```
Error: Unable to assume role arn:aws:iam::123456789012:role/GitHubActionsDeployRole
```

**Causes:**
- OIDC provider not created
- IAM role trust policy incorrect
- Repository name mismatch

**Solution:**
```bash
# Verify OIDC provider exists
aws iam list-open-id-connect-providers

# Check IAM role trust policy
aws iam get-role --role-name GitHubActionsDeployRole --query 'Role.AssumeRolePolicyDocument'

# Verify repository name in trust policy matches exactly
# Format: repo:YOUR_ORG/YOUR_REPO:*

# Update trust policy if needed
aws iam update-assume-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-document file://github-actions-trust-policy.json
```

#### Issue 2: Terraform State Lock

**Symptom:**
```
Error: Error acquiring the state lock
```

**Solution:**
```bash
# Check for lock file in S3
# With S3 native locking, wait 20 seconds for automatic expiration
aws s3 ls s3://mass-voice-campaign-terraform-state/env:/dev/.terraform.lock

# If stale, force unlock (use with caution!)
# This requires manual Terraform access
cd terraform
terraform init
terraform workspace select dev
terraform force-unlock <LOCK_ID>
```

#### Issue 3: ECR Push Failed

**Symptom:**
```
Error: denied: Your authorization token has expired
```

**Solution:**
- Re-run the workflow
- ECR login tokens expire after 12 hours
- The workflow will automatically re-authenticate

#### Issue 4: Lambda Function Not Found

**Symptom:**
```
Error: Function not found: api-handler-dev
```

**Causes:**
- Infrastructure not deployed yet
- Function name mismatch
- Wrong region

**Solution:**
```bash
# Verify function exists
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `dev`)].FunctionName'

# If missing, deploy infrastructure first
gh workflow run terraform-deploy.yml -f environment=dev -f action=apply

# Wait for completion, then retry Lambda deployment
gh workflow run deploy-lambda.yml -f environment=dev
```

#### Issue 5: Asterisk SSH Connection Failed

**Symptom:**
```
Error: Permission denied (publickey)
```

**Solution:**
```bash
# Verify SSH key secret is set
gh secret list | grep ASTERISK

# Update SSH key if needed
gh secret set ASTERISK_SSH_PRIVATE_KEY < ~/.ssh/asterisk-deploy-key

# Verify EC2 instance has correct key pair
aws ec2 describe-instances \
  --filters "Name=tag:Environment,Values=dev" "Name=tag:Name,Values=asterisk*" \
  --query 'Reservations[*].Instances[*].[InstanceId,KeyName]'
```

#### Issue 6: Frontend Shows Blank Page

**Symptom:**
- Frontend deploys successfully
- But shows blank page in browser

**Solution:**
```bash
# Check S3 bucket contents
aws s3 ls s3://mass-voice-campaign-frontend-dev/ --recursive

# Verify index.html exists
aws s3 ls s3://mass-voice-campaign-frontend-dev/index.html

# Check CloudFront distribution
aws cloudfront get-distribution --id <DISTRIBUTION_ID>

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"

# Check browser console for errors
# Common issues:
# - CORS errors (check API Gateway CORS settings)
# - Environment variables not set
# - API URL incorrect
```

#### Issue 7: Workflow Stuck in "Waiting for approval"

**Symptom:**
- Production workflow waiting indefinitely

**Solution:**
1. Go to GitHub Actions UI
2. Click on the workflow run
3. Click "Review deployments"
4. Select environment
5. Click "Approve and deploy"

**Or reject:**
```bash
# Cancel workflow
gh run cancel <run-id>
```

#### Issue 8: Tests Failing in CI but Pass Locally

**Symptom:**
- Tests pass on local machine
- Fail in GitHub Actions

**Common Causes:**
- Environment variables missing
- Different Node.js version
- Timezone differences
- Database not available

**Solution:**
```bash
# Check Node.js version in workflow
# Should match local version

# Add environment variables to workflow
# Edit .github/workflows/test.yml

# Run tests with same Node version locally
nvm use 18
npm test

# Check workflow logs for specific error
gh run view <run-id> --log
```

### Debug Mode

Enable debug logging:

```bash
# Set repository secrets
gh secret set ACTIONS_STEP_DEBUG --body "true"
gh secret set ACTIONS_RUNNER_DEBUG --body "true"

# Re-run workflow
gh run rerun <run-id> --debug
```

### Getting Help

1. **Check workflow logs:**
```bash
gh run view <run-id> --log
```

2. **Check AWS CloudWatch logs:**
```bash
aws logs tail /aws/lambda/FUNCTION_NAME --follow
```

3. **Review GitHub Actions documentation:**
- https://docs.github.com/en/actions

4. **Check AWS service health:**
- https://status.aws.amazon.com/

5. **Create GitHub issue:**
```bash
gh issue create --title "Deployment failed" --body "Description of issue"
```


---

## Best Practices

### 1. Branch Strategy

**Recommended Git Flow:**

```
feature/* → develop → main → production
```

- **feature/** branches: Individual features
- **develop** branch: Integration branch, auto-deploys to dev
- **main** branch: Stable branch, auto-deploys to staging
- **production**: Manual deployment from main

**Example:**
```bash
# Create feature branch
git checkout develop
git pull
git checkout -b feature/add-sms-templates

# Work on feature
# ... make changes ...

# Commit and push
git add .
git commit -m "Add SMS templates feature"
git push origin feature/add-sms-templates

# Create PR to develop
gh pr create --base develop --title "Add SMS templates"

# After review, merge to develop (auto-deploys to dev)
gh pr merge --squash

# Test in dev, then merge develop to main (auto-deploys to staging)
git checkout main
git merge develop
git push origin main

# Test in staging, then manually deploy to production
```

### 2. Pull Request Workflow

**Always use pull requests:**

```bash
# Create PR with template
gh pr create --base develop --title "Feature: Add SMS templates" --body "
## Description
Adds SMS template management feature

## Changes
- Added SMS template model
- Added template CRUD API
- Added template UI

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Tested in dev environment

## Checklist
- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
"

# Request reviews
gh pr edit <pr-number> --add-reviewer @teammate1,@teammate2

# View PR status
gh pr status

# Merge after approval
gh pr merge --squash
```

### 3. Environment Parity

Keep environments as similar as possible:

| Aspect | Dev | Staging | Production |
|--------|-----|---------|------------|
| Instance sizes | Small | Medium | Large |
| Multi-AZ | No | Yes | Yes |
| Backups | 7 days | 14 days | 30 days |
| Monitoring | Basic | Full | Full + Alerts |
| Data | Synthetic | Anonymized | Real |

### 4. Deployment Checklist

Before deploying to production:

- [ ] All tests pass in CI
- [ ] Code reviewed and approved
- [ ] Deployed and tested in dev
- [ ] Deployed and tested in staging
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Team notified
- [ ] Maintenance window scheduled (if needed)
- [ ] Backup taken

### 5. Secrets Management

**Never commit secrets:**

```bash
# Add to .gitignore
echo "*.tfvars" >> .gitignore
echo ".env*" >> .gitignore
echo "!.env.example" >> .gitignore

# Use GitHub Secrets for CI/CD
gh secret set SECRET_NAME --body "secret-value"

# Use AWS Secrets Manager for runtime
aws secretsmanager create-secret \
  --name my-secret \
  --secret-string "secret-value"
```

**Rotate secrets regularly:**

```bash
# Rotate every 90 days
# Set calendar reminder

# Update in AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id my-secret \
  --secret-string "new-secret-value"

# Update in GitHub Secrets
gh secret set SECRET_NAME --body "new-secret-value"
```

### 6. Monitoring and Alerting

**Set up alerts for:**

- Deployment failures
- High error rates
- Performance degradation
- Security issues

**Example CloudWatch alarm:**

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name lambda-high-errors-production \
  --alarm-description "Alert when Lambda error rate > 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ops-alerts
```

### 7. Documentation

**Keep documentation updated:**

- Update CHANGELOG.md with each deployment
- Document breaking changes
- Update API documentation
- Update runbooks

**Example CHANGELOG entry:**

```markdown
## [1.2.0] - 2024-01-15

### Added
- SMS template management feature
- Bulk SMS sending capability

### Changed
- Improved campaign scheduling algorithm
- Updated frontend dependencies

### Fixed
- Fixed timezone handling in reports
- Fixed memory leak in dialer worker

### Deployment Notes
- Run migration 003_add_sms_templates.sql
- Update environment variable SMS_PROVIDER_API_KEY
- Restart asterisk-worker service
```

### 8. Cost Optimization

**Monitor costs:**

```bash
# Check daily costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Set budget alerts
aws budgets create-budget \
  --account-id 123456789012 \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

**Stop dev/staging when not in use:**

```bash
# Stop RDS
aws rds stop-db-instance --db-instance-identifier mass-voice-campaign-postgres-dev

# Stop EC2
aws ec2 stop-instances --instance-ids i-1234567890abcdef0

# Start when needed
aws rds start-db-instance --db-instance-identifier mass-voice-campaign-postgres-dev
aws ec2 start-instances --instance-ids i-1234567890abcdef0
```

### 9. Security

**Security best practices:**

- Use OIDC instead of long-lived credentials
- Enable MFA on AWS root account
- Use least-privilege IAM policies
- Enable CloudTrail for audit logging
- Scan Docker images for vulnerabilities
- Keep dependencies updated
- Enable AWS GuardDuty

**Security scanning in CI/CD:**

```yaml
# Add to workflow
- name: Run security scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.ECR_REGISTRY }}/api-handler:latest
    format: 'sarif'
    output: 'trivy-results.sarif'

- name: Upload scan results
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'
```

### 10. Rollback Strategy

**Always have a rollback plan:**

```bash
# Tag releases
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin v1.2.0

# Rollback Lambda
aws lambda update-function-code \
  --function-name api-handler-production \
  --image-uri $ECR_REGISTRY/api-handler:v1.1.0

# Rollback frontend
git checkout v1.1.0
gh workflow run deploy-frontend.yml -f environment=production

# Rollback infrastructure
cd terraform
git checkout v1.1.0
gh workflow run terraform-deploy.yml -f environment=production -f action=apply
```


---

## Advanced Topics

### Blue-Green Deployment

For zero-downtime production deployments:

```bash
# 1. Create green environment
gh workflow run terraform-deploy.yml \
  -f environment=production-green \
  -f action=apply

# 2. Deploy application to green
gh workflow run deploy-lambda.yml -f environment=production-green
gh workflow run deploy-frontend.yml -f environment=production-green

# 3. Run smoke tests on green
# ... validate green environment ...

# 4. Switch traffic to green (update Route53 or ALB)
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file://switch-to-green.json

# 5. Monitor for 30 minutes
# ... watch metrics ...

# 6. If successful, destroy blue environment
gh workflow run terraform-deploy.yml \
  -f environment=production-blue \
  -f action=destroy
```

### Canary Deployment

Gradually roll out changes:

```yaml
# Add to Lambda deployment workflow
- name: Update Lambda alias
  run: |
    # Create new version
    VERSION=$(aws lambda publish-version \
      --function-name api-handler-production \
      --query 'Version' \
      --output text)
    
    # Update alias with traffic shifting
    aws lambda update-alias \
      --function-name api-handler-production \
      --name live \
      --function-version $VERSION \
      --routing-config AdditionalVersionWeights={"$VERSION"=0.1}
    
    # Monitor for 10 minutes
    sleep 600
    
    # If successful, shift 100% traffic
    aws lambda update-alias \
      --function-name api-handler-production \
      --name live \
      --function-version $VERSION
```

### Multi-Region Deployment

Deploy to multiple AWS regions:

```yaml
# Add to workflow
strategy:
  matrix:
    region:
      - us-east-1
      - eu-west-1
      - ap-southeast-1

steps:
  - name: Deploy to ${{ matrix.region }}
    run: |
      # Deploy infrastructure
      cd terraform
      terraform workspace select production-${{ matrix.region }}
      terraform apply -var-file=environments/production.tfvars \
        -var="aws_region=${{ matrix.region }}"
```

### Feature Flags

Use feature flags for gradual rollout:

```typescript
// In Lambda function
import { FeatureFlags } from './feature-flags';

export async function handler(event: any) {
  const flags = await FeatureFlags.get();
  
  if (flags.newSmsFeature) {
    // Use new SMS implementation
    return await newSmsHandler(event);
  } else {
    // Use old SMS implementation
    return await oldSmsHandler(event);
  }
}
```

**Manage flags via AWS AppConfig:**

```bash
# Create feature flag
aws appconfig create-configuration-profile \
  --application-id app-123 \
  --name feature-flags \
  --location-uri hosted

# Update flag
aws appconfig create-hosted-configuration-version \
  --application-id app-123 \
  --configuration-profile-id profile-456 \
  --content '{"newSmsFeature": true}' \
  --content-type application/json
```

### Automated Testing in Production

**Synthetic monitoring:**

```yaml
# Add to workflow
- name: Run synthetic tests
  run: |
    # Test critical user journeys
    npm run test:synthetic -- --env=production
    
    # Test API endpoints
    curl -f https://api.production.com/health || exit 1
    
    # Test frontend
    npx playwright test --config=playwright.production.config.ts
```

**Chaos engineering:**

```bash
# Use AWS Fault Injection Simulator
aws fis create-experiment-template \
  --cli-input-json file://chaos-experiment.json

# Run experiment
aws fis start-experiment \
  --experiment-template-id template-123
```

---

## Quick Reference

### Essential Commands

```bash
# View all workflows
gh workflow list

# Trigger workflow
gh workflow run WORKFLOW_NAME -f key=value

# List recent runs
gh run list --limit 10

# Watch running workflow
gh run watch

# View logs
gh run view <run-id> --log

# Cancel workflow
gh run cancel <run-id>

# Re-run workflow
gh run rerun <run-id>

# Download artifacts
gh run download <run-id>
```

### Workflow Triggers

| Workflow | Automatic Trigger | Manual Trigger |
|----------|------------------|----------------|
| test.yml | Every PR, push to main/develop | No |
| terraform-deploy.yml | Push to main/develop (Terraform changes) | Yes |
| deploy-lambda.yml | Push to main/develop (Lambda changes) | Yes |
| deploy-frontend.yml | Push to main/develop (Frontend changes) | Yes |
| deploy-asterisk.yml | Push to main/develop (Ansible changes) | Yes |

### Environment URLs

```bash
# Get all URLs
cd terraform

# Dev
terraform workspace select dev
echo "Frontend: https://$(terraform output -raw cloudfront_domain_name)"
echo "API: $(terraform output -raw api_gateway_url)"

# Staging
terraform workspace select staging
echo "Frontend: https://$(terraform output -raw cloudfront_domain_name)"
echo "API: $(terraform output -raw api_gateway_url)"

# Production
terraform workspace select production
echo "Frontend: https://$(terraform output -raw cloudfront_domain_name)"
echo "API: $(terraform output -raw api_gateway_url)"
```

### Deployment Checklist

**Before deploying:**
- [ ] All tests pass
- [ ] Code reviewed
- [ ] Tested in dev
- [ ] Tested in staging
- [ ] Database migrations ready
- [ ] Rollback plan documented
- [ ] Team notified

**After deploying:**
- [ ] Smoke tests pass
- [ ] Monitoring shows healthy metrics
- [ ] No errors in logs
- [ ] User acceptance testing complete
- [ ] Documentation updated
- [ ] CHANGELOG updated

---

## Support and Resources

### Documentation

- **GitHub Actions**: https://docs.github.com/en/actions
- **AWS OIDC**: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
- **Terraform**: https://www.terraform.io/docs
- **Ansible**: https://docs.ansible.com/

### Internal Documentation

- [Complete Deployment Tutorial](COMPLETE_DEPLOYMENT_TUTORIAL.md) - Manual deployment guide
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) - Quick reference checklist
- [Main README](README.md) - Project overview
- [Terraform README](terraform/README.md) - Infrastructure documentation
- [Workflows README](.github/workflows/README.md) - Workflow details

### Getting Help

1. **Check workflow logs**: `gh run view <run-id> --log`
2. **Check AWS CloudWatch**: View Lambda and service logs
3. **Review documentation**: See links above
4. **Create GitHub issue**: `gh issue create`
5. **Contact DevOps team**: devops@example.com

---

## Conclusion

You now have a fully automated CI/CD pipeline for the Mass Voice Campaign System!

### Key Takeaways

✅ **Automatic deployments** to dev and staging
✅ **Manual approval** for production
✅ **Comprehensive testing** at every stage
✅ **Easy rollback** capabilities
✅ **Full monitoring** and alerting
✅ **Secure** OIDC authentication
✅ **Cost-effective** with on-demand deployments

### Next Steps

1. **Test the pipeline**: Make a small change and push to develop
2. **Monitor deployments**: Watch the GitHub Actions UI
3. **Validate environments**: Test in dev, staging, and production
4. **Set up alerts**: Configure CloudWatch alarms and notifications
5. **Train team**: Share this guide with your team
6. **Iterate**: Improve workflows based on feedback

### Continuous Improvement

- Review deployment metrics monthly
- Update workflows as needed
- Keep dependencies updated
- Gather team feedback
- Document lessons learned

---

**Happy Deploying! 🚀**

*Last Updated: 2024-01-15*
*Version: 1.0.0*
