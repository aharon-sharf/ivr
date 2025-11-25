# Prerequisites

This document outlines all the tools, software, and accounts required to implement the Mass Voice Campaign System.

## Development Environment Prerequisites

### Required Tools

**1. Node.js & npm**
- Node.js 18+ (LTS recommended)
- npm 9+ or yarn 1.22+
- Used for: Lambda functions (TypeScript), Node.js Worker for Asterisk, React frontend

**2. Python**
- Python 3.9+ 
- pip package manager
- Used for: ML Lambda functions, SageMaker training scripts, Ansible

**3. AWS CLI**
- AWS CLI v2
- Configured with credentials (`aws configure`)
- Used for: Deploying infrastructure, managing AWS resources

**4. Terraform**
- Terraform 1.5+
- Used for: Infrastructure as Code provisioning

**5. Docker**
- Docker Desktop (Windows) or Docker Engine (Linux)
- Docker Compose
- Used for: Lambda container images, local testing with LocalStack, integration tests

**6. Git**
- Git 2.30+
- GitHub account for CI/CD
- Used for: Version control, GitHub Actions workflows

### Platform-Specific (Windows)

**7. WSL2 (Windows Subsystem for Linux)**
- **Highly Recommended** for Windows users
- Ubuntu 22.04 LTS or similar
- Reason: Terraform, Ansible, and many AWS tools work better in Linux environment
- Alternative: Use PowerShell with Windows-native tools (more complex)

**8. Ansible** (runs in WSL2/Linux)
- Ansible 2.14+
- Used for: Asterisk EC2 configuration management
- Install in WSL2: `sudo apt install ansible`

### Optional but Recommended

**9. VS Code Extensions**
- Terraform extension
- Docker extension
- AWS Toolkit
- ESLint, Prettier for TypeScript/React

**10. LocalStack** (for local AWS testing)
- LocalStack Pro (free tier available)
- Docker-based AWS emulator
- Used for: Local development without AWS costs

**11. MongoDB Compass** (GUI for MongoDB)
- For viewing CDR data during development

**12. PostgreSQL Client** (psql or DBeaver)
- For database management and debugging

### AWS Account Requirements

**13. AWS Account**
- Active AWS account with billing enabled
- IAM user with AdministratorAccess (or specific permissions)
- AWS credentials configured locally
- Budget alerts recommended (~$500/month for production)

**14. Domain Name** (optional but recommended)
- For custom domain on CloudFront (frontend)
- Can use Route 53 or external registrar

### Israeli SIP Trunk Provider

**15. SIP Trunk Account**
- Account with Israeli provider (019, Partner, or similar)
- SIP credentials (username, password, server)
- Whitelist your Elastic IP for SIP registration

### Testing Tools

**16. Property-Based Testing Libraries**
- **TypeScript/Node.js**: `fast-check` (npm package)
- **Python**: `hypothesis` (pip package)
- Used for: Property-based tests throughout implementation

**17. Load Testing Tools**
- Apache JMeter, k6, or Gatling
- Used for: Performance and load testing (Task 13.3)

### Minimum System Requirements

**Development Machine**:
- CPU: 4+ cores (8+ recommended)
- RAM: 16GB minimum (32GB recommended for running Docker + LocalStack)
- Storage: 50GB free space
- OS: Windows 10/11 with WSL2, macOS 12+, or Linux (Ubuntu 22.04+)

## Installation Quick Start (Windows with WSL2)

```bash
# In WSL2 Ubuntu terminal:

# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install Python 3.9+
sudo apt install -y python3 python3-pip

# 4. Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 5. Install Terraform
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# 6. Install Docker (if not using Docker Desktop)
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER

# 7. Install Ansible
sudo apt install -y ansible

# 8. Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (e.g., us-east-1), Output format (json)

# 9. Install Node.js dependencies for Lambda
npm install -g typescript ts-node

# 10. Install Python dependencies
pip3 install boto3 pandas scikit-learn hypothesis pytest
```

## Verification Checklist

Before starting implementation, verify all tools are installed correctly:

```bash
# Check versions
node --version          # Should be 18+
npm --version           # Should be 9+
python3 --version       # Should be 3.9+
aws --version           # Should be 2.x
terraform --version     # Should be 1.5+
docker --version        # Should be 20+
ansible --version       # Should be 2.14+

# Test AWS credentials
aws sts get-caller-identity  # Should return your AWS account info

# Test Docker
docker run hello-world  # Should download and run successfully
```

## Cost Considerations

### Development/Testing
- LocalStack: Free tier available
- AWS Free Tier: Some services free for 12 months
- Estimated dev cost: $50-100/month (if using real AWS resources)

### Production
- Estimated: $490-540/month for 1M calls
- Idle cost: ~$260/month (RDS, Redis, EC2, VPC Endpoints)

### Cost Breakdown (1M calls/month)
- Lambda invocations: ~$50-100
- API Gateway: ~$35
- SQS/SNS: ~$10
- Step Functions: ~$25
- EventBridge Pipes: ~$5
- SageMaker Serverless Inference: ~$20
- Amazon Polly: ~$40
- AWS Cognito: ~$5
- CloudFront: ~$10
- VPC Endpoints: ~$50
- RDS PostgreSQL: ~$100
- ElastiCache Redis: ~$50
- EC2 Asterisk: ~$60
- Data transfer: ~$30

## AWS IAM Permissions Required

Your IAM user/role needs permissions for:
- EC2 (instances, security groups, Elastic IPs)
- VPC (subnets, route tables, endpoints)
- RDS (database instances)
- ElastiCache (Redis clusters)
- S3 (buckets, objects)
- Lambda (functions, layers)
- API Gateway (REST APIs, WebSocket APIs)
- SQS (queues)
- SNS (topics, subscriptions)
- Step Functions (state machines)
- EventBridge (rules, pipes)
- SageMaker (endpoints, training jobs)
- Polly (synthesize speech)
- Cognito (user pools, identity pools)
- CloudFront (distributions)
- CloudWatch (logs, metrics, alarms)
- IAM (roles, policies)
- ECR (container registry)

Recommended: Use `AdministratorAccess` policy for development, then create least-privilege policies for production.

## Next Steps

Once you have all prerequisites installed and verified:

1. **Start with Task 1.1**: Set up Terraform project structure
2. **Configure AWS credentials**: Ensure proper IAM permissions
3. **Create S3 bucket for Terraform state**: Backend for state management
4. **Begin infrastructure provisioning**: Follow tasks.md sequentially

## Troubleshooting

### Common Issues

**WSL2 Docker Integration**
- If Docker commands fail in WSL2, ensure Docker Desktop has WSL2 integration enabled
- Settings → Resources → WSL Integration → Enable for your distro

**AWS Credentials**
- If `aws sts get-caller-identity` fails, check `~/.aws/credentials` and `~/.aws/config`
- Ensure Access Key ID and Secret Access Key are correct

**Terraform State Locking**
- Create DynamoDB table for state locking: `terraform-state-lock`
- Prevents concurrent Terraform runs

**Node.js Version**
- Use `nvm` (Node Version Manager) to manage multiple Node.js versions
- Install: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash`
- Use: `nvm install 18 && nvm use 18`

**Python Virtual Environments**
- Recommended to use virtual environments for Python dependencies
- Create: `python3 -m venv venv`
- Activate: `source venv/bin/activate`
- Install: `pip install -r requirements.txt`

## Additional Resources

- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Asterisk Documentation](https://wiki.asterisk.org/)
- [React Documentation](https://react.dev/)
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [Amazon Polly Documentation](https://docs.aws.amazon.com/polly/)
- [SageMaker Serverless Inference](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html)
