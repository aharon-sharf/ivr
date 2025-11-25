# AWS X-Ray Setup for Lambda Functions

This guide explains how to enable and configure AWS X-Ray tracing for Lambda functions in the Mass Voice Campaign System.

## Lambda Function Configuration

### Terraform Configuration

Enable X-Ray tracing in your Lambda function resource:

```hcl
resource "aws_lambda_function" "dialer_worker" {
  function_name = "${var.project_name}-${var.environment}-dialer-worker"
  # ... other configuration ...

  tracing_config {
    mode = "Active"  # Enable X-Ray tracing
  }

  environment {
    variables = {
      AWS_XRAY_TRACING_NAME = "${var.project_name}-${var.environment}-dialer-worker"
      AWS_XRAY_CONTEXT_MISSING = "LOG_ERROR"
    }
  }
}
```

### IAM Permissions

Ensure the Lambda execution role has X-Ray permissions:

```hcl
resource "aws_iam_role_policy_attachment" "lambda_xray" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}
```

## Application Code Integration

### Node.js/TypeScript Lambda Functions

#### 1. Install X-Ray SDK

```bash
npm install aws-xray-sdk-core
```

#### 2. Instrument AWS SDK

```typescript
// At the top of your Lambda handler file
import AWSXRay from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';

// Wrap AWS SDK
const XAWS = AWSXRay.captureAWS(AWS);

// Use XAWS instead of AWS
const dynamodb = new XAWS.DynamoDB.DocumentClient();
const sqs = new XAWS.SQS();
```

#### 3. Create Custom Subsegments

```typescript
import AWSXRay from 'aws-xray-sdk-core';

export const handler = async (event: any) => {
  // Create a subsegment for custom logic
  const segment = AWSXRay.getSegment();
  const subsegment = segment?.addNewSubsegment('ProcessDialTask');

  try {
    subsegment?.addAnnotation('campaignId', event.campaignId);
    subsegment?.addMetadata('contactData', event.contact);

    // Your business logic here
    const result = await processDialTask(event);

    subsegment?.close();
    return result;
  } catch (error) {
    subsegment?.addError(error as Error);
    subsegment?.close();
    throw error;
  }
};

async function processDialTask(event: any) {
  // Create nested subsegment
  const segment = AWSXRay.getSegment();
  const subsegment = segment?.addNewSubsegment('CheckBlacklist');

  try {
    subsegment?.addAnnotation('phoneNumber', event.phoneNumber);

    // Check blacklist
    const isBlacklisted = await checkBlacklist(event.phoneNumber);

    subsegment?.addMetadata('isBlacklisted', isBlacklisted);
    subsegment?.close();

    if (isBlacklisted) {
      return { status: 'blacklisted' };
    }

    // Continue processing...
    return { status: 'success' };
  } catch (error) {
    subsegment?.addError(error as Error);
    subsegment?.close();
    throw error;
  }
}
```

#### 4. Trace HTTP Requests

```typescript
import AWSXRay from 'aws-xray-sdk-core';
import axios from 'axios';

// Wrap axios for automatic tracing
const http = AWSXRay.captureHTTPsGlobal(require('http'));
const https = AWSXRay.captureHTTPsGlobal(require('https'));

// Now all axios requests will be traced
const response = await axios.get('https://api.example.com/data');
```

#### 5. Trace Database Queries

```typescript
import AWSXRay from 'aws-xray-sdk-core';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function queryDatabase(sql: string, params: any[]) {
  const segment = AWSXRay.getSegment();
  const subsegment = segment?.addNewSubsegment('PostgreSQL');

  try {
    subsegment?.addAnnotation('query', sql);
    subsegment?.addMetadata('params', params);

    const result = await pool.query(sql, params);

    subsegment?.addMetadata('rowCount', result.rowCount);
    subsegment?.close();

    return result;
  } catch (error) {
    subsegment?.addError(error as Error);
    subsegment?.close();
    throw error;
  }
}
```

### Python Lambda Functions

#### 1. Install X-Ray SDK

```bash
pip install aws-xray-sdk
```

#### 2. Instrument AWS SDK

```python
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

# Patch all supported libraries
patch_all()

import boto3

# Now all boto3 calls are automatically traced
dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')
```

#### 3. Create Custom Subsegments

```python
from aws_xray_sdk.core import xray_recorder

def lambda_handler(event, context):
    # Create a subsegment
    with xray_recorder.capture('ProcessMLInference') as subsegment:
        subsegment.put_annotation('model_version', event['model_version'])
        subsegment.put_metadata('input_data', event['data'])

        try:
            result = process_inference(event)
            subsegment.put_metadata('result', result)
            return result
        except Exception as e:
            subsegment.put_metadata('error', str(e))
            raise

def process_inference(event):
    with xray_recorder.capture('LoadModel') as subsegment:
        model = load_model(event['model_version'])
        subsegment.put_annotation('model_loaded', True)

    with xray_recorder.capture('RunInference') as subsegment:
        prediction = model.predict(event['data'])
        subsegment.put_metadata('prediction', prediction)
        return prediction
```

## Best Practices

### 1. Use Annotations for Filtering

Annotations are indexed and can be used for filtering in the X-Ray console:

```typescript
subsegment?.addAnnotation('campaignId', campaignId);
subsegment?.addAnnotation('environment', process.env.ENVIRONMENT);
subsegment?.addAnnotation('userId', userId);
```

### 2. Use Metadata for Context

Metadata is not indexed but provides rich context:

```typescript
subsegment?.addMetadata('requestBody', event.body);
subsegment?.addMetadata('responseData', result);
subsegment?.addMetadata('config', campaignConfig);
```

### 3. Always Close Subsegments

```typescript
try {
  const subsegment = segment?.addNewSubsegment('MyOperation');
  // ... operation ...
  subsegment?.close();
} catch (error) {
  subsegment?.addError(error as Error);
  subsegment?.close();
  throw error;
}
```

### 4. Trace Critical Paths

Focus on tracing:
- Database queries
- External API calls
- ML model inference
- Message queue operations
- Cache lookups

### 5. Add Error Context

```typescript
catch (error) {
  subsegment?.addError(error as Error);
  subsegment?.addMetadata('errorContext', {
    campaignId,
    contactId,
    attemptNumber
  });
  subsegment?.close();
  throw error;
}
```

## Example: Complete Lambda Handler with X-Ray

```typescript
import AWSXRay from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';

const XAWS = AWSXRay.captureAWS(AWS);
const sqs = new XAWS.SQS();
const dynamodb = new XAWS.DynamoDB.DocumentClient();

interface DialTaskEvent {
  campaignId: string;
  contactId: string;
  phoneNumber: string;
}

export const handler = async (event: DialTaskEvent) => {
  const segment = AWSXRay.getSegment();

  // Validate input
  const validateSubsegment = segment?.addNewSubsegment('ValidateInput');
  try {
    validateSubsegment?.addAnnotation('campaignId', event.campaignId);
    validateSubsegment?.addMetadata('event', event);

    if (!event.phoneNumber) {
      throw new Error('Phone number is required');
    }

    validateSubsegment?.close();
  } catch (error) {
    validateSubsegment?.addError(error as Error);
    validateSubsegment?.close();
    throw error;
  }

  // Check blacklist
  const blacklistSubsegment = segment?.addNewSubsegment('CheckBlacklist');
  try {
    blacklistSubsegment?.addAnnotation('phoneNumber', event.phoneNumber);

    const isBlacklisted = await checkBlacklist(event.phoneNumber);

    blacklistSubsegment?.addMetadata('isBlacklisted', isBlacklisted);
    blacklistSubsegment?.close();

    if (isBlacklisted) {
      return { status: 'blacklisted', phoneNumber: event.phoneNumber };
    }
  } catch (error) {
    blacklistSubsegment?.addError(error as Error);
    blacklistSubsegment?.close();
    throw error;
  }

  // Initiate call
  const dialSubsegment = segment?.addNewSubsegment('InitiateCall');
  try {
    dialSubsegment?.addAnnotation('campaignId', event.campaignId);
    dialSubsegment?.addAnnotation('contactId', event.contactId);

    const result = await initiateCall(event);

    dialSubsegment?.addMetadata('callResult', result);
    dialSubsegment?.close();

    return result;
  } catch (error) {
    dialSubsegment?.addError(error as Error);
    dialSubsegment?.close();
    throw error;
  }
};

async function checkBlacklist(phoneNumber: string): Promise<boolean> {
  const result = await dynamodb.get({
    TableName: process.env.BLACKLIST_TABLE!,
    Key: { phoneNumber }
  }).promise();

  return !!result.Item;
}

async function initiateCall(event: DialTaskEvent) {
  // Send message to Asterisk worker
  await sqs.sendMessage({
    QueueUrl: process.env.ASTERISK_QUEUE_URL!,
    MessageBody: JSON.stringify(event)
  }).promise();

  return { status: 'initiated', phoneNumber: event.phoneNumber };
}
```

## Viewing Traces

### AWS Console

1. Navigate to AWS X-Ray console
2. Select "Traces" from the left menu
3. Use filter expressions:
   - `annotation.campaignId = "campaign-123"`
   - `error = true`
   - `duration >= 5`
   - `service("voice-campaign-production-dialer-worker")`

### CLI

```bash
# Get trace summaries
aws xray get-trace-summaries \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --filter-expression 'annotation.campaignId = "campaign-123"'

# Get specific trace
aws xray batch-get-traces \
  --trace-ids <trace-id>
```

## Troubleshooting

### Traces not appearing

1. Check Lambda function has `tracing_config { mode = "Active" }`
2. Verify IAM role has `AWSXRayDaemonWriteAccess` policy
3. Ensure X-Ray SDK is properly initialized in code
4. Check CloudWatch Logs for X-Ray errors

### Subsegments not showing

1. Verify subsegments are properly closed
2. Check for exceptions that prevent closing
3. Ensure parent segment exists before creating subsegments

### High X-Ray costs

1. Reduce sampling rate in sampling rules
2. Use conditional tracing (only trace errors or slow requests)
3. Limit metadata size
4. Archive old traces

## Cost Optimization

- **Default sampling (5%)**: ~$5/month for 1M requests
- **Critical functions (20%)**: ~$20/month for 1M requests
- **Error traces (100%)**: Cost depends on error rate

Adjust sampling rates based on your budget and monitoring needs.
