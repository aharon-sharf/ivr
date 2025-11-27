# Mass Voice Campaign System - Terraform Infrastructure

This directory contains the Terraform configuration for provisioning the Mass Voice Campaign System infrastructure on AWS.

## Architecture Overview

The infrastructure follows a hybrid serverless architecture:
- **Serverless compute**: AWS Lambda for business logic
- **Telephony**: Self-hosted Asterisk on EC2
- **Data layer**: RDS PostgreSQL, ElastiCache Redis
- **Messaging**: SQS queues, SNS topics
- **Storage**: S3 buckets with lifecycle policies
- **Orchestration**: Step Functions, EventBridge
- **ML**: SageMaker Serverless Inference
- **Auth**: AWS Cognito

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.5.0
3. **SSH Key Pair** created in AWS for Asterisk EC2 instance

## Initial Setup

### 1. Set up Remote State Backend

Before running Terraform for the first time, set up the S3 bucket for remote state:

```bash
cd terraform
chmod +x backend-setup.sh
./backend-setup.sh
```

This script creates:
- S3 bucket: `mass-voice-campaign-terraform-state`
- Enables S3 native state locking (no DynamoDB required)
- Single bucket shared by all environments (dev/staging/production)

### 2. Configure Variables

Copy the example variables file and update with your values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and update:
- `asterisk_key_name`: Your SSH key pair name
- Other variables as needed for your environment

### 3. Initialize Terraform

```bash
terraform init
```

This will:
- Download required providers
- Configure the remote state backend
- Initialize modules

### 4. Create Workspaces for Each Environment

Terraform workspaces allow you to manage multiple environments (dev/staging/production) with the same configuration:

```bash
# Create workspaces
terraform workspace new dev
terraform workspace new staging
terraform workspace new production

# List all workspaces
terraform workspace list

# Switch to a workspace
terraform workspace select dev
```

**How workspaces work:**
- Each workspace maintains its own state file in the S3 bucket
- State files are stored as: `env:/WORKSPACE_NAME/terraform.tfstate`
- Example: `env:/dev/terraform.tfstate`, `env:/production/terraform.tfstate`
- Resources are completely isolated between workspaces
- You can have dev, staging, and production running simultaneously

## Deployment

### Option 1: Using Helper Scripts (Recommended)

We provide helper scripts to make deployment safer and easier:

```bash
# Make scripts executable
chmod +x deploy.sh check-workspace.sh

# Deploy to dev
./deploy.sh dev plan      # Preview changes
./deploy.sh dev apply     # Apply changes

# Deploy to staging
./deploy.sh staging plan
./deploy.sh staging apply

# Deploy to production (requires confirmation)
./deploy.sh production plan
./deploy.sh production apply

# Destroy environment
./deploy.sh dev destroy
```

The `deploy.sh` script will:
- ✅ Verify you're in the correct workspace
- ✅ Automatically switch workspaces if needed
- ✅ Use the correct `.tfvars` file
- ✅ Require extra confirmation for production
- ✅ Show clear status messages

### Option 2: Manual Deployment

If you prefer manual control:

#### Working with Environments

Always ensure you're in the correct workspace before making changes:

```bash
# Check current workspace
terraform workspace show

# Or use the helper script
./check-workspace.sh dev

# Switch to desired environment
terraform workspace select dev    # or staging, or production
```

#### Plan Changes

Review the infrastructure changes before applying:

```bash
# Make sure you're in the right workspace!
terraform workspace select dev

# Plan changes
terraform plan -var-file=environments/dev.tfvars
```

#### Apply Changes

Deploy the infrastructure:

```bash
# Make sure you're in the right workspace!
terraform workspace select dev

# Apply changes
terraform apply -var-file=environments/dev.tfvars
```

Review the plan and type `yes` to confirm.

#### Destroy Infrastructure

To tear down all infrastructure for a specific environment:

```bash
# Make sure you're in the right workspace!
terraform workspace select dev

# Destroy
terraform destroy -var-file=environments/dev.tfvars
```

**Warning**: This will delete all resources in the selected workspace. Use with caution in production.

## Module Structure

```
terraform/
├── main.tf                    # Root module orchestration
├── variables.tf               # Input variables
├── outputs.tf                 # Output values
├── terraform.tfvars.example   # Example variable values
├── backend-setup.sh           # Script to set up remote state
└── modules/
    ├── networking/            # VPC, subnets, VPC endpoints
    ├── data/                  # RDS, Redis
    ├── storage/               # S3 buckets
    ├── messaging/             # SQS, SNS
    ├── compute/               # Lambda, EC2 (Asterisk)
    ├── orchestration/         # Step Functions, EventBridge
    ├── auth/                  # Cognito
    ├── ml/                    # SageMaker
    └── monitoring/            # CloudWatch
```

## Cost Optimization

The infrastructure is designed for scale-to-zero economics:

- **Lambda**: Pay only for actual compute time
- **VPC Endpoints**: ~$50/month (vs $65-100 for NAT Gateway)
- **RDS/Redis**: Can be stopped when not in use (dev/staging)
- **S3**: Lifecycle policies move old data to Glacier
- **SageMaker**: Serverless inference scales to zero

### Estimated Monthly Costs (1M calls/month)

- Lambda: $50-100
- API Gateway: $35
- SQS/SNS: $10
- Step Functions: $25
- EventBridge Pipes: $5
- SageMaker: $20
- Polly: $40
- RDS (db.t3.medium): $60
- Redis (cache.t3.medium): $50
- VPC Endpoints: $50
- EC2 (c5.large): $60
- **Total**: ~$405/month

## Network Architecture

The system uses VPC Endpoints instead of NAT Gateway for cost optimization:

- **Public Subnets**: Lambda (for external APIs), Asterisk EC2
- **Private Subnets**: RDS, Redis
- **VPC Endpoints**: S3 (free), SQS, SNS, Lambda, Polly, SageMaker
- **No NAT Gateway**: Saves $65-100/month fixed cost

## Security

- All data encrypted at rest (RDS, Redis, S3)
- All data encrypted in transit (TLS 1.3)
- Secrets stored in AWS Secrets Manager
- Security groups restrict traffic to VPC only
- Public access blocked on all S3 buckets (except frontend)

## Outputs

After deployment, Terraform outputs important values:

```bash
terraform output
```

Key outputs:
- `rds_endpoint`: PostgreSQL connection string
- `redis_endpoint`: Redis connection string
- `asterisk_public_ip`: Asterisk EC2 public IP
- `api_gateway_url`: API Gateway endpoint
- `cognito_user_pool_id`: Cognito User Pool ID
- S3 bucket names

## Best Practices for Workspaces

### 1. Always Check Your Workspace

Before running any Terraform command, verify you're in the correct workspace:

```bash
# Show current workspace (will be highlighted with *)
terraform workspace list

# Or just show current
terraform workspace show
```

### 2. Use Environment-Specific Variable Files

Create separate `.tfvars` files for each environment:

```bash
terraform/
└── environments/
    ├── dev.tfvars
    ├── staging.tfvars
    └── production.tfvars
```

Always specify the correct file:

```bash
terraform apply -var-file=environments/dev.tfvars
```

### 3. Naming Convention

Use workspace name in resource names to avoid confusion:

```hcl
resource "aws_instance" "asterisk" {
  tags = {
    Name        = "asterisk-${terraform.workspace}"
    Environment = terraform.workspace
  }
}
```

This creates: `asterisk-dev`, `asterisk-staging`, `asterisk-production`

### 4. Workspace-Specific Configuration

Use conditional logic for environment-specific settings:

```hcl
locals {
  instance_type = terraform.workspace == "production" ? "c5.xlarge" : "t3.medium"
  multi_az      = terraform.workspace == "production" ? true : false
}
```

### 5. State File Backup

The S3 bucket has versioning enabled, so you can recover previous state versions:

```bash
# List state file versions
aws s3api list-object-versions \
  --bucket mass-voice-campaign-terraform-state \
  --prefix env:/dev/terraform.tfstate
```

## Troubleshooting

### Backend Initialization Fails

If `terraform init` fails with backend errors:
1. Ensure `backend-setup.sh` ran successfully
2. Check AWS credentials have permissions for S3
3. Verify bucket name matches in `main.tf`

### Resource Creation Fails

If resources fail to create:
1. Check AWS service quotas (especially VPC, EC2, RDS)
2. Verify SSH key pair exists in the correct region
3. Check IAM permissions for your AWS credentials

### State Lock Errors

If you see "Error acquiring the state lock":
1. Another Terraform process may be running
2. Check S3 bucket for `.terraform.lock` file
3. Wait for the lock to expire (typically 20 seconds) or manually remove the lock file if confirmed no other process is running

## Helper Scripts

### backend-setup.sh

Creates the S3 bucket for Terraform state (run once):

```bash
./backend-setup.sh
```

### deploy.sh

Simplified deployment with safety checks:

```bash
./deploy.sh <environment> <action>

# Examples:
./deploy.sh dev plan
./deploy.sh staging apply
./deploy.sh production destroy
```

Features:
- Automatic workspace switching
- Correct `.tfvars` file selection
- Production confirmation prompts
- Clear status messages

### check-workspace.sh

Verify you're in the correct workspace:

```bash
# Show current workspace
./check-workspace.sh

# Verify specific workspace
./check-workspace.sh dev
```

Returns exit code 0 if correct, 1 if wrong (useful in CI/CD).

## Next Steps

After infrastructure is provisioned:

1. **Database Setup**: Run database migrations (task 2.1)
2. **Lambda Deployment**: Deploy Lambda function code (task 3.x)
3. **Asterisk Configuration**: Run Ansible playbooks (task 7.x)
4. **Frontend Deployment**: Deploy React app to S3 (task 11.x)

## Support

For issues or questions, refer to:
- Design document: `.kiro/specs/mass-voice-campaign-system/design.md`
- Requirements: `.kiro/specs/mass-voice-campaign-system/requirements.md`
- Tasks: `.kiro/specs/mass-voice-campaign-system/tasks.md`
