# Phone Number Validation Property Tests

## Test: Property 3 - Phone Number Validation Correctness

**Feature**: mass-voice-campaign-system, Property 3: Phone number validation correctness  
**Validates**: Requirements 1.3

### Property Statement

For any string input, the validation function should accept it if and only if it matches valid phone number formats according to E.164 or configured regional standards.

### E.164 Format Specification

The E.164 standard defines international phone number format:
- Must start with `+`
- Followed by country code (1-3 digits, cannot start with 0)
- Followed by subscriber number
- Total length: 2-15 digits (including country code)

Examples:
- ✅ `+1234567890` (valid)
- ✅ `+972501234567` (Israeli mobile)
- ✅ `+442071234567` (UK London)
- ❌ `1234567890` (missing +)
- ❌ `+0123456789` (country code starts with 0)
- ❌ `+1` (too short)
- ❌ `+1234567890123456` (too long, >15 digits)

### Test Implementation

The property tests verify:

1. **Valid E.164 acceptance**: Any properly formatted E.164 number is accepted
2. **Missing prefix rejection**: Numbers without `+` are rejected
3. **Invalid country code rejection**: Country codes starting with 0 are rejected
4. **Length validation**: Numbers too short (<2 digits) or too long (>15 digits) are rejected
5. **Character validation**: Numbers with non-digit characters are rejected
6. **Normalization correctness**: Normalization produces valid E.164 format
7. **Idempotence**: Normalizing twice equals normalizing once
8. **Preservation**: Valid E.164 numbers remain unchanged after normalization

### Test Configuration

- **Iterations**: 100 per property (as specified in design document)
- **Framework**: Vitest + fast-check
- **Generators**: Custom arbitraries for valid/invalid phone numbers

### Running the Tests

**Prerequisites**:
1. Node.js installed
2. Dependencies installed: `npm install`

**Execute**:
```bash
npm test tests/models/phone-validation.test.ts
```

**Watch mode**:
```bash
npm run test:watch tests/models/phone-validation.test.ts
```

### Expected Behavior

✅ **PASS**: All property tests should pass, confirming that:
- Valid E.164 numbers are accepted
- Invalid formats are rejected
- Normalization works correctly
- Validation is consistent

❌ **FAIL**: If any test fails, it indicates:
- Validation logic is incorrect
- E.164 format not properly implemented
- Normalization produces invalid results
- Edge cases not handled

### Manual Verification

You can manually test the validation functions:

```typescript
import { validatePhoneNumber, normalizePhoneNumber } from './src/models/Contact';

// Valid numbers
console.log(validatePhoneNumber('+1234567890')); // true
console.log(validatePhoneNumber('+972501234567')); // true

// Invalid numbers
console.log(validatePhoneNumber('1234567890')); // false (no +)
console.log(validatePhoneNumber('+0123456789')); // false (starts with 0)

// Normalization
console.log(normalizePhoneNumber('(123) 456-7890')); // '+1234567890'
console.log(normalizePhoneNumber('+1 234 567 8900')); // '+12345678900'
```

### Integration with Contact Validation

The phone number validation is integrated into the contact validation:

```typescript
import { validateContact, createContact } from './src/models/Contact';

const contact = createContact('campaign-id', '(123) 456-7890', {});
const errors = validateContact(contact);

if (errors.length > 0) {
  console.error('Validation errors:', errors);
}
```

### Notes

- The validation strictly follows E.164 format
- Normalization removes spaces, dashes, parentheses, and ensures `+` prefix
- The validation is used during contact ingestion to reject invalid phone numbers
- Property tests ensure validation works correctly across all possible inputs
