# API Handler Lambda

This Lambda function handles all API Gateway requests for campaign CRUD operations.

## Features

- **Campaign CRUD**: Create, Read, Update, Delete campaigns
- **JWT Authentication**: Validates Cognito JWT tokens
- **RBAC**: Role-based access control (CampaignManager, Administrator, Analyst)
- **Request Validation**: Validates request bodies against schemas
- **PostgreSQL Integration**: Stores campaign data in RDS

## Environment Variables

Required environment variables:

```bash
# Database Configuration
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=campaigns
DB_USER=admin
DB_PASSWORD=your-password

# Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-client-id
```

## API Endpoints

### Create Campaign
```
POST /campaigns
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Summer Fundraiser 2024",
  "type": "voice",
  "config": {
    "audioFileUrl": "s3://bucket/audio.mp3",
    "callingWindows": [
      {
        "dayOfWeek": [1, 2, 3, 4, 5],
        "startHour": 9,
        "endHour": 17
      }
    ]
  },
  "startTime": "2024-06-01T09:00:00Z",
  "endTime": "2024-06-30T17:00:00Z",
  "timezone": "America/New_York"
}
```

**RBAC**: Requires `CampaignManager` or `Administrator` role

### Get Campaign
```
GET /campaigns/{id}
Authorization: Bearer <jwt-token>
```

### List Campaigns
```
GET /campaigns?status=active&type=voice&limit=50&offset=0
Authorization: Bearer <jwt-token>
```

### Update Campaign
```
PUT /campaigns/{id}
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Updated Campaign Name",
  "config": {
    "maxConcurrentCalls": 100
  }
}
```

**RBAC**: Requires `CampaignManager` or `Administrator` role

### Delete Campaign
```
DELETE /campaigns/{id}
Authorization: Bearer <jwt-token>
```

**RBAC**: Requires `Administrator` role

## Deployment

### Build Docker Image
```bash
docker build -t api-handler-lambda -f src/lambda/api-handler/Dockerfile .
```

### Push to ECR
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag api-handler-lambda:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/api-handler-lambda:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/api-handler-lambda:latest
```

### Update Lambda Function
```bash
aws lambda update-function-code \
  --function-name api-handler-lambda \
  --image-uri <account-id>.dkr.ecr.us-east-1.amazonaws.com/api-handler-lambda:latest
```

## Testing

Run unit tests:
```bash
npm test
```

## Architecture

```
API Gateway
    ↓
Lambda Handler (index.ts)
    ↓
Authentication Middleware (auth.ts)
    ↓
Validation Middleware (validation.ts)
    ↓
Campaign Service (CampaignService.ts)
    ↓
PostgreSQL (RDS)
```

## Error Handling

All errors are returned in a standardized format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

Common error codes:
- `UNAUTHORIZED`: Missing or invalid JWT token
- `FORBIDDEN`: User lacks required role
- `VALIDATION_ERROR`: Invalid request body
- `NOT_FOUND`: Resource not found
- `INTERNAL_SERVER_ERROR`: Unexpected error
