// Campaign Types
export interface Campaign {
  id: string;
  name: string;
  type: 'voice' | 'sms' | 'hybrid';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  config: CampaignConfig;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CampaignConfig {
  name: string;
  type: 'voice' | 'sms' | 'hybrid';
  audioFileUrl?: string;
  smsTemplate?: string;
  ivrFlow?: IVRFlowDefinition;
  schedule: Schedule;
  callingWindows: TimeWindow[];
  maxConcurrentCalls?: number;
}

export interface Schedule {
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface TimeWindow {
  dayOfWeek: number[];
  startHour: number;
  endHour: number;
}

// Contact Types
export interface Contact {
  id: string;
  campaignId: string;
  phoneNumber: string;
  metadata: Record<string, unknown>;
  optimalCallTime?: string;
  blacklisted: boolean;
  createdAt: string;
}

export interface ImportResult {
  totalRecords: number;
  imported: number;
  duplicates: number;
  failures: number;
  errors: string[];
}

// IVR Types
export interface IVRFlowDefinition {
  nodes: IVRNode[];
  startNodeId: string;
}

export interface IVRNode {
  id: string;
  type: 'play_audio' | 'capture_input' | 'action' | 'menu';
  audioUrl?: string;
  timeout?: number;
  validInputs?: string[];
  actions?: Record<string, IVRAction>;
  nextNodeId?: string;
}

export interface IVRAction {
  type: 'send_sms' | 'transfer_agent' | 'add_to_blacklist' | 'trigger_donation' | 'end_call';
  parameters?: Record<string, unknown>;
}

// Analytics Types
export interface CampaignMetrics {
  campaignId: string;
  campaignName?: string;
  activeCalls: number;
  queueDepth: number;
  dialingRate: number;
  totalAttempts: number;
  answered: number;
  busy: number;
  failed: number;
  converted: number;
  optOuts: number;
  answerRate: number;
  conversionRate: number;
  optOutRate?: number;
  averageCallDuration?: number;
  totalCost?: number;
}

export interface HistoricalMetrics {
  campaignId: string;
  campaignName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  dailyMetrics: DailyMetric[];
  aggregateMetrics: CampaignMetrics;
}

export interface DailyMetric {
  date: string;
  totalAttempts: number;
  answered: number;
  busy: number;
  failed: number;
  converted: number;
  optOuts: number;
  answerRate: number;
  conversionRate: number;
}

export interface CampaignComparison {
  campaignId: string;
  campaignName: string;
  type: 'voice' | 'sms' | 'hybrid';
  status: string;
  metrics: CampaignMetrics;
  createdAt: string;
  completedAt?: string;
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'CampaignManager' | 'Administrator' | 'Analyst';
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Blacklist Types
export interface BlacklistEntry {
  phoneNumber: string;
  reason: string | null;
  source?: 'user_optout' | 'admin_import' | 'compliance';
  addedAt: string;
  addedBy?: string;
}
