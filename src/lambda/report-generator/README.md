# Report Generator Lambda

## Overview

The Report Generator Lambda creates comprehensive campaign reports by aggregating data from PostgreSQL and MongoDB, calculating metrics, and generating reports in multiple formats (CSV, Excel, PDF).

## Responsibilities

- Aggregate data from PostgreSQL and MongoDB
- Calculate aggregate metrics (total attempts, answer rate, conversion rate)
- Generate CSV/Excel/PDF reports
- Upload report to S3
- Send notification with download link

## Event Input

```json
{
  "campaignId": "campaign-123",
  "format": "excel",
  "notificationEmail": "user@example.com"
}
```

**Parameters:**
- `campaignId` (required): ID of the campaign to generate report for
- `format` (required): Report format - "csv", "excel", or "pdf"
- `notificationEmail` (optional): Email address for notification

## Output

```json
{
  "success": true,
  "campaignId": "campaign-123",
  "downloadUrl": "https://campaign-reports.s3.amazonaws.com/reports/campaign-123/2024-01-15T10-30-00.xlsx",
  "format": "xlsx"
}
```

## Report Contents

### Summary Section
- Campaign metadata (name, ID, type, dates)
- Total contacts
- Total attempts
- Call outcomes (answered, busy, failed, no answer)
- Conversions and opt-outs
- Calculated rates (answer rate, conversion rate, opt-out rate)
- Total cost
- Average call duration

### Call Records Section
- Contact ID
- Phone number
- Call status
- Call outcome
- Start/end times
- Duration
- DTMF inputs
- Cost per call

## Report Formats

### CSV Format
- Plain text format
- Summary metrics at top
- Call records in tabular format
- Easy to import into spreadsheet applications

### Excel Format
- Two sheets: "Summary" and "Call Records"
- Formatted cells with proper data types
- Professional appearance
- Native Excel format (.xlsx)

### PDF Format (Future)
- Professional PDF layout
- Charts and visualizations
- Print-ready format

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: campaign_db)
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `MONGO_URL`: MongoDB connection URL
- `MONGO_DB_NAME`: MongoDB database name
- `REPORTS_BUCKET`: S3 bucket for report storage
- `NOTIFICATION_TOPIC_ARN`: SNS topic for notifications
- `AWS_REGION`: AWS region (default: us-east-1)

## Data Sources

### PostgreSQL
- `campaigns` table: Campaign metadata
- `contacts` table: Contact counts
- `call_records` table: Aggregated statistics

### MongoDB
- `call_records` collection: Detailed call records with CDR data

## S3 Storage

Reports are stored in S3 with the following structure:
```
s3://campaign-reports/
  reports/
    {campaignId}/
      {timestamp}.csv
      {timestamp}.xlsx
```

## Notifications

After report generation, a notification is sent via SNS with:
- Campaign name
- Download link (valid for 7 days)
- Report format

## Metrics Calculations

- **Answer Rate**: (answered / totalAttempts) × 100
- **Conversion Rate**: (converted / answered) × 100
- **Opt-Out Rate**: (optOuts / totalAttempts) × 100

## Performance Considerations

- Uses connection pooling for databases
- Streams large datasets to avoid memory issues
- Generates reports asynchronously
- Supports pagination for very large campaigns

## Requirements Validation

- ✅ 11.1: Aggregate data from PostgreSQL and MongoDB
- ✅ 11.2: Calculate aggregate metrics
- ✅ 11.3: Generate CSV/Excel reports
- ✅ 11.3: Upload report to S3
- ✅ 11.3: Send notification with download link

## Usage Example

Invoke via Step Functions or directly:

```typescript
const event = {
  campaignId: 'campaign-123',
  format: 'excel',
  notificationEmail: 'manager@example.com'
};

const result = await lambda.invoke({
  FunctionName: 'ReportGeneratorLambda',
  Payload: JSON.stringify(event)
});
```

## Error Handling

- Campaign not found: Throws error with campaign ID
- Database connection failures: Retries with exponential backoff
- S3 upload failures: Logs error and retries
- Notification failures: Logs warning but doesn't fail report generation
