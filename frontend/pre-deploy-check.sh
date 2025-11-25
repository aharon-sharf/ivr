#!/bin/bash

# Pre-Deployment Check Script
# Validates the frontend build before deploying to production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Frontend Pre-Deployment Checks${NC}"
echo -e "${GREEN}========================================${NC}"

# Check 1: Node.js version
echo -e "\n${YELLOW}Checking Node.js version...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version must be 18 or higher (current: $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js version: $(node -v)${NC}"

# Check 2: Dependencies installed
echo -e "\n${YELLOW}Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm ci
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Check 3: Linting
echo -e "\n${YELLOW}Running linter...${NC}"
if npm run lint; then
    echo -e "${GREEN}✓ Linting passed${NC}"
else
    echo -e "${RED}✗ Linting failed${NC}"
    exit 1
fi

# Check 4: TypeScript compilation
echo -e "\n${YELLOW}Checking TypeScript compilation...${NC}"
if npx tsc --noEmit; then
    echo -e "${GREEN}✓ TypeScript compilation successful${NC}"
else
    echo -e "${RED}✗ TypeScript compilation failed${NC}"
    exit 1
fi

# Check 5: Build
echo -e "\n${YELLOW}Building application...${NC}"
if npm run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Check 6: Build output
echo -e "\n${YELLOW}Checking build output...${NC}"
if [ ! -f "dist/index.html" ]; then
    echo -e "${RED}✗ dist/index.html not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build output verified${NC}"

# Check 7: Build size
echo -e "\n${YELLOW}Analyzing build size...${NC}"
BUILD_SIZE=$(du -sh dist | cut -f1)
echo -e "${GREEN}✓ Build size: ${BUILD_SIZE}${NC}"

# Check 8: Environment variables
echo -e "\n${YELLOW}Checking environment configuration...${NC}"
if [ -f ".env.production" ]; then
    echo -e "${GREEN}✓ .env.production found${NC}"
    
    # Check for required variables
    REQUIRED_VARS=("VITE_API_URL" "VITE_COGNITO_USER_POOL_ID" "VITE_COGNITO_CLIENT_ID")
    for VAR in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${VAR}=" .env.production; then
            echo -e "${GREEN}  ✓ ${VAR} configured${NC}"
        else
            echo -e "${YELLOW}  ⚠ ${VAR} not found in .env.production${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠ .env.production not found (using defaults)${NC}"
fi

# Check 9: AWS CLI
echo -e "\n${YELLOW}Checking AWS CLI...${NC}"
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version)
    echo -e "${GREEN}✓ AWS CLI installed: ${AWS_VERSION}${NC}"
    
    # Check AWS credentials
    if aws sts get-caller-identity &> /dev/null; then
        AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
        echo -e "${GREEN}✓ AWS credentials configured (Account: ${AWS_ACCOUNT})${NC}"
    else
        echo -e "${YELLOW}⚠ AWS credentials not configured${NC}"
    fi
else
    echo -e "${YELLOW}⚠ AWS CLI not installed${NC}"
fi

# Check 10: Terraform state
echo -e "\n${YELLOW}Checking Terraform infrastructure...${NC}"
if [ -f "../terraform/terraform.tfstate" ]; then
    echo -e "${GREEN}✓ Terraform state found${NC}"
    
    cd ../terraform
    if terraform output frontend_hosting_bucket &> /dev/null; then
        BUCKET=$(terraform output -raw frontend_hosting_bucket)
        DISTRIBUTION=$(terraform output -raw cloudfront_distribution_id)
        echo -e "${GREEN}  ✓ S3 Bucket: ${BUCKET}${NC}"
        echo -e "${GREEN}  ✓ CloudFront Distribution: ${DISTRIBUTION}${NC}"
    else
        echo -e "${YELLOW}  ⚠ Could not retrieve Terraform outputs${NC}"
    fi
    cd ../frontend
else
    echo -e "${YELLOW}⚠ Terraform state not found${NC}"
    echo -e "${YELLOW}  Run 'cd terraform && terraform apply' first${NC}"
fi

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Pre-Deployment Checks Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${GREEN}Ready to deploy! Run:${NC}"
echo -e "${YELLOW}  ./deploy.sh dev${NC}"
echo -e "\n${GREEN}Or for production:${NC}"
echo -e "${YELLOW}  ./deploy.sh production${NC}"
