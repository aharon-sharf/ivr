# Database Property Test Setup

## Test: Property 2 - Database Synchronization Consistency

**Feature**: mass-voice-campaign-system, Property 2: Database synchronization consistency  
**Validates**: Requirements 1.2

### Property Statement

For any external database connection, after synchronization completes, the local contact records should match the remote records exactly.

### Test Implementation

The property test in `schema-integrity.test.ts` verifies this by:

1. Generating random contact records using `fast-check`
2. Simulating external database synchronization by inserting contacts
3. Querying the database to retrieve the synchronized contacts
4. Verifying that retrieved records match inserted records exactly

### Test Configuration

- **Iterations**: 100 (as specified in design document)
- **Framework**: Vitest + fast-check
- **Database**: PostgreSQL with test schema

### Running the Test

**Prerequisites**:
1. PostgreSQL running on localhost:5432
2. Test database created: `campaign_test`
3. Schema applied: `database/migrations/001_initial_schema.sql`
4. Node.js dependencies installed: `npm install`

**Execute**:
```bash
npm test tests/database/schema-integrity.test.ts
```

### Expected Behavior

✅ **PASS**: All 100 iterations should pass, confirming that:
- Contact records are inserted correctly
- Retrieved records match inserted records exactly
- Foreign key constraints are enforced
- Unique constraints prevent duplicates

❌ **FAIL**: If any iteration fails, it indicates:
- Data loss during synchronization
- Schema integrity issues
- Constraint violations not being enforced

### Manual Verification (Without Running Tests)

To manually verify the schema integrity:

```sql
-- 1. Create test campaign
INSERT INTO campaigns (name, type, status, config)
VALUES ('Test', 'voice', 'draft', '{}')
RETURNING id;

-- 2. Insert contact
INSERT INTO contacts (campaign_id, phone_number, metadata)
VALUES ('<campaign_id>', '+1234567890', '{"name": "Test"}')
RETURNING *;

-- 3. Query contact
SELECT * FROM contacts WHERE campaign_id = '<campaign_id>';

-- 4. Verify data matches
-- The retrieved record should exactly match the inserted record

-- 5. Test foreign key constraint
INSERT INTO contacts (campaign_id, phone_number)
VALUES ('00000000-0000-0000-0000-000000000000', '+1234567890');
-- Should fail with foreign key violation

-- 6. Test unique constraint
INSERT INTO contacts (campaign_id, phone_number)
VALUES ('<campaign_id>', '+1234567890');
-- Should fail with unique constraint violation
```

### Notes

- Tests run in transactions that are rolled back, leaving no test data
- Each test iteration uses unique identifiers to avoid conflicts
- The test validates both the happy path and constraint enforcement
