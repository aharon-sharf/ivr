#!/bin/bash
# Script to set up Terraform remote state backend (S3 + DynamoDB)
# Run this script once before running terraform init

set -e

# Configuration
BUCKET_NAME="mass-voice-campaign-terraform-state"
DYNAMODB_TABLE="mass-voice-campaign-terraform-locks"
REGION="il-central-1"

echo "Setting up Terraform remote state backend..."

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
echo ""
echo "You can now run: terraform init"
