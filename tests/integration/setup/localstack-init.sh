#!/bin/bash
# LocalStack initialization script for AWS services
# This script sets up S3 buckets, SQS queues, SNS topics, and other AWS resources for testing

set -e

echo "Waiting for LocalStack to be ready..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"s3": "available"'; do
  sleep 2
done

echo "LocalStack is ready. Initializing AWS resources..."

# Set AWS CLI to use LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
AWS_ENDPOINT="--endpoint-url=http://localhost:4566"

# Create S3 buckets
echo "Creating S3 buckets..."
aws $AWS_ENDPOINT s3 mb s3://test-audio-files
aws $AWS_ENDPOINT s3 mb s3://test-ml-models
aws $AWS_ENDPOINT s3 mb s3://test-campaign-reports
aws $AWS_ENDPOINT s3 mb s3://test-contact-uploads

# Enable versioning on audio files bucket
aws $AWS_ENDPOINT s3api put-bucket-versioning \
  --bucket test-audio-files \
  --versioning-configuration Status=Enabled

# Create SQS queues
echo "Creating SQS queues..."
aws $AWS_ENDPOINT sqs create-queue --queue-name test-dial-tasks
aws $AWS_ENDPOINT sqs create-queue --queue-name test-dial-tasks-dlq

# Set DLQ redrive policy
QUEUE_URL=$(aws $AWS_ENDPOINT sqs get-queue-url --queue-name test-dial-tasks --query 'QueueUrl' --output text)
DLQ_ARN=$(aws $AWS_ENDPOINT sqs get-queue-attributes --queue-url $(aws $AWS_ENDPOINT sqs get-queue-url --queue-name test-dial-tasks-dlq --query 'QueueUrl' --output text) --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

aws $AWS_ENDPOINT sqs set-queue-attributes \
  --queue-url $QUEUE_URL \
  --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}"

# Create SNS topics
echo "Creating SNS topics..."
aws $AWS_ENDPOINT sns create-topic --name test-call-events
aws $AWS_ENDPOINT sns create-topic --name test-donation-events
aws $AWS_ENDPOINT sns create-topic --name test-optout-events
aws $AWS_ENDPOINT sns create-topic --name test-campaign-notifications

# Create DynamoDB table for distributed locks (if needed)
echo "Creating DynamoDB tables..."
aws $AWS_ENDPOINT dynamodb create-table \
  --table-name test-distributed-locks \
  --attribute-definitions AttributeName=lockId,AttributeType=S \
  --key-schema AttributeName=lockId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Create Secrets Manager secrets
echo "Creating Secrets Manager secrets..."
aws $AWS_ENDPOINT secretsmanager create-secret \
  --name test/database/credentials \
  --secret-string '{"username":"postgres","password":"test_password"}'

aws $AWS_ENDPOINT secretsmanager create-secret \
  --name test/sms/api-key \
  --secret-string '{"apiKey":"test-api-key","apiSecret":"test-api-secret"}'

# Upload sample audio file to S3
echo "Uploading sample test files..."
echo "This is a test audio file" > /tmp/test-audio.txt
aws $AWS_ENDPOINT s3 cp /tmp/test-audio.txt s3://test-audio-files/test-message-1.mp3

# Upload sample ML model
echo "Sample ML model" > /tmp/test-model.pkl
aws $AWS_ENDPOINT s3 cp /tmp/test-model.pkl s3://test-ml-models/optimal-time-predictor/v1/model.pkl

echo "LocalStack initialization complete!"
echo ""
echo "Available resources:"
echo "  S3 Buckets: test-audio-files, test-ml-models, test-campaign-reports, test-contact-uploads"
echo "  SQS Queues: test-dial-tasks, test-dial-tasks-dlq"
echo "  SNS Topics: test-call-events, test-donation-events, test-optout-events, test-campaign-notifications"
echo "  DynamoDB Tables: test-distributed-locks"
echo "  Secrets: test/database/credentials, test/sms/api-key"
