/**
 * Property-Based Tests for Phone Number Validation
 * 
 * Feature: mass-voice-campaign-system, Property 3: Phone number validation correctness
 * Validates: Requirements 1.3
 * 
 * Property: For any string input, the validation function should accept it if and only if
 * it matches valid phone number formats according to E.164 or configured regional standards.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validatePhoneNumber, normalizePhoneNumber } from '../../src/models/Contact';

describe('Phone Number Validation - Property Tests', () => {
  /**
   * Property 3: Phone number validation correctness
   * 
   * For any string input, the validation function should accept it if and only if
   * it matches valid E.164 format: +[country code][number]
   * - Must start with +
   * - Must have 1-15 digits after the +
   * - Country code must not start with 0
   */
  it('should accept valid E.164 phone numbers', async () => {
    await fc.assert(
      fc.property(
        // Generate valid E.164 phone numbers
        fc.integer({ min: 1, max: 9 }), // First digit (country code start, 1-9)
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 14 }), // Remaining digits (at least 1)
        (firstDigit, remainingDigits) => {
          const phoneNumber = '+' + firstDigit + remainingDigits.join('');
          
          // Valid E.164 numbers should be accepted
          expect(validatePhoneNumber(phoneNumber)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject phone numbers without + prefix', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 14 }),
        (firstDigit, remainingDigits) => {
          // Phone number without + prefix
          const phoneNumber = firstDigit + remainingDigits.join('');
          
          expect(validatePhoneNumber(phoneNumber)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject phone numbers with country code starting with 0', async () => {
    await fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 14 }),
        (digits) => {
          // Phone number starting with +0 (invalid country code)
          const phoneNumber = '+0' + digits.join('');
          
          expect(validatePhoneNumber(phoneNumber)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject phone numbers that are too short', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        (digit) => {
          // Phone number with only country code (too short)
          const phoneNumber = '+' + digit;
          
          // E.164 requires at least 2 digits total (country code + number)
          expect(validatePhoneNumber(phoneNumber)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject phone numbers that are too long', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 15, maxLength: 20 }),
        (firstDigit, remainingDigits) => {
          // Phone number with more than 15 digits (too long)
          const phoneNumber = '+' + firstDigit + remainingDigits.join('');
          
          expect(validatePhoneNumber(phoneNumber)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject phone numbers with non-digit characters', async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 15 }).filter(s => /[^0-9+]/.test(s)),
        (invalidString) => {
          // String containing non-digit characters
          expect(validatePhoneNumber(invalidString)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Normalization should produce valid E.164 format
   * 
   * For any phone number string with digits, normalizing it should produce
   * a string that either passes E.164 validation or is clearly invalid.
   */
  it('should normalize phone numbers to E.164 format', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 14 }),
        fc.constantFrom(' ', '-', '(', ')', '.', ''),
        (firstDigit, remainingDigits, separator) => {
          // Create a phone number with separators
          const digitsString = firstDigit + remainingDigits.join('');
          const phoneWithSeparators = digitsString.split('').join(separator);
          
          // Normalize it
          const normalized = normalizePhoneNumber(phoneWithSeparators);
          
          // Normalized number should start with +
          expect(normalized.startsWith('+')).toBe(true);
          
          // Normalized number should only contain + and digits
          expect(/^[+0-9]+$/.test(normalized)).toBe(true);
          
          // If the original had valid length, normalized should be valid E.164
          if (digitsString.length >= 2 && digitsString.length <= 15) {
            expect(validatePhoneNumber(normalized)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Normalization is idempotent
   * 
   * For any phone number, normalizing it twice should produce the same result
   * as normalizing it once.
   */
  it('should be idempotent - normalizing twice equals normalizing once', async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }),
        (phoneNumber) => {
          const normalizedOnce = normalizePhoneNumber(phoneNumber);
          const normalizedTwice = normalizePhoneNumber(normalizedOnce);
          
          expect(normalizedOnce).toBe(normalizedTwice);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Valid E.164 numbers remain unchanged after normalization
   * 
   * For any valid E.164 phone number, normalizing it should return the same number.
   */
  it('should not change valid E.164 numbers during normalization', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 14 }),
        (firstDigit, remainingDigits) => {
          const validE164 = '+' + firstDigit + remainingDigits.join('');
          
          const normalized = normalizePhoneNumber(validE164);
          
          expect(normalized).toBe(validE164);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation after normalization
   * 
   * For any phone number with the right number of digits, after normalization,
   * it should pass validation.
   */
  it('should produce valid E.164 after normalizing numbers with correct digit count', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 14 }),
        (firstDigit, remainingDigits) => {
          // Create a phone number with various formats
          const digits = firstDigit + remainingDigits.join('');
          const formats = [
            digits,
            `+${digits}`,
            `(${digits.slice(0, 3)}) ${digits.slice(3)}`,
            `${digits.slice(0, 3)}-${digits.slice(3)}`,
          ];
          
          formats.forEach(format => {
            const normalized = normalizePhoneNumber(format);
            
            // After normalization, should be valid E.164
            expect(validatePhoneNumber(normalized)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Specific test cases for common phone number formats
   */
  it('should handle common international phone number formats', () => {
    const testCases = [
      { input: '+1234567890', expected: true },
      { input: '+972501234567', expected: true }, // Israeli mobile
      { input: '+442071234567', expected: true }, // UK London
      { input: '+12125551234', expected: true }, // US New York
      { input: '+861012345678', expected: true }, // China Beijing
      { input: '1234567890', expected: false }, // Missing +
      { input: '+0123456789', expected: false }, // Country code starts with 0
      { input: '+12', expected: true }, // Minimum valid length
      { input: '+123456789012345', expected: true }, // Maximum valid length
      { input: '+1234567890123456', expected: false }, // Too long
      { input: '+1', expected: false }, // Too short
      { input: 'abc123', expected: false }, // Contains letters
      { input: '+1-234-567-8900', expected: false }, // Contains dashes (not normalized)
    ];

    testCases.forEach(({ input, expected }) => {
      expect(validatePhoneNumber(input)).toBe(expected);
    });
  });

  it('should normalize common phone number formats correctly', () => {
    const testCases = [
      { input: '1234567890', expected: '+1234567890' },
      { input: '+1234567890', expected: '+1234567890' },
      { input: '(123) 456-7890', expected: '+1234567890' },
      { input: '123-456-7890', expected: '+1234567890' },
      { input: '123.456.7890', expected: '+1234567890' },
      { input: '+1 (234) 567-8900', expected: '+12345678900' },
      { input: '  +1234567890  ', expected: '+1234567890' },
    ];

    testCases.forEach(({ input, expected }) => {
      expect(normalizePhoneNumber(input)).toBe(expected);
    });
  });
});
