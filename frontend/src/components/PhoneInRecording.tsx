import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Phone,
  FiberManualRecord,
  Stop,
  CheckCircle,
  Info,
} from '@mui/icons-material';

interface PhoneInRecordingProps {
  phoneNumber?: string;
  recordingId?: string;
  onRecordingComplete?: (recordingId: string) => void;
}

export const PhoneInRecording = ({
  phoneNumber = '+972-3-123-4567',
  onRecordingComplete,
}: PhoneInRecordingProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCompleted, setRecordingCompleted] = useState(false);

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingCompleted(false);
    
    // Simulate recording completion after user calls
    // In real implementation, this would be triggered by backend webhook
    setTimeout(() => {
      setIsRecording(false);
      setRecordingCompleted(true);
      const newRecordingId = `recording-${Date.now()}`;
      onRecordingComplete?.(newRecordingId);
    }, 5000);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Phone-In Recording
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Record your campaign message by calling our recording line. This option is ideal for
          high-quality recordings or if you prefer using a phone.
        </Typography>
      </Alert>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
          Recording Phone Number
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            bgcolor: 'primary.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'primary.200',
          }}
        >
          <Phone color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" color="primary.main" fontWeight="bold">
            {phoneNumber}
          </Typography>
          <Chip
            label="Available 24/7"
            color="success"
            size="small"
            sx={{ ml: 'auto' }}
          />
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
        Recording Instructions
      </Typography>

      <List>
        <ListItem>
          <ListItemIcon>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              1
            </Box>
          </ListItemIcon>
          <ListItemText
            primary="Call the recording number"
            secondary={`Dial ${phoneNumber} from any phone`}
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              2
            </Box>
          </ListItemIcon>
          <ListItemText
            primary="Enter your campaign ID"
            secondary="You will be prompted to enter your unique campaign identifier"
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              3
            </Box>
          </ListItemIcon>
          <ListItemText
            primary="Wait for the beep"
            secondary="After the beep, start recording your message"
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              4
            </Box>
          </ListItemIcon>
          <ListItemText
            primary="Record your message"
            secondary="Speak clearly and at a normal pace. Maximum duration: 5 minutes"
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              5
            </Box>
          </ListItemIcon>
          <ListItemText
            primary="Press # to finish"
            secondary="Press the pound key (#) when you're done recording"
          />
        </ListItem>

        <ListItem>
          <ListItemIcon>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              6
            </Box>
          </ListItemIcon>
          <ListItemText
            primary="Review and confirm"
            secondary="Listen to your recording and press 1 to accept or 2 to re-record"
          />
        </ListItem>
      </List>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {!isRecording && !recordingCompleted && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<FiberManualRecord />}
            onClick={handleStartRecording}
          >
            I'm Ready to Call
          </Button>
        )}

        {isRecording && (
          <>
            <Alert severity="warning" sx={{ flex: 1 }}>
              <Typography variant="body2">
                Waiting for your recording... Please call {phoneNumber} now.
              </Typography>
            </Alert>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Stop />}
              onClick={() => setIsRecording(false)}
            >
              Cancel
            </Button>
          </>
        )}

        {recordingCompleted && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ flex: 1 }}>
            <Typography variant="body2">
              Recording received successfully! Your audio will appear in the dashboard shortly.
            </Typography>
          </Alert>
        )}
      </Box>

      <Alert severity="info" icon={<Info />} sx={{ mt: 3 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          Tips for a great recording:
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Find a quiet location with minimal background noise</li>
            <li>Speak clearly and at a moderate pace</li>
            <li>Hold the phone close to your mouth for best quality</li>
            <li>Avoid using speakerphone if possible</li>
            <li>Practice your message before recording</li>
          </ul>
        </Typography>
      </Alert>
    </Paper>
  );
};
