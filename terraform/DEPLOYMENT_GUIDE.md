# Deployment Guide - Mass Voice Campaign System

This guide walks you through deploying the infrastructure for the Mass Voice Campaign System.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] AWS Account with appropriate permissions
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Terraform >= 1.5.0 installed
- [ ] SSH key pair created in AWS (for Asterisk EC2 instance)
- [ ] Basic understanding of AWS services

## Step-by-Step Deployment

### Step 1: Clone and Navigate

```bash
cd terraform
```

### Step 2: Set Up Remote State Backend

Run the backend setup script to create the S3 bucket and DynamoDB table for Terraform state:

```bash
chmod +x backend-setup.sh
./backend-setup.sh
```

**Expected Output:**
```
✅ Terraform backend setup complete!

S3 Bucket: mass-voice-campaign-terraform-state
Region: us-east-1
```

### Step 3: Configure Variables

Copy the example variables file:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your preferred editor:

```bash
# Use your preferred editor
nano terraform.tfvars
# or
vim terraform.tfvars
# or
code terraform.tfvars
```

**Required Changes:**
- `asterisk_key_name`: Replace with your SSH key pair name

**Optional Changes:**
- `aws_region`: Change if deploying to a different region
- `environment`: Change for different environments (dev, staging, production)
- Instance sizes: Adjust for your workload

### Step 4: Initialize Terraform

Initialize Terraform to download providers and set up modules:

```bash
terraform init
```

**Expected Output:**
```
Initializing modules...
Initializing the backend...
Initializing provider plugins...
Terraform has been successfully initialized!
```

### Step 5: Validate Configuration

Validate the Terraform configuration:

```bash
terraform validate
```

**Expected Output:**
```
Success! The configuration is valid.
```

### Step 6: Plan Infrastructure

Review what Terraform will create:

```bash
terraform plan
```

This will show you:
- Resources to be created
- Estimated costs
- Any potential issues

**Review carefully** before proceeding.

### Step 7: Apply Infrastructure

Deploy the infrastructure:

```bash
terraform apply
```

Terraform will show the plan again and ask for confirmation:
```
Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value:
```

Type `yes` and press Enter.

**Deployment Time:** Approximately 15-20 minutes

### Step 8: Save Outputs

After deployment completes, save the important outputs:

```bash
terraform output > outputs.txt
```

**Important Outputs:**
- `rds_endpoint`: PostgreSQL connection string
- `redis_endpoint`: Redis connection string
- `asterisk_public_ip`: Asterisk EC2 public IP
- `api_gateway_url`: API Gateway endpoint
- `cognito_user_pool_id`: Cognito User Pool ID
- S3 bucket names

### Step 9: Verify Deployment

Check that key resources were created:

```bash
# Check VPC
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=MassVoiceCampaign"

# Check RDS
aws rds describe-db-instances --db-instance-identifier mass-voice-campaign-postgres-dev

# Check S3 buckets
aws s3 ls | grep mass-voice-campaign

# Check Cognito User Pool
aws cognito-idp describe-user-pool --user-pool-id $(terraform output -raw cognito_user_pool_id)
```

## Post-Deployment Steps

### 1. Retrieve Database Credentials

Database credentials are stored in AWS Secrets Manager:

```bash
# Get RDS password
aws secretsmanager get-secret-value \
  --secret-id mass-voice-campaign-rds-password-dev \
  --query SecretString \
  --output text | jq .

# Get Redis auth token
aws secretsmanager get-secret-value \
  --secret-id mass-voice-campaign-redis-auth-token-dev \
  --query SecretString \
  --output text | jq .
```

### 2. Connect to Asterisk EC2

SSH into the Asterisk instance:

```bash
ASTERISK_IP=$(terraform output -raw asterisk_public_ip)
ssh -i ~/.ssh/your-key.pem ec2-user@$ASTERISK_IP
```

### 3. Test Database Connection

Test PostgreSQL connection:

```bash
# Install PostgreSQL client if needed
sudo apt-get install postgresql-client

# Connect to RDS
psql -h $(terraform output -raw rds_endpoint | cut -d: -f1) \
     -U admin \
     -d campaign_system
```

### 4. Test Redis Connection

Test Redis connection:

```bash
# Install Redis CLI if needed
sudo apt-get install redis-tools

# Connect to Redis
redis-cli -h $(terraform output -raw redis_endpoint) \
          -a $(aws secretsmanager get-secret-value --secret-id mass-voice-campaign-redis-auth-token-dev --query SecretString --output text | jq -r .auth_token) \
          --tls
```

## Updating Infrastructure

To update infrastructure after making changes:

```bash
# 1. Review changes
terraform plan

# 2. Apply changes
terraform apply
```

## Destroying Infrastructure

**⚠️ WARNING:** This will delete ALL resources and data.

To destroy all infrastructure:

```bash
terraform destroy
```

Type `yes` to confirm.

**Note:** In production, you may want to:
1. Take final database backups
2. Export important data
3. Disable deletion protection on RDS

## Troubleshooting

### Issue: Backend initialization fails

**Solution:**
```bash
# Ensure backend setup script ran successfully
./backend-setup.sh

# Verify S3 bucket exists
aws s3 ls s3://mass-voice-campaign-terraform-state

# Verify DynamoDB table exists
aws dynamodb describe-table --table-name mass-voice-campaign-terraform-locks
```

### Issue: SSH key not found

**Error:** `Error: InvalidKeyPair.NotFound`

**Solution:**
```bash
# List available key pairs
aws ec2 describe-key-pairs

# Create a new key pair if needed
aws ec2 create-key-pair --key-name mass-voice-campaign-key --query 'KeyMaterial' --output text > ~/.ssh/mass-voice-campaign-key.pem
chmod 400 ~/.ssh/mass-voice-campaign-key.pem

# Update terraform.tfvars
asterisk_key_name = "mass-voice-campaign-key"
```

### Issue: Resource quota exceeded

**Error:** `Error: Error creating DB Instance: DBInstanceQuotaExceeded`

**Solution:**
```bash
# Check current RDS instances
aws rds describe-db-instances

# Request quota increase in AWS Service Quotas console
# Or delete unused RDS instances
```

### Issue: State lock error

**Error:** `Error acquiring the state lock`

**Solution:**
```bash
# Check if another Terraform process is running
ps aux | grep terraform

# If no other process, manually remove lock
aws dynamodb delete-item \
  --table-name mass-voice-campaign-terraform-locks \
  --key '{"LockID":{"S":"mass-voice-campaign-terraform-state/infrastructure/terraform.tfstate"}}'
```

## Cost Management

### Monitor Costs

```bash
# Check estimated monthly costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://cost-filter.json
```

### Stop Non-Production Resources

For dev/staging environments, stop resources when not in use:

```bash
# Stop RDS instance
aws rds stop-db-instance --db-instance-identifier mass-voice-campaign-postgres-dev

# Stop EC2 instance
aws ec2 stop-instances --instance-ids $(terraform output -raw asterisk_instance_id)
```

### Start Resources

```bash
# Start RDS instance
aws rds start-db-instance --db-instance-identifier mass-voice-campaign-postgres-dev

# Start EC2 instance
aws ec2 start-instances --instance-ids $(terraform output -raw asterisk_instance_id)
```

## Next Steps

After infrastructure is deployed:

1. **Database Setup** (Task 2.1): Run database migrations
2. **Lambda Deployment** (Task 3.x): Deploy Lambda function code
3. **Asterisk Configuration** (Task 7.x): Run Ansible playbooks
4. **Frontend Deployment** (Task 11.x): Deploy React app to S3

## Support

For issues or questions:
- Review the main README: `terraform/README.md`
- Check design document: `.kiro/specs/mass-voice-campaign-system/design.md`
- Review requirements: `.kiro/specs/mass-voice-campaign-system/requirements.md`
