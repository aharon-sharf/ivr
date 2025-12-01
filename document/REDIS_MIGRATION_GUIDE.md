# Redis Migration Guide: ElastiCache to Self-Hosted

## Overview

Redis has been moved from AWS ElastiCache to a self-hosted instance on the Asterisk EC2 server to reduce infrastructure costs. This document explains the changes and deployment process.

## Cost Savings

**Before:**
- ElastiCache Redis (cache.t3.micro): ~$15-20/month
- Multi-AZ setup: ~$30-40/month

**After:**
- Self-hosted Redis on existing Asterisk EC2: $0 additional cost
- **Estimated savings: $15-40/month**

## Architecture Changes

### Before
```
┌─────────────┐
│   Lambda    │
│  Functions  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ElastiCache │
│   Redis     │
└─────────────┘
```

### After
```
┌─────────────┐
│   Lambda    │
│  Functions  │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Asterisk Server    │
│  ┌───────────────┐  │
│  │   Asterisk    │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │  Node.js      │  │
│  │  Worker       │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │  Redis 7.x    │  │ ← New
│  └───────────────┘  │
└─────────────────────┘
```

## Changes Made

### 1. Terraform Changes

#### `terraform/modules/data/main.tf`
- ❌ Removed: ElastiCache replication group
- ❌ Removed: ElastiCache subnet group
- ❌ Removed: ElastiCache security group
- ❌ Removed: Redis auth token secret

#### `terraform/modules/compute/main.tf`
- ✅ Added: Redis port (6379) to Asterisk security group
- ✅ Added: Redis installation in user data script
- ✅ Added: Redis password generation (random_password)
- ✅ Added: Redis password storage in Secrets Manager

#### `terraform/modules/data/outputs.tf`
- ❌ Removed: `redis_endpoint` output
- ❌ Removed: `redis_auth_token_secret_arn` output

#### `terraform/modules/compute/outputs.tf`
- ✅ Added: `redis_endpoint` (Asterisk private IP)
- ✅ Added: `redis_port` (6379)
- ✅ Added: `redis_password_secret_arn`

#### `terraform/outputs.tf`
- ✅ Updated: `redis_endpoint` now points to compute module
- ✅ Added: `redis_port` output
- ✅ Added: `redis_password_secret_arn` output

### 2. Ansible Changes

#### `ansible/asterisk-setup.yml`
- ✅ Added: Redis installation task
- ✅ Added: Redis configuration from template
- ✅ Added: Redis service management
- ✅ Added: Redis connectivity test
- ✅ Added: Handler for Redis restart

#### `ansible/group_vars/asterisk.yml`
- ✅ Added: Redis configuration variables
  - `redis_password`: From environment variable
  - `redis_port`: 6379
  - `redis_bind_address`: 0.0.0.0 (secured by security group)
  - `redis_maxmemory`: 512mb
  - `redis_maxmemory_policy`: allkeys-lru
  - `redis_save_intervals`: RDB persistence settings
  - `redis_appendonly`: yes (AOF enabled)

#### `ansible/templates/redis.conf.j2`
- ✅ Created: Complete Redis configuration template
  - Network settings (bind, port, protected-mode)
  - Security (requirepass)
  - Persistence (RDB + AOF)
  - Memory management (maxmemory, eviction policy)
  - Logging and monitoring

### 3. Documentation Changes

#### `README.md`
- ✅ Updated: Technology stack section
- Changed: "Redis (ElastiCache)" → "Redis (self-hosted on Asterisk EC2)"

## Deployment Process

### Prerequisites

1. Ensure you have the Redis password ready:
   ```bash
   export REDIS_PASSWORD="your-secure-password-here"
   ```

2. Ensure Ansible inventory is configured with Asterisk server details

### Step 1: Apply Terraform Changes

```bash
cd terraform

# Initialize (if needed)
terraform init

# Review changes
terraform plan

# Apply changes
terraform apply
```

**Expected changes:**
- Remove ElastiCache resources (replication group, subnet group, security group)
- Add Redis security group rule to Asterisk server
- Create new Secrets Manager secret for Redis password
- Update outputs

### Step 2: Run Ansible Playbook

```bash
cd ansible

# Set Redis password
export REDIS_PASSWORD="$(aws secretsmanager get-secret-value \
  --secret-id <project-name>-redis-password-<environment> \
  --query SecretString --output text | jq -r .password)"

# Run playbook
ansible-playbook -i inventory/hosts asterisk-setup.yml
```

**What happens:**
1. Installs Redis 7.x on Asterisk server
2. Configures Redis with authentication
3. Enables RDB and AOF persistence
4. Starts Redis service
5. Verifies connectivity

### Step 3: Update Lambda Functions

Update Lambda environment variables to use the new Redis endpoint:

```bash
# Get the new Redis endpoint (Asterisk private IP)
REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)
REDIS_PASSWORD_ARN=$(terraform output -raw redis_password_secret_arn)

# Update each Lambda function
aws lambda update-function-configuration \
  --function-name <function-name> \
  --environment "Variables={
    REDIS_HOST=$REDIS_ENDPOINT,
    REDIS_PORT=6379,
    REDIS_PASSWORD_SECRET_ARN=$REDIS_PASSWORD_ARN
  }"
```

### Step 4: Verify Connectivity

Test Redis connectivity from a Lambda function or EC2 instance in the VPC:

```bash
# From within VPC
redis-cli -h <asterisk-private-ip> -p 6379 -a <password> ping
# Expected: PONG

# Test set/get
redis-cli -h <asterisk-private-ip> -p 6379 -a <password> SET test "hello"
redis-cli -h <asterisk-private-ip> -p 6379 -a <password> GET test
# Expected: "hello"
```

### Step 5: Monitor

Monitor Redis performance and health:

```bash
# SSH to Asterisk server
ssh ec2-user@<asterisk-public-ip>

# Check Redis status
sudo systemctl status redis

# Monitor Redis
redis-cli -a <password> INFO
redis-cli -a <password> MONITOR

# Check logs
sudo tail -f /var/log/redis/redis.log
```

## Configuration Details

### Redis Configuration Highlights

- **Port**: 6379 (standard)
- **Authentication**: Required (password from Secrets Manager)
- **Bind Address**: 0.0.0.0 (all interfaces, secured by security group)
- **Max Memory**: 512MB
- **Eviction Policy**: allkeys-lru (evict any key using LRU)
- **Persistence**: 
  - RDB: Snapshots every 5 minutes (if data changed)
  - AOF: Append-only file with fsync every second
- **Data Directory**: /var/lib/redis
- **Log File**: /var/log/redis/redis.log

### Security

1. **Network Security**:
   - Redis port 6379 only accessible from VPC CIDR
   - Not exposed to public internet
   - Security group rules enforce access control

2. **Authentication**:
   - Strong password (32 characters, alphanumeric)
   - Stored in AWS Secrets Manager
   - Required for all connections

3. **Data Protection**:
   - RDB persistence for point-in-time recovery
   - AOF persistence for durability
   - Data stored in /var/lib/redis with restricted permissions

## Monitoring

### CloudWatch Metrics

The CloudWatch agent on the Asterisk server can be configured to send Redis metrics:

```json
{
  "metrics": {
    "namespace": "CampaignSystem/Redis",
    "metrics_collected": {
      "redis": {
        "measurement": [
          "used_memory",
          "connected_clients",
          "instantaneous_ops_per_sec"
        ]
      }
    }
  }
}
```

### Health Checks

Add Redis health check to the Node.js worker health endpoint:

```javascript
// In asterisk-worker health check
const redisHealthy = await checkRedisConnection();
return {
  status: redisHealthy ? 'healthy' : 'degraded',
  redis: {
    connected: redisHealthy,
    endpoint: process.env.REDIS_HOST
  }
};
```

## Rollback Plan

If issues occur, you can rollback to ElastiCache:

1. **Revert Terraform changes**:
   ```bash
   git revert <commit-hash>
   terraform apply
   ```

2. **Update Lambda environment variables** to point back to ElastiCache

3. **Keep self-hosted Redis running** as backup until stable

## Performance Considerations

### Pros
- ✅ Cost savings ($15-40/month)
- ✅ Simplified architecture (one less service)
- ✅ Lower latency (Redis on same server as Asterisk worker)
- ✅ Full control over configuration

### Cons
- ⚠️ No automatic failover (single instance)
- ⚠️ No automatic backups (manual RDB/AOF)
- ⚠️ Shares resources with Asterisk and Node.js worker
- ⚠️ Manual scaling required

### Mitigation
- Monitor memory usage closely
- Set up CloudWatch alarms for Redis health
- Regular RDB snapshots to S3 (optional)
- Consider upgrading Asterisk instance type if needed

## Troubleshooting

### Redis Won't Start

```bash
# Check logs
sudo journalctl -u redis -n 50

# Check configuration
sudo redis-server /etc/redis/redis.conf --test-config

# Check permissions
ls -la /var/lib/redis
ls -la /var/log/redis
```

### Connection Refused

```bash
# Check if Redis is listening
sudo netstat -tlnp | grep 6379

# Check security group
aws ec2 describe-security-groups --group-ids <sg-id>

# Test from Lambda VPC
# Deploy a test Lambda in same VPC and try connecting
```

### Out of Memory

```bash
# Check memory usage
redis-cli -a <password> INFO memory

# Increase maxmemory in redis.conf
sudo vi /etc/redis/redis.conf
# Change: maxmemory 512mb → maxmemory 1gb

# Restart Redis
sudo systemctl restart redis
```

### Data Loss

```bash
# Check RDB file
ls -lh /var/lib/redis/dump.rdb

# Check AOF file
ls -lh /var/lib/redis/appendonly.aof

# Restore from backup (if available)
sudo cp /backup/dump.rdb /var/lib/redis/
sudo chown redis:redis /var/lib/redis/dump.rdb
sudo systemctl restart redis
```

## Next Steps

1. ✅ Deploy changes to development environment first
2. ✅ Test all Lambda functions with new Redis endpoint
3. ✅ Monitor for 24-48 hours
4. ✅ Deploy to production during low-traffic window
5. ✅ Set up CloudWatch alarms for Redis health
6. ✅ Document any issues and resolutions

## Questions?

Contact the DevOps team or refer to:
- [Redis Documentation](https://redis.io/documentation)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [Ansible Redis Module](https://docs.ansible.com/ansible/latest/collections/community/general/redis_module.html)
