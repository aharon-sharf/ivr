# Frontend Deployment Guide

This guide covers deploying the Mass Voice Campaign System frontend to AWS S3 + CloudFront.

## Architecture

The frontend is deployed as a static site using:
- **S3**: Hosts the built React application files
- **CloudFront**: Global CDN for fast content delivery with HTTPS
- **Origin Access Identity (OAI)**: Secures S3 bucket access (only CloudFront can access)

## Prerequisites

1. **AWS CLI** installed and configured
   ```bash
   aws --version
   aws configure
   ```

2. **Terraform** infrastructure deployed
   ```bash
   cd terraform
   terraform init
   terraform apply
   ```

3. **Node.js 18+** installed
   ```bash
   node --version
   npm --version
   ```

## Manual Deployment

### Step 1: Build the Application

```bash
cd frontend
npm ci
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Step 2: Deploy Using Script

```bash
chmod +x deploy.sh
./deploy.sh dev
```

The script will:
1. Fetch S3 bucket name and CloudFront distribution ID from Terraform
2. Build the React application
3. Upload files to S3 with appropriate cache headers
4. Invalidate CloudFront cache
5. Display the frontend URL

### Step 3: Verify Deployment

Visit the CloudFront URL displayed at the end of deployment:
```
https://d1234567890abc.cloudfront.net
```

## Automated Deployment (CI/CD)

### GitHub Actions

The repository includes a GitHub Actions workflow that automatically deploys on push to `main` or `develop` branches.

**Setup:**

1. Create an IAM role for GitHub Actions with permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::mass-voice-campaign-frontend-*",
           "arn:aws:s3:::mass-voice-campaign-frontend-*/*"
         ]
       },
       {
         "Effect": "Allow",
         "Action": [
           "cloudfront:CreateInvalidation",
           "cloudfront:GetInvalidation"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

2. Add GitHub repository secrets:
   - `AWS_DEPLOY_ROLE_ARN`: ARN of the IAM role created above

3. Push to `main` or `develop` branch:
   ```bash
   git add .
   git commit -m "Deploy frontend"
   git push origin main
   ```

4. Monitor deployment in GitHub Actions tab

### Manual Trigger

You can also trigger deployment manually from GitHub Actions:
1. Go to Actions tab
2. Select "Deploy Frontend to S3 + CloudFront"
3. Click "Run workflow"
4. Select environment (dev/staging/production)

## Cache Strategy

### Static Assets (JS, CSS, Images)
- **Cache-Control**: `public, max-age=31536000, immutable`
- **Rationale**: Vite generates unique hashes for each build, so files can be cached forever

### index.html
- **Cache-Control**: `no-cache, no-store, must-revalidate`
- **Rationale**: Always fetch latest version to ensure users get updated app

### CloudFront Invalidation
After each deployment, we invalidate `/*` to clear the CloudFront cache globally.

## Custom Domain Setup (Optional)

To use a custom domain (e.g., `dashboard.example.com`):

### Step 1: Request SSL Certificate

```bash
aws acm request-certificate \
  --domain-name dashboard.example.com \
  --validation-method DNS \
  --region us-east-1
```

**Note**: ACM certificates for CloudFront must be in `us-east-1` region.

### Step 2: Validate Certificate

Add the DNS validation records to your domain's DNS settings.

### Step 3: Update Terraform Configuration

Add to `terraform/modules/storage/variables.tf`:
```hcl
variable "custom_domain" {
  description = "Custom domain for frontend"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = ""
}
```

Update CloudFront distribution in `terraform/modules/storage/main.tf`:
```hcl
resource "aws_cloudfront_distribution" "frontend" {
  # ... existing config ...
  
  aliases = var.custom_domain != "" ? [var.custom_domain] : []
  
  viewer_certificate {
    cloudfront_default_certificate = var.custom_domain == ""
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = var.custom_domain != "" ? "sni-only" : null
    minimum_protocol_version       = var.custom_domain != "" ? "TLSv1.2_2021" : null
  }
}
```

### Step 4: Create DNS Record

Add a CNAME record pointing to the CloudFront distribution:
```
dashboard.example.com -> d1234567890abc.cloudfront.net
```

Or use Route 53 Alias record for better performance.

## Rollback

To rollback to a previous version:

### Option 1: Redeploy Previous Commit
```bash
git checkout <previous-commit-hash>
cd frontend
./deploy.sh dev
git checkout main
```

### Option 2: Use S3 Versioning
```bash
# List object versions
aws s3api list-object-versions \
  --bucket mass-voice-campaign-frontend-dev \
  --prefix index.html

# Restore specific version
aws s3api copy-object \
  --bucket mass-voice-campaign-frontend-dev \
  --copy-source mass-voice-campaign-frontend-dev/index.html?versionId=<VERSION_ID> \
  --key index.html

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

## Monitoring

### CloudFront Metrics

Monitor in CloudWatch:
- **Requests**: Total number of requests
- **BytesDownloaded**: Total bytes served
- **ErrorRate**: 4xx and 5xx error rates
- **CacheHitRate**: Percentage of requests served from cache

### S3 Metrics

Monitor in CloudWatch:
- **BucketSizeBytes**: Total size of objects
- **NumberOfObjects**: Total number of objects

## Troubleshooting

### Issue: 403 Forbidden Error

**Cause**: S3 bucket policy not allowing CloudFront access

**Solution**:
```bash
cd terraform
terraform apply -target=module.storage.aws_s3_bucket_policy.frontend_hosting
```

### Issue: Old Version Still Showing

**Cause**: CloudFront cache not invalidated

**Solution**:
```bash
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

### Issue: Blank Page After Deployment

**Cause**: Environment variables not set during build

**Solution**: Ensure `.env.production` exists with correct values:
```bash
VITE_API_URL=https://api.example.com
VITE_COGNITO_USER_POOL_ID=il-central-1_xxxxx
VITE_COGNITO_CLIENT_ID=xxxxx
```

### Issue: 404 on Page Refresh

**Cause**: CloudFront not configured for SPA routing

**Solution**: Verify custom error responses in CloudFront distribution (already configured in Terraform).

## Cost Optimization

### CloudFront Pricing
- **Data Transfer**: ~$0.085/GB for first 10TB
- **Requests**: ~$0.0075 per 10,000 HTTPS requests
- **Invalidations**: First 1,000 paths free per month

### S3 Pricing
- **Storage**: ~$0.023/GB per month
- **Requests**: ~$0.005 per 1,000 PUT requests

### Estimated Monthly Cost
For a typical dashboard with 1,000 users:
- CloudFront: ~$5-10
- S3: ~$1-2
- **Total**: ~$6-12/month

## Security Best Practices

1. **HTTPS Only**: CloudFront configured to redirect HTTP to HTTPS
2. **Origin Access Identity**: S3 bucket not publicly accessible
3. **Security Headers**: Add via Lambda@Edge if needed:
   - `Strict-Transport-Security`
   - `X-Content-Type-Options`
   - `X-Frame-Options`
   - `Content-Security-Policy`

## Performance Optimization

1. **Gzip Compression**: Enabled in CloudFront
2. **HTTP/2**: Enabled by default in CloudFront
3. **Edge Locations**: Using PriceClass_100 (North America + Europe)
4. **Asset Optimization**: Vite automatically minifies and tree-shakes code

## Support

For issues or questions:
1. Check CloudWatch Logs for Lambda@Edge (if configured)
2. Review CloudFront access logs (if enabled)
3. Check S3 server access logs (if enabled)
4. Contact DevOps team
