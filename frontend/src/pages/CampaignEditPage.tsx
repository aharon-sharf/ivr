import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { useAppDispatch } from '../store/hooks';
import { updateCampaign as updateCampaignAction, setError } from '../store/slices/campaignSlice';
import { campaignApi } from '../api/campaigns';
import { Campaign, TimeWindow } from '../types';

export const CampaignEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setErrorMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (id) {
      loadCampaign(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadCampaign = async (campaignId: string) => {
    try {
      setIsLoading(true);
      const data = await campaignApi.getCampaign(campaignId);
      setCampaign(data);
      setFormData({
        name: data.name,
        type: data.type,
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        timezone: data.timezone || 'UTC',
        ...data.config,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load campaign';
      setErrorMessage(message);
      dispatch(setError(message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaign || !id) return;

    // Validation
    if (!formData.name?.trim()) {
      setErrorMessage('Campaign name is required');
      return;
    }

    if (!formData.startTime || !formData.endTime) {
      setErrorMessage('Start and end times are required');
      return;
    }

    if (new Date(formData.startTime) >= new Date(formData.endTime)) {
      setErrorMessage('End time must be after start time');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const updatePayload = {
        name: formData.name,
        type: formData.type,
        config: {
          audioFileUrl: formData.audioFileUrl,
          smsTemplate: formData.smsTemplate,
          ivrFlow: formData.ivrFlow,
          callingWindows: formData.callingWindows,
          maxConcurrentCalls: formData.maxConcurrentCalls,
        },
        startTime: formData.startTime,
        endTime: formData.endTime,
        timezone: formData.timezone,
      };
      const updated = await campaignApi.updateCampaign(id, updatePayload as any);
      dispatch(updateCampaignAction(updated));
      navigate(`/campaigns/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update campaign';
      setErrorMessage(message);
      dispatch(setError(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: unknown) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateSchedule = (field: string, value: unknown) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateCallingWindow = (index: number, field: keyof TimeWindow, value: unknown) => {
    setFormData((prev: any) => {
      const windows = [...(prev.callingWindows || [])];
      windows[index] = {
        ...windows[index],
        [field]: value,
      };
      return {
        ...prev,
        callingWindows: windows,
      };
    });
  };

  const addCallingWindow = () => {
    setFormData((prev: any) => ({
      ...prev,
      callingWindows: [
        ...(prev.callingWindows || []),
        {
          dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startHour: 9,
          endHour: 20,
        },
      ],
    }));
  };

  const removeCallingWindow = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      callingWindows: (prev.callingWindows || []).filter((_: any, i: number) => i !== index),
    }));
  };

  const getDayName = (day: number): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day];
  };

  if (isLoading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!campaign) {
    return (
      <Container maxWidth="md">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">Campaign not found</Alert>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/campaigns')} sx={{ mt: 2 }}>
            Back to Campaigns
          </Button>
        </Box>
      </Container>
    );
  }

  if (campaign.status === 'active' || campaign.status === 'completed') {
    return (
      <Container maxWidth="md">
        <Box sx={{ py: 4 }}>
          <Alert severity="warning">
            Cannot edit {campaign.status} campaigns. Please pause or wait for completion.
          </Alert>
          <Button startIcon={<BackIcon />} onClick={() => navigate(`/campaigns/${id}`)} sx={{ mt: 2 }}>
            Back to Campaign
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(`/campaigns/${id}`)} sx={{ mb: 2 }}>
          Back to Campaign
        </Button>

        <Typography variant="h4" component="h1" gutterBottom>
          Edit Campaign
        </Typography>

        <Paper sx={{ p: 3, mt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Campaign Name"
                  value={formData.name || ''}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth disabled>
                  <InputLabel>Campaign Type</InputLabel>
                  <Select value={formData.type || 'voice'} label="Campaign Type">
                    <MenuItem value="voice">Voice Only</MenuItem>
                    <MenuItem value="sms">SMS Only</MenuItem>
                    <MenuItem value="hybrid">Hybrid (Voice + SMS)</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary">
                  Campaign type cannot be changed after creation
                </Typography>
              </Grid>

              {/* Schedule */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Schedule
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Start Time"
                  type="datetime-local"
                  value={formData.startTime || ''}
                  onChange={(e) => updateSchedule('startTime', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="End Time"
                  type="datetime-local"
                  value={formData.endTime || ''}
                  onChange={(e) => updateSchedule('endTime', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Timezone</InputLabel>
                  <Select
                    value={formData.timezone || 'Asia/Jerusalem'}
                    label="Timezone"
                    onChange={(e) => updateSchedule('timezone', e.target.value)}
                  >
                    <MenuItem value="Asia/Jerusalem">Asia/Jerusalem (Israel)</MenuItem>
                    <MenuItem value="UTC">UTC</MenuItem>
                    <MenuItem value="America/New_York">America/New_York</MenuItem>
                    <MenuItem value="Europe/London">Europe/London</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Calling Windows */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Typography variant="h6">Calling Windows</Typography>
                  <Button variant="outlined" size="small" onClick={addCallingWindow}>
                    Add Window
                  </Button>
                </Box>
              </Grid>

              {(formData.callingWindows || []).map((window: any, index: number) => (
                <Grid item xs={12} key={index}>
                  <Paper sx={{ p: 2 }} variant="outlined">
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle2">Window {index + 1}</Typography>
                          {(formData.callingWindows?.length || 0) > 1 && (
                            <Button size="small" color="error" onClick={() => removeCallingWindow(index)}>
                              Remove
                            </Button>
                          )}
                        </Box>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" gutterBottom>
                          Days of Week
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                            <Chip
                              key={day}
                              label={getDayName(day)}
                              onClick={() => {
                                const days = window.dayOfWeek.includes(day)
                                  ? window.dayOfWeek.filter((d: number) => d !== day)
                                  : [...window.dayOfWeek, day].sort();
                                updateCallingWindow(index, 'dayOfWeek', days);
                              }}
                              color={window.dayOfWeek.includes(day) ? 'primary' : 'default'}
                              variant={window.dayOfWeek.includes(day) ? 'filled' : 'outlined'}
                            />
                          ))}
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Start Hour"
                          type="number"
                          value={window.startHour}
                          onChange={(e) => updateCallingWindow(index, 'startHour', parseInt(e.target.value))}
                          inputProps={{ min: 0, max: 23 }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="End Hour"
                          type="number"
                          value={window.endHour}
                          onChange={(e) => updateCallingWindow(index, 'endHour', parseInt(e.target.value))}
                          inputProps={{ min: 0, max: 23 }}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}

              {/* Voice Configuration */}
              {(formData.type === 'voice' || formData.type === 'hybrid') && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                      Voice Configuration
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Audio File URL"
                      value={formData.audioFileUrl || ''}
                      onChange={(e) => updateFormData('audioFileUrl', e.target.value)}
                      placeholder="https://example.com/audio/message.mp3"
                      helperText="URL to the pre-recorded audio message"
                    />
                  </Grid>
                </>
              )}

              {/* SMS Configuration */}
              {(formData.type === 'sms' || formData.type === 'hybrid') && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                      SMS Configuration
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="SMS Template"
                      value={formData.smsTemplate || ''}
                      onChange={(e) => updateFormData('smsTemplate', e.target.value)}
                      placeholder="Hello {{name}}, this is a message from our campaign..."
                      helperText="Use {{variable}} for dynamic content"
                    />
                  </Grid>
                </>
              )}

              {/* Advanced Settings */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Advanced Settings
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Max Concurrent Calls"
                  type="number"
                  value={formData.maxConcurrentCalls || 100}
                  onChange={(e) => updateFormData('maxConcurrentCalls', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 1000 }}
                  helperText="Maximum number of simultaneous calls"
                />
              </Grid>

              {/* Actions */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                  <Button onClick={() => navigate(`/campaigns/${id}`)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};
