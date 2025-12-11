# Campaign Scheduling Fix

## Problem
Campaigns were stuck in 'DRAFT' status and never being triggered because the system was missing critical scheduling functionality.

## Root Cause Analysis
1. **Missing API Endpoints**: No endpoints to start or schedule campaigns (`/campaigns/{id}/start`, `/campaigns/{id}/schedule`)
2. **Missing Campaign Orchestrator Lambda**: The Terraform configuration was missing the campaign orchestrator Lambda function
3. **Disabled EventBridge Rules**: EventBridge rules were set to `DISABLED` by default
4. **No Frontend Integration**: Frontend had no buttons to start or schedule campaigns

## Solution Implemented

### 1. Added Missing API Endpoints
- `POST /campaigns/{id}/start` - Start campaign immediately
- `POST /campaigns/{id}/schedule` - Schedule campaign for future execution  
- `POST /campaigns/{id}/pause` - Pause active campaign
- `POST /campaigns/{id}/resume` - Resume paused campaign

### 2. Created Campaign Orchestration Service
- **File**: `src/lambda/api-handler/services/CampaignOrchestrationService.ts`
- **Responsibilities**:
  - Update campaign status in database
  - Create EventBridge rules for scheduled campaigns
  - Invoke campaign orchestrator Lambda for immediate execution
  - Handle campaign lifecycle (start, pause, resume)

### 3. Added Campaign Orchestrator Lambda
- **Terraform**: Added `aws_lambda_function.campaign_orchestrator` in `terraform/modules/compute/main.tf`
- **Environment Variables**: Added `CAMPAIGN_ORCHESTRATOR_LAMBDA_ARN` to API handler
- **IAM Permissions**: Added EventBridge and Lambda invoke permissions

### 4. Updated Frontend
- **API Client**: Added `startCampaign()` and `scheduleCampaign()` methods
- **Campaign List Page**: Added "Start Now" and "Schedule" buttons for draft campaigns
- **Campaign Detail Page**: Added action buttons based on campaign status

### 5. Enhanced IAM Permissions
Added permissions for:
- `lambda:InvokeFunction` - To invoke campaign orchestrator
- `events:PutRule`, `events:PutTargets` - To create EventBridge rules
- `events:EnableRule`, `events:DisableRule` - To manage rule states

## Campaign Status Flow
```
DRAFT → (start immediately) → ACTIVE
DRAFT → (schedule) → SCHEDULED → (EventBridge trigger) → ACTIVE
ACTIVE → (pause) → PAUSED
PAUSED → (resume) → ACTIVE
ACTIVE → (complete/stop) → COMPLETED/CANCELLED
```

## Files Modified

### Backend
- `src/lambda/api-handler/index.ts` - Added new API endpoints
- `src/lambda/api-handler/services/CampaignOrchestrationService.ts` - New service (created)
- `terraform/modules/compute/main.tf` - Added campaign orchestrator Lambda and IAM permissions
- `terraform/modules/compute/outputs.tf` - Added campaign orchestrator ARN output
- `terraform/modules/compute/api-gateway.tf` - Added environment variable
- `terraform/modules/orchestration/variables.tf` - Added campaign orchestrator ARN variable
- `terraform/main.tf` - Pass campaign orchestrator ARN to orchestration module

### Frontend
- `frontend/src/api/campaigns.ts` - Added start/schedule API methods
- `frontend/src/pages/CampaignListPage.tsx` - Added action buttons and handlers
- `frontend/src/pages/CampaignDetailPage.tsx` - Added action buttons and handlers

## Testing
After deployment, campaigns should now:
1. Show "Start Now" and "Schedule" buttons when in DRAFT status
2. Transition to ACTIVE status when started immediately
3. Transition to SCHEDULED status when scheduled for future
4. Automatically start at scheduled time via EventBridge

## Next Steps
1. Deploy the updated Terraform configuration
2. Build and deploy the updated Lambda functions
3. Deploy the updated frontend
4. Test campaign scheduling functionality
5. Monitor EventBridge rules and Lambda executions