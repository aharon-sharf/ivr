/**
 * Campaign Model
 * Represents a voice, SMS, or hybrid campaign
 */

export type CampaignType = 'voice' | 'sms' | 'hybrid';

export type CampaignStatus = 
  | 'draft' 
  | 'scheduled' 
  | 'active' 
  | 'paused' 
  | 'completed' 
  | 'cancelled';

export interface TimeWindow {
  dayOfWeek: number[]; // 0-6, where 0 is Sunday
  startHour: number; // 0-23
  endHour: number; // 0-23
}

export interface Schedule {
  startTime: Date;
  endTime: Date;
  timezone: string;
}

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
  parameters?: Record<string, any>;
}

export interface CampaignConfig {
  audioFileUrl?: string;
  smsTemplate?: string;
  ivrFlow?: IVRFlowDefinition;
  callingWindows: TimeWindow[];
  maxConcurrentCalls?: number;
  maxAttemptsPerContact?: number;
  retryDelayMinutes?: number;
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  config: CampaignConfig;
  startTime?: Date;
  endTime?: Date;
  timezone: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validates a campaign configuration
 */
export function validateCampaign(campaign: Partial<Campaign>): string[] {
  const errors: string[] = [];

  if (!campaign.name || campaign.name.trim().length === 0) {
    errors.push('Campaign name is required');
  }

  if (!campaign.type || !['voice', 'sms', 'hybrid'].includes(campaign.type)) {
    errors.push('Campaign type must be voice, sms, or hybrid');
  }

  if (!campaign.config) {
    errors.push('Campaign config is required');
  } else {
    // Validate voice campaign requirements
    if (campaign.type === 'voice' || campaign.type === 'hybrid') {
      if (!campaign.config.audioFileUrl && !campaign.config.ivrFlow) {
        errors.push('Voice campaigns require audioFileUrl or ivrFlow');
      }
    }

    // Validate SMS campaign requirements
    if (campaign.type === 'sms' || campaign.type === 'hybrid') {
      if (!campaign.config.smsTemplate) {
        errors.push('SMS campaigns require smsTemplate');
      }
    }

    // Validate calling windows
    if (!campaign.config.callingWindows || campaign.config.callingWindows.length === 0) {
      errors.push('At least one calling window is required');
    } else {
      campaign.config.callingWindows.forEach((window, index) => {
        if (window.startHour < 0 || window.startHour > 23) {
          errors.push(`Calling window ${index}: startHour must be between 0 and 23`);
        }
        if (window.endHour < 0 || window.endHour > 23) {
          errors.push(`Calling window ${index}: endHour must be between 0 and 23`);
        }
        if (window.startHour >= window.endHour) {
          errors.push(`Calling window ${index}: startHour must be less than endHour`);
        }
      });
    }
  }

  // Validate time range
  if (campaign.startTime && campaign.endTime) {
    if (campaign.startTime >= campaign.endTime) {
      errors.push('Start time must be before end time');
    }
  }

  return errors;
}

/**
 * Creates a new campaign with default values
 */
export function createCampaign(
  name: string,
  type: CampaignType,
  config: CampaignConfig
): Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    type,
    status: 'draft',
    config,
    timezone: 'UTC',
  };
}
