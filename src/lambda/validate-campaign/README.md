# Validate Campaign Lambda

## Purpose

Validates campaign configuration before execution in the Step Functions workflow. This Lambda ensures that campaigns are properly configured with all required fields, valid time windows, accessible audio files, and valid IVR flows.

## Responsibilities

- Fetch campaign from PostgreSQL database
- Validate campaign configuration (time windows, IVR flow, audio files)
- Check for required fields and valid values
- Verify campaign has contacts to process
- Return validation errors to Step Functions

## Input

```json
{
  "campaignId": "uuid",
  "executionSource": "scheduled"
}
```

## Output

### Success
```json
{
  "valid": true,
  "campaign": { ... },
  "campaignId": "uuid",
  "campaignName": "Campaign Name"
}
```

### Failure
```json
{
  "valid": false,
  "errors": [
    "Campaign end time is in the past",
    "Audio file not found: https://..."
  ],
  "campaignId": "uuid",
  "campaignName": "Campaign Name"
}
```

## Validations Performed

### Basic Validations (from Campaign model)
- Campaign name is required
- Campaign type is valid (voice, sms, hybrid)
- Voice campaigns have audioFileUrl or ivrFlow
- SMS campaigns have smsTemplate
- Calling windows are properly configured
- Time ranges are valid

### Runtime Validations
- Campaign status is 'scheduled' or 'draft'
- Campaign end time is not in the past
- Audio files exist and are accessible
- IVR flow is valid (if present)
- Campaign has contacts to process

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password

## Error Handling

- Returns validation errors in structured format
- Throws exceptions for database connection errors
- Step Functions will retry on transient failures (3 attempts with exponential backoff)

## Requirements Validated

- **Requirement 2.1**: Campaign configuration validation
