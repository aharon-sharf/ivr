# Campaign Comparison Lambda

## Overview

The Campaign Comparison Lambda provides side-by-side comparison of multiple campaigns, allowing users to analyze performance differences and identify best practices.

## Responsibilities

- Query multiple campaigns from database
- Calculate side-by-side metrics
- Return comparison data to frontend
- Identify best performers across campaigns

## API Endpoint

**GET** `/analytics/compare?campaignIds=id1,id2,id3`

Returns comparison data for the specified campaigns.

**Query Parameters:**
- `campaignIds` (required): Comma-separated list of campaign IDs (2-10 campaigns)

**Example Request:**
```
GET /analytics/compare?campaignIds=campaign-123,campaign-456,campaign-789
```

**Response:**
```json
{
  "campaigns": [
    {
      "campaignId": "campaign-123",
      "campaignName": "Holiday Campaign",
      "campaignType": "voice",
      "status": "completed",
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2024-01-15T23:59:59Z",
      "totalContacts": 10000,
      "totalAttempts": 12000,
      "answered": 4200,
      "busy": 2000,
      "failed": 1500,
      "noAnswer": 4300,
      "converted": 600,
      "optOuts": 50,
      "answerRate": 35.0,
      "conversionRate": 14.3,
      "optOutRate": 0.42,
      "totalCost": 1200.00,
      "costPerContact": 0.12,
      "costPerConversion": 2.00,
      "averageCallDuration": 45.5
    },
    {
      "campaignId": "campaign-456",
      "campaignName": "Spring Promotion",
      "campaignType": "voice",
      "status": "completed",
      "startTime": "2024-03-01T00:00:00Z",
      "endTime": "2024-03-15T23:59:59Z",
      "totalContacts": 8000,
      "totalAttempts": 9500,
      "answered": 3800,
      "busy": 1500,
      "failed": 1200,
      "noAnswer": 3000,
      "converted": 800,
      "optOuts": 30,
      "answerRate": 40.0,
      "conversionRate": 21.1,
      "optOutRate": 0.32,
      "totalCost": 950.00,
      "costPerContact": 0.12,
      "costPerConversion": 1.19,
      "averageCallDuration": 52.3
    }
  ],
  "summary": {
    "totalCampaigns": 2,
    "bestAnswerRate": {
      "campaignId": "campaign-456",
      "campaignName": "Spring Promotion",
      "rate": 40.0
    },
    "bestConversionRate": {
      "campaignId": "campaign-456",
      "campaignName": "Spring Promotion",
      "rate": 21.1
    },
    "lowestCostPerConversion": {
      "campaignId": "campaign-456",
      "campaignName": "Spring Promotion",
      "cost": 1.19
    },
    "totalContactsAcrossAll": 18000,
    "totalAttemptsAcrossAll": 21500,
    "totalConversionsAcrossAll": 1400,
    "averageAnswerRate": 37.5,
    "averageConversionRate": 17.7
  }
}
```

## Comparison Metrics

For each campaign, the following metrics are provided:

### Basic Metrics
- Campaign ID, name, type, status
- Start and end times
- Total contacts
- Total call attempts

### Outcome Metrics
- Answered calls
- Busy signals
- Failed calls
- No answer
- Conversions
- Opt-outs

### Performance Rates
- **Answer Rate**: (answered / totalAttempts) × 100
- **Conversion Rate**: (converted / answered) × 100
- **Opt-Out Rate**: (optOuts / totalAttempts) × 100

### Cost Metrics
- Total cost
- Cost per contact
- Cost per conversion
- Average call duration

### Summary Statistics

The summary section identifies:
- Best answer rate across all campaigns
- Best conversion rate across all campaigns
- Lowest cost per conversion
- Aggregate totals (contacts, attempts, conversions)
- Average rates across all campaigns

## Validation

- Minimum 2 campaigns required for comparison
- Maximum 10 campaigns allowed per request
- All campaign IDs must exist in database
- Returns 400 error for invalid input
- Returns 404 error if campaign not found

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: campaign_db)
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password

## Database Queries

The Lambda queries the following tables:
- `campaigns`: Campaign metadata
- `contacts`: Contact counts
- `call_records`: Call outcomes and statistics

## Use Cases

### Performance Analysis
Compare campaigns to identify which strategies work best:
- Which time windows yield better answer rates?
- Which IVR flows have higher conversion rates?
- Which contact lists are most responsive?

### Cost Optimization
Identify cost-effective campaigns:
- Lowest cost per conversion
- Best ROI campaigns
- Most efficient resource utilization

### A/B Testing
Compare variations of campaigns:
- Different audio messages
- Different calling times
- Different IVR flows

### Trend Analysis
Track performance over time:
- Compare campaigns from different months
- Identify seasonal patterns
- Measure improvement over time

## Performance Considerations

- Uses connection pooling for database
- Parallel queries for multiple campaigns
- Efficient aggregation queries
- Caches campaign metadata

## Error Handling

- Campaign not found: Returns 404 with campaign ID
- Database errors: Returns 500 with error message
- Invalid parameters: Returns 400 with validation message
- Connection failures: Retries with exponential backoff

## Requirements Validation

- ✅ 11.5: Query multiple campaigns from database
- ✅ 11.5: Calculate side-by-side metrics
- ✅ 11.5: Return comparison data to frontend
- ✅ 11.5: Identify best performers

## Usage Example

```typescript
// Frontend code
const campaignIds = ['campaign-123', 'campaign-456', 'campaign-789'];
const response = await fetch(
  `/analytics/compare?campaignIds=${campaignIds.join(',')}`
);
const comparison = await response.json();

// Display comparison table
console.log('Best Answer Rate:', comparison.summary.bestAnswerRate);
console.log('Best Conversion Rate:', comparison.summary.bestConversionRate);
console.log('Lowest Cost:', comparison.summary.lowestCostPerConversion);
```

## Future Enhancements

- Export comparison as CSV/Excel
- Visual charts and graphs
- Statistical significance testing
- Trend analysis over time
- Predictive analytics
