import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Card,
  CardContent,
  SelectChangeEvent,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Compare as CompareIcon } from '@mui/icons-material';
import { analyticsApi } from '../api/analytics';
import { campaignApi } from '../api/campaigns';
import { Campaign, CampaignComparison } from '../types';

export const CampaignComparisonPage = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<CampaignComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await campaignApi.getCampaigns();
      // Filter to only completed campaigns for comparison
      const completedCampaigns = data.filter((c) => c.status === 'completed');
      setCampaigns(completedCampaigns);
    } catch (err) {
      setError('Failed to load campaigns');
      console.error(err);
    }
  };

  const handleCampaignSelection = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setSelectedCampaignIds(typeof value === 'string' ? value.split(',') : value);
  };

  const handleCompare = async () => {
    if (selectedCampaignIds.length < 2) {
      setError('Please select at least 2 campaigns to compare');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await analyticsApi.compareCampaigns(selectedCampaignIds);
      setComparisonData(data);
    } catch (err) {
      setError('Failed to compare campaigns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getComparisonChartData = () => {
    return comparisonData.map((campaign) => ({
      name: campaign.campaignName,
      'Answer Rate': campaign.metrics.answerRate * 100,
      'Conversion Rate': campaign.metrics.conversionRate * 100,
      'Opt-out Rate':
        (campaign.metrics.optOuts / campaign.metrics.totalAttempts) * 100,
    }));
  };

  const getVolumeChartData = () => {
    return comparisonData.map((campaign) => ({
      name: campaign.campaignName,
      Answered: campaign.metrics.answered,
      Busy: campaign.metrics.busy,
      Failed: campaign.metrics.failed,
      Converted: campaign.metrics.converted,
    }));
  };

  const getRadarChartData = () => {
    const metrics = ['Answer Rate', 'Conversion Rate', 'Total Attempts', 'Converted'];
    return metrics.map((metric) => {
      const dataPoint: any = { metric };
      comparisonData.forEach((campaign) => {
        switch (metric) {
          case 'Answer Rate':
            dataPoint[campaign.campaignName] = campaign.metrics.answerRate * 100;
            break;
          case 'Conversion Rate':
            dataPoint[campaign.campaignName] = campaign.metrics.conversionRate * 100;
            break;
          case 'Total Attempts':
            dataPoint[campaign.campaignName] =
              (campaign.metrics.totalAttempts / 1000).toFixed(1);
            break;
          case 'Converted':
            dataPoint[campaign.campaignName] = campaign.metrics.converted;
            break;
        }
      });
      return dataPoint;
    });
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Campaign Comparison
        </Typography>

        {/* Campaign Selection */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <FormControl fullWidth>
                <InputLabel>Select Campaigns to Compare</InputLabel>
                <Select
                  multiple
                  value={selectedCampaignIds}
                  onChange={handleCampaignSelection}
                  label="Select Campaigns to Compare"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((id) => {
                        const campaign = campaigns.find((c) => c.id === id);
                        return (
                          <Chip
                            key={id}
                            label={campaign?.name || id}
                            size="small"
                          />
                        );
                      })}
                    </Box>
                  )}
                >
                  {campaigns.map((campaign) => (
                    <MenuItem key={campaign.id} value={campaign.id}>
                      {campaign.name} ({campaign.type})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<CompareIcon />}
                onClick={handleCompare}
                disabled={loading || selectedCampaignIds.length < 2}
              >
                Compare Campaigns
              </Button>
            </Grid>
          </Grid>

          {selectedCampaignIds.length > 0 && selectedCampaignIds.length < 2 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Select at least 2 campaigns to compare
            </Alert>
          )}
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
        ) : comparisonData.length > 0 ? (
          <>
            {/* Summary Table */}
            <Paper sx={{ mb: 3 }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Campaign</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Total Attempts</TableCell>
                      <TableCell align="right">Answered</TableCell>
                      <TableCell align="right">Answer Rate</TableCell>
                      <TableCell align="right">Converted</TableCell>
                      <TableCell align="right">Conversion Rate</TableCell>
                      <TableCell align="right">Opt-outs</TableCell>
                      <TableCell align="right">Opt-out Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comparisonData.map((campaign) => (
                      <TableRow key={campaign.campaignId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {campaign.campaignName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={campaign.type}
                            size="small"
                            color={
                              campaign.type === 'voice'
                                ? 'primary'
                                : campaign.type === 'sms'
                                ? 'secondary'
                                : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          {campaign.metrics.totalAttempts.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {campaign.metrics.answered.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {(campaign.metrics.answerRate * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell align="right">
                          {campaign.metrics.converted.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {(campaign.metrics.conversionRate * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell align="right">
                          {campaign.metrics.optOuts.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {(
                            (campaign.metrics.optOuts / campaign.metrics.totalAttempts) *
                            100
                          ).toFixed(1)}
                          %
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Performance Metrics Comparison */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance Metrics Comparison
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getComparisonChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="Answer Rate" fill="#0088FE" />
                  <Bar dataKey="Conversion Rate" fill="#00C49F" />
                  <Bar dataKey="Opt-out Rate" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            {/* Call Volume Comparison */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Call Volume Comparison
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getVolumeChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Answered" fill="#82ca9d" />
                  <Bar dataKey="Busy" fill="#ffc658" />
                  <Bar dataKey="Failed" fill="#ff8042" />
                  <Bar dataKey="Converted" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            {/* Radar Chart for Multi-dimensional Comparison */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Multi-dimensional Performance Comparison
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={getRadarChartData()}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis />
                  {comparisonData.map((campaign, idx) => (
                    <Radar
                      key={campaign.campaignId}
                      name={campaign.campaignName}
                      dataKey={campaign.campaignName}
                      stroke={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'][idx]}
                      fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'][idx]}
                      fillOpacity={0.3}
                    />
                  ))}
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </Paper>

            {/* Key Insights */}
            <Grid container spacing={3}>
              {comparisonData.map((campaign) => (
                <Grid item xs={12} md={6} lg={4} key={campaign.campaignId}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {campaign.campaignName}
                      </Typography>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Best Metric:
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {campaign.metrics.answerRate > 0.5
                            ? `High Answer Rate (${(campaign.metrics.answerRate * 100).toFixed(1)}%)`
                            : campaign.metrics.conversionRate > 0.1
                            ? `Good Conversion Rate (${(campaign.metrics.conversionRate * 100).toFixed(1)}%)`
                            : 'High Volume'}
                        </Typography>
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Total Reach:
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {campaign.metrics.totalAttempts.toLocaleString()} contacts
                        </Typography>
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Success Rate:
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {(
                            ((campaign.metrics.answered + campaign.metrics.converted) /
                              campaign.metrics.totalAttempts) *
                            100
                          ).toFixed(1)}
                          %
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        ) : (
          <Paper sx={{ p: 8, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Select campaigns to compare their performance
            </Typography>
          </Paper>
        )}
      </Box>
    </Container>
  );
};
