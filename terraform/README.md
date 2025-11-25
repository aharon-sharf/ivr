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

Before running Terraform for the first time, set up the S3 bucket and DynamoDB table for remote state:

```bash
cd terraform
chmod +x backend-setup.sh
./backend-setup.sh
```

This script creates:
- S3 bucket: `mass-voice-campaign-terraform-state`
- DynamoDB table: `mass-voice-campaign-terraform-locks`

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

## Deployment

### Plan Changes

Review the infrastructure changes before applying:

```bash
terraform plan
```

### Apply Changes

Deploy the infrastructure:

```bash
terraform apply
```

Review the plan and type `yes` to confirm.

### Destroy Infrastructure

To tear down all infrastructure:

```bash
terraform destroy
```

**Warning**: This will delete all resources. Use with caution in production.

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

## Troubleshooting

### Backend Initialization Fails

If `terraform init` fails with backend errors:
1. Ensure `backend-setup.sh` ran successfully
2. Check AWS credentials have permissions for S3 and DynamoDB
3. Verify bucket and table names match in `main.tf`

### Resource Creation Fails

If resources fail to create:
1. Check AWS service quotas (especially VPC, EC2, RDS)
2. Verify SSH key pair exists in the correct region
3. Check IAM permissions for your AWS credentials

### State Lock Errors

If you see "Error acquiring the state lock":
1. Another Terraform process may be running
2. Check DynamoDB table for stuck locks
3. Manually remove lock if confirmed no other process is running

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
