import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  TextField,
} from '@mui/material';
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
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { analyticsApi } from '../api/analytics';
import { campaignApi } from '../api/campaigns';
import { Campaign, HistoricalMetrics } from '../types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const AnalyticsPage = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [historicalData, setHistoricalData] = useState<HistoricalMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaignId && startDate && endDate) {
      loadHistoricalData();
    }
  }, [selectedCampaignId, startDate, endDate]);

  const loadCampaigns = async () => {
    try {
      const data = await campaignApi.getCampaigns();
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(data[0].id);
      }
    } catch (err) {
      setError('Failed to load campaigns');
      console.error(err);
    }
  };

  const loadHistoricalData = async () => {
    if (!selectedCampaignId || !startDate || !endDate) return;

    setLoading(true);
    setError(null);

    try {
      const data = await analyticsApi.getHistoricalMetrics(
        selectedCampaignId,
        startDate,
        endDate
      );
      setHistoricalData(data);
    } catch (err) {
      setError('Failed to load historical data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedCampaignId) return;

    setExporting(true);
    try {
      const blob = await analyticsApi.exportReport(selectedCampaignId, exportFormat);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign-${selectedCampaignId}-report.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export report');
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const getOutcomeData = () => {
    if (!historicalData) return [];
    const { aggregateMetrics } = historicalData;
    return [
      { name: 'Answered', value: aggregateMetrics.answered },
      { name: 'Busy', value: aggregateMetrics.busy },
      { name: 'Failed', value: aggregateMetrics.failed },
      { name: 'Converted', value: aggregateMetrics.converted },
      { name: 'Opt-outs', value: aggregateMetrics.optOuts },
    ];
  };

  return (
    <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Campaign Analytics
          </Typography>

          {/* Filters */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Campaign</InputLabel>
                  <Select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    label="Campaign"
                  >
                    {campaigns.map((campaign) => (
                      <MenuItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<RefreshIcon />}
                  onClick={loadHistoricalData}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : historicalData ? (
            <>
              {/* Summary Cards */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Total Attempts
                      </Typography>
                      <Typography variant="h4">
                        {historicalData.aggregateMetrics.totalAttempts.toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Answer Rate
                      </Typography>
                      <Typography variant="h4">
                        {(historicalData.aggregateMetrics.answerRate * 100).toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Conversion Rate
                      </Typography>
                      <Typography variant="h4">
                        {(historicalData.aggregateMetrics.conversionRate * 100).toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Opt-out Rate
                      </Typography>
                      <Typography variant="h4">
                        {(
                          (historicalData.aggregateMetrics.optOuts /
                            historicalData.aggregateMetrics.totalAttempts) *
                          100
                        ).toFixed(1)}
                        %
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Daily Trends Chart */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Daily Performance Trends
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalData.dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="totalAttempts"
                      stroke="#8884d8"
                      name="Total Attempts"
                    />
                    <Line
                      type="monotone"
                      dataKey="answered"
                      stroke="#82ca9d"
                      name="Answered"
                    />
                    <Line
                      type="monotone"
                      dataKey="converted"
                      stroke="#ffc658"
                      name="Converted"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>

              {/* Answer & Conversion Rates Chart */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Answer & Conversion Rates Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalData.dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                    <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="answerRate"
                      stroke="#0088FE"
                      name="Answer Rate"
                    />
                    <Line
                      type="monotone"
                      dataKey="conversionRate"
                      stroke="#00C49F"
                      name="Conversion Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>

              {/* Call Outcomes Distribution */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Call Outcomes Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={getOutcomeData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getOutcomeData().map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Daily Call Volume
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={historicalData.dailyMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="answered" stackId="a" fill="#82ca9d" name="Answered" />
                        <Bar dataKey="busy" stackId="a" fill="#ffc658" name="Busy" />
                        <Bar dataKey="failed" stackId="a" fill="#ff8042" name="Failed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>
              </Grid>

              {/* Export Section */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Export Report
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Format</InputLabel>
                      <Select
                        value={exportFormat}
                        onChange={(e) =>
                          setExportFormat(e.target.value as 'csv' | 'excel' | 'pdf')
                        }
                        label="Format"
                      >
                        <MenuItem value="csv">CSV</MenuItem>
                        <MenuItem value="excel">Excel</MenuItem>
                        <MenuItem value="pdf">PDF</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<DownloadIcon />}
                      onClick={handleExport}
                      disabled={exporting}
                    >
                      {exporting ? 'Exporting...' : 'Download Report'}
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </>
          ) : (
            <Paper sx={{ p: 8, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                Select a campaign and date range to view analytics
              </Typography>
            </Paper>
          )}
        </Box>
      </Container>
  );
};
