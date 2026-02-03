#!/bin/bash

# Script to update all Lambda functions to use the latest ECR images
# Usage: ./update-lambda-images.sh [environment]

set -e

ENVIRONMENT=${1:-staging}
REGION="il-central-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Updating Lambda functions for environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Account ID: $ACCOUNT_ID"
echo ""

# List of Lambda functions
FUNCTIONS=(
  "api-handler"
  "mass-voice-campaign-audio-converter"
  "dispatcher"
  "dialer-worker"
  "enrich-dial-task"
  "validate-campaign"
  "status-checker"
  "campaign-orchestrator"
  "sms-gateway"
  "sms-dispatcher"
  "sms-reply-handler"
  "tts-service"
  "tts-fallback"
  "ml-inference"
  "analytics"
  "report-generator"
  "campaign-comparison"
  "cdr-logger"
  "donation-handler"
  "optout-handler"
)

for FUNCTION in "${FUNCTIONS[@]}"; do
  FUNCTION_NAME="${FUNCTION}-${ENVIRONMENT}"
  IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${FUNCTION}:latest"
  
  echo "Updating $FUNCTION_NAME..."
  
  # Check if function exists
  if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    # Update function code
    aws lambda update-function-code \
      --function-name "$FUNCTION_NAME" \
      --image-uri "$IMAGE_URI" \
      --region "$REGION" \
      --output json > /dev/null
    
    echo "✓ Updated $FUNCTION_NAME"
    
    # Wait for update to complete
    aws lambda wait function-updated \
      --function-name "$FUNCTION_NAME" \
      --region "$REGION" || true
  else
    echo "⚠ Function $FUNCTION_NAME not found, skipping..."
  fi
  
  echo ""
done

echo "All Lambda functions updated successfully!"
