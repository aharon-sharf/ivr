# Campaign Status Checker Lambda

## Purpose

Queries campaign progress from PostgreSQL and calculates completion percentage. This Lambda is invoked by the Step Functions state machine during the monitoring loop to track campaign execution progress.

## Responsibilities

- Query campaign progress from PostgreSQL
- Calculate completion percentage
- Aggregate contact statistics (total, completed, pending, in-progress, failed, blacklisted)
- Aggregate call outcome metrics (answered, busy, no answer, failed, converted, opted out)
- Determine if campaign is complete
- Update campaign status to 'completed' when all contacts processed
- Return status to Step Functions for monitoring loop

## Input

```json
{
  "campaignId": "uuid",
  "campaignName": "Campaign Name"
}
```

## Output

```json
{
  "campaignId": "uuid",
  "campaignName": "Campaign Name",
  "status": "active",
  "totalContacts": 1000,
  "completedContacts": 750,
  "pendingContacts": 200,
  "inProgressContacts": 50,
  "failedContacts": 0,
  "blacklistedContacts": 0,
  "completionPercentage": 75,
  "needsMoreContacts": true,
  "metrics": {
    "answered": 600,
    "busy": 100,
    "noAnswer": 50,
    "failed": 0,
    "converted": 150,
    "optedOut": 10
  }
}
```

## Status Determination

### Campaign Status Values
- **active**: Campaign is currently running
- **completed**: All contacts processed or end time reached
- **paused**: Campaign manually paused by user
- **cancelled**: Campaign manually cancelled by user

### Completion Logic
A campaign is considered complete when:
1. No pending contacts remain (`pendingContacts === 0`)
2. No contacts are in progress (`inProgressContacts === 0`)
3. OR campaign end time has passed

When completion is detected, the Lambda automatically updates the campaign status to 'completed'.

### needsMoreContacts Flag
Returns `true` if:
- Campaign status is 'active'
- AND pending contacts remain

This flag tells Step Functions whether to re-invoke the Dispatcher Lambda to process more contacts.

## Contact Statistics

Tracks contacts by status:
- **pending**: Not yet dispatched to queue
- **in_progress**: Dispatched to queue, call in progress
- **completed**: Call completed (any outcome)
- **failed**: Call failed after max attempts
- **blacklisted**: Contact on blacklist

## Call Metrics

Aggregates call outcomes from `call_records` table:
- **answered**: Calls that were answered
- **busy**: Busy signal received
- **noAnswer**: No answer after ringing
- **failed**: Technical failure
- **converted**: User completed desired action (e.g., donation)
- **optedOut**: User pressed 9 to opt out

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password

## Error Handling

- Throws exceptions for database connection errors
- Step Functions will retry on transient failures (3 attempts with exponential backoff)

## Requirements Validated

- **Requirement 2.3**: Campaign end time handling and status updates
