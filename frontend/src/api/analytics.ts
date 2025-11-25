import apiClient from './client';
import { CampaignMetrics, ApiResponse, HistoricalMetrics, CampaignComparison } from '../types';

export const analyticsApi = {
  // Get real-time metrics for a specific campaign
  getRealTimeMetrics: async (campaignId: string): Promise<CampaignMetrics> => {
    const response = await apiClient.get<ApiResponse<CampaignMetrics>>(
      `/analytics/campaigns/${campaignId}/metrics`
    );
    if (!response.data.data) {
      throw new Error('Failed to fetch metrics');
    }
    return response.data.data;
  },

  // Get real-time metrics for all active campaigns
  getAllRealTimeMetrics: async (): Promise<CampaignMetrics[]> => {
    const response = await apiClient.get<ApiResponse<CampaignMetrics[]>>(
      '/analytics/metrics'
    );
    return response.data.data || [];
  },

  // Get system health metrics
  getSystemHealth: async (): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    activeCalls: number;
    queueDepth: number;
    answerRate: number;
  }> => {
    const response = await apiClient.get('/analytics/system/health');
    return response.data.data || {
      cpuUsage: 0,
      memoryUsage: 0,
      activeCalls: 0,
      queueDepth: 0,
      answerRate: 0,
    };
  },

  // Get historical metrics for a campaign
  getHistoricalMetrics: async (
    campaignId: string,
    startDate: string,
    endDate: string
  ): Promise<HistoricalMetrics> => {
    const response = await apiClient.get<ApiResponse<HistoricalMetrics>>(
      `/analytics/campaigns/${campaignId}/historical`,
      {
        params: { startDate, endDate },
      }
    );
    if (!response.data.data) {
      throw new Error('Failed to fetch historical metrics');
    }
    return response.data.data;
  },

  // Compare multiple campaigns
  compareCampaigns: async (campaignIds: string[]): Promise<CampaignComparison[]> => {
    const response = await apiClient.post<ApiResponse<CampaignComparison[]>>(
      '/analytics/campaigns/compare',
      { campaignIds }
    );
    return response.data.data || [];
  },

  // Export campaign report
  exportReport: async (
    campaignId: string,
    format: 'csv' | 'excel' | 'pdf'
  ): Promise<Blob> => {
    const response = await apiClient.get(
      `/analytics/campaigns/${campaignId}/export`,
      {
        params: { format },
        responseType: 'blob',
      }
    );
    return response.data;
  },

  // Get all campaigns for analytics (with date filtering)
  getCampaignsForAnalytics: async (
    startDate?: string,
    endDate?: string
  ): Promise<CampaignMetrics[]> => {
    const response = await apiClient.get<ApiResponse<CampaignMetrics[]>>(
      '/analytics/campaigns',
      {
        params: { startDate, endDate },
      }
    );
    return response.data.data || [];
  },
};
