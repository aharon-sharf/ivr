import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Queue as QueueIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Block as BlockIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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

// Chart colors
const COLORS = {
  answered: '#4caf50',
  busy: '#ff9800',
  failed: '#f44336',
  converted: '#2196f3',
  optOuts: '#9c27b0',
};

export const RealTimeDashboardPage = () => {
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

  const [historicalData, setHistoricalData] = useState<Array<{ time: string; activeCalls: number; queueDepth: number; dialingRate: number }>>([]);
  const autoRefresh = true; // Auto-refresh enabled by default

  // Initialize WebSocket connection and fetch initial data
  useEffect(() => {
    const initializeDashboard = async () => {
      dispatch(setLoading(true));

      try {
        // Fetch initial metrics via REST API
        const metrics = await analyticsApi.getAllRealTimeMetrics();
        dispatch(updateAllCampaignMetrics(metrics));

        const health = await analyticsApi.getSystemHealth();
        dispatch(updateSystemHealth(health));

        // Connect to WebSocket for real-time updates
        await websocketService.connect();
        dispatch(setConnectionStatus(true));

        // Subscribe to metrics updates
        const unsubscribeMetrics = websocketService.subscribe('metrics_update', (message) => {
          if (message.data.campaignId) {
            dispatch(updateCampaignMetrics(message.data));
          }
        });

        // Subscribe to system health updates
        const unsubscribeHealth = websocketService.subscribe('system_health_update', (message) => {
          dispatch(updateSystemHealth(message.data));
        });

        // Cleanup on unmount
        return () => {
          unsubscribeMetrics();
          unsubscribeHealth();
          websocketService.disconnect();
        };
      } catch (err) {
        console.error('Failed to initialize dashboard:', err);
        dispatch(setError('Failed to connect to real-time metrics'));
      } finally {
        dispatch(setLoading(false));
      }
    };

    initializeDashboard();
  }, [dispatch]);

  // Auto-refresh metrics every 2 seconds (fallback if WebSocket fails)
  useEffect(() => {
    if (!autoRefresh || isConnected) return;

    const interval = setInterval(async () => {
      try {
        const metrics = await analyticsApi.getAllRealTimeMetrics();
        dispatch(updateAllCampaignMetrics(metrics));

        const health = await analyticsApi.getSystemHealth();
        dispatch(updateSystemHealth(health));
      } catch (err) {
        console.error('Failed to refresh metrics:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, isConnected, dispatch]);

  // Update historical data for charts
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    setHistoricalData((prev) => {
      const newData = [
        ...prev,
        {
          time: timestamp,
          activeCalls: aggregateMetrics.totalActiveCalls,
          queueDepth: aggregateMetrics.totalQueueDepth,
          dialingRate: aggregateMetrics.averageDialingRate,
        },
      ];
      // Keep only last 20 data points
      return newData.slice(-20);
    });
  }, [aggregateMetrics]);

  // Manual refresh
  const handleRefresh = async () => {
    dispatch(setLoading(true));
    try {
      const metrics = await analyticsApi.getAllRealTimeMetrics();
      dispatch(updateAllCampaignMetrics(metrics));

      const health = await analyticsApi.getSystemHealth();
      dispatch(updateSystemHealth(health));
    } catch (err) {
      dispatch(setError('Failed to refresh metrics'));
    } finally {
      dispatch(setLoading(false));
    }
  };

  // Prepare data for outcome pie chart
  const outcomeData = [
    { name: 'Answered', value: aggregateMetrics.totalAnswered, color: COLORS.answered },
    { name: 'Busy', value: aggregateMetrics.totalBusy, color: COLORS.busy },
    { name: 'Failed', value: aggregateMetrics.totalFailed, color: COLORS.failed },
    { name: 'Converted', value: aggregateMetrics.totalConverted, color: COLORS.converted },
    { name: 'Opt-outs', value: aggregateMetrics.totalOptOuts, color: COLORS.optOuts },
  ].filter((item) => item.value > 0);

  if (isLoading && Object.keys(campaignMetrics).length === 0) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Real-Time Dashboard
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={<CircleIcon sx={{ fontSize: 12 }} />}
                label={isConnected ? 'Connected' : 'Disconnected'}
                color={isConnected ? 'success' : 'error'}
                size="small"
              />
              {lastUpdate && (
                <Typography variant="caption" color="text.secondary">
                  Last update: {new Date(lastUpdate).toLocaleTimeString()}
                </Typography>
              )}
            </Box>
          </Box>
          <Tooltip title="Refresh metrics">
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="warning" sx={{ mb: 3 }} onClose={() => dispatch(setError(''))}>
            {error}
          </Alert>
        )}

        {/* Key Metrics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Active Calls
                    </Typography>
                    <Typography variant="h4">{aggregateMetrics.totalActiveCalls}</Typography>
                  </Box>
                  <PhoneIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Queue Depth
                    </Typography>
                    <Typography variant="h4">{aggregateMetrics.totalQueueDepth}</Typography>
                  </Box>
                  <QueueIcon sx={{ fontSize: 48, color: 'warning.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Dialing Rate
                    </Typography>
                    <Typography variant="h4">
                      {aggregateMetrics.averageDialingRate.toFixed(1)}
                      <Typography component="span" variant="body2" color="text.secondary">
                        {' '}
                        /sec
                      </Typography>
                    </Typography>
                  </Box>
                  <SpeedIcon sx={{ fontSize: 48, color: 'success.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      Total Attempts
                    </Typography>
                    <Typography variant="h4">{aggregateMetrics.totalAttempts}</Typography>
                  </Box>
                  <TrendingUpIcon sx={{ fontSize: 48, color: 'info.main', opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts Row */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Real-Time Activity Chart */}
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Real-Time Activity
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="activeCalls"
                    stroke="#2196f3"
                    name="Active Calls"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="queueDepth"
                    stroke="#ff9800"
                    name="Queue Depth"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="dialingRate"
                    stroke="#4caf50"
                    name="Dialing Rate"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Call Outcomes Pie Chart */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Call Outcomes
              </Typography>
              {outcomeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {outcomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box
                  sx={{
                    height: 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography color="text.secondary">No data available</Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Outcome Metrics Bar Chart */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Campaign Progress
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={[
                    {
                      name: 'Outcomes',
                      Answered: aggregateMetrics.totalAnswered,
                      Busy: aggregateMetrics.totalBusy,
                      Failed: aggregateMetrics.totalFailed,
                      Converted: aggregateMetrics.totalConverted,
                      'Opt-outs': aggregateMetrics.totalOptOuts,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="Answered" fill={COLORS.answered} />
                  <Bar dataKey="Busy" fill={COLORS.busy} />
                  <Bar dataKey="Failed" fill={COLORS.failed} />
                  <Bar dataKey="Converted" fill={COLORS.converted} />
                  <Bar dataKey="Opt-outs" fill={COLORS.optOuts} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* System Health */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            System Health
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  CPU Usage
                </Typography>
                <Typography variant="h5">{systemHealth.cpuUsage.toFixed(1)}%</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Memory Usage
                </Typography>
                <Typography variant="h5">{systemHealth.memoryUsage.toFixed(1)}%</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Answer Rate
                </Typography>
                <Typography variant="h5">{systemHealth.answerRate.toFixed(1)}%</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Active Campaigns
                </Typography>
                <Typography variant="h5">{Object.keys(campaignMetrics).length}</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Per-Campaign Metrics */}
        {Object.keys(campaignMetrics).length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Campaign Details
            </Typography>
            <Grid container spacing={2}>
              {Object.values(campaignMetrics).map((metrics) => (
                <Grid item xs={12} md={6} key={metrics.campaignId}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Campaign: {metrics.campaignId}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleIcon fontSize="small" color="success" />
                            <Typography variant="body2">
                              Answered: {metrics.answered}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CancelIcon fontSize="small" color="error" />
                            <Typography variant="body2">Failed: {metrics.failed}</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingUpIcon fontSize="small" color="primary" />
                            <Typography variant="body2">
                              Converted: {metrics.converted}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BlockIcon fontSize="small" color="warning" />
                            <Typography variant="body2">
                              Opt-outs: {metrics.optOuts}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Answer Rate: {metrics.answerRate.toFixed(1)}% | Conversion Rate:{' '}
                          {metrics.conversionRate.toFixed(1)}%
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>
    </Container>
  );
};
