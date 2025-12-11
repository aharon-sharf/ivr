import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Upload as UploadIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useAppDispatch } from '../store/hooks';
import { setSelectedCampaign, setError, removeCampaign, updateCampaign } from '../store/slices/campaignSlice';
import { campaignApi } from '../api/campaigns';
import { Campaign } from '../types';
import { format } from 'date-fns';

export const CampaignDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setErrorMessage] = useState('');

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
      dispatch(setSelectedCampaign(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load campaign';
      setErrorMessage(message);
      dispatch(setError(message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!campaign || !window.confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      await campaignApi.deleteCampaign(campaign.id);
      dispatch(removeCampaign(campaign.id));
      navigate('/campaigns');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete campaign';
      setErrorMessage(message);
      dispatch(setError(message));
    }
  };

  const handlePause = async () => {
    if (!campaign) return;

    try {
      const updated = await campaignApi.pauseCampaign(campaign.id);
      setCampaign(updated);
      dispatch(updateCampaign(updated));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pause campaign';
      setErrorMessage(message);
      dispatch(setError(message));
    }
  };

  const handleResume = async () => {
    if (!campaign) return;

    try {
      const updated = await campaignApi.resumeCampaign(campaign.id);
      setCampaign(updated);
      dispatch(updateCampaign(updated));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume campaign';
      setErrorMessage(message);
      dispatch(setError(message));
    }
  };

  const handleStart = async () => {
    if (!campaign) return;

    try {
      const updated = await campaignApi.startCampaign(campaign.id);
      setCampaign(updated);
      dispatch(updateCampaign(updated));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start campaign';
      setErrorMessage(message);
      dispatch(setError(message));
    }
  };

  const handleSchedule = async () => {
    if (!campaign) return;

    try {
      const updated = await campaignApi.scheduleCampaign(campaign.id);
      setCampaign(updated);
      dispatch(updateCampaign(updated));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule campaign';
      setErrorMessage(message);
      dispatch(setError(message));
    }
  };

  const getStatusColor = (status: Campaign['status']) => {
    const colors: Record<Campaign['status'], 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
      draft: 'default',
      scheduled: 'primary',
      active: 'success',
      paused: 'warning',
      completed: 'default',
      cancelled: 'error',
    };
    return colors[status];
  };

  const getTypeColor = (type: Campaign['type']) => {
    const colors: Record<Campaign['type'], 'primary' | 'secondary' | 'info'> = {
      voice: 'primary',
      sms: 'secondary',
      hybrid: 'info',
    };
    return colors[type];
  };

  const getDayName = (day: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!campaign) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">Campaign not found</Alert>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/campaigns')} sx={{ mt: 2 }}>
            Back to Campaigns
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/campaigns')} sx={{ mb: 2 }}>
            Back to Campaigns
          </Button>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                {campaign.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label={campaign.type.toUpperCase()} color={getTypeColor(campaign.type)} />
                <Chip label={campaign.status.toUpperCase()} color={getStatusColor(campaign.status)} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {campaign.status === 'draft' && (
                <>
                  <Button variant="contained" startIcon={<PlayIcon />} onClick={handleStart} color="primary">
                    Start Now
                  </Button>
                  <Button variant="outlined" startIcon={<ScheduleIcon />} onClick={handleSchedule} color="secondary">
                    Schedule
                  </Button>
                </>
              )}
              {campaign.status === 'active' && (
                <Button variant="outlined" startIcon={<PauseIcon />} onClick={handlePause}>
                  Pause
                </Button>
              )}
              {campaign.status === 'paused' && (
                <Button variant="outlined" startIcon={<PlayIcon />} onClick={handleResume}>
                  Resume
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
                disabled={campaign.status === 'active' || campaign.status === 'completed'}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                disabled={campaign.status === 'active'}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrorMessage('')}>
            {error}
          </Alert>
        )}

        {/* Contact Management */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Contact Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload and manage contact lists for this campaign
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => navigate(`/campaigns/${campaign.id}/contacts/upload`)}
            >
              Upload Contacts
            </Button>
          </Box>
        </Paper>

        {/* Campaign Details */}
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Campaign ID
                    </Typography>
                    <Typography variant="body1">{campaign.id}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Created By
                    </Typography>
                    <Typography variant="body1">{campaign.createdBy}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Created At
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(campaign.createdAt), 'PPpp')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Last Updated
                    </Typography>
                    <Typography variant="body1">
                      {format(new Date(campaign.updatedAt), 'PPpp')}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Schedule */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Schedule
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Start Time
                    </Typography>
                    <Typography variant="body1">
                      {campaign.startTime ? format(new Date(campaign.startTime), 'PPpp') : 'Not set'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      End Time
                    </Typography>
                    <Typography variant="body1">
                      {campaign.endTime ? format(new Date(campaign.endTime), 'PPpp') : 'Not set'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Timezone
                    </Typography>
                    <Typography variant="body1">{campaign.timezone || 'UTC'}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Calling Windows */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Calling Windows
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {campaign.config.callingWindows.map((window, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Window {index + 1}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Days: {window.dayOfWeek.map(getDayName).join(', ')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Hours: {window.startHour}:00 - {window.endHour}:00
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Voice Configuration */}
          {(campaign.type === 'voice' || campaign.type === 'hybrid') && campaign.config.audioFileUrl && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Voice Configuration
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Audio File URL
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: 'break-all',
                        color: 'primary.main',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                      onClick={() => window.open(campaign.config.audioFileUrl, '_blank')}
                    >
                      {campaign.config.audioFileUrl}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* SMS Configuration */}
          {(campaign.type === 'sms' || campaign.type === 'hybrid') && campaign.config.smsTemplate && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    SMS Configuration
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      SMS Template
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {campaign.config.smsTemplate}
                      </Typography>
                    </Paper>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Advanced Settings */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Advanced Settings
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Max Concurrent Calls
                  </Typography>
                  <Typography variant="body1">
                    {campaign.config.maxConcurrentCalls || 'Not set'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};
