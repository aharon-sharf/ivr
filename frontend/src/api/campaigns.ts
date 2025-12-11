import apiClient from './client';
import { Campaign, ApiResponse, Contact, IVRFlowDefinition, TimeWindow } from '../types';

export const campaignApi = {
  // Get all campaigns
  getCampaigns: async (): Promise<Campaign[]> => {
    const response = await apiClient.get<ApiResponse<{ campaigns: Campaign[]; total: number; limit: number; offset: number }>>('/campaigns');
    return response.data.data?.campaigns || [];
  },

  // Get single campaign by ID
  getCampaign: async (id: string): Promise<Campaign> => {
    const response = await apiClient.get<ApiResponse<Campaign>>(`/campaigns/${id}`);
    if (!response.data.data) {
      throw new Error('Campaign not found');
    }
    return response.data.data;
  },

  // Create new campaign
  createCampaign: async (config: {
    name: string;
    type: Campaign['type'];
    startTime: string;
    endTime: string;
    timezone: string;
    audioFileUrl?: string;
    smsTemplate?: string;
    ivrFlow?: IVRFlowDefinition;
    callingWindows: TimeWindow[];
    maxConcurrentCalls?: number;
    maxAttemptsPerContact?: number;
    retryDelayMinutes?: number;
  }): Promise<Campaign> => {
    const payload = {
      name: config.name,
      type: config.type,
      config: {
        audioFileUrl: config.audioFileUrl,
        smsTemplate: config.smsTemplate,
        ivrFlow: config.ivrFlow,
        callingWindows: config.callingWindows,
        maxConcurrentCalls: config.maxConcurrentCalls,
        maxAttemptsPerContact: config.maxAttemptsPerContact,
        retryDelayMinutes: config.retryDelayMinutes,
      },
      startTime: config.startTime,
      endTime: config.endTime,
      timezone: config.timezone,
    };
    const response = await apiClient.post<ApiResponse<Campaign>>('/campaigns', payload);
    if (!response.data.data) {
      throw new Error('Failed to create campaign');
    }
    return response.data.data;
  },

  // Update existing campaign
  updateCampaign: async (id: string, config: {
    name?: string;
    type?: Campaign['type'];
    config?: Partial<{
      audioFileUrl?: string;
      smsTemplate?: string;
      ivrFlow?: IVRFlowDefinition;
      callingWindows?: TimeWindow[];
      maxConcurrentCalls?: number;
    }>;
    startTime?: string;
    endTime?: string;
    timezone?: string;
  }): Promise<Campaign> => {
    const response = await apiClient.put<ApiResponse<Campaign>>(`/campaigns/${id}`, config);
    if (!response.data.data) {
      throw new Error('Failed to update campaign');
    }
    return response.data.data;
  },

  // Delete campaign
  deleteCampaign: async (id: string): Promise<void> => {
    await apiClient.delete(`/campaigns/${id}`);
  },

  // Pause campaign
  pauseCampaign: async (id: string): Promise<Campaign> => {
    const response = await apiClient.post<ApiResponse<Campaign>>(`/campaigns/${id}/pause`);
    if (!response.data.data) {
      throw new Error('Failed to pause campaign');
    }
    return response.data.data;
  },

  // Resume campaign
  resumeCampaign: async (id: string): Promise<Campaign> => {
    const response = await apiClient.post<ApiResponse<Campaign>>(`/campaigns/${id}/resume`);
    if (!response.data.data) {
      throw new Error('Failed to resume campaign');
    }
    return response.data.data;
  },

  // Start campaign immediately
  startCampaign: async (id: string): Promise<Campaign> => {
    const response = await apiClient.post<ApiResponse<Campaign>>(`/campaigns/${id}/start`);
    if (!response.data.data) {
      throw new Error('Failed to start campaign');
    }
    return response.data.data;
  },

  // Schedule campaign for future execution
  scheduleCampaign: async (id: string, startTime?: string): Promise<Campaign> => {
    const payload = startTime ? { startTime } : {};
    const response = await apiClient.post<ApiResponse<Campaign>>(`/campaigns/${id}/schedule`, payload);
    if (!response.data.data) {
      throw new Error('Failed to schedule campaign');
    }
    return response.data.data;
  },

  // Create contact for campaign
  createContact: async (campaignId: string, contactData: { phoneNumber: string }): Promise<Contact> => {
    const response = await apiClient.post<ApiResponse<Contact>>(
      `/campaigns/${campaignId}/contacts`,
      contactData
    );
    if (!response.data.data) {
      throw new Error('Failed to create contact');
    }
    return response.data.data;
  },
};
