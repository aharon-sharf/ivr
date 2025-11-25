#!/bin/bash

# Frontend Deployment Script
# This script builds the React app and deploys it to S3 + CloudFront

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-il-central-1}
PROJECT_NAME="mass-voice-campaign"

echo -e "${GREEN}Starting frontend deployment for environment: ${ENVIRONMENT}${NC}"

# Get bucket name and CloudFront distribution ID from Terraform outputs
echo -e "${YELLOW}Fetching infrastructure details from Terraform...${NC}"
cd ../terraform

if [ ! -f "terraform.tfstate" ]; then
    echo -e "${RED}Error: terraform.tfstate not found. Please run 'terraform apply' first.${NC}"
    exit 1
fi

BUCKET_NAME=$(terraform output -raw frontend_hosting_bucket 2>/dev/null || echo "")
DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")

if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}Error: Could not retrieve S3 bucket name from Terraform outputs${NC}"
    exit 1
fi

if [ -z "$DISTRIBUTION_ID" ]; then
    echo -e "${RED}Error: Could not retrieve CloudFront distribution ID from Terraform outputs${NC}"
    exit 1
fi

echo -e "${GREEN}S3 Bucket: ${BUCKET_NAME}${NC}"
echo -e "${GREEN}CloudFront Distribution: ${DISTRIBUTION_ID}${NC}"

cd ../frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm ci
fi

# Build the React app
echo -e "${YELLOW}Building React application...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}Error: Build failed - dist directory not found${NC}"
    exit 1
fi

# Upload to S3
echo -e "${YELLOW}Uploading files to S3...${NC}"
aws s3 sync dist/ "s3://${BUCKET_NAME}/" \
    --region "${AWS_REGION}" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" \
    --exclude "*.map"

# Upload index.html with no-cache to ensure users get latest version
echo -e "${YELLOW}Uploading index.html with no-cache...${NC}"
aws s3 cp dist/index.html "s3://${BUCKET_NAME}/index.html" \
    --region "${AWS_REGION}" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html"

# Invalidate CloudFront cache
echo -e "${YELLOW}Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "${DISTRIBUTION_ID}" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${GREEN}CloudFront invalidation created: ${INVALIDATION_ID}${NC}"
echo -e "${YELLOW}Waiting for invalidation to complete (this may take a few minutes)...${NC}"

aws cloudfront wait invalidation-completed \
    --distribution-id "${DISTRIBUTION_ID}" \
    --id "${INVALIDATION_ID}"

# Get CloudFront URL
CLOUDFRONT_URL=$(cd ../terraform && terraform output -raw frontend_url)

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Frontend URL: ${CLOUDFRONT_URL}${NC}"
echo -e "${GREEN}========================================${NC}"
