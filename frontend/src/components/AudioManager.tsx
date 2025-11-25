import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import {
  Mic,
  CloudUpload,
  Phone,
  LibraryMusic,
} from '@mui/icons-material';
import { AudioRecorder } from './AudioRecorder';
import { AudioUpload } from './AudioUpload';
import { PhoneInRecording } from './PhoneInRecording';
import { AudioLibrary } from './AudioLibrary';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`audio-tabpanel-${index}`}
      aria-labelledby={`audio-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface AudioManagerProps {
  onAudioSelected: (audioUrl: string, audioSource: string) => void;
  currentAudioUrl?: string;
}

export const AudioManager = ({ onAudioSelected, currentAudioUrl }: AudioManagerProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedAudio, setSelectedAudio] = useState<{
    url: string;
    source: string;
  } | null>(currentAudioUrl ? { url: currentAudioUrl, source: 'existing' } : null);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleRecordingReady = (_audioBlob: Blob, audioUrl: string) => {
    setSelectedAudio({ url: audioUrl, source: 'recording' });
    onAudioSelected(audioUrl, 'recording');
  };

  const handleUploadReady = (_file: File, audioUrl: string) => {
    setSelectedAudio({ url: audioUrl, source: 'upload' });
    onAudioSelected(audioUrl, 'upload');
  };

  const handlePhoneRecordingComplete = (recordingId: string) => {
    const audioUrl = `/api/recordings/${recordingId}`;
    setSelectedAudio({ url: audioUrl, source: 'phone' });
    onAudioSelected(audioUrl, 'phone');
  };

  const handleLibrarySelect = (audio: any) => {
    setSelectedAudio({ url: audio.url, source: 'library' });
    onAudioSelected(audio.url, 'library');
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Audio Recording & Upload
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Choose how you want to provide your campaign audio message. You can record directly in your
        browser, upload a file, call our recording line, or select from your audio library.
      </Typography>

      {selectedAudio && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Audio selected from: {selectedAudio.source}. You can change it by selecting a different
          option below.
        </Alert>
      )}

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="audio recording options"
          variant="fullWidth"
        >
          <Tab icon={<Mic />} label="Record" iconPosition="start" />
          <Tab icon={<CloudUpload />} label="Upload" iconPosition="start" />
          <Tab icon={<Phone />} label="Phone-In" iconPosition="start" />
          <Tab icon={<LibraryMusic />} label="Library" iconPosition="start" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <AudioRecorder
            onAudioReady={handleRecordingReady}
            onError={(error) => console.error('Recording error:', error)}
            maxDurationSeconds={300}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <AudioUpload
            onAudioReady={handleUploadReady}
            onError={(error) => console.error('Upload error:', error)}
            maxSizeMB={10}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <PhoneInRecording
            phoneNumber="+972-3-123-4567"
            onRecordingComplete={handlePhoneRecordingComplete}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <AudioLibrary
            onSelectAudio={handleLibrarySelect}
            selectedAudioId={
              selectedAudio?.source === 'library' ? selectedAudio.url : undefined
            }
          />
        </TabPanel>
      </Paper>
    </Box>
  );
};
