# ML Module - SageMaker Serverless Inference

This module provisions AWS SageMaker Serverless Inference infrastructure for the Mass Voice Campaign System's ML-based optimal call time predictions.

## Overview

The ML module creates:
- **SageMaker Model**: References a trained model artifact stored in S3
- **Serverless Endpoint Configuration**: Configured with 1024 MB memory and 200 max concurrency
- **Serverless Endpoint**: Auto-scaling inference endpoint that scales to zero when idle
- **IAM Roles**: Execution role for SageMaker and invoke role for Lambda functions

## Architecture

```
┌─────────────────┐
│  Lambda Function│
│  (API Handler)  │
└────────┬────────┘
         │ InvokeEndpoint
         ▼
┌─────────────────────────────┐
│ SageMaker Serverless        │
│ Inference Endpoint          │
│ - Memory: 1024 MB           │
│ - Max Concurrency: 200      │
│ - Auto-scales to zero       │
└────────┬────────────────────┘
         │ Loads model from
         ▼
┌─────────────────────────────┐
│ S3 Bucket                   │
│ /models/optimal-call-time/  │
│   - model.tar.gz            │
│   - code/inference.py       │
└─────────────────────────────┘
```

## Prerequisites

Before deploying this module, you must prepare and upload your ML model artifact to S3.

### Model Artifact Structure

The model artifact must be a `.tar.gz` file with the following structure:

```
model.tar.gz
├── model.pkl              # Trained scikit-learn model (or other framework)
├── inference.py           # Inference script (optional, for custom logic)
└── requirements.txt       # Python dependencies (optional)
```

### Creating the Model Artifact

#### Option 1: Simple scikit-learn Model

```python
import pickle
import tarfile
from sklearn.ensemble import RandomForestClassifier

# Train your model
model = RandomForestClassifier()
# ... training code ...

# Save model
with open('model.pkl', 'wb') as f:
    pickle.dump(model, f)

# Create tar.gz
with tarfile.open('model.tar.gz', 'w:gz') as tar:
    tar.add('model.pkl')
```

#### Option 2: Custom Inference Script

Create `inference.py`:

```python
import json
import pickle
import os

def model_fn(model_dir):
    """Load the model from the model_dir"""
    model_path = os.path.join(model_dir, 'model.pkl')
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    return model

def input_fn(request_body, content_type='application/json'):
    """Parse input data"""
    if content_type == 'application/json':
        input_data = json.loads(request_body)
        return input_data
    else:
        raise ValueError(f"Unsupported content type: {content_type}")

def predict_fn(input_data, model):
    """Make predictions"""
    predictions = model.predict(input_data['features'])
    return predictions

def output_fn(prediction, accept='application/json'):
    """Format output"""
    if accept == 'application/json':
        return json.dumps({
            'predictions': prediction.tolist()
        }), accept
    else:
        raise ValueError(f"Unsupported accept type: {accept}")
```

Create the artifact:

```bash
tar -czf model.tar.gz model.pkl inference.py requirements.txt
```

### Uploading to S3

```bash
# Upload model artifact
aws s3 cp model.tar.gz s3://YOUR-ML-MODELS-BUCKET/models/optimal-call-time/model.tar.gz

# If using custom inference code, upload the code directory
aws s3 cp inference.py s3://YOUR-ML-MODELS-BUCKET/models/optimal-call-time/code/inference.py
```

## Configuration

### Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `project_name` | Project name for resource naming | Required |
| `environment` | Environment name (dev/staging/prod) | Required |
| `ml_models_bucket` | S3 bucket name for ML models | Required |
| `sagemaker_container_image` | SageMaker container image URI | scikit-learn 1.2-1 |
| `tags` | Common tags for all resources | `{}` |

### Container Images

The default container image is for scikit-learn. Update `sagemaker_container_image` based on your framework:

**Scikit-learn**:
```
683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3
```

**XGBoost**:
```
683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-xgboost:1.7-1
```

**PyTorch**:
```
763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:2.0.0-cpu-py310
```

**TensorFlow**:
```
763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-inference:2.12.0-cpu
```

**Note**: Update the registry ID and region based on your AWS region. For IL region (il-central-1), check AWS documentation for available container images.

## Outputs

| Output | Description |
|--------|-------------|
| `endpoint_name` | SageMaker endpoint name |
| `endpoint_arn` | SageMaker endpoint ARN |
| `model_name` | SageMaker model name |
| `sagemaker_execution_role_arn` | IAM role ARN for SageMaker |
| `lambda_sagemaker_invoke_role_arn` | IAM role ARN for Lambda to invoke endpoint |
| `lambda_sagemaker_invoke_role_name` | IAM role name for Lambda |

## Usage in Lambda Functions

### Invoking the Endpoint

```typescript
import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";

const client = new SageMakerRuntimeClient({ region: "il-central-1" });

async function predictOptimalCallTime(contactData: any) {
  const payload = {
    features: [
      contactData.dayOfWeek,
      contactData.hourOfDay,
      contactData.previousAnswerRate,
      // ... other features
    ]
  };

  const command = new InvokeEndpointCommand({
    EndpointName: process.env.SAGEMAKER_ENDPOINT_NAME,
    ContentType: "application/json",
    Body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Body));
  
  return result.predictions;
}
```

### Lambda IAM Role

Attach the `lambda_sagemaker_invoke_role` to your Lambda function, or add the invoke policy to your existing Lambda role:

```terraform
resource "aws_iam_role_policy_attachment" "lambda_sagemaker_invoke" {
  role       = aws_iam_role.your_lambda_role.name
  policy_arn = module.ml.lambda_sagemaker_invoke_role_arn
}
```

## Cost Optimization

**Serverless Inference Pricing**:
- **Compute**: $0.20 per 1M inferences (approximate)
- **Memory**: Charged per GB-second
- **No idle costs**: Scales to zero when not in use

**Cost Comparison**:
- **Serverless**: ~$20/month for 100K predictions
- **Real-time endpoint**: ~$150/month (always running)
- **Lambda + model loading**: ~$50/month (slower cold starts)

**Best Practices**:
1. Use serverless for bursty, unpredictable workloads
2. Configure appropriate memory size (1024 MB is a good starting point)
3. Set max concurrency based on expected peak load
4. Monitor cold start times (typically 10-15 seconds)

## Monitoring

### CloudWatch Metrics

The endpoint automatically publishes metrics to CloudWatch:
- `ModelLatency`: Time taken for inference
- `OverheadLatency`: Time for request/response processing
- `Invocations`: Number of endpoint invocations
- `ModelSetupTime`: Cold start time

### Alarms

Consider setting up alarms for:
- High latency (> 1 second)
- High error rate (> 5%)
- Throttling events

## Troubleshooting

### Common Issues

**1. Model artifact not found**
```
Error: Could not find model data at s3://bucket/path/model.tar.gz
```
Solution: Ensure the model artifact is uploaded to the correct S3 path.

**2. Container image not available in region**
```
Error: Container image not found in registry
```
Solution: Update `sagemaker_container_image` to use the correct registry for your region.

**3. Cold start timeout**
```
Error: Endpoint invocation timed out
```
Solution: Increase Lambda timeout or implement retry logic. Cold starts can take 10-15 seconds.

**4. Insufficient memory**
```
Error: Container ran out of memory
```
Solution: Increase `memory_size_in_mb` in the endpoint configuration.

## Development Workflow

1. **Train Model Locally**: Develop and train your model using historical call data
2. **Create Artifact**: Package model as `model.tar.gz`
3. **Upload to S3**: Upload artifact to the ML models bucket
4. **Deploy Infrastructure**: Run `terraform apply` to create/update endpoint
5. **Test Endpoint**: Invoke endpoint from Lambda or AWS CLI
6. **Monitor Performance**: Check CloudWatch metrics and logs
7. **Iterate**: Retrain model periodically and update artifact

## References

- [SageMaker Serverless Inference Documentation](https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html)
- [SageMaker Pre-built Containers](https://docs.aws.amazon.com/sagemaker/latest/dg/pre-built-containers-frameworks-deep-learning.html)
- [SageMaker Python SDK](https://sagemaker.readthedocs.io/)
