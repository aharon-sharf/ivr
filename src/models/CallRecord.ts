/**
 * Call Record Model
 * Represents the outcome and details of a voice call
 */

import { IVRAction } from './Campaign';

export type CallStatus = 
  | 'queued'
  | 'dialing'
  | 'ringing'
  | 'answered'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no_answer'
  | 'blacklisted';

export interface CallRecord {
  id: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  status: CallStatus;
  outcome: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  dtmfInputs: string[];
  actionsTriggered: IVRAction[];
  cost: number;
  createdAt: Date;
}

/**
 * Validates a call record
 */
export function validateCallRecord(record: Partial<CallRecord>): string[] {
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

  if (!record.status) {
    errors.push('Status is required');
  }

  if (!record.startTime) {
    errors.push('Start time is required');
  }

  if (record.endTime && record.startTime) {
    if (record.endTime < record.startTime) {
      errors.push('End time must be after start time');
    }
  }

  if (record.duration !== undefined && record.duration < 0) {
    errors.push('Duration cannot be negative');
  }

  return errors;
}

/**
 * Creates a new call record
 */
export function createCallRecord(
  campaignId: string,
  contactId: string,
  phoneNumber: string,
  status: CallStatus = 'queued'
): Omit<CallRecord, 'id' | 'createdAt'> {
  return {
    campaignId,
    contactId,
    phoneNumber,
    status,
    outcome: '',
    startTime: new Date(),
    dtmfInputs: [],
    actionsTriggered: [],
    cost: 0,
  };
}

/**
 * Calculates call duration in seconds
 */
export function calculateDuration(startTime: Date, endTime: Date): number {
  return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
}

/**
 * Updates call record with completion data
 */
export function completeCallRecord(
  record: CallRecord,
  status: CallStatus,
  outcome: string,
  endTime: Date = new Date()
): CallRecord {
  return {
    ...record,
    status,
    outcome,
    endTime,
    duration: calculateDuration(record.startTime, endTime),
  };
}

/**
 * Adds DTMF input to call record
 */
export function addDTMFInput(record: CallRecord, digit: string): CallRecord {
  return {
    ...record,
    dtmfInputs: [...record.dtmfInputs, digit],
  };
}

/**
 * Adds triggered action to call record
 */
export function addTriggeredAction(record: CallRecord, action: IVRAction): CallRecord {
  return {
    ...record,
    actionsTriggered: [...record.actionsTriggered, action],
  };
}
