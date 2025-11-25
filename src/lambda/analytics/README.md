# Analytics Lambda

## Overview

The Analytics Lambda provides real-time campaign metrics for the dashboard. It queries Redis for live metrics and PostgreSQL for campaign progress, calculates derived metrics, and returns data to the API Gateway.

## Responsibilities

- Query Redis for live metrics (active calls, queue depth, dialing rate)
- Query PostgreSQL for campaign progress
- Calculate answer rate, conversion rate, opt-out rate
- Return metrics to API Gateway

## API Endpoints

### Get Campaign Metrics

**GET** `/analytics/campaigns/{campaignId}`

Returns real-time metrics for a specific campaign.

**Response:**
```json
{
  "campaignId": "campaign-123",
  "campaignName": "Holiday Campaign",
  "activeCalls": 150,
  "queueDepth": 500,
  "dialingRate": 25.5,
  "totalAttempts": 10000,
  "answered": 3500,
  "busy": 2000,
  "failed": 1500,
  "converted": 500,
  "optOuts": 100,
  "answerRate": 35.0,
  "conversionRate": 14.3,
  "optOutRate": 1.0
}
```

### Get System Metrics

**GET** `/analytics/system`

Returns system-wide metrics for all active campaigns.

**Response:**
```json
{
  "totalActiveCalls": 450,
  "totalQueueDepth": 1500,
  "systemDialingRate": 75.5,
  "activeCampaigns": 3,
  "campaigns": [
    {
      "campaignId": "campaign-123",
      "campaignName": "Holiday Campaign",
      "activeCalls": 150,
      ...
    }
  ]
}
```

## Environment Variables

- `REDIS_URL`: Redis connection URL (default: redis://localhost:6379)
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: campaign_db)
- `DB_USER`: Database user (default: postgres)
- `DB_PASSWORD`: Database password

## Redis Keys

The Lambda expects the following Redis keys to be maintained by other services:

- `campaign:{campaignId}:active_calls` - Current number of active calls
- `campaign:{campaignId}:queue_depth` - Number of contacts in queue
- `campaign:{campaignId}:dialing_rate` - Calls per second in last minute

## Database Schema

The Lambda queries the following tables:

- `campaigns` - Campaign metadata
- `call_records` - Call outcomes and details

## Metrics Calculations

- **Answer Rate**: (answered / totalAttempts) * 100
- **Conversion Rate**: (converted / answered) * 100
- **Opt-Out Rate**: (optOuts / totalAttempts) * 100

## Performance

- Uses connection pooling for PostgreSQL
- Reuses Redis client across invocations
- Designed for <2 second response time (Requirement 10.3)

## Requirements Validation

- ✅ 10.1: Query Redis for live metrics
- ✅ 10.2: Query PostgreSQL for campaign progress
- ✅ 10.3: Calculate answer rate, conversion rate, opt-out rate
- ✅ 10.4: Return metrics to API Gateway
