# Quick Deploy Guide

## First Time Setup

```bash
# 1. Deploy infrastructure
cd terraform
terraform init
terraform apply

# 2. Generate environment config
cd ../frontend
chmod +x generate-env.sh
./generate-env.sh production

# 3. Deploy frontend
chmod +x deploy.sh
./deploy.sh production
```

## Subsequent Deployments

```bash
cd frontend
./deploy.sh production
```

## Pre-Deployment Check

```bash
chmod +x pre-deploy-check.sh
./pre-deploy-check.sh
```

## Get Frontend URL

```bash
cd terraform
terraform output frontend_url
```

## Rollback

```bash
git checkout <previous-commit>
cd frontend
./deploy.sh production
git checkout main
```

## Troubleshooting

### 403 Error
```bash
cd terraform
terraform apply -target=module.storage.aws_s3_bucket_policy.frontend_hosting
```

### Cache Not Clearing
```bash
aws cloudfront create-invalidation \
  --distribution-id $(cd terraform && terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

### Build Fails
```bash
rm -rf node_modules dist
npm ci
npm run build
```

## Documentation

- Full guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Checklist: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
