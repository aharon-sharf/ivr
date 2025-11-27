# ML Module Setup Guide

The ML module (SageMaker Serverless Inference) is **disabled by default** in the Terraform configuration. This allows you to deploy the infrastructure without having a trained ML model ready.

## Quick Start

### 1. Deploy Infrastructure Without ML

```bash
# ML module is disabled by default
terraform apply -var-file=environments/dev.tfvars
```

The infrastructure will deploy successfully without the ML module.

### 2. Create and Upload Model Artifact

When you're ready to enable ML predictions:

```bash
# Navigate to sample model directory
cd terraform/modules/ml/sample-model

# Install Python dependencies
pip install scikit-learn numpy

# Generate placeholder model
python create_placeholder_model.py

# This creates model.tar.gz
```

### 3. Upload to S3

```bash
# Get your ML models bucket name
cd ../../..
terraform output ml_models_bucket

# Upload model artifact
aws s3 cp terraform/modules/ml/sample-model/model.tar.gz \
  s3://YOUR-ML-MODELS-BUCKET/models/optimal-call-time/model.tar.gz
```

### 4. Enable ML Module

Edit your `terraform.tfvars` or environment-specific `.tfvars` file:

```hcl
enable_ml_module = true
```

### 5. Apply Changes

```bash
terraform apply -var-file=environments/dev.tfvars
```

Terraform will create:
- SageMaker Model
- Serverless Endpoint Configuration
- Serverless Endpoint
- IAM roles for Lambda to invoke the endpoint

## Verification

After deployment, verify the endpoint is active:

```bash
# Get endpoint name
terraform output sagemaker_endpoint_name

# Test the endpoint
aws sagemaker-runtime invoke-endpoint \
  --endpoint-name YOUR-ENDPOINT-NAME \
  --body '{"features": [1, 10, 0.5]}' \
  --content-type application/json \
  output.json

# View results
cat output.json
```

Expected output:
```json
{
  "optimal_hours": [10],
  "confidence": [0.85]
}
```

## Model Format

The model artifact must be a `.tar.gz` file containing:

```
model.tar.gz
├── model.pkl              # Trained scikit-learn model
├── inference.py           # Custom inference script
└── requirements.txt       # Python dependencies
```

### Input Format

The endpoint accepts JSON with either format:

**Single prediction:**
```json
{
  "features": [day_of_week, hour_of_day, previous_answer_rate]
}
```

**Batch predictions:**
```json
{
  "contacts": [
    {"day_of_week": 1, "hour_of_day": 10, "previous_answer_rate": 0.5},
    {"day_of_week": 2, "hour_of_day": 15, "previous_answer_rate": 0.3}
  ]
}
```

### Output Format

```json
{
  "optimal_hours": [10, 19],
  "confidence": [0.85, 0.92]
}
```

## Using in Lambda Functions

Once the ML module is enabled, Lambda functions can invoke the endpoint:

```typescript
import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";

const client = new SageMakerRuntimeClient({ region: "il-central-1" });

async function predictOptimalCallTime(contact: any) {
  const payload = {
    features: [
      contact.dayOfWeek,
      contact.hourOfDay,
      contact.previousAnswerRate
    ]
  };

  const command = new InvokeEndpointCommand({
    EndpointName: process.env.SAGEMAKER_ENDPOINT_NAME,
    ContentType: "application/json",
    Body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Body));
  
  return {
    optimalHour: result.optimal_hours[0],
    confidence: result.confidence[0]
  };
}
```

## Production Model

The placeholder model is for testing only. For production:

1. **Collect Training Data**: Export historical call data with features:
   - Day of week (0-6)
   - Hour of day (0-23)
   - Previous answer rate (0-1)
   - Other relevant features

2. **Train Model**: Use scikit-learn, XGBoost, or other framework

3. **Package Model**: Create `model.tar.gz` with trained model

4. **Upload to S3**: Replace the placeholder model

5. **Update Endpoint**: Terraform will detect the change and update

See `terraform/modules/ml/README.md` for detailed training and deployment instructions.

## Cost

SageMaker Serverless Inference pricing:
- **Compute**: ~$0.20 per 1M inferences
- **Memory**: Charged per GB-second
- **Idle**: Scales to zero (no cost when not in use)

Estimated cost for 100K predictions/month: **~$20**

## Disabling the ML Module

To disable the ML module (e.g., to save costs in dev):

1. Edit `terraform.tfvars`:
   ```hcl
   enable_ml_module = false
   ```

2. Apply changes:
   ```bash
   terraform apply -var-file=environments/dev.tfvars
   ```

This will destroy the SageMaker endpoint but keep the model artifact in S3.

## Troubleshooting

### Error: Model artifact not found

```
Error: Could not find model data at s3://bucket/path/model.tar.gz
```

**Solution**: Upload the model artifact to S3 before enabling the module.

### Error: Container image not available

```
Error: Container image not found in registry
```

**Solution**: Update `sagemaker_container_image` in `variables.tf` for your region.

### Cold start timeout

First invocation may take 10-15 seconds (cold start). Subsequent calls are faster.

**Solution**: Implement retry logic in Lambda or increase timeout.

## References

- [SageMaker Serverless Inference Docs](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html)
- [Module README](./modules/ml/README.md)
- [Sample Model Script](./modules/ml/sample-model/create_placeholder_model.py)
