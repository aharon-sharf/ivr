import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { ContactUpload } from '../components/ContactUpload';
import { ImportResult } from '../types';

export const ContactUploadPage = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();

  if (!campaignId) {
    return (
      <Container maxWidth="md">
        <Box sx={{ py: 4 }}>
          <Typography variant="h5" color="error">
            Campaign ID is required
          </Typography>
        </Box>
      </Container>
    );
  }

  const handleUploadComplete = (result: ImportResult) => {
    console.log('Upload complete:', result);
    // You can add additional logic here, such as showing a success notification
    // or automatically navigating to the campaign detail page after a delay
  };

  const handleBackToCampaign = () => {
    navigate(`/campaigns/${campaignId}`);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/campaigns')}
            sx={{ cursor: 'pointer' }}
          >
            Campaigns
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={handleBackToCampaign}
            sx={{ cursor: 'pointer' }}
          >
            Campaign Details
          </Link>
          <Typography variant="body2" color="text.primary">
            Upload Contacts
          </Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToCampaign}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h4" component="h1">
            Upload Contact List
          </Typography>
        </Box>

        {/* Instructions */}
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.lighter' }}>
          <Typography variant="h6" gutterBottom>
            Instructions
          </Typography>
          <Typography variant="body2" component="div">
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Upload an Excel (.xlsx, .xls) or CSV (.csv) file containing contact information</li>
              <li>The file should include phone numbers in E.164 format (e.g., +972501234567)</li>
              <li>Additional columns can include: name, email, custom metadata</li>
              <li>Duplicate phone numbers will be automatically merged</li>
              <li>Invalid phone numbers will be reported in the import summary</li>
            </ul>
          </Typography>
        </Paper>

        {/* Upload Component */}
        <ContactUpload
          campaignId={campaignId}
          onUploadComplete={handleUploadComplete}
        />
      </Box>
    </Container>
  );
};
