# SageMaker Serverless Inference - Quick Start

## 🚀 5-Minute Setup

### 1. Create Test Model
```bash
cd terraform/modules/ml/sample-model
pip install scikit-learn numpy
python create_placeholder_model.py
```

### 2. Upload to S3
```bash
# Get bucket name
cd ../../../
BUCKET=$(terraform output -raw ml_models_bucket 2>/dev/null || echo "YOUR-BUCKET-NAME")

# Upload model
cd terraform/modules/ml/sample-model
aws s3 cp model.tar.gz s3://$BUCKET/models/optimal-call-time/model.tar.gz
```

### 3. Deploy Infrastructure
```bash
cd ../../../
terraform apply -auto-approve
```

### 4. Wait for Endpoint (5-10 minutes)
```bash
ENDPOINT=$(terraform output -raw sagemaker_endpoint_name)
aws sagemaker describe-endpoint --endpoint-name $ENDPOINT --query 'EndpointStatus'
```

### 5. Test Endpoint
```bash
cd terraform/modules/ml/sample-model
python test_endpoint.py --endpoint-name $ENDPOINT
```

## 📝 Lambda Integration Example

```typescript
import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";

const client = new SageMakerRuntimeClient({ region: "il-central-1" });

async function predict(dayOfWeek: number, hour: number, answerRate: number) {
  const command = new InvokeEndpointCommand({
    EndpointName: process.env.SAGEMAKER_ENDPOINT_NAME,
    ContentType: "application/json",
    Body: JSON.stringify({
      features: [dayOfWeek, hour, answerRate]
    }),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Body));
  return result.optimal_hours[0];
}
```

## 🔍 Quick Test with AWS CLI

```bash
aws sagemaker-runtime invoke-endpoint \
  --endpoint-name YOUR-ENDPOINT-NAME \
  --body '{"features": [1, 10, 0.5]}' \
  --content-type application/json \
  output.json && cat output.json
```

## 📊 Monitor Performance

```bash
# Check endpoint status
aws sagemaker describe-endpoint --endpoint-name YOUR-ENDPOINT-NAME

# View CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/SageMaker \
  --metric-name ModelLatency \
  --dimensions Name=EndpointName,Value=YOUR-ENDPOINT-NAME \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## 🛠️ Troubleshooting

**Endpoint not ready?**
```bash
aws sagemaker describe-endpoint --endpoint-name YOUR-ENDPOINT-NAME --query 'EndpointStatus'
```

**Model not found?**
```bash
aws s3 ls s3://YOUR-BUCKET/models/optimal-call-time/
```

**Test failed?**
```bash
aws sagemaker-runtime invoke-endpoint \
  --endpoint-name YOUR-ENDPOINT-NAME \
  --body '{"features": [1, 10, 0.5]}' \
  --content-type application/json \
  --debug \
  output.json
```

## 📚 Full Documentation

- **Setup Guide**: `SETUP_GUIDE.md`
- **Module README**: `README.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`
