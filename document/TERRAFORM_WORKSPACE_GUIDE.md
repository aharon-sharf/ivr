# Terraform Workspaces Guide

## Overview

This project uses **Terraform workspaces** to manage multiple environments (dev, staging, production) with a single S3 bucket for state storage.

## Why Workspaces?

Instead of creating separate S3 buckets for each environment, we use:
- **One S3 bucket**: `mass-voice-campaign-terraform-state`
- **Multiple workspaces**: `dev`, `staging`, `production`

Each workspace maintains its own state file within the same bucket:
```
s3://mass-voice-campaign-terraform-state/
├── env:/dev/
│   └── terraform.tfstate
├── env:/staging/
│   └── terraform.tfstate
└── env:/production/
    └── terraform.tfstate
```

## Benefits

✅ **Simpler setup**: One bucket to manage instead of three  
✅ **Cost-effective**: Reduced S3 costs and management overhead  
✅ **Consistent configuration**: Same backend config for all environments  
✅ **Easy switching**: Change environments with one command  

## Setup

### 1. Create the Backend (One Time)

```bash
cd terraform
./backend-setup.sh
```

This creates:
- S3 bucket with versioning enabled
- Encryption enabled (AES256)
- Public access blocked
- S3 native state locking

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Create Workspaces

```bash
# Create workspaces
terraform workspace new dev
terraform workspace new staging
terraform workspace new production

# List all workspaces
terraform workspace list
```

## Usage

### Switch Between Environments

```bash
# Switch to dev
terraform workspace select dev

# Switch to staging
terraform workspace select staging

# Switch to production
terraform workspace select production

# Show current workspace
terraform workspace show
```

### Deploy to Specific Environment

```bash
# Deploy to dev
terraform workspace select dev
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars

# Deploy to staging
terraform workspace select staging
terraform plan -var-file=environments/staging.tfvars
terraform apply -var-file=environments/staging.tfvars

# Deploy to production
terraform workspace select production
terraform plan -var-file=environments/production.tfvars
terraform apply -var-file=environments/production.tfvars
```

## Important Notes

### Always Check Your Workspace

Before running any Terraform command, verify you're in the correct workspace:

```bash
terraform workspace show
```

### State File Locations

Each workspace has its own state file in S3:
- `dev` → `s3://mass-voice-campaign-terraform-state/env:/dev/terraform.tfstate`
- `staging` → `s3://mass-voice-campaign-terraform-state/env:/staging/terraform.tfstate`
- `production` → `s3://mass-voice-campaign-terraform-state/env:/production/terraform.tfstate`

### State Locking

S3 native locking is enabled:
- Lock files expire automatically after 20 seconds
- No DynamoDB table required
- Lock file location: `s3://mass-voice-campaign-terraform-state/env:/<workspace>/.terraform.lock`

### Force Unlock (Use with Caution)

If you need to force unlock a stale lock:

```bash
# Switch to the correct workspace first
terraform workspace select dev

# Force unlock
terraform force-unlock <LOCK_ID>
```

## Troubleshooting

### Wrong Workspace

**Problem**: Applied changes to wrong environment

**Solution**: 
```bash
# Check current workspace
terraform workspace show

# Switch to correct workspace
terraform workspace select <correct-environment>
```

### State Lock Issues

**Problem**: State is locked

**Solution**:
```bash
# Wait 20 seconds for automatic expiration
sleep 20

# Or check lock file
aws s3 ls s3://mass-voice-campaign-terraform-state/env:/dev/.terraform.lock

# Force unlock if needed
terraform workspace select dev
terraform force-unlock <LOCK_ID>
```

### Workspace Doesn't Exist

**Problem**: `Workspace "dev" doesn't exist`

**Solution**:
```bash
# Create the workspace
terraform workspace new dev
```

## Best Practices

1. **Always verify workspace** before running commands
2. **Use workspace-specific tfvars files** (dev.tfvars, staging.tfvars, production.tfvars)
3. **Never delete the default workspace** (it's required by Terraform)
4. **Document workspace changes** in your deployment logs
5. **Use CI/CD** to automate workspace selection

## CI/CD Integration

In GitHub Actions workflows, workspaces are selected automatically:

```yaml
- name: Select Terraform Workspace
  run: |
    cd terraform
    terraform workspace select ${{ inputs.environment }} || terraform workspace new ${{ inputs.environment }}
```

## Cleanup

### Delete a Workspace

```bash
# Switch to a different workspace first
terraform workspace select default

# Delete the workspace
terraform workspace delete dev
```

### Delete State Files

```bash
# Delete state for specific workspace
aws s3 rm s3://mass-voice-campaign-terraform-state/env:/dev/ --recursive

# Delete entire bucket (all environments)
aws s3 rb s3://mass-voice-campaign-terraform-state --force
```

## References

- [Terraform Workspaces Documentation](https://www.terraform.io/docs/language/state/workspaces.html)
- [S3 Backend Configuration](https://www.terraform.io/docs/language/settings/backends/s3.html)
- [Project Deployment Guide](DEPLOYMENT.md)
- [CI/CD Deployment Guide](CICD_DEPLOYMENT_GUIDE.md)

---

**Last Updated**: 2024-01-15  
**Version**: 1.0.0
