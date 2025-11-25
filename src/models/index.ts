/**
 * Models Index
 * Exports all data models and their validation functions
 */

// Campaign
export {
  Campaign,
  CampaignType,
  CampaignStatus,
  CampaignConfig,
  TimeWindow,
  Schedule,
  IVRFlowDefinition,
  IVRNode,
  IVRAction,
  validateCampaign,
  createCampaign,
} from './Campaign';

// Contact
export {
  Contact,
  ContactStatus,
  OptimalTimeWindow,
  validatePhoneNumber,
  normalizePhoneNumber,
  validateContact,
  createContact,
  isContactEligible,
} from './Contact';

// Blacklist Entry
export {
  BlacklistEntry,
  BlacklistSource,
  validateBlacklistEntry,
  createBlacklistEntry,
  isPhoneNumberBlacklisted,
} from './BlacklistEntry';

// Call Record
export {
  CallRecord,
  CallStatus,
  validateCallRecord,
  createCallRecord,
  calculateDuration,
  completeCallRecord,
  addDTMFInput,
  addTriggeredAction,
} from './CallRecord';

// SMS Record
export {
  SMSRecord,
  SMSDeliveryStatus,
  validateSMSRecord,
  createSMSRecord,
  updateSMSDeliveryStatus,
  markTTSFallbackTriggered,
  substituteTemplateVariables,
  validateTemplateSubstitution,
} from './SMSRecord';
