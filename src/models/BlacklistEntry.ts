/**
 * Blacklist Entry Model
 * Represents a phone number in the Do-Not-Call registry
 */

export type BlacklistSource = 'user_optout' | 'admin_import' | 'compliance';

export interface BlacklistEntry {
  phoneNumber: string;
  addedAt: Date;
  reason: string;
  source: BlacklistSource;
  metadata?: Record<string, any>;
}

/**
 * Validates a blacklist entry
 */
export function validateBlacklistEntry(entry: Partial<BlacklistEntry>): string[] {
  const errors: string[] = [];

  if (!entry.phoneNumber) {
    errors.push('Phone number is required');
  }

  if (!entry.source || !['user_optout', 'admin_import', 'compliance'].includes(entry.source)) {
    errors.push('Source must be user_optout, admin_import, or compliance');
  }

  if (!entry.reason || entry.reason.trim().length === 0) {
    errors.push('Reason is required');
  }

  return errors;
}

/**
 * Creates a new blacklist entry
 */
export function createBlacklistEntry(
  phoneNumber: string,
  source: BlacklistSource,
  reason: string,
  metadata?: Record<string, any>
): Omit<BlacklistEntry, 'addedAt'> {
  return {
    phoneNumber,
    source,
    reason,
    metadata,
  };
}

/**
 * Checks if a phone number is blacklisted
 * This would typically query the database, but the function signature is provided here
 */
export async function isPhoneNumberBlacklisted(
  phoneNumber: string,
  blacklistChecker: (phone: string) => Promise<boolean>
): Promise<boolean> {
  return await blacklistChecker(phoneNumber);
}
