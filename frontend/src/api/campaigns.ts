import apiClient from './client';
import { Campaign, CampaignConfig, ApiResponse } from '../types';

export const campaignApi = {
  // Get all campaigns
  getCampaigns: async (): Promise<Campaign[]> => {
    const response = await apiClient.get<ApiResponse<Campaign[]>>('/campaigns');
    return response.data.data || [];
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
  createCampaign: async (config: CampaignConfig): Promise<Campaign> => {
    const response = await apiClient.post<ApiResponse<Campaign>>('/campaigns', config);
    if (!response.data.data) {
      throw new Error('Failed to create campaign');
    }
    return response.data.data;
  },

  // Update existing campaign
  updateCampaign: async (id: string, config: Partial<CampaignConfig>): Promise<Campaign> => {
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
};
