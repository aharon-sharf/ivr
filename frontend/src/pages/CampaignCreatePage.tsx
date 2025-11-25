import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Chip,
} from '@mui/material';
import { useAppDispatch } from '../store/hooks';
import { addCampaign, setError } from '../store/slices/campaignSlice';
import { campaignApi } from '../api/campaigns';
import { CampaignConfig, TimeWindow, IVRFlowDefinition } from '../types';
import { AudioManager } from '../components/AudioManager';
import { IVRFlowBuilder } from '../components/IVRFlowBuilder';

const steps = ['Basic Information', 'Schedule & Time Windows', 'Configuration', 'Review'];

export const CampaignCreatePage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setErrorMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState<CampaignConfig>({
    name: '',
    type: 'voice',
    schedule: {
      startTime: '',
      endTime: '',
      timezone: 'Asia/Jerusalem',
    },
    callingWindows: [
      {
        dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startHour: 9,
        endHour: 20,
      },
    ],
    audioFileUrl: '',
    smsTemplate: '',
    maxConcurrentCalls: 100,
  });

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      setErrorMessage('');
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setErrorMessage('');
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Basic Information
        if (!formData.name.trim()) {
          setErrorMessage('Campaign name is required');
          return false;
        }
        if (!formData.type) {
          setErrorMessage('Campaign type is required');
          return false;
        }
        return true;

      case 1: // Schedule & Time Windows
        if (!formData.schedule.startTime) {
          setErrorMessage('Start time is required');
          return false;
        }
        if (!formData.schedule.endTime) {
          setErrorMessage('End time is required');
          return false;
        }
        if (new Date(formData.schedule.startTime) >= new Date(formData.schedule.endTime)) {
          setErrorMessage('End time must be after start time');
          return false;
        }
        if (formData.callingWindows.length === 0) {
          setErrorMessage('At least one calling window is required');
          return false;
        }
        return true;

      case 2: // Configuration
        if (formData.type === 'voice' || formData.type === 'hybrid') {
          if (!formData.audioFileUrl?.trim()) {
            setErrorMessage('Audio file URL is required for voice campaigns');
            return false;
          }
        }
        if (formData.type === 'sms' || formData.type === 'hybrid') {
          if (!formData.smsTemplate?.trim()) {
            setErrorMessage('SMS template is required for SMS campaigns');
            return false;
          }
        }
        return true;

      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage('');
      const campaign = await campaignApi.createCampaign(formData);
      dispatch(addCampaign(campaign));
      navigate('/campaigns');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create campaign';
      setErrorMessage(message);
      dispatch(setError(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateSchedule = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [field]: value,
      },
    }));
  };

  const updateCallingWindow = (index: number, field: keyof TimeWindow, value: any) => {
    setFormData((prev) => {
      const windows = [...prev.callingWindows];
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
    setFormData((prev) => ({
      ...prev,
      callingWindows: [
        ...prev.callingWindows,
        {
          dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startHour: 9,
          endHour: 20,
        },
      ],
    }));
  };

  const removeCallingWindow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      callingWindows: prev.callingWindows.filter((_, i) => i !== index),
    }));
  };

  const getDayName = (day: number): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day];
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Basic Information
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Campaign Name"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Campaign Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Campaign Type"
                  onChange={(e) => updateFormData('type', e.target.value)}
                >
                  <MenuItem value="voice">Voice Only</MenuItem>
                  <MenuItem value="sms">SMS Only</MenuItem>
                  <MenuItem value="hybrid">Hybrid (Voice + SMS)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                {formData.type === 'voice' && 'Voice campaigns deliver pre-recorded messages via phone calls.'}
                {formData.type === 'sms' && 'SMS campaigns send text messages to recipients.'}
                {formData.type === 'hybrid' && 'Hybrid campaigns use both voice calls and SMS messages.'}
              </Typography>
            </Grid>
          </Grid>
        );

      case 1: // Schedule & Time Windows
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Campaign Schedule
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Start Time"
                type="datetime-local"
                value={formData.schedule.startTime}
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
                value={formData.schedule.endTime}
                onChange={(e) => updateSchedule('endTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={formData.schedule.timezone}
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

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Typography variant="h6">Calling Windows</Typography>
                <Button variant="outlined" size="small" onClick={addCallingWindow}>
                  Add Window
                </Button>
              </Box>
            </Grid>

            {formData.callingWindows.map((window, index) => (
              <Grid item xs={12} key={index}>
                <Paper sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2">Window {index + 1}</Typography>
                        {formData.callingWindows.length > 1 && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => removeCallingWindow(index)}
                          >
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
                                ? window.dayOfWeek.filter((d) => d !== day)
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
          </Grid>
        );

      case 2: // Configuration
        return (
          <Grid container spacing={3}>
            {(formData.type === 'voice' || formData.type === 'hybrid') && (
              <>
                <Grid item xs={12}>
                  <AudioManager
                    onAudioSelected={(audioUrl, audioSource) => {
                      updateFormData('audioFileUrl', audioUrl);
                      console.log('Audio selected from:', audioSource);
                    }}
                    currentAudioUrl={formData.audioFileUrl}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    IVR Flow Configuration
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Design the interactive voice response flow for your campaign. Add nodes to play audio,
                    capture DTMF input, and trigger actions based on user responses.
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <IVRFlowBuilder
                    initialFlow={formData.ivrFlow}
                    onFlowChange={(flow: IVRFlowDefinition) => {
                      updateFormData('ivrFlow', flow);
                    }}
                    onSave={(flow: IVRFlowDefinition) => {
                      updateFormData('ivrFlow', flow);
                    }}
                  />
                </Grid>
              </>
            )}

            {(formData.type === 'sms' || formData.type === 'hybrid') && (
              <>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    SMS Configuration
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="SMS Template"
                    value={formData.smsTemplate}
                    onChange={(e) => updateFormData('smsTemplate', e.target.value)}
                    placeholder="Hello {{name}}, this is a message from our campaign..."
                    helperText="Use {{variable}} for dynamic content"
                    required
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Advanced Settings
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Max Concurrent Calls"
                type="number"
                value={formData.maxConcurrentCalls}
                onChange={(e) => updateFormData('maxConcurrentCalls', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 1000 }}
                helperText="Maximum number of simultaneous calls"
              />
            </Grid>
          </Grid>
        );

      case 3: // Review
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Review Campaign Details
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Basic Information
                </Typography>
                <Typography variant="body2">Name: {formData.name}</Typography>
                <Typography variant="body2">Type: {formData.type.toUpperCase()}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Schedule
                </Typography>
                <Typography variant="body2">
                  Start: {new Date(formData.schedule.startTime).toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  End: {new Date(formData.schedule.endTime).toLocaleString()}
                </Typography>
                <Typography variant="body2">Timezone: {formData.schedule.timezone}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Calling Windows
                </Typography>
                {formData.callingWindows.map((window, index) => (
                  <Typography key={index} variant="body2">
                    Window {index + 1}: {window.dayOfWeek.map(getDayName).join(', ')} from{' '}
                    {window.startHour}:00 to {window.endHour}:00
                  </Typography>
                ))}
              </Paper>
            </Grid>
            {formData.audioFileUrl && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Voice Configuration
                  </Typography>
                  <Typography variant="body2">Audio URL: {formData.audioFileUrl}</Typography>
                  {formData.ivrFlow && formData.ivrFlow.nodes && formData.ivrFlow.nodes.length > 0 && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      IVR Flow: {formData.ivrFlow.nodes.length} node(s) configured
                    </Typography>
                  )}
                </Paper>
              </Grid>
            )}
            {formData.smsTemplate && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    SMS Configuration
                  </Typography>
                  <Typography variant="body2">Template: {formData.smsTemplate}</Typography>
                </Paper>
              </Grid>
            )}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Advanced Settings
                </Typography>
                <Typography variant="body2">
                  Max Concurrent Calls: {formData.maxConcurrentCalls}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Campaign
        </Typography>

        <Paper sx={{ p: 3, mt: 3 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 4 }}>{renderStepContent(activeStep)}</Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => navigate('/campaigns')} disabled={isSubmitting}>
              Cancel
            </Button>
            <Box>
              <Button disabled={activeStep === 0 || isSubmitting} onClick={handleBack} sx={{ mr: 1 }}>
                Back
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Campaign'}
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext}>
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};
