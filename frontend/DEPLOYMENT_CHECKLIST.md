# Frontend Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment

- [ ] All tests passing locally
- [ ] Linting passes (`npm run lint`)
- [ ] TypeScript compilation successful (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] Environment variables configured (`.env.production`)
- [ ] AWS credentials configured
- [ ] Terraform infrastructure deployed

## Infrastructure Verification

- [ ] S3 bucket created and accessible
- [ ] CloudFront distribution created
- [ ] Origin Access Identity configured
- [ ] S3 bucket policy allows CloudFront access
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate valid (if using custom domain)

## Deployment

- [ ] Run pre-deployment checks (`./pre-deploy-check.sh`)
- [ ] Generate environment config (`./generate-env.sh production`)
- [ ] Build application with production config
- [ ] Upload to S3 with correct cache headers
- [ ] Invalidate CloudFront cache
- [ ] Verify deployment URL accessible

## Post-Deployment

- [ ] Frontend loads without errors
- [ ] Authentication works (login/signup)
- [ ] API calls successful
- [ ] Real-time dashboard updates
- [ ] All pages accessible
- [ ] No console errors
- [ ] Performance acceptable (Lighthouse score)

## Monitoring

- [ ] CloudWatch metrics configured
- [ ] Error tracking enabled
- [ ] Access logs reviewed
- [ ] Cost alerts configured
