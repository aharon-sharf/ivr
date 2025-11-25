#!/bin/bash

# Generate Environment Configuration from Terraform Outputs
# This script creates .env.production file with values from Terraform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-production}
OUTPUT_FILE=".env.${ENVIRONMENT}"

echo -e "${GREEN}Generating ${OUTPUT_FILE} from Terraform outputs...${NC}"

# Check if Terraform state exists
if [ ! -f "../terraform/terraform.tfstate" ]; then
    echo -e "${RED}Error: Terraform state not found. Please run 'terraform apply' first.${NC}"
    exit 1
fi

cd ../terraform

# Get Terraform outputs
echo -e "${YELLOW}Fetching Terraform outputs...${NC}"

API_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "")
COGNITO_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "il-central-1")
COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null || echo "")
COGNITO_CLIENT_ID=$(terraform output -raw cognito_app_client_id 2>/dev/null || echo "")

cd ../frontend

# Validate outputs
if [ -z "$API_URL" ]; then
    echo -e "${RED}Error: Could not retrieve API Gateway URL${NC}"
    exit 1
fi

if [ -z "$COGNITO_USER_POOL_ID" ]; then
    echo -e "${RED}Error: Could not retrieve Cognito User Pool ID${NC}"
    exit 1
fi

if [ -z "$COGNITO_CLIENT_ID" ]; then
    echo -e "${RED}Error: Could not retrieve Cognito Client ID${NC}"
    exit 1
fi

# Generate .env file
cat > "${OUTPUT_FILE}" << EOF
# Auto-generated from Terraform outputs
# Generated at: $(date)

# API Gateway URL
VITE_API_URL=${API_URL}

# AWS Cognito Configuration
VITE_COGNITO_REGION=${COGNITO_REGION}
VITE_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
VITE_COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}

# WebSocket URL (replace with actual WebSocket endpoint if different)
VITE_WEBSOCKET_URL=${API_URL/https/wss}

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ML_PREDICTIONS=true

# Environment
VITE_ENVIRONMENT=${ENVIRONMENT}
EOF

echo -e "${GREEN}✓ ${OUTPUT_FILE} generated successfully!${NC}"
echo -e "\n${GREEN}Configuration:${NC}"
echo -e "${YELLOW}  API URL: ${API_URL}${NC}"
echo -e "${YELLOW}  Cognito Region: ${COGNITO_REGION}${NC}"
echo -e "${YELLOW}  User Pool ID: ${COGNITO_USER_POOL_ID}${NC}"
echo -e "${YELLOW}  Client ID: ${COGNITO_CLIENT_ID}${NC}"
echo -e "\n${GREEN}You can now build and deploy the frontend.${NC}"
