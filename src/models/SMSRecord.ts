/**
 * SMS Record Model
 * Represents the outcome and details of an SMS message
 */

export type SMSDeliveryStatus = 
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered';

export interface SMSRecord {
  id: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  message: string;
  status: SMSDeliveryStatus;
  sentAt: Date;
  deliveredAt?: Date;
  failureReason?: string;
  ttsFallbackTriggered: boolean;
  cost: number;
  providerMessageId?: string;
  createdAt: Date;
}

/**
 * Validates an SMS record
 */
export function validateSMSRecord(record: Partial<SMSRecord>): string[] {
  const errors: string[] = [];

  if (!record.campaignId) {
    errors.push('Campaign ID is required');
  }

  if (!record.contactId) {
    errors.push('Contact ID is required');
  }

  if (!record.phoneNumber) {
    errors.push('Phone number is required');
  }

  if (!record.message || record.message.trim().length === 0) {
    errors.push('Message is required');
  }

  if (!record.status) {
    errors.push('Status is required');
  }

  if (!record.sentAt) {
    errors.push('Sent time is required');
  }

  if (record.deliveredAt && record.sentAt) {
    if (record.deliveredAt < record.sentAt) {
      errors.push('Delivered time must be after sent time');
    }
  }

  return errors;
}

/**
 * Creates a new SMS record
 */
export function createSMSRecord(
  campaignId: string,
  contactId: string,
  phoneNumber: string,
  message: string,
  status: SMSDeliveryStatus = 'queued'
): Omit<SMSRecord, 'id' | 'createdAt'> {
  return {
    campaignId,
    contactId,
    phoneNumber,
    message,
    status,
    sentAt: new Date(),
    ttsFallbackTriggered: false,
    cost: 0,
  };
}

/**
 * Updates SMS record with delivery status
 */
export function updateSMSDeliveryStatus(
  record: SMSRecord,
  status: SMSDeliveryStatus,
  deliveredAt?: Date,
  failureReason?: string
): SMSRecord {
  return {
    ...record,
    status,
    deliveredAt: deliveredAt || record.deliveredAt,
    failureReason: failureReason || record.failureReason,
  };
}

/**
 * Marks SMS record as requiring TTS fallback
 */
export function markTTSFallbackTriggered(record: SMSRecord): SMSRecord {
  return {
    ...record,
    ttsFallbackTriggered: true,
  };
}

/**
 * Substitutes template variables in SMS message
 * Example: "Hello {firstName}, your code is {code}" with {firstName: "John", code: "1234"}
 * Returns: "Hello John, your code is 1234"
 */
export function substituteTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let message = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    message = message.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return message;
}

/**
 * Validates that all template variables have been substituted
 * Returns true if no placeholders remain
 */
export function validateTemplateSubstitution(message: string): boolean {
  // Check for any remaining {variable} patterns
  const placeholderPattern = /\{[^}]+\}/g;
  return !placeholderPattern.test(message);
}
