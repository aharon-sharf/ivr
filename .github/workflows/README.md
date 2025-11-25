# CI/CD Workflows

This directory contains GitHub Actions workflows for automated deployment of the Mass Voice Campaign System.

## Overview

The CI/CD pipeline consists of four main workflows:

1. **Lambda Deployment** (`deploy-lambda.yml`) - Builds and deploys Lambda functions
2. **Infrastructure Updates** (`terraform-deploy.yml`) - Manages AWS infrastructure via Terraform
3. **Frontend Deployment** (`deploy-frontend.yml`) - Builds and deploys the React dashboard
4. **Asterisk Configuration** (`deploy-asterisk.yml`) - Configures Asterisk telephony servers

## Prerequisites

### Required GitHub Secrets

Configure the following secrets in your GitHub repository settings:

- `AWS_ACCOUNT_ID` - Your AWS account ID
- `AWS_DEPLOY_ROLE_ARN` - ARN of the IAM role for deployments (e.g., `arn:aws:iam::123456789012:role/GitHubActionsDeployRole`)
- `ASTERISK_SSH_PRIVATE_KEY` - SSH private key for accessing Asterisk EC2 instances
- `ASTERISK_HOST` - Hostname or IP of Asterisk server (for SSH key scanning)

### AWS IAM Role Setup

Create an IAM role with OIDC federation for GitHub Actions:

```bash
# Create trust policy
cat > trust-policy.json << EOF
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

# Create role
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://trust-policy.json

# Attach policies (adjust as needed)
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

### Terraform Backend Setup

Initialize Terraform state buckets for each environment:

```bash
# Run the backend setup script
cd terraform
./backend-setup.sh dev
./backend-setup.sh staging
./backend-setup.sh production
```

## Workflows

### 1. Lambda Deployment

**File:** `deploy-lambda.yml`

**Triggers:**
- Push to `main` or `develop` branches (when Lambda code changes)
- Manual workflow dispatch

**What it does:**
1. Runs unit tests and property-based tests
2. Builds Docker images for all Lambda functions
3. Pushes images to Amazon ECR
4. Updates Lambda function code
5. Runs smoke tests
6. Runs integration tests (on main/develop branches)

**Manual Deployment:**

```bash
# Deploy all functions to dev
gh workflow run deploy-lambda.yml -f environment=dev

# Deploy specific functions to staging
gh workflow run deploy-lambda.yml -f environment=staging -f functions="api-handler,dispatcher"

# Deploy to production
gh workflow run deploy-lambda.yml -f environment=production
```

**Environment Variables:**
- `AWS_REGION` - Target AWS region (default: il-central-1)
- `NODE_VERSION` - Node.js version (default: 18)
- `ECR_REGISTRY` - ECR registry URL

### 2. Infrastructure Updates

**File:** `terraform-deploy.yml`

**Triggers:**
- Push to `main` or `develop` branches (when Terraform code changes)
- Pull requests (plan only)
- Manual workflow dispatch

**What it does:**
1. Validates Terraform configuration
2. Generates Terraform plans for all environments
3. Auto-applies to dev (on develop branch push)
4. Auto-applies to staging (on main branch push)
5. Requires manual approval for production

**Deployment Flow:**

```
develop branch → Auto-deploy to dev
     ↓
main branch → Auto-deploy to staging
     ↓
Manual approval → Deploy to production
```

**Manual Deployment:**

```bash
# Plan changes for production
gh workflow run terraform-deploy.yml -f environment=production -f action=plan

# Apply changes to production (requires approval)
gh workflow run terraform-deploy.yml -f environment=production -f action=apply

# Destroy infrastructure (use with caution!)
gh workflow run terraform-deploy.yml -f environment=dev -f action=destroy
```

**Environment-Specific Configuration:**

Each environment has its own tfvars file:
- `terraform/environments/dev.tfvars`
- `terraform/environments/staging.tfvars`
- `terraform/environments/production.tfvars`

### 3. Frontend Deployment

**File:** `deploy-frontend.yml`

**Triggers:**
- Push to `main` or `develop` branches (when frontend code changes)
- Manual workflow dispatch

**What it does:**
1. Installs dependencies
2. Runs linter
3. Builds React application
4. Uploads to S3 bucket
5. Invalidates CloudFront cache

**Manual Deployment:**

```bash
# Deploy to dev
gh workflow run deploy-frontend.yml -f environment=dev

# Deploy to production
gh workflow run deploy-frontend.yml -f environment=production
```

**Build Configuration:**
- Uses Vite for fast builds
- Applies cache headers (long cache for assets, no-cache for index.html)
- Excludes source maps from production

### 4. Asterisk Configuration

**File:** `deploy-asterisk.yml`

**Triggers:**
- Push to `main` or `develop` branches (when Ansible or asterisk-worker code changes)
- Manual workflow dispatch

**What it does:**
1. Validates Ansible playbooks
2. Builds Node.js worker package
3. Discovers Asterisk EC2 instances via AWS tags
4. Runs Ansible playbooks
5. Restarts services
6. Runs health checks

**Manual Deployment:**

```bash
# Deploy full configuration to dev
gh workflow run deploy-asterisk.yml -f environment=dev -f playbook=site.yml

# Update only Node.js worker
gh workflow run deploy-asterisk.yml -f environment=staging -f playbook=nodejs-worker-deploy.yml

# Skip health checks
gh workflow run deploy-asterisk.yml -f environment=dev -f skip_health_check=true
```

**Available Playbooks:**
- `site.yml` - Full deployment (Asterisk + Node.js worker)
- `asterisk-setup.yml` - Initial Asterisk installation
- `asterisk-configure.yml` - Update Asterisk configuration
- `nodejs-worker-deploy.yml` - Deploy Node.js worker only

**Health Checks:**
- Verifies Asterisk service is running
- Verifies Node.js worker service is running
- Tests AMI port (5038) connectivity
- Tests Node.js worker HTTP endpoint
- Checks SIP trunk registration status

## Deployment Strategies

### Development Environment

**Automatic Deployment:**
- Push to `develop` branch triggers automatic deployment to dev environment
- All workflows run automatically
- No manual approval required

**Use Case:** Rapid iteration and testing

### Staging Environment

**Automatic Deployment:**
- Push to `main` branch triggers automatic deployment to staging environment
- Terraform and Lambda deployments run automatically
- No manual approval required

**Use Case:** Pre-production validation and QA testing

### Production Environment

**Manual Deployment Only:**
- Requires manual workflow dispatch
- Requires approval via GitHub Environments
- Terraform changes require explicit approval

**Deployment Process:**
1. Merge PR to `main` (deploys to staging)
2. Validate in staging environment
3. Manually trigger production deployment
4. Approve deployment in GitHub UI
5. Monitor deployment and health checks

## Monitoring Deployments

### GitHub Actions UI

View deployment status:
1. Go to repository → Actions tab
2. Select workflow from left sidebar
3. View run history and logs

### Deployment Summaries

Each workflow generates a deployment summary with:
- Environment and commit information
- Test results
- Deployment status
- Next steps

### Notifications

Configure notifications in GitHub repository settings:
- Email notifications for failed workflows
- Slack/Discord webhooks for deployment events

## Rollback Procedures

### Lambda Functions

```bash
# Rollback to previous image
aws lambda update-function-code \
  --function-name api-handler-production \
  --image-uri $ECR_REGISTRY/api-handler:PREVIOUS_SHA
```

### Infrastructure

```bash
# Revert Terraform changes
cd terraform
git revert HEAD
git push origin main

# Or manually apply previous state
terraform apply -var-file=environments/production.tfvars
```

### Frontend

```bash
# Redeploy previous version
git checkout PREVIOUS_COMMIT
gh workflow run deploy-frontend.yml -f environment=production
```

### Asterisk

```bash
# Redeploy previous configuration
git checkout PREVIOUS_COMMIT
gh workflow run deploy-asterisk.yml -f environment=production -f playbook=site.yml
```

## Troubleshooting

### Common Issues

**1. AWS Credentials Error**
```
Error: Unable to assume role
```
**Solution:** Verify `AWS_DEPLOY_ROLE_ARN` secret is correct and OIDC provider is configured

**2. Terraform State Lock**
```
Error: Error acquiring the state lock
```
**Solution:** Manually release lock in DynamoDB table or wait for timeout

**3. ECR Push Failed**
```
Error: denied: Your authorization token has expired
```
**Solution:** Re-run workflow (ECR login tokens expire after 12 hours)

**4. Asterisk SSH Connection Failed**
```
Error: Permission denied (publickey)
```
**Solution:** Verify `ASTERISK_SSH_PRIVATE_KEY` secret is correct and matches EC2 key pair

### Debug Mode

Enable debug logging by setting repository secrets:
- `ACTIONS_STEP_DEBUG` = `true`
- `ACTIONS_RUNNER_DEBUG` = `true`

## Best Practices

1. **Always test in dev first** - Never deploy directly to production
2. **Use feature branches** - Create PRs for code review before merging
3. **Monitor deployments** - Watch CloudWatch logs and metrics after deployment
4. **Tag releases** - Use Git tags for production deployments
5. **Document changes** - Update CHANGELOG.md with deployment notes
6. **Run health checks** - Always verify services after deployment
7. **Keep secrets secure** - Rotate AWS credentials regularly
8. **Review Terraform plans** - Always review plans before applying

## Security Considerations

- All workflows use OIDC for AWS authentication (no long-lived credentials)
- Secrets are encrypted at rest in GitHub
- Production deployments require manual approval
- SSH keys are stored as GitHub secrets
- Docker images are scanned for vulnerabilities (optional: add Trivy scan)

## Cost Optimization

- Workflows only run when relevant files change
- Lambda deployments use matrix strategy for parallel execution
- Terraform plans are cached as artifacts
- Frontend builds use npm cache
- Health checks have configurable timeouts

## Support

For issues or questions:
1. Check workflow logs in GitHub Actions
2. Review CloudWatch logs in AWS Console
3. Contact DevOps team
4. Create issue in repository

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS OIDC Setup](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [Terraform Cloud Backend](https://www.terraform.io/docs/language/settings/backends/s3.html)
- [Ansible Best Practices](https://docs.ansible.com/ansible/latest/user_guide/playbooks_best_practices.html)
