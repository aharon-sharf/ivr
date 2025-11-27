#!/bin/bash
# Script to set up Terraform remote state backend (S3 with native locking)
# Run this script once before running terraform init
# This script creates a single S3 bucket that will be used by all environments (dev/staging/production)
# Terraform workspaces will be used to separate state files within the same bucket

set -e

# Configuration
BUCKET_NAME="mass-voice-campaign-terraform-state"
REGION="il-central-1"

echo "Setting up Terraform remote state backend..."
echo "Note: This creates a single S3 bucket for all environments."
echo "Terraform workspaces will separate state files within this bucket."
echo ""

# Create S3 bucket for Terraform state
echo "Creating S3 bucket: $BUCKET_NAME"
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"
  2>/dev/null || echo "Bucket already exists"

# Enable versioning on the bucket
echo "Enabling versioning on S3 bucket..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled \
  --region "$REGION"

# Enable encryption on the bucket
echo "Enabling encryption on S3 bucket..."
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }' \
  --region "$REGION"

# Block public access
echo "Blocking public access to S3 bucket..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --region "$REGION"


echo ""
echo "✅ Terraform backend setup complete!"
echo ""
echo "S3 Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo "Locking: S3 native locking (use_lockfile = true)"
echo ""
echo "Note: This configuration uses S3's native state locking feature."
echo "DynamoDB is no longer required for state locking."
echo ""
echo "Next steps:"
echo "1. Run: terraform init"
echo "2. Create workspaces for each environment:"
echo "   terraform workspace new dev"
echo "   terraform workspace new staging"
echo "   terraform workspace new production"
echo "3. Switch between workspaces:"
echo "   terraform workspace select dev"
