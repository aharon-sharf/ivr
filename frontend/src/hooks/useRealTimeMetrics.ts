import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  updateCampaignMetrics,
  updateAllCampaignMetrics,
  updateSystemHealth,
  setConnectionStatus,
  setLoading,
  setError,
} from '../store/slices/metricsSlice';
import { websocketService } from '../services/websocket';
import { analyticsApi } from '../api/analytics';

interface UseRealTimeMetricsOptions {
  campaignId?: string;
  autoConnect?: boolean;
  pollingInterval?: number; // Fallback polling interval in ms
}

/**
 * Custom hook for managing real-time metrics
 * 
 * This hook handles:
 * - WebSocket connection management
 * - Real-time metrics updates via WebSocket
 * - Fallback polling if WebSocket fails
 * - Automatic reconnection
 */
export const useRealTimeMetrics = (options: UseRealTimeMetricsOptions = {}) => {
  const {
    campaignId,
    autoConnect = true,
    pollingInterval = 2000,
  } = options;

  const dispatch = useAppDispatch();
  const {
    campaignMetrics,
    systemHealth,
    aggregateMetrics,
    isConnected,
    lastUpdate,
    isLoading,
    error,
  } = useAppSelector((state) => state.metrics);

  /**
   * Fetch initial metrics via REST API
   */
  const fetchInitialMetrics = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      if (campaignId) {
        const metrics = await analyticsApi.getRealTimeMetrics(campaignId);
        dispatch(updateCampaignMetrics(metrics));
      } else {
        const metrics = await analyticsApi.getAllRealTimeMetrics();
        dispatch(updateAllCampaignMetrics(metrics));
      }

      const health = await analyticsApi.getSystemHealth();
      dispatch(updateSystemHealth(health));
    } catch (err) {
      console.error('Failed to fetch initial metrics:', err);
      dispatch(setError('Failed to load metrics'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [campaignId, dispatch]);

  /**
   * Connect to WebSocket and subscribe to updates
   */
  const connectWebSocket = useCallback(async () => {
    try {
      await websocketService.connect();
      dispatch(setConnectionStatus(true));

      // Subscribe to specific campaign if provided
      if (campaignId) {
        websocketService.subscribeToCampaign(campaignId);
      }
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
      dispatch(setConnectionStatus(false));
    }
  }, [campaignId, dispatch]);

  /**
   * Disconnect from WebSocket
   */
  const disconnectWebSocket = useCallback(() => {
    if (campaignId) {
      websocketService.unsubscribeFromCampaign(campaignId);
    }
    websocketService.disconnect();
    dispatch(setConnectionStatus(false));
  }, [campaignId, dispatch]);

  /**
   * Manual refresh of metrics
   */
  const refreshMetrics = useCallback(async () => {
    await fetchInitialMetrics();
  }, [fetchInitialMetrics]);

  /**
   * Initialize: Fetch initial data and connect WebSocket
   */
  useEffect(() => {
    if (!autoConnect) return;

    const initialize = async () => {
      await fetchInitialMetrics();
      await connectWebSocket();
    };

    initialize();

    // Subscribe to WebSocket messages
    const unsubscribeMetrics = websocketService.subscribe('metrics_update', (message) => {
      if (campaignId) {
        // Only update if message is for our campaign
        if (message.data.campaignId === campaignId) {
          dispatch(updateCampaignMetrics(message.data));
        }
      } else {
        // Update any campaign metrics
        dispatch(updateCampaignMetrics(message.data));
      }
    });

    const unsubscribeHealth = websocketService.subscribe('system_health_update', (message) => {
      dispatch(updateSystemHealth(message.data));
    });

    // Cleanup on unmount
    return () => {
      unsubscribeMetrics();
      unsubscribeHealth();
      disconnectWebSocket();
    };
  }, [autoConnect, campaignId, fetchInitialMetrics, connectWebSocket, disconnectWebSocket, dispatch]);

  /**
   * Fallback polling if WebSocket is not connected
   */
  useEffect(() => {
    if (isConnected || !autoConnect) return;

    const interval = setInterval(async () => {
      try {
        if (campaignId) {
          const metrics = await analyticsApi.getRealTimeMetrics(campaignId);
          dispatch(updateCampaignMetrics(metrics));
        } else {
          const metrics = await analyticsApi.getAllRealTimeMetrics();
          dispatch(updateAllCampaignMetrics(metrics));
        }

        const health = await analyticsApi.getSystemHealth();
        dispatch(updateSystemHealth(health));
      } catch (err) {
        console.error('Failed to poll metrics:', err);
      }
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [isConnected, autoConnect, campaignId, pollingInterval, dispatch]);

  return {
    // State
    campaignMetrics,
    systemHealth,
    aggregateMetrics,
    isConnected,
    lastUpdate,
    isLoading,
    error,

    // Actions
    refreshMetrics,
    connectWebSocket,
    disconnectWebSocket,
  };
};
