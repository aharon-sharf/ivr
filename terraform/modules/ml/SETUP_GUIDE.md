# SageMaker Serverless Inference Setup Guide

This guide walks you through setting up the SageMaker Serverless Inference endpoint for the Mass Voice Campaign System.

## Overview

The ML module provides optimal call time predictions using a SageMaker Serverless Inference endpoint. This setup includes:

1. Creating a placeholder ML model for testing
2. Uploading the model to S3
3. Deploying the infrastructure with Terraform
4. Testing the endpoint
5. Integrating with Lambda functions

## Prerequisites

- AWS CLI configured with appropriate credentials
- Python 3.8+ with pip
- Terraform 1.5+
- Access to the S3 bucket for ML models

## Step 1: Create Placeholder Model

For initial testing, create a placeholder model:

```bash
cd terraform/modules/ml/sample-model

# Install dependencies
pip install scikit-learn numpy boto3

# Create the model artifact
python create_placeholder_model.py
```

This creates `model.tar.gz` containing:
- `model.pkl`: Trained scikit-learn model
- `inference.py`: Custom inference script
- `requirements.txt`: Python dependencies

## Step 2: Upload Model to S3

First, identify your ML models bucket name:

```bash
# Get the bucket name from Terraform outputs
cd ../../../
terraform output ml_models_bucket
```

Then upload the model:

```bash
cd terraform/modules/ml/sample-model

# Replace YOUR-BUCKET with the actual bucket name
aws s3 cp model.tar.gz s3://YOUR-BUCKET/models/optimal-call-time/model.tar.gz

# Verify upload
aws s3 ls s3://YOUR-BUCKET/models/optimal-call-time/
```

## Step 3: Configure Terraform Variables

Update `terraform/terraform.tfvars` or create it if it doesn't exist:

```hcl
# Required variables
aws_region         = "il-central-1"
environment        = "dev"
asterisk_key_name  = "your-ssh-key-name"

# Optional: Update SageMaker container image for your region
sagemaker_container_image = "683313688378.dkr.ecr.il-central-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3"
```

**Note**: The default container image is for us-east-1. For IL region (il-central-1), you may need to:

1. Check available images in your region:
```bash
aws ecr describe-repositories --region il-central-1 | grep sagemaker
```

2. Or use a custom container image from ECR

## Step 4: Deploy Infrastructure

```bash
cd terraform

# Initialize Terraform (first time only)
terraform init

# Review the plan
terraform plan

# Apply the configuration
terraform apply
```

This will create:
- SageMaker Model
- Serverless Endpoint Configuration (1024 MB, 200 max concurrency)
- Serverless Endpoint
- IAM roles for SageMaker and Lambda

**Note**: Endpoint creation takes 5-10 minutes. Monitor progress:

```bash
aws sagemaker describe-endpoint \
  --endpoint-name $(terraform output -raw sagemaker_endpoint_name) \
  --region il-central-1
```

Wait until `EndpointStatus` is `InService`.

## Step 5: Test the Endpoint

Once the endpoint is in service, test it:

```bash
cd modules/ml/sample-model

# Test with the Python script
python test_endpoint.py \
  --endpoint-name $(cd ../../.. && terraform output -raw sagemaker_endpoint_name) \
  --region il-central-1
```

Or test manually with AWS CLI:

```bash
# Single prediction
aws sagemaker-runtime invoke-endpoint \
  --endpoint-name YOUR-ENDPOINT-NAME \
  --body '{"features": [1, 10, 0.5]}' \
  --content-type application/json \
  --region il-central-1 \
  output.json

cat output.json
```

Expected output:
```json
{
  "optimal_hours": [10],
  "confidence": [0.85]
}
```

## Step 6: Integrate with Lambda

### Get IAM Role ARN

```bash
cd terraform
terraform output lambda_sagemaker_invoke_role_arn
```

### Update Lambda Function

Add the IAM role to your Lambda function or attach the policy:

**Option 1: Use the pre-created role**

```terraform
resource "aws_lambda_function" "ml_inference" {
  function_name = "ml-inference-lambda"
  role          = module.ml.lambda_sagemaker_invoke_role_arn
  # ... other configuration
}
```

**Option 2: Attach policy to existing role**

```terraform
resource "aws_iam_role_policy_attachment" "lambda_sagemaker" {
  role       = aws_iam_role.existing_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}
```

### Lambda Code Example

```typescript
import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";

const client = new SageMakerRuntimeClient({ region: process.env.AWS_REGION });

export async function predictOptimalCallTime(contact: Contact): Promise<OptimalTimeWindow> {
  const payload = {
    features: [
      contact.dayOfWeek || new Date().getDay(),
      contact.hourOfDay || new Date().getHours(),
      contact.previousAnswerRate || 0.5
    ]
  };

  const command = new InvokeEndpointCommand({
    EndpointName: process.env.SAGEMAKER_ENDPOINT_NAME,
    ContentType: "application/json",
    Body: JSON.stringify(payload),
  });

  try {
    const response = await client.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Body));
    
    return {
      contactId: contact.id,
      preferredHourRange: {
        start: result.optimal_hours[0] - 1,
        end: result.optimal_hours[0] + 1
      },
      confidence: result.confidence[0]
    };
  } catch (error) {
    console.error("ML prediction failed:", error);
    // Fallback to default time window
    return {
      contactId: contact.id,
      preferredHourRange: { start: 10, end: 12 },
      confidence: 0.5
    };
  }
}
```

### Environment Variables

Set these environment variables in your Lambda function:

```bash
SAGEMAKER_ENDPOINT_NAME=mass-voice-campaign-dev-optimal-call-time-endpoint
AWS_REGION=il-central-1
```

## Step 7: Monitor Performance

### CloudWatch Metrics

Monitor the endpoint in CloudWatch:

```bash
# View metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/SageMaker \
  --metric-name ModelLatency \
  --dimensions Name=EndpointName,Value=YOUR-ENDPOINT-NAME \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average \
  --region il-central-1
```

Key metrics to monitor:
- `ModelLatency`: Inference time
- `Invocations`: Number of requests
- `ModelSetupTime`: Cold start time
- `OverheadLatency`: Request/response processing time

### Set Up Alarms

```bash
# Create alarm for high latency
aws cloudwatch put-metric-alarm \
  --alarm-name sagemaker-high-latency \
  --alarm-description "Alert when model latency exceeds 1 second" \
  --metric-name ModelLatency \
  --namespace AWS/SageMaker \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=EndpointName,Value=YOUR-ENDPOINT-NAME \
  --region il-central-1
```

## Troubleshooting

### Issue: Endpoint creation fails

**Error**: `ResourceLimitExceeded`

**Solution**: Check your SageMaker quotas:
```bash
aws service-quotas get-service-quota \
  --service-code sagemaker \
  --quota-code L-93A4C3F1 \
  --region il-central-1
```

Request a quota increase if needed.

### Issue: Model artifact not found

**Error**: `Could not find model data at s3://...`

**Solution**: 
1. Verify the S3 path in `terraform/modules/ml/main.tf`
2. Check bucket permissions
3. Ensure the file was uploaded correctly:
```bash
aws s3 ls s3://YOUR-BUCKET/models/optimal-call-time/ --recursive
```

### Issue: Cold start timeout

**Error**: `Endpoint invocation timed out`

**Solution**:
1. Increase Lambda timeout to 30+ seconds
2. Implement retry logic with exponential backoff
3. Consider increasing endpoint memory (currently 1024 MB)

### Issue: High latency

**Symptoms**: ModelLatency > 1 second

**Solutions**:
1. Increase memory size in endpoint configuration
2. Optimize model size (reduce features, use simpler model)
3. Implement caching for frequently requested predictions
4. Use batch predictions when possible

### Issue: Container image not available

**Error**: `Container image not found in registry`

**Solution**: Update the container image URI for your region:

```bash
# List available images in your region
aws ecr describe-repositories --region il-central-1

# Or use a custom image
# 1. Build your own container
# 2. Push to ECR
# 3. Update sagemaker_container_image variable
```

## Cost Optimization

### Serverless Inference Pricing

**Compute**: ~$0.20 per 1M inferences
**Memory**: Charged per GB-second
**No idle costs**: Scales to zero

### Cost Comparison (100K predictions/month)

| Option | Monthly Cost | Cold Start | Complexity |
|--------|-------------|------------|------------|
| Serverless Inference | $20 | 10-15s | Low |
| Real-time Endpoint | $150 | None | Low |
| Lambda + Model | $50 | 5-10s | Medium |

### Best Practices

1. **Batch predictions**: Process multiple contacts in one request
2. **Cache results**: Store predictions in Redis for 24 hours
3. **Monitor usage**: Set up billing alarms
4. **Right-size memory**: Start with 1024 MB, adjust based on metrics

## Production Deployment

### 1. Train Real Model

Replace the placeholder model with a real trained model:

```python
# train_model.py
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import pickle

# Load historical call data
df = pd.read_csv('call_history.csv')

# Feature engineering
X = df[['day_of_week', 'hour_of_day', 'previous_answer_rate']]
y = df['optimal_hour']

# Train model
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X, y)

# Save model
with open('model.pkl', 'wb') as f:
    pickle.dump(model, f)
```

### 2. Implement Model Retraining

Set up a scheduled job to retrain the model:

```bash
# Create EventBridge rule for weekly retraining
aws events put-rule \
  --name sagemaker-weekly-retrain \
  --schedule-expression "cron(0 2 ? * SUN *)" \
  --region il-central-1

# Trigger SageMaker training job
aws events put-targets \
  --rule sagemaker-weekly-retrain \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT:function:trigger-training"
```

### 3. Implement A/B Testing

Deploy multiple model versions and compare:

```typescript
// Route 10% of traffic to new model
const useNewModel = Math.random() < 0.1;
const endpointName = useNewModel 
  ? process.env.SAGEMAKER_ENDPOINT_V2 
  : process.env.SAGEMAKER_ENDPOINT_V1;
```

### 4. Set Up Monitoring Dashboard

Create a CloudWatch dashboard:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name sagemaker-ml-monitoring \
  --dashboard-body file://dashboard.json
```

## Next Steps

1. ✅ Deploy SageMaker endpoint
2. ✅ Test endpoint functionality
3. ⏭️ Implement ML Inference Lambda (Task 4.2)
4. ⏭️ Integrate predictions into contact ingestion (Task 4.4)
5. ⏭️ Set up model retraining pipeline
6. ⏭️ Implement monitoring and alerting

## References

- [SageMaker Serverless Inference](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html)
- [SageMaker Python SDK](https://sagemaker.readthedocs.io/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sagemaker-runtime/)
- [Terraform AWS Provider - SageMaker](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/sagemaker_endpoint)
