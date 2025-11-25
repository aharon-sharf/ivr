import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CampaignMetrics } from '../../types';

interface SystemHealth {
  cpuUsage: number;
  memoryUsage: number;
  activeCalls: number;
  queueDepth: number;
  answerRate: number;
}

interface MetricsState {
  // Campaign-specific metrics
  campaignMetrics: Record<string, CampaignMetrics>;
  
  // System-wide metrics
  systemHealth: SystemHealth;
  
  // Aggregate metrics across all campaigns
  aggregateMetrics: {
    totalActiveCalls: number;
    totalQueueDepth: number;
    averageDialingRate: number;
    totalAttempts: number;
    totalAnswered: number;
    totalBusy: number;
    totalFailed: number;
    totalConverted: number;
    totalOptOuts: number;
  };
  
  // Connection status
  isConnected: boolean;
  lastUpdate: string | null;
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
}

const initialState: MetricsState = {
  campaignMetrics: {},
  systemHealth: {
    cpuUsage: 0,
    memoryUsage: 0,
    activeCalls: 0,
    queueDepth: 0,
    answerRate: 0,
  },
  aggregateMetrics: {
    totalActiveCalls: 0,
    totalQueueDepth: 0,
    averageDialingRate: 0,
    totalAttempts: 0,
    totalAnswered: 0,
    totalBusy: 0,
    totalFailed: 0,
    totalConverted: 0,
    totalOptOuts: 0,
  },
  isConnected: false,
  lastUpdate: null,
  isLoading: false,
  error: null,
};

const metricsSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    // Update metrics for a specific campaign
    updateCampaignMetrics: (state, action: PayloadAction<CampaignMetrics>) => {
      state.campaignMetrics[action.payload.campaignId] = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
      
      // Recalculate aggregate metrics
      const allMetrics = Object.values(state.campaignMetrics);
      state.aggregateMetrics = {
        totalActiveCalls: allMetrics.reduce((sum, m) => sum + m.activeCalls, 0),
        totalQueueDepth: allMetrics.reduce((sum, m) => sum + m.queueDepth, 0),
        averageDialingRate: allMetrics.length > 0 
          ? allMetrics.reduce((sum, m) => sum + m.dialingRate, 0) / allMetrics.length 
          : 0,
        totalAttempts: allMetrics.reduce((sum, m) => sum + m.totalAttempts, 0),
        totalAnswered: allMetrics.reduce((sum, m) => sum + m.answered, 0),
        totalBusy: allMetrics.reduce((sum, m) => sum + m.busy, 0),
        totalFailed: allMetrics.reduce((sum, m) => sum + m.failed, 0),
        totalConverted: allMetrics.reduce((sum, m) => sum + m.converted, 0),
        totalOptOuts: allMetrics.reduce((sum, m) => sum + m.optOuts, 0),
      };
    },

    // Update multiple campaign metrics at once
    updateAllCampaignMetrics: (state, action: PayloadAction<CampaignMetrics[]>) => {
      action.payload.forEach((metrics) => {
        state.campaignMetrics[metrics.campaignId] = metrics;
      });
      state.lastUpdate = new Date().toISOString();
      state.error = null;
      
      // Recalculate aggregate metrics
      const allMetrics = Object.values(state.campaignMetrics);
      state.aggregateMetrics = {
        totalActiveCalls: allMetrics.reduce((sum, m) => sum + m.activeCalls, 0),
        totalQueueDepth: allMetrics.reduce((sum, m) => sum + m.queueDepth, 0),
        averageDialingRate: allMetrics.length > 0 
          ? allMetrics.reduce((sum, m) => sum + m.dialingRate, 0) / allMetrics.length 
          : 0,
        totalAttempts: allMetrics.reduce((sum, m) => sum + m.totalAttempts, 0),
        totalAnswered: allMetrics.reduce((sum, m) => sum + m.answered, 0),
        totalBusy: allMetrics.reduce((sum, m) => sum + m.busy, 0),
        totalFailed: allMetrics.reduce((sum, m) => sum + m.failed, 0),
        totalConverted: allMetrics.reduce((sum, m) => sum + m.converted, 0),
        totalOptOuts: allMetrics.reduce((sum, m) => sum + m.optOuts, 0),
      };
    },

    // Update system health metrics
    updateSystemHealth: (state, action: PayloadAction<SystemHealth>) => {
      state.systemHealth = action.payload;
      state.lastUpdate = new Date().toISOString();
    },

    // Set WebSocket connection status
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      if (!action.payload) {
        state.error = 'WebSocket disconnected';
      } else {
        state.error = null;
      }
    },

    // Clear metrics for a specific campaign
    clearCampaignMetrics: (state, action: PayloadAction<string>) => {
      delete state.campaignMetrics[action.payload];
    },

    // Clear all metrics
    clearAllMetrics: (state) => {
      state.campaignMetrics = {};
      state.aggregateMetrics = initialState.aggregateMetrics;
      state.lastUpdate = null;
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Set error state
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const {
  updateCampaignMetrics,
  updateAllCampaignMetrics,
  updateSystemHealth,
  setConnectionStatus,
  clearCampaignMetrics,
  clearAllMetrics,
  setLoading,
  setError,
} = metricsSlice.actions;

export default metricsSlice.reducer;
