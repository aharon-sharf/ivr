/**
 * Contact Model
 * Represents a contact in a campaign with phone number and metadata
 */

export type ContactStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'blacklisted';

export interface OptimalTimeWindow {
  preferredDayOfWeek: number[];
  preferredHourRange: { start: number; end: number };
  confidence: number;
}

export interface Contact {
  id: string;
  campaignId: string;
  phoneNumber: string;
  metadata: Record<string, any>;
  timezone?: string;
  smsCapable: boolean;
  optimalCallTime?: OptimalTimeWindow;
  status: ContactStatus;
  attempts: number;
  lastAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validates a phone number format
 * Accepts E.164 format: +[country code][number]
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  // E.164 format: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Normalizes a phone number to E.164 format
 * Removes spaces, dashes, parentheses, and ensures + prefix
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except +
  let normalized = phoneNumber.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  
  return normalized;
}

/**
 * Validates contact data
 */
export function validateContact(contact: Partial<Contact>): string[] {
  const errors: string[] = [];

  if (!contact.campaignId) {
    errors.push('Campaign ID is required');
  }

  if (!contact.phoneNumber) {
    errors.push('Phone number is required');
  } else {
    const normalized = normalizePhoneNumber(contact.phoneNumber);
    if (!validatePhoneNumber(normalized)) {
      errors.push('Phone number must be in valid E.164 format (+[country code][number])');
    }
  }

  if (contact.timezone) {
    // Basic timezone validation - check if it's a reasonable string
    if (contact.timezone.length < 3 || contact.timezone.length > 50) {
      errors.push('Invalid timezone format');
    }
  }

  return errors;
}

/**
 * Creates a new contact with default values
 */
export function createContact(
  campaignId: string,
  phoneNumber: string,
  metadata: Record<string, any> = {}
): Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    campaignId,
    phoneNumber: normalizePhoneNumber(phoneNumber),
    metadata,
    smsCapable: true,
    status: 'pending',
    attempts: 0,
  };
}

/**
 * Checks if a contact is eligible for calling based on attempts and status
 */
export function isContactEligible(
  contact: Contact,
  maxAttempts: number = 3
): boolean {
  return (
    contact.status === 'pending' &&
    contact.attempts < maxAttempts
  );
}
