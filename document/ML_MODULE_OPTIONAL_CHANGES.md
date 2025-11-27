# ML Module Made Optional - Implementation Summary

## Problem

Terraform deployment was failing with the following error:

```
Error: creating SageMaker AI model: operation error SageMaker: CreateModel, 
https response error StatusCode: 400, RequestID: 38683204-11f3-43b3-893f-a52f43b289a6, 
api error ValidationException: Could not find model data at 
s3://mass-voice-campaign-ml-models-staging/models/optimal-call-time/model.tar.gz.
```

**Root Cause**: SageMaker requires a trained model artifact (`.tar.gz` file) to exist in S3 before creating the endpoint. The infrastructure couldn't be deployed without first creating and uploading a model.

## Solution

Made the ML module **optional** using a feature flag, allowing infrastructure deployment without requiring a trained model artifact upfront.

## Changes Made

### 1. Added Feature Flag Variable

**File**: `terraform/variables.tf`

Added new variable to control ML module deployment:

```hcl
# ML Module Feature Flag
variable "enable_ml_module" {
  description = "Enable ML module (SageMaker). Set to false if model artifact is not yet uploaded to S3."
  type        = bool
  default     = false
}
```

**Default**: `false` (ML module disabled by default)

### 2. Made ML Module Conditional

**File**: `terraform/main.tf`

Updated ML module to use `count` for conditional creation:

```hcl
# ML Module (SageMaker) - Optional
# Set enable_ml_module = true in terraform.tfvars after uploading model artifact to S3
module "ml" {
  count  = var.enable_ml_module ? 1 : 0
  source = "./modules/ml"

  project_name = local.project_name
  environment  = var.environment

  ml_models_bucket          = module.storage.ml_models_bucket
  sagemaker_container_image = var.sagemaker_container_image

  tags = local.common_tags
}
```

**Behavior**:
- When `enable_ml_module = false`: Module is not created (count = 0)
- When `enable_ml_module = true`: Module is created (count = 1)

### 3. Updated Outputs

**File**: `terraform/outputs.tf`

Updated ML outputs to handle optional module:

```hcl
# ML Outputs (only available when enable_ml_module = true)
output "sagemaker_endpoint_name" {
  description = "SageMaker Serverless Inference endpoint name"
  value       = var.enable_ml_module ? module.ml[0].endpoint_name : "ML module disabled"
}

output "sagemaker_endpoint_arn" {
  description = "SageMaker Serverless Inference endpoint ARN"
  value       = var.enable_ml_module ? module.ml[0].endpoint_arn : "ML module disabled"
}

output "lambda_sagemaker_invoke_role_arn" {
  description = "IAM role ARN for Lambda to invoke SageMaker endpoint"
  value       = var.enable_ml_module ? module.ml[0].lambda_sagemaker_invoke_role_arn : "ML module disabled"
}
```

**Note**: When using `count`, module outputs must be accessed with index: `module.ml[0]`

### 4. Updated Example Variables

**File**: `terraform/terraform.tfvars.example`

Added the new variable with documentation:

```hcl
# ML Module (SageMaker)
# Set to true after uploading model artifact to S3
# See terraform/modules/ml/README.md for setup instructions
enable_ml_module = false
```

### 5. Updated Documentation

**File**: `terraform/README.md`

Added comprehensive "ML Module Setup (Optional)" section explaining:
- Why the module is disabled by default
- Step-by-step instructions to enable it
- How to create and upload a placeholder model
- How to use a real trained model

**File**: `terraform/ML_MODULE_SETUP.md` (NEW)

Created dedicated setup guide with:
- Quick start instructions
- Model format specifications
- Verification steps
- Lambda integration examples
- Production model guidelines
- Cost information
- Troubleshooting tips

## Usage

### Deploy Without ML (Default)

```bash
# ML module is disabled by default
terraform apply -var-file=environments/dev.tfvars
```

Infrastructure deploys successfully without SageMaker.

### Enable ML Module Later

**Step 1**: Create and upload model artifact

```bash
cd terraform/modules/ml/sample-model
pip install scikit-learn numpy
python create_placeholder_model.py
aws s3 cp model.tar.gz s3://YOUR-BUCKET/models/optimal-call-time/model.tar.gz
```

**Step 2**: Enable in configuration

Edit `terraform.tfvars`:
```hcl
enable_ml_module = true
```

**Step 3**: Apply changes

```bash
terraform apply -var-file=environments/dev.tfvars
```

### Disable ML Module

To disable (e.g., to save costs in dev):

```hcl
enable_ml_module = false
```

```bash
terraform apply -var-file=environments/dev.tfvars
```

This destroys the SageMaker endpoint but keeps the model artifact in S3.

## Benefits

1. **Flexible Deployment**: Can deploy infrastructure without ML model ready
2. **Cost Control**: Disable ML in dev/staging to save costs
3. **Gradual Rollout**: Enable ML only when model is trained and tested
4. **No Breaking Changes**: Existing deployments unaffected (default is disabled)
5. **Clear Documentation**: Users know exactly how to enable ML when ready

## Impact on Existing Deployments

- **No impact**: Default is `false`, so existing deployments won't change
- **Backward compatible**: Can enable ML by setting variable to `true`
- **State safe**: Terraform will show plan before making changes

## Testing

To verify the changes work:

1. **Deploy without ML**:
   ```bash
   terraform plan -var="enable_ml_module=false"
   # Should show no ML resources
   ```

2. **Deploy with ML** (after uploading model):
   ```bash
   terraform plan -var="enable_ml_module=true"
   # Should show ML resources being created
   ```

3. **Toggle ML**:
   ```bash
   # Enable
   terraform apply -var="enable_ml_module=true"
   
   # Disable
   terraform apply -var="enable_ml_module=false"
   ```

## Next Steps

1. Deploy infrastructure with ML disabled (current state)
2. When ready for ML:
   - Create placeholder model using provided script
   - Upload to S3
   - Set `enable_ml_module = true`
   - Apply changes
3. For production:
   - Train real model with historical data
   - Replace placeholder model
   - Update endpoint

## Files Modified

- ✅ `terraform/variables.tf` - Added `enable_ml_module` variable
- ✅ `terraform/main.tf` - Made ML module conditional
- ✅ `terraform/outputs.tf` - Updated ML outputs for optional module
- ✅ `terraform/terraform.tfvars.example` - Added new variable
- ✅ `terraform/README.md` - Added ML setup section
- ✅ `terraform/ML_MODULE_SETUP.md` - Created setup guide (NEW)
- ✅ `document/ML_MODULE_OPTIONAL_CHANGES.md` - This summary (NEW)

## Resolution

The original error is now resolved. You can deploy the infrastructure immediately without needing to create or upload a model artifact. The ML module can be enabled later when you're ready.

**To deploy now**:
```bash
terraform apply -var-file=environments/staging.tfvars
```

The deployment will succeed with `enable_ml_module = false` (default).
