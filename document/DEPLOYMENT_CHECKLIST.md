# Deployment Checklist

Quick reference checklist for deploying the Mass Voice Campaign System.

## Pre-Deployment

### Tools Installation
- [ ] AWS CLI v2+ installed and configured
- [ ] Terraform v1.6+ installed
- [ ] Node.js v18+ installed
- [ ] Ansible v2.15+ installed
- [ ] Docker installed
- [ ] PostgreSQL client installed

### AWS Account Setup
- [ ] AWS account created
- [ ] AWS CLI configured (`aws configure`)
- [ ] SSH key pair created (`mass-voice-campaign-key`)
- [ ] Service quotas checked (EC2, RDS, Lambda)
- [ ] GitHub OIDC provider created (if using CI/CD)

## Infrastructure Deployment

### Terraform Setup
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] Terraform backend setup (`./backend-setup.sh`)
- [ ] Terraform initialized (`terraform init`)
- [ ] Terraform workspaces created (`terraform workspace new dev/staging/production`)
- [ ] `terraform.tfvars` configured for your environment
- [ ] SIP trunk credentials added

### Infrastructure Deployment
- [ ] Terraform plan reviewed (`terraform plan`)
- [ ] Infrastructure deployed (`terraform apply`)
- [ ] Outputs saved (`terraform output > outputs.txt`)
- [ ] All resources verified in AWS Console

## Database Setup

- [ ] RDS password retrieved from Secrets Manager
- [ ] Database connection tested
- [ ] Security group allows your IP (if needed)
- [ ] Migration 001 applied (initial schema)
- [ ] Migration 002 applied (SMS replies)
- [ ] Schema verified (`\dt` in psql)
- [ ] Admin user created in Cognito

## Lambda Deployment

- [ ] All Lambda Docker images built
- [ ] ECR login successful
- [ ] Images tagged and pushed to ECR
- [ ] Lambda functions updated with new images
- [ ] Environment variables configured
- [ ] Lambda functions tested
- [ ] CloudWatch logs verified

## Asterisk Setup

- [ ] Ansible inventory updated with Asterisk IP
- [ ] `asterisk-setup.yml` playbook run
- [ ] `asterisk-configure.yml` playbook run
- [ ] `nodejs-worker-deploy.yml` playbook run
- [ ] Asterisk service running
- [ ] Worker service running
- [ ] SIP trunk registered
- [ ] Test call successful

## Frontend Deployment

- [ ] `.env.production` created with correct values
- [ ] Dependencies installed (`npm ci`)
- [ ] Frontend built (`npm run build`)
- [ ] Build verified (check `dist/` folder)
- [ ] Deployed to S3 (`./deploy.sh dev`)
- [ ] CloudFront cache invalidated
- [ ] Frontend URL accessible
- [ ] Login page loads

## Testing & Validation

### Automated Tests
- [ ] Unit tests pass (`npm test`)
- [ ] Property tests pass
- [ ] Integration tests pass (if applicable)
- [ ] Smoke tests pass (`./smoke-test.sh`)

### Manual Testing
- [ ] Can log in to dashboard
- [ ] Dashboard loads without errors
- [ ] Can create campaign
- [ ] Can upload contacts
- [ ] Can upload/record audio
- [ ] IVR flow builder works
- [ ] Can schedule campaign
- [ ] Real-time dashboard updates
- [ ] Analytics page loads
- [ ] Blacklist management works

### End-to-End Test
- [ ] Test campaign created
- [ ] Test campaign executed
- [ ] Test call received
- [ ] Call record in database
- [ ] Logs show successful execution

## Production Deployment

### Production Environment
- [ ] Production workspace created
- [ ] `terraform.tfvars.production` configured
- [ ] Larger instance sizes set
- [ ] Multi-AZ enabled
- [ ] Production infrastructure deployed
- [ ] Production database migrations run
- [ ] Production admin user created

### Production Services
- [ ] Lambda functions deployed to production
- [ ] Asterisk configured for production
- [ ] Frontend deployed to production
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate validated

### Monitoring & Security
- [ ] CloudWatch dashboard created
- [ ] CloudWatch alarms configured
- [ ] SNS topics for alerts created
- [ ] Email notifications configured
- [ ] CloudTrail enabled
- [ ] GuardDuty enabled (optional)
- [ ] MFA enabled on root account
- [ ] Backup strategy documented

### Final Validation
- [ ] Production smoke tests pass
- [ ] All services healthy
- [ ] Monitoring working
- [ ] Alerts tested
- [ ] Documentation updated
- [ ] Team trained

## Post-Deployment

- [ ] Runbook created
- [ ] On-call rotation set up
- [ ] Backup procedures documented
- [ ] Disaster recovery plan documented
- [ ] Cost monitoring enabled
- [ ] Performance baseline established

---

## Quick Commands Reference

```bash
# Check system health
./smoke-test.sh

# View logs
aws logs tail /aws/lambda/api-handler-production --follow

# Connect to database
psql -h $(cd terraform && terraform output -raw rds_endpoint) -U admin -d campaign_system

# SSH to Asterisk
ssh -i ~/.ssh/mass-voice-campaign-key.pem ubuntu@$(cd terraform && terraform output -raw asterisk_public_ip)

# Deploy frontend
cd frontend && ./deploy.sh production

# Update Lambda
aws lambda update-function-code --function-name FUNCTION_NAME-production --image-uri $ECR_REGISTRY/FUNCTION_NAME:latest

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id $(cd terraform && terraform output -raw cloudfront_distribution_id) --paths "/*"
```

---

## Troubleshooting Quick Fixes

**Terraform state locked:**
```bash
terraform force-unlock <LOCK_ID>
```

**Lambda not updating:**
```bash
aws lambda wait function-updated --function-name FUNCTION_NAME
```

**Database connection fails:**
```bash
# Add your IP to security group
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --group-id SG_ID --protocol tcp --port 5432 --cidr $MY_IP/32
```

**Frontend shows blank page:**
```bash
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

**Asterisk not registered:**
```bash
ssh ubuntu@ASTERISK_IP "sudo systemctl restart asterisk"
```

---

For detailed instructions, see [COMPLETE_DEPLOYMENT_TUTORIAL.md](COMPLETE_DEPLOYMENT_TUTORIAL.md)
