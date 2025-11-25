#!/bin/bash
# Script to validate Terraform configuration

set -e

echo "🔍 Validating Terraform configuration..."
echo ""

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install Terraform >= 1.5.0"
    exit 1
fi

# Check Terraform version
TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version')
echo "✅ Terraform version: $TERRAFORM_VERSION"
echo ""

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo "⚠️  terraform.tfvars not found. Creating from example..."
    cp terraform.tfvars.example terraform.tfvars
    echo "📝 Please edit terraform.tfvars with your configuration"
    echo ""
fi

# Format check
echo "📐 Checking Terraform formatting..."
if terraform fmt -check -recursive; then
    echo "✅ Terraform files are properly formatted"
else
    echo "⚠️  Some files need formatting. Run: terraform fmt -recursive"
fi
echo ""

# Initialize if needed
if [ ! -d ".terraform" ]; then
    echo "⚠️  Terraform not initialized. Please run: terraform init"
    echo ""
    exit 0
fi

# Validate configuration
echo "🔍 Validating Terraform configuration..."
if terraform validate; then
    echo "✅ Terraform configuration is valid"
else
    echo "❌ Terraform configuration has errors"
    exit 1
fi
echo ""

# Run plan
echo "📋 Running Terraform plan..."
echo "This will show what resources will be created."
echo ""
terraform plan -out=tfplan

echo ""
echo "✅ Validation complete!"
echo ""
echo "Next steps:"
echo "  1. Review the plan above"
echo "  2. If everything looks good, run: terraform apply tfplan"
echo "  3. Or run: terraform apply (to review and approve interactively)"
