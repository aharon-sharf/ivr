# CI/CD Quick Reference

Quick commands for common deployment operations.

## Prerequisites

Install GitHub CLI:
```bash
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

## Common Commands

### Deploy Everything to Dev

```bash
# Infrastructure
gh workflow run terraform-deploy.yml -f environment=dev -f action=apply

# Lambda functions
gh workflow run deploy-lambda.yml -f environment=dev

# Frontend
gh workflow run deploy-frontend.yml -f environment=dev

# Asterisk
gh workflow run deploy-asterisk.yml -f environment=dev -f playbook=site.yml
```

### Deploy Single Lambda Function

```bash
gh workflow run deploy-lambda.yml \
  -f environment=production \
  -f functions="api-handler"
```

### Deploy Multiple Lambda Functions

```bash
gh workflow run deploy-lambda.yml \
  -f environment=production \
  -f functions="api-handler,dispatcher,dialer-worker"
```

### Terraform Operations

```bash
# Plan only
gh workflow run terraform-deploy.yml -f environment=production -f action=plan

# Apply changes
gh workflow run terraform-deploy.yml -f environment=production -f action=apply

# Destroy (use with caution!)
gh workflow run terraform-deploy.yml -f environment=dev -f action=destroy
```

### Asterisk Deployments

```bash
# Full deployment
gh workflow run deploy-asterisk.yml -f environment=production -f playbook=site.yml

# Update configuration only
gh workflow run deploy-asterisk.yml -f environment=production -f playbook=asterisk-configure.yml

# Deploy Node.js worker only
gh workflow run deploy-asterisk.yml -f environment=production -f playbook=nodejs-worker-deploy.yml

# Skip health checks
gh workflow run deploy-asterisk.yml -f environment=dev -f skip_health_check=true
```

### View Workflow Status

```bash
# List recent runs
gh run list --workflow=deploy-lambda.yml

# Watch a specific run
gh run watch

# View logs
gh run view --log
```

### Rollback

```bash
# Rollback Lambda
git checkout PREVIOUS_COMMIT
gh workflow run deploy-lambda.yml -f environment=production

# Rollback Frontend
git checkout PREVIOUS_COMMIT
gh workflow run deploy-frontend.yml -f environment=production

# Rollback Infrastructure
cd terraform
git revert HEAD
git push origin main
```

## Environment URLs

### Development
- Dashboard: https://dev.dashboard.example.com
- API: https://dev.api.example.com

### Staging
- Dashboard: https://staging.dashboard.example.com
- API: https://staging.api.example.com

### Production
- Dashboard: https://dashboard.example.com
- API: https://api.example.com

## AWS CLI Commands

### Lambda

```bash
# List functions
aws lambda list-functions --query 'Functions[].FunctionName'

# Get function info
aws lambda get-function --function-name api-handler-production

# Invoke function
aws lambda invoke \
  --function-name api-handler-production \
  --payload '{"test": true}' \
  response.json

# View logs
aws logs tail /aws/lambda/api-handler-production --follow
```

### ECR

```bash
# List repositories
aws ecr describe-repositories

# List images
aws ecr list-images --repository-name api-handler

# Delete old images
aws ecr batch-delete-image \
  --repository-name api-handler \
  --image-ids imageTag=old-tag
```

### RDS

```bash
# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier campaign-db-production \
  --query 'DBInstances[0].Endpoint.Address'

# Create snapshot
aws rds create-db-snapshot \
  --db-instance-identifier campaign-db-production \
  --db-snapshot-identifier manual-backup-$(date +%Y%m%d)
```

### S3

```bash
# List buckets
aws s3 ls

# Sync frontend
aws s3 sync frontend/dist/ s3://campaign-dashboard-production/

# View bucket contents
aws s3 ls s3://campaign-dashboard-production/ --recursive
```

### CloudFront

```bash
# List distributions
aws cloudfront list-distributions

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

## Terraform Commands

```bash
# Initialize
terraform init

# Select workspace
terraform workspace select production

# Plan
terraform plan -var-file=environments/production.tfvars

# Apply
terraform apply -var-file=environments/production.tfvars

# Show outputs
terraform output

# Show state
terraform show
```

## Ansible Commands

```bash
# Test connectivity
ansible asterisk -i inventory/hosts.ini -m ping

# Run playbook
ansible-playbook -i inventory/hosts.ini site.yml

# Run specific tasks
ansible-playbook -i inventory/hosts.ini site.yml --tags "nodejs-worker"

# Check syntax
ansible-playbook --syntax-check site.yml

# Dry run
ansible-playbook -i inventory/hosts.ini site.yml --check
```

## Health Checks

```bash
# API health
curl https://api.example.com/health

# Lambda health
aws lambda invoke \
  --function-name api-handler-production \
  --payload '{"action": "health"}' \
  response.json

# Asterisk health
ssh ubuntu@asterisk-prod "sudo systemctl status asterisk"
ssh ubuntu@asterisk-prod "sudo asterisk -rx 'core show version'"

# Database health
psql -h $RDS_ENDPOINT -U admin -d campaign_db -c "SELECT 1"

# Redis health
redis-cli -h $REDIS_ENDPOINT ping
```

## Monitoring

```bash
# CloudWatch logs
aws logs tail /aws/lambda/api-handler-production --follow

# CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=api-handler-production \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# X-Ray traces
aws xray get-trace-summaries \
  --start-time $(date -u -d '5 minutes ago' +%s) \
  --end-time $(date -u +%s)
```

## Emergency Procedures

### Stop All Campaigns

```bash
# Pause all active campaigns via API
curl -X POST https://api.example.com/campaigns/pause-all \
  -H "Authorization: Bearer $TOKEN"

# Or via Lambda
aws lambda invoke \
  --function-name api-handler-production \
  --payload '{"action": "pause-all-campaigns"}' \
  response.json
```

### Scale Down

```bash
# Reduce Lambda concurrency
aws lambda put-function-concurrency \
  --function-name dialer-worker-production \
  --reserved-concurrent-executions 10

# Stop Asterisk
ssh ubuntu@asterisk-prod "sudo systemctl stop asterisk"
```

### Scale Up

```bash
# Increase Lambda concurrency
aws lambda put-function-concurrency \
  --function-name dialer-worker-production \
  --reserved-concurrent-executions 2000

# Start Asterisk
ssh ubuntu@asterisk-prod "sudo systemctl start asterisk"
```

## Troubleshooting

### Check Workflow Failures

```bash
# List failed runs
gh run list --workflow=deploy-lambda.yml --status=failure

# View failed run
gh run view RUN_ID --log-failed
```

### Check Lambda Errors

```bash
# Get error metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=api-handler-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# View recent errors
aws logs filter-pattern /aws/lambda/api-handler-production --filter-pattern "ERROR"
```

### Check Terraform State

```bash
# Show current state
terraform show

# List resources
terraform state list

# Show specific resource
terraform state show aws_lambda_function.api_handler
```

## Useful Aliases

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# GitHub CLI
alias ghw='gh workflow'
alias ghr='gh run'

# AWS
alias awsl='aws lambda'
alias awss='aws s3'
alias awse='aws ecr'

# Terraform
alias tf='terraform'
alias tfi='terraform init'
alias tfp='terraform plan'
alias tfa='terraform apply'

# Ansible
alias ap='ansible-playbook'
alias ai='ansible-inventory'

# Deployment shortcuts
alias deploy-dev='gh workflow run deploy-lambda.yml -f environment=dev'
alias deploy-staging='gh workflow run deploy-lambda.yml -f environment=staging'
alias deploy-prod='gh workflow run deploy-lambda.yml -f environment=production'
```

## Support

- **Documentation:** See [workflows/README.md](.github/workflows/README.md)
- **Deployment Guide:** See [DEPLOYMENT.md](../DEPLOYMENT.md)
- **Slack:** #mass-voice-campaign-ops
- **Email:** devops@example.com
