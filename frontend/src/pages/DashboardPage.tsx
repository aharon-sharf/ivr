import { Box, Container, Typography, Button, Paper, Grid, Card, CardContent, CardActions } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Campaign as CampaignIcon, Assessment as AnalyticsIcon, Block as BlacklistIcon } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';

export const DashboardPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Dashboard
          </Typography>
          <Button variant="outlined" onClick={handleSignOut}>
            Sign Out
          </Button>
        </Box>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Welcome, {user?.name}!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Email: {user?.email}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Role: {user?.role}
          </Typography>
        </Paper>

        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Quick Actions
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CampaignIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                  <Typography variant="h6">Campaigns</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Create and manage voice and SMS campaigns. Monitor campaign progress and performance.
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/campaigns')}>
                  View Campaigns
                </Button>
                <Button size="small" variant="contained" onClick={() => navigate('/campaigns/create')}>
                  Create New
                </Button>
              </CardActions>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AnalyticsIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                  <Typography variant="h6">Analytics</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  View real-time metrics, campaign reports, and performance analytics.
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/analytics/realtime')}>
                  Real-Time
                </Button>
                <Button size="small" onClick={() => navigate('/analytics')}>
                  Historical
                </Button>
                <Button size="small" onClick={() => navigate('/analytics/comparison')}>
                  Compare
                </Button>
              </CardActions>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BlacklistIcon sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                  <Typography variant="h6">Blacklist</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Manage Do-Not-Call list and opt-out requests to ensure compliance.
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/blacklist')}>
                  Manage Blacklist
                </Button>
              </CardActions>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};
