# Cognito Domain Configuration Fix

## Problem
The frontend was showing "Auth UserPool not configured" error because the Cognito domain wasn't being passed to the frontend build process.

## Root Cause
1. The Cognito domain output existed in the auth module but wasn't exposed in root Terraform outputs
2. The `generate-env.sh` script didn't fetch the Cognito domain
3. The GitHub Actions workflow didn't generate `.env.production` before building the frontend
4. Vite embeds environment variables at build time, so missing config = broken auth

## Solution Applied

### 1. Terraform Outputs (`terraform/outputs.tf`)
Added two new outputs to expose Cognito domain:
```terraform
output "cognito_user_pool_domain" {
  description = "Cognito User Pool domain prefix"
  value       = module.auth.user_pool_domain
}

output "cognito_hosted_ui_url" {
  description = "Cognito Hosted UI URL"
  value       = module.auth.hosted_ui_url
}
```

### 2. Environment Generation Script (`frontend/generate-env.sh`)
Updated to:
- Fetch `cognito_user_pool_domain` from Terraform
- Validate the domain is present
- Generate full Cognito domain URL: `{prefix}.auth.{region}.amazoncognito.com`
- Include it in the `.env.production` file as `VITE_COGNITO_DOMAIN`

### 3. GitHub Actions Workflow (`.github/workflows/deploy-frontend.yml`)
Added new step **before** the build:
- Configures AWS credentials early
- Determines environment (dev/staging/production)
- Installs and initializes Terraform
- Fetches all required outputs including Cognito domain
- Generates `.env.production` with complete configuration
- Then builds the frontend with proper environment variables

### 4. Documentation Updates
Updated example files to include Cognito domain:
- `frontend/.env.example`
- `frontend/.env.production.example`

## Deployment Steps

### Option 1: Automatic (Recommended)
1. Apply Terraform changes to expose new outputs:
   ```bash
   cd terraform
   terraform workspace select production  # or your environment
   terraform apply
   ```

2. Trigger GitHub Actions deployment:
   - Push to main branch, OR
   - Manually trigger workflow from GitHub Actions UI

3. The workflow will automatically:
   - Generate `.env.production` with Cognito domain
   - Build frontend with correct configuration
   - Deploy to S3 and invalidate CloudFront cache

### Option 2: Manual Local Build
1. Apply Terraform changes:
   ```bash
   cd terraform
   terraform workspace select production
   terraform apply
   ```

2. Generate environment configuration:
   ```bash
   cd ../frontend
   bash generate-env.sh production
   ```

3. Build and deploy:
   ```bash
   npm run build
   
   # Upload to S3
   aws s3 sync dist/ s3://YOUR_BUCKET_NAME/ --delete
   
   # Invalidate CloudFront
   aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
   ```

## Verification

After deployment, verify the configuration:

1. Check the deployed site loads without errors
2. Open browser console and verify no "Auth UserPool not configured" errors
3. Try to access `/login` - should show Cognito hosted UI
4. Check that environment variables are embedded in the build:
   ```bash
   # In the deployed site, check the compiled JS
   curl https://YOUR_CLOUDFRONT_URL/assets/index-*.js | grep -o "VITE_COGNITO"
   ```

## What Changed in the Build Process

**Before:**
```
Install deps → Lint → Build (missing env vars) → Deploy
```

**After:**
```
Install deps → Lint → Get Terraform outputs → Generate .env.production → Build (with env vars) → Deploy
```

## Environment Variables Now Included

The frontend build now includes:
- `VITE_API_URL` - API Gateway endpoint
- `VITE_COGNITO_REGION` - AWS region
- `VITE_COGNITO_USER_POOL_ID` - User Pool ID
- `VITE_COGNITO_CLIENT_ID` - App Client ID
- `VITE_COGNITO_DOMAIN` - **NEW** - Full Cognito domain URL
- `VITE_WEBSOCKET_URL` - WebSocket endpoint
- `VITE_ENABLE_ANALYTICS` - Feature flag
- `VITE_ENABLE_ML_PREDICTIONS` - Feature flag
- `VITE_ENVIRONMENT` - Environment name

## Troubleshooting

### If you still see the error after deployment:

1. **Check CloudFront cache was invalidated:**
   ```bash
   aws cloudfront list-invalidations --distribution-id YOUR_DIST_ID
   ```

2. **Verify Terraform outputs are correct:**
   ```bash
   cd terraform
   terraform workspace select production
   terraform output cognito_user_pool_domain
   terraform output cognito_hosted_ui_url
   ```

3. **Check the generated .env.production file:**
   ```bash
   cat frontend/.env.production
   ```

4. **Hard refresh your browser:**
   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or open in incognito/private mode

5. **Check build artifacts include the domain:**
   ```bash
   cd frontend/dist/assets
   grep -r "COGNITO_DOMAIN" .
   ```

## Files Modified
- `terraform/outputs.tf` - Added Cognito domain outputs
- `frontend/generate-env.sh` - Added domain fetching and validation
- `.github/workflows/deploy-frontend.yml` - Added env generation before build
- `frontend/.env.example` - Updated documentation
- `frontend/.env.production.example` - Updated documentation
