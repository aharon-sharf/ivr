// Campaign Status
export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// Campaign Types
export const CAMPAIGN_TYPES = {
  VOICE: 'voice',
  SMS: 'sms',
  HYBRID: 'hybrid',
} as const;

// User Roles
export const USER_ROLES = {
  CAMPAIGN_MANAGER: 'CampaignManager',
  ADMINISTRATOR: 'Administrator',
  ANALYST: 'Analyst',
} as const;

// Call Status
export const CALL_STATUS = {
  QUEUED: 'queued',
  DIALING: 'dialing',
  RINGING: 'ringing',
  ANSWERED: 'answered',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BUSY: 'busy',
  NO_ANSWER: 'no_answer',
  BLACKLISTED: 'blacklisted',
} as const;

// IVR Node Types
export const IVR_NODE_TYPES = {
  PLAY_AUDIO: 'play_audio',
  CAPTURE_INPUT: 'capture_input',
  ACTION: 'action',
  MENU: 'menu',
} as const;

// IVR Action Types
export const IVR_ACTION_TYPES = {
  SEND_SMS: 'send_sms',
  TRANSFER_AGENT: 'transfer_agent',
  ADD_TO_BLACKLIST: 'add_to_blacklist',
  TRIGGER_DONATION: 'trigger_donation',
  END_CALL: 'end_call',
} as const;

// File Upload Limits
export const FILE_LIMITS = {
  AUDIO_MAX_SIZE_MB: 10,
  CONTACT_MAX_SIZE_MB: 50,
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/mp3'],
  ALLOWED_CONTACT_TYPES: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
} as const;

// Dashboard Refresh Intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  REAL_TIME_METRICS: 2000, // 2 seconds
  CAMPAIGN_LIST: 30000, // 30 seconds
  ANALYTICS: 60000, // 1 minute
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'PPP',
  DISPLAY_WITH_TIME: 'PPP p',
  API: "yyyy-MM-dd'T'HH:mm:ss",
} as const;
