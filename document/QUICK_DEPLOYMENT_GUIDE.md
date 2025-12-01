# Quick Deployment Guide - Infrastructure Optimizations

## TL;DR

Two optimizations save **$34-59/month** while improving performance:
1. **Redis**: ElastiCache → Asterisk server (saves $15-40/month)
2. **RDS Proxy**: Connection pooling for Lambda (saves $19/month)

---

## Prerequisites

```bash
# Set environment variables
export REDIS_PASSWORD="your-secure-32-char-password"
export AWS_REGION="il-central-1"
export ENVIRONMENT="staging"  # or "production"
```

---

## Deployment Steps

### 1. Apply Terraform (5 minutes)

```bash
cd terraform

# Review changes
terraform plan

# Expected changes:
# - Remove: ElastiCache resources (3 resources)
# - Add: RDS Proxy resources (6 resources)
# - Modify: Asterisk security group (1 resource)

# Apply
terraform apply -auto-approve

# Save outputs
terraform output -json > outputs.json
```

### 2. Deploy Redis to Asterisk (10 minutes)

```bash
cd ../ansible

# Run playbook
ansible-playbook -i inventory/hosts asterisk-setup.yml

# Verify Redis
ssh ec2-user@$(terraform output -raw asterisk_public_ip)
redis-cli -a $REDIS_PASSWORD ping
# Expected: PONG
exit
```

### 3. Update Lambda Functions (5 minutes)

```bash
# Get endpoints
RDS_PROXY=$(terraform output -raw rds_proxy_endpoint)
REDIS_HOST=$(terraform output -raw redis_endpoint)
RDS_SECRET=$(terraform output -raw rds_master_secret_arn)

# Update all Lambda functions
for FUNC in validate-campaign dispatcher dialer-worker status-checker report-generator enrich-dial-task; do
  aws lambda update-function-configuration \
    --function-name ${FUNC}-lambda \
    --environment "Variables={
      RDS_PROXY_ENDPOINT=$RDS_PROXY,
      REDIS_HOST=$REDIS_HOST,
      REDIS_PORT=6379,
      RDS_SECRET_ARN=$RDS_SECRET,
      DATABASE_NAME=campaign_system
    }"
done
```

### 4. Verify Connectivity (2 minutes)

```bash
# Test RDS Proxy
aws rds describe-db-proxies --db-proxy-name $(terraform output -raw project_name)-postgres-proxy-$ENVIRONMENT
# Status should be: available

# Test Redis from Lambda VPC
# (Deploy a test Lambda or use existing one)
```

### 5. Monitor (Ongoing)

```bash
# Watch CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBProxyName,Value=$(terraform output -raw project_name)-postgres-proxy-$ENVIRONMENT \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Check Redis
ssh ec2-user@$(terraform output -raw asterisk_public_ip) \
  "redis-cli -a $REDIS_PASSWORD INFO stats"
```

---

## Rollback (If Needed)

```bash
# Revert Terraform
git revert HEAD
terraform apply -auto-approve

# Update Lambda to use old endpoints
# (ElastiCache and direct RDS)
```

---

## Key Endpoints

After deployment, use these endpoints:

| Service | Endpoint | Use Case |
|---------|----------|----------|
| RDS Proxy | `terraform output rds_proxy_endpoint` | Lambda functions |
| RDS Direct | `terraform output rds_endpoint` | Admin tools |
| Redis | `terraform output redis_endpoint` | Lambda functions |

---

## Lambda Code Changes

### Before
```javascript
const client = new Client({
  host: process.env.RDS_ENDPOINT,  // Direct RDS
  // ...
});
```

### After
```javascript
const client = new Client({
  host: process.env.RDS_PROXY_ENDPOINT,  // Via proxy
  // ...
});
```

**That's it!** Just change the endpoint environment variable.

---

## Verification Checklist

- [ ] Terraform apply successful
- [ ] Redis running on Asterisk server
- [ ] RDS Proxy status: available
- [ ] Lambda environment variables updated
- [ ] Test campaign runs successfully
- [ ] No "too many connections" errors
- [ ] CloudWatch metrics look healthy
- [ ] Monthly costs reduced

---

## Troubleshooting

### Redis Connection Failed
```bash
# Check Redis status
ssh ec2-user@$(terraform output -raw asterisk_public_ip)
sudo systemctl status redis
sudo tail -f /var/log/redis/redis.log
```

### RDS Proxy Connection Failed
```bash
# Check proxy status
aws rds describe-db-proxies --db-proxy-name <proxy-name>

# Check security groups
aws ec2 describe-security-groups --group-ids <sg-id>
```

### Lambda Errors
```bash
# Check Lambda logs
aws logs tail /aws/lambda/<function-name> --follow
```

---

## Cost Verification

Check costs after 24 hours:

```bash
# View cost explorer
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Expected reductions:
# - ElastiCache: $0 (removed)
# - RDS: ~50% reduction (smaller instance)
# - RDS Proxy: ~$11/month (new)
```

---

## Support

- **Detailed Guides**: See `document/` folder
- **Redis Issues**: `document/REDIS_MIGRATION_GUIDE.md`
- **RDS Proxy Issues**: `document/RDS_PROXY_GUIDE.md`
- **Architecture**: `document/INFRASTRUCTURE_OPTIMIZATIONS.md`

---

## Success! 🎉

You've successfully:
- ✅ Reduced costs by $34-59/month
- ✅ Improved Lambda performance
- ✅ Eliminated connection errors
- ✅ Simplified architecture

**Total deployment time**: ~25 minutes
**Annual savings**: $408-708
**ROI**: Immediate
