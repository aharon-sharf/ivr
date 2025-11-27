# Deployment Guide

This guide covers the complete deployment process for the Mass Voice Campaign System.

> **Note**: This project uses Terraform workspaces to manage multiple environments. See [Terraform Workspaces Guide](TERRAFORM_WORKSPACE_GUIDE.md) for details.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Process](#deployment-process)
5. [Post-Deployment Validation](#post-deployment-validation)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- AWS CLI v2 or later
- Terraform v1.6.0 or later
- Ansible v2.15 or later
- Node.js v18 or later
- Docker v20.10 or later
- GitHub CLI (optional, for workflow dispatch)

### AWS Account Setup

1. **Create AWS Account** (if not exists)
2. **Configure AWS CLI**:
   ```bash
   aws configure
   ```

3. **Create OIDC Provider for GitHub Actions**:
   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```

4. **Create IAM Role for Deployments**:
   ```bash
   # See .github/workflows/README.md for detailed instructions
   ```

### GitHub Repository Setup

1. **Configure Secrets**:
   - Go to Settings → Secrets and variables → Actions
   - Add required secrets (see `.github/workflows/README.md`)

2. **Configure Environments**:
   - Go to Settings → Environments
   - Create environments: `dev`, `staging`, `production`, `production-destroy`
   - Add protection rules for production (require approval)

3. **Enable GitHub Actions**:
   - Go to Settings → Actions → General
   - Allow all actions and reusable workflows

## Initial Setup

### 1. Terraform Backend

Initialize Terraform state storage:

```bash
cd terraform

# Create shared S3 bucket for all environments
./backend-setup.sh

# Initialize Terraform
terraform init

# Create workspaces for each environment
terraform workspace new dev
terraform workspace new staging
terraform workspace new production
```

This creates:
- Single S3 bucket for Terraform state (shared by all environments)
- S3 native state locking (no DynamoDB required)
- Proper encryption and versioning
- Separate workspaces for dev/staging/production

### 2. Infrastructure Deployment

Deploy base infrastructure:

```bash
# Initialize Terraform
terraform init

# Create dev workspace
terraform workspace new dev
terraform workspace select dev

# Plan and apply
terraform plan -var-file=environments/dev.tfvars -out=tfplan
terraform apply tfplan
```

Or use GitHub Actions:

```bash
gh workflow run terraform-deploy.yml -f environment=dev -f action=apply
```

### 3. Database Setup

Run database migrations:

```bash
# Get RDS endpoint from Terraform outputs
RDS_ENDPOINT=$(cd terraform && terraform output -raw rds_endpoint)

# Run migrations
psql -h $RDS_ENDPOINT -U admin -d campaign_db -f database/migrations/001_initial_schema.sql
psql -h $RDS_ENDPOINT -U admin -d campaign_db -f database/migrations/002_sms_replies_table.sql
```

### 4. Asterisk Server Setup

Deploy Asterisk configuration:

```bash
# Using GitHub Actions
gh workflow run deploy-asterisk.yml -f environment=dev -f playbook=site.yml

# Or manually with Ansible
cd ansible
ansible-playbook -i inventory/hosts.ini site.yml
```

### 5. Lambda Functions

Deploy Lambda functions:

```bash
# Using GitHub Actions
gh workflow run deploy-lambda.yml -f environment=dev

# Or manually build and push
cd src/lambda/api-handler
docker build -t api-handler:latest .
docker tag api-handler:latest $ECR_REGISTRY/api-handler:latest
docker push $ECR_REGISTRY/api-handler:latest

aws lambda update-function-code \
  --function-name api-handler-dev \
  --image-uri $ECR_REGISTRY/api-handler:latest
```

### 6. Frontend Deployment

Deploy React dashboard:

```bash
# Using GitHub Actions
gh workflow run deploy-frontend.yml -f environment=dev

# Or manually
cd frontend
npm ci
npm run build
aws s3 sync dist/ s3://campaign-dashboard-dev/
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

## Environment Configuration

### Development (dev)

**Purpose:** Rapid development and testing

**Configuration:**
- Single AZ deployment
- Smaller instance sizes
- Reduced concurrency limits
- 7-day log retention
- Auto-deploy on push to `develop` branch

**Access:**
- Dashboard: https://dev.dashboard.example.com
- API: https://dev.api.example.com

### Staging (staging)

**Purpose:** Pre-production validation and QA

**Configuration:**
- Multi-AZ deployment
- Production-like instance sizes
- Higher concurrency limits
- 14-day log retention
- Auto-deploy on push to `main` branch

**Access:**
- Dashboard: https://staging.dashboard.example.com
- API: https://staging.api.example.com

### Production (production)

**Purpose:** Live customer-facing environment

**Configuration:**
- Multi-AZ deployment across 3 AZs
- Large instance sizes
- Maximum concurrency limits
- 30-day log retention
- Manual deployment with approval required

**Access:**
- Dashboard: https://dashboard.example.com
- API: https://api.example.com

## Deployment Process

### Standard Deployment Flow

```
1. Create feature branch
   ↓
2. Develop and test locally
   ↓
3. Create Pull Request
   ↓
4. Automated tests run
   ↓
5. Code review and approval
   ↓
6. Merge to develop → Auto-deploy to dev
   ↓
7. Validate in dev environment
   ↓
8. Merge to main → Auto-deploy to staging
   ↓
9. QA testing in staging
   ↓
10. Manual production deployment
    ↓
11. Post-deployment validation
```

### Hotfix Deployment

For urgent production fixes:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/critical-bug-fix

# 2. Make fix and test locally
# ... make changes ...
npm run test

# 3. Create PR and get expedited review
gh pr create --title "Hotfix: Critical bug fix" --base main

# 4. After approval, merge to main
gh pr merge --squash

# 5. Deploy to staging first
gh workflow run deploy-lambda.yml -f environment=staging

# 6. Validate in staging
# ... run smoke tests ...

# 7. Deploy to production
gh workflow run deploy-lambda.yml -f environment=production

# 8. Monitor production
# ... watch CloudWatch logs and metrics ...
```

### Database Migration Deployment

For schema changes:

```bash
# 1. Create migration file
cat > database/migrations/003_new_feature.sql << EOF
-- Migration: Add new feature
-- Date: 2024-01-15

BEGIN;

-- Add new columns
ALTER TABLE campaigns ADD COLUMN new_field VARCHAR(255);

-- Create indexes
CREATE INDEX idx_campaigns_new_field ON campaigns(new_field);

COMMIT;
EOF

# 2. Test migration in dev
psql -h $DEV_RDS_ENDPOINT -U admin -d campaign_db -f database/migrations/003_new_feature.sql

# 3. Validate application works with new schema
npm run test

# 4. Deploy to staging
psql -h $STAGING_RDS_ENDPOINT -U admin -d campaign_db -f database/migrations/003_new_feature.sql

# 5. Deploy to production (during maintenance window)
psql -h $PROD_RDS_ENDPOINT -U admin -d campaign_db -f database/migrations/003_new_feature.sql
```

### Blue-Green Deployment (Advanced)

For zero-downtime deployments:

```bash
# 1. Deploy new version to "green" environment
terraform workspace new production-green
terraform apply -var-file=environments/production.tfvars

# 2. Deploy application to green
gh workflow run deploy-lambda.yml -f environment=production-green

# 3. Run smoke tests on green
# ... validate green environment ...

# 4. Switch traffic to green (update Route53 or ALB)
aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file://switch-to-green.json

# 5. Monitor for issues
# ... watch metrics for 30 minutes ...

# 6. If successful, destroy blue environment
terraform workspace select production-blue
terraform destroy -var-file=environments/production.tfvars
```

## Post-Deployment Validation

### Automated Health Checks

The deployment workflows include automated health checks:

- ✅ Service status verification
- ✅ HTTP endpoint testing
- ✅ Database connectivity
- ✅ Redis connectivity
- ✅ SIP trunk registration

### Manual Validation Checklist

After deployment, verify:

- [ ] Dashboard loads successfully
- [ ] User can log in with Cognito
- [ ] Campaign creation works
- [ ] Contact upload works
- [ ] Audio upload/recording works
- [ ] IVR flow builder works
- [ ] Test campaign can be scheduled
- [ ] Real-time dashboard updates
- [ ] Analytics page loads
- [ ] Blacklist management works

### Smoke Tests

Run smoke tests:

```bash
# Test API endpoints
curl -X GET https://api.example.com/health
curl -X GET https://api.example.com/campaigns -H "Authorization: Bearer $TOKEN"

# Test Lambda functions
aws lambda invoke \
  --function-name api-handler-production \
  --payload '{"test": true}' \
  response.json

# Test Asterisk
ssh ubuntu@asterisk-prod "sudo asterisk -rx 'core show version'"
ssh ubuntu@asterisk-prod "sudo systemctl status asterisk"
ssh ubuntu@asterisk-prod "sudo systemctl status asterisk-worker"
```

### Monitoring

Monitor key metrics:

```bash
# CloudWatch Logs
aws logs tail /aws/lambda/api-handler-production --follow

# CloudWatch Metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=api-handler-production \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# X-Ray Traces
aws xray get-trace-summaries \
  --start-time $(date -u -d '5 minutes ago' +%s) \
  --end-time $(date -u +%s)
```

## Rollback Procedures

### Lambda Rollback

```bash
# Option 1: Redeploy previous version
git checkout PREVIOUS_COMMIT
gh workflow run deploy-lambda.yml -f environment=production

# Option 2: Update to previous image
aws lambda update-function-code \
  --function-name api-handler-production \
  --image-uri $ECR_REGISTRY/api-handler:PREVIOUS_SHA
```

### Infrastructure Rollback

```bash
# Option 1: Revert Terraform changes
cd terraform
git revert HEAD
git push origin main
gh workflow run terraform-deploy.yml -f environment=production -f action=apply

# Option 2: Apply previous state
terraform workspace select production
terraform apply -var-file=environments/production.tfvars
```

### Database Rollback

```bash
# Create rollback migration
cat > database/migrations/003_rollback.sql << EOF
BEGIN;
ALTER TABLE campaigns DROP COLUMN new_field;
COMMIT;
EOF

# Apply rollback
psql -h $PROD_RDS_ENDPOINT -U admin -d campaign_db -f database/migrations/003_rollback.sql
```

### Frontend Rollback

```bash
# Redeploy previous version
git checkout PREVIOUS_COMMIT
gh workflow run deploy-frontend.yml -f environment=production
```

## Troubleshooting

### Common Issues

#### 1. Lambda Deployment Fails

**Symptom:** `Error: Function not found`

**Solution:**
```bash
# Verify function exists
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `api-handler`)].FunctionName'

# If missing, deploy infrastructure first
gh workflow run terraform-deploy.yml -f environment=production -f action=apply
```

#### 2. Terraform State Lock

**Symptom:** `Error: Error acquiring the state lock`

**Solution:**
```bash
# With S3 native locking, wait 20 seconds for automatic expiration
# Or check for lock file in S3:
aws s3 ls s3://mass-voice-campaign-terraform-state/env:/production/.terraform.lock

# Force unlock (use with caution!)
# First, make sure you're in the correct workspace
terraform workspace select production
terraform force-unlock LOCK_ID
```

#### 3. Asterisk Not Responding

**Symptom:** Health checks fail for Asterisk

**Solution:**
```bash
# SSH to server
ssh ubuntu@asterisk-prod

# Check service status
sudo systemctl status asterisk
sudo systemctl status asterisk-worker

# Check logs
sudo tail -f /var/log/asterisk/messages
sudo journalctl -u asterisk-worker -f

# Restart services
sudo systemctl restart asterisk
sudo systemctl restart asterisk-worker
```

#### 4. Database Connection Errors

**Symptom:** Lambda functions can't connect to RDS

**Solution:**
```bash
# Verify security group rules
aws ec2 describe-security-groups --group-ids $RDS_SG_ID

# Test connection from Lambda VPC
aws lambda invoke \
  --function-name api-handler-production \
  --payload '{"action": "test-db-connection"}' \
  response.json

# Check RDS status
aws rds describe-db-instances --db-instance-identifier campaign-db-production
```

#### 5. Frontend Not Loading

**Symptom:** Dashboard shows 404 or blank page

**Solution:**
```bash
# Check S3 bucket contents
aws s3 ls s3://campaign-dashboard-production/

# Check CloudFront distribution
aws cloudfront get-distribution --id $DIST_ID

# Invalidate cache
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"

# Check CloudFront logs
aws s3 ls s3://campaign-dashboard-logs/
```

### Getting Help

1. **Check workflow logs** in GitHub Actions
2. **Review CloudWatch logs** in AWS Console
3. **Check X-Ray traces** for distributed tracing
4. **Review Terraform plan** before applying
5. **Contact DevOps team** for assistance

## Best Practices

1. **Always deploy to dev first** - Never skip environments
2. **Test thoroughly in staging** - Staging should mirror production
3. **Deploy during maintenance windows** - Schedule production deployments
4. **Monitor after deployment** - Watch metrics for at least 30 minutes
5. **Have rollback plan ready** - Know how to rollback before deploying
6. **Document changes** - Update CHANGELOG.md with each deployment
7. **Use feature flags** - Enable gradual rollout of new features
8. **Tag releases** - Use Git tags for production deployments
9. **Backup before migrations** - Always backup database before schema changes
10. **Communicate deployments** - Notify team of production deployments

## Maintenance Windows

Recommended maintenance windows for production deployments:

- **Preferred:** Sunday 2:00 AM - 6:00 AM IST (low traffic)
- **Acceptable:** Weekday 11:00 PM - 1:00 AM IST
- **Avoid:** Business hours (9:00 AM - 6:00 PM IST)

## Support Contacts

- **DevOps Team:** devops@example.com
- **On-Call Engineer:** +972-XX-XXX-XXXX
- **Slack Channel:** #mass-voice-campaign-ops

## Additional Resources

- [GitHub Actions Workflows](.github/workflows/README.md)
- [Terraform Documentation](terraform/README.md)
- [Ansible Playbooks](ansible/README.md)
- [Frontend Deployment](frontend/DEPLOYMENT.md)
- [AWS Architecture Diagram](docs/architecture.md)
