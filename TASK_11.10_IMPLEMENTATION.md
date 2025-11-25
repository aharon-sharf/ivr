# Task 11.10 Implementation: Deploy Frontend to S3 + CloudFront

## Overview

Implemented complete infrastructure and deployment pipeline for the Mass Voice Campaign System frontend using AWS S3 + CloudFront.

## What Was Implemented

### 1. Infrastructure (Terraform)

**CloudFront Distribution** (`terraform/modules/storage/main.tf`):
- Origin Access Identity (OAI) for secure S3 access
- HTTPS-only with redirect from HTTP
- Gzip compression enabled
- Custom error responses for SPA routing (403/404 → index.html)
- Cache optimization (static assets: 1 year, index.html: no-cache)
- Price Class 100 (North America + Europe edge locations)

**S3 Bucket Configuration**:
- Website hosting enabled
- Versioning enabled for rollback capability
- Server-side encryption (AES256)
- Bucket policy allowing only CloudFront access
- CORS configuration for uploads

**Terraform Outputs** (`terraform/modules/storage/outputs.tf`):
- `cloudfront_distribution_id` - For cache invalidation
- `cloudfront_domain_name` - Frontend URL
- `cloudfront_hosted_zone_id` - For Route 53 alias records
- `frontend_hosting_bucket` - S3 bucket name

### 2. Deployment Scripts

**`frontend/deploy.sh`**:
- Automated deployment script
- Fetches infrastructure details from Terraform
- Builds React application
- Uploads to S3 with optimized cache headers
- Invalidates CloudFront cache
- Displays deployment URL

**`frontend/pre-deploy-check.sh`**:
- Pre-deployment validation
- Checks Node.js version
- Runs linter and TypeScript compilation
- Validates build output
- Verifies AWS credentials
- Confirms Terraform infrastructure

**`frontend/generate-env.sh`**:
- Generates environment configuration from Terraform outputs
- Automatically populates API URL, Cognito settings
- Creates `.env.production` file

### 3. CI/CD Pipeline

**`.github/workflows/deploy-frontend.yml`**:
- Automated deployment on push to main/develop
- Manual trigger with environment selection
- Steps:
  1. Checkout code
  2. Setup Node.js with caching
  3. Install dependencies
  4. Run linter
  5. Build application
  6. Configure AWS credentials
  7. Get Terraform outputs
  8. Upload to S3
  9. Invalidate CloudFront cache
  10. Display deployment summary

### 4. Documentation

**`frontend/DEPLOYMENT.md`** (comprehensive guide):
- Architecture overview
- Prerequisites
- Manual deployment steps
- CI/CD setup instructions
- Cache strategy explanation
- Custom domain setup
- Rollback procedures
- Monitoring and troubleshooting
- Cost optimization
- Security best practices

**`frontend/DEPLOYMENT_CHECKLIST.md`**:
- Pre-deployment checklist
- Infrastructure verification
- Deployment steps
- Post-deployment validation
- Monitoring setup

**Updated `frontend/README.md`**:
- Added deployment section
- Quick deploy commands
- Reference to detailed documentation

### 5. Configuration Files

**`.env.production.example`**:
- Template for production environment variables
- API Gateway URL
- Cognito configuration
- WebSocket URL
- Feature flags

## Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────┐
│   CloudFront Distribution       │
│   - Global CDN                  │
│   - HTTPS only                  │
│   - Gzip compression            │
│   - Custom error responses      │
└──────────┬──────────────────────┘
           │ Origin Access Identity
           ▼
┌─────────────────────────────────┐
│   S3 Bucket (Private)           │
│   - Static files                │
│   - Versioning enabled          │
│   - Encryption enabled          │
└─────────────────────────────────┘
```

## Cache Strategy

### Static Assets (JS, CSS, Images)
- **Cache-Control**: `public, max-age=31536000, immutable`
- **Rationale**: Vite generates unique hashes, safe to cache forever
- **CloudFront TTL**: 24 hours default, 1 day max

### index.html
- **Cache-Control**: `no-cache, no-store, must-revalidate`
- **Rationale**: Always fetch latest version for app updates
- **CloudFront**: Custom error responses redirect to index.html

## Deployment Workflow

### Manual Deployment
```bash
# 1. Pre-deployment checks
./pre-deploy-check.sh

# 2. Generate environment config
./generate-env.sh production

# 3. Deploy
./deploy.sh production
```

### Automated Deployment (CI/CD)
```bash
# Push to main branch
git push origin main

# Or manual trigger via GitHub Actions UI
```

## Security Features

1. **HTTPS Only**: CloudFront redirects HTTP to HTTPS
2. **Origin Access Identity**: S3 bucket not publicly accessible
3. **Encryption**: Server-side encryption enabled on S3
4. **Versioning**: Enabled for rollback capability
5. **IAM Roles**: Least privilege access for deployments

## Cost Optimization

### Estimated Monthly Cost (1,000 users)
- **CloudFront**: $5-10 (data transfer + requests)
- **S3**: $1-2 (storage + requests)
- **Total**: ~$6-12/month

### Optimization Strategies
- Price Class 100 (cheaper edge locations)
- Gzip compression (reduces data transfer)
- Long cache TTLs (reduces origin requests)
- S3 lifecycle policies (not needed for frontend)

## Custom Domain Setup (Optional)

To use a custom domain (e.g., `dashboard.example.com`):

1. Request ACM certificate in `us-east-1`
2. Validate certificate via DNS
3. Update Terraform variables:
   ```hcl
   custom_domain = "dashboard.example.com"
   acm_certificate_arn = "arn:aws:acm:us-east-1:..."
   ```
4. Create DNS CNAME or Route 53 Alias record

## Monitoring

### CloudWatch Metrics
- Requests per minute
- Bytes downloaded
- Error rate (4xx, 5xx)
- Cache hit rate

### Recommended Alarms
- Error rate > 5%
- Cache hit rate < 80%
- Unusual traffic spikes

## Rollback Procedure

### Option 1: Redeploy Previous Version
```bash
git checkout <previous-commit>
./deploy.sh production
git checkout main
```

### Option 2: S3 Versioning
```bash
# List versions
aws s3api list-object-versions --bucket <bucket-name>

# Restore version
aws s3api copy-object \
  --copy-source <bucket-name>/index.html?versionId=<version-id> \
  --bucket <bucket-name> \
  --key index.html

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id <dist-id> \
  --paths "/*"
```

## Testing

### Pre-Deployment
- [x] Linting passes
- [x] TypeScript compilation successful
- [x] Build succeeds
- [x] Environment variables configured

### Post-Deployment
- [ ] Frontend loads without errors
- [ ] Authentication works
- [ ] API calls successful
- [ ] Real-time updates working
- [ ] All routes accessible
- [ ] No console errors

## Files Created/Modified

### New Files
1. `terraform/modules/storage/main.tf` - Added CloudFront distribution
2. `terraform/modules/storage/outputs.tf` - Added CloudFront outputs
3. `terraform/outputs.tf` - Added frontend URL output
4. `frontend/deploy.sh` - Deployment script
5. `frontend/pre-deploy-check.sh` - Pre-deployment validation
6. `frontend/generate-env.sh` - Environment config generator
7. `frontend/DEPLOYMENT.md` - Comprehensive deployment guide
8. `frontend/DEPLOYMENT_CHECKLIST.md` - Deployment checklist
9. `frontend/.env.production.example` - Production env template
10. `.github/workflows/deploy-frontend.yml` - CI/CD pipeline

### Modified Files
1. `frontend/README.md` - Added deployment section
2. `terraform/modules/storage/variables.tf` - Added custom domain variables (commented)

## Next Steps

1. **Deploy Infrastructure**:
   ```bash
   cd terraform
   terraform init
   terraform apply
   ```

2. **Configure Environment**:
   ```bash
   cd frontend
   ./generate-env.sh production
   ```

3. **Deploy Frontend**:
   ```bash
   ./deploy.sh production
   ```

4. **Setup CI/CD** (optional):
   - Create IAM role for GitHub Actions
   - Add `AWS_DEPLOY_ROLE_ARN` to GitHub secrets
   - Push to main branch to trigger deployment

5. **Custom Domain** (optional):
   - Request ACM certificate
   - Update Terraform variables
   - Apply Terraform changes
   - Create DNS records

## Validation

To verify the deployment:

1. Visit CloudFront URL (from Terraform output)
2. Check browser console for errors
3. Test authentication flow
4. Verify API calls work
5. Check real-time dashboard updates
6. Test all navigation routes

## Support

For issues:
1. Check CloudWatch Logs
2. Review CloudFront access logs
3. Verify S3 bucket policy
4. Check Terraform outputs
5. Review deployment script logs

## References

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
- [React Production Deployment](https://react.dev/learn/start-a-new-react-project#deploying-to-production)
