# Environment-Specific Configuration Files

This directory contains Terraform variable files (`.tfvars`) for each environment.

## Files

- **dev.tfvars** - Development environment configuration
- **staging.tfvars** - Staging environment configuration  
- **production.tfvars** - Production environment configuration

## Usage

When deploying to a specific environment, always specify the corresponding `.tfvars` file:

```bash
# Deploy to dev
terraform workspace select dev
terraform apply -var-file=environments/dev.tfvars

# Deploy to staging
terraform workspace select staging
terraform apply -var-file=environments/staging.tfvars

# Deploy to production
terraform workspace select production
terraform apply -var-file=environments/production.tfvars
```

## Configuration Differences

### Development (dev.tfvars)
- Smaller instance sizes for cost savings
- Single AZ deployment
- Shorter backup retention (7 days)
- Lower Lambda concurrency limits
- Minimal SageMaker resources

### Staging (staging.tfvars)
- Medium instance sizes
- Multi-AZ for testing HA scenarios
- Medium backup retention (14 days)
- Production-like configuration
- Used for final testing before production

### Production (production.tfvars)
- Large instance sizes for performance
- Multi-AZ for high availability
- Long backup retention (30 days)
- High Lambda concurrency limits
- Full SageMaker resources
- Additional monitoring and alerting

## Important Notes

⚠️ **Never commit sensitive values** (passwords, API keys) to these files!

Use AWS Secrets Manager or environment variables for sensitive data:

```hcl
# In your Terraform code
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "mass-voice-campaign-db-password-${var.environment}"
}
```

## Adding a New Environment

To add a new environment (e.g., `qa`):

1. Copy an existing `.tfvars` file:
   ```bash
   cp dev.tfvars qa.tfvars
   ```

2. Update the values in `qa.tfvars`:
   ```hcl
   environment = "qa"
   # ... other settings
   ```

3. Create a new workspace:
   ```bash
   terraform workspace new qa
   ```

4. Deploy:
   ```bash
   terraform workspace select qa
   terraform apply -var-file=environments/qa.tfvars
   ```

## Validation

Before applying, always validate your configuration:

```bash
# Check syntax
terraform validate

# Preview changes
terraform plan -var-file=environments/dev.tfvars

# Check for security issues (optional)
tfsec .
```

## Best Practices

1. ✅ Always specify `-var-file` explicitly
2. ✅ Keep environment configs as similar as possible
3. ✅ Use variables for all environment-specific values
4. ✅ Document any environment-specific quirks
5. ✅ Review changes carefully before applying to production
6. ❌ Never hardcode sensitive values
7. ❌ Don't use different resource types between environments
