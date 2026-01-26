import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Mic,
  Stop,
  PlayArrow,
  Pause,
  Delete,
} from '@mui/icons-material';
import { audioApi } from '../api/audio';
import { WavRecorder } from '../utils/audioConverter';

interface AudioRecorderProps {
  onAudioReady: (audioBlob: Blob, audioUrl: string) => void;
  onError?: (error: string) => void;
  maxDurationSeconds?: number;
}

export const AudioRecorder = ({
  onAudioReady,
  onError,
  maxDurationSeconds = 300, // 5 minutes default
}: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [s3Url, setS3Url] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const wavRecorderRef = useRef<WavRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Check for microphone permission on mount
    checkMicrophonePermission();

    return () => {
      // Cleanup on unmount
      stopRecording();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionGranted(true);
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setPermissionGranted(false);
      const errorMessage = 'Microphone permission denied. Please enable microphone access.';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      
      // Create WAV recorder with telephony-optimized settings
      const wavRecorder = new WavRecorder({
        sampleRate: 8000,  // 8kHz for telephony
        numChannels: 1,    // Mono
        bitDepth: 16       // 16-bit PCM
      });
      
      wavRecorderRef.current = wavRecorder;
      
      await wavRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxDurationSeconds) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const stopRecording = async () => {
    if (wavRecorderRef.current && isRecording) {
      try {
        setIsRecording(false);
        setIsPaused(false);

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Get WAV blob from recorder
        const wavBlob = await wavRecorderRef.current.stop();
        const localUrl = URL.createObjectURL(wavBlob);
        setAudioBlob(wavBlob);
        setAudioUrl(localUrl);

        // Upload to S3
        setIsUploading(true);
        try {
          const fileName = `recording-${Date.now()}.wav`;
          console.log('=== AUDIO UPLOAD DEBUG ===');
          console.log('1. Getting presigned URL for:', fileName, wavBlob.type);
          console.log('   WAV Blob size:', wavBlob.size, 'bytes');
          
          const { uploadUrl, audioUrl: s3AudioUrl } = await audioApi.getUploadUrl(fileName, wavBlob.type);
          console.log('2. Got presigned URL:', uploadUrl);
          console.log('3. Expected S3 URL:', s3AudioUrl);
          
          console.log('4. Starting S3 upload...');
          await audioApi.uploadToS3(uploadUrl, wavBlob);
          console.log('5. S3 upload completed successfully!');
          
          setS3Url(s3AudioUrl);
          setIsUploading(false);
          console.log('6. Upload process completed, calling onAudioReady');
          // Return the S3 URL (not the blob URL) to the parent
          onAudioReady(wavBlob, s3AudioUrl);
        } catch (err) {
          console.error('=== UPLOAD ERROR ===');
          console.error('Error uploading recording to S3:', err);
          console.error('Error type:', typeof err);
          console.error('Error constructor:', err?.constructor?.name);
          if (err instanceof Error) {
            console.error('Error message:', err.message);
            console.error('Error stack:', err.stack);
          }
          const errorMessage = err instanceof Error ? err.message : 'Failed to upload recording';
          setError(errorMessage);
          onError?.(errorMessage);
          setIsUploading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    }
  };

  const pauseRecording = () => {
    if (wavRecorderRef.current && isRecording) {
      if (isPaused) {
        wavRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        wavRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const playAudio = () => {
    if (audioUrl && audioPlayerRef.current) {
      if (isPlaying) {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      } else {
        audioPlayerRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setS3Url(null);
    setRecordingTime(0);
    setIsPlaying(false);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecordingProgress = (): number => {
    return (recordingTime / maxDurationSeconds) * 100;
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Record Audio Message
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!permissionGranted && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Microphone access is required for recording. Please grant permission when prompted.
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        {/* Recording Controls */}
        {!audioBlob && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {!isRecording ? (
              <Button
                variant="contained"
                color="primary"
                startIcon={<Mic />}
                onClick={startRecording}
                disabled={!permissionGranted}
              >
                Start Recording
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Stop />}
                  onClick={stopRecording}
                >
                  Stop
                </Button>
                <Button
                  variant="outlined"
                  onClick={pauseRecording}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
              </>
            )}
          </Box>
        )}

        {/* Recording Timer and Progress */}
        {isRecording && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Recording: {formatTime(recordingTime)} / {formatTime(maxDurationSeconds)}
              </Typography>
              <Typography variant="body2" color="error">
                {isPaused && '(Paused)'}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getRecordingProgress()}
              color={recordingTime >= maxDurationSeconds * 0.9 ? 'error' : 'primary'}
            />
          </Box>
        )}

        {/* Audio Player */}
        {audioBlob && audioUrl && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
                <IconButton
                  color="primary"
                  onClick={playAudio}
                  size="large"
                >
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
              </Tooltip>
              <Typography variant="body2">
                Duration: {formatTime(recordingTime)}
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Delete Recording">
                <IconButton
                  color="error"
                  onClick={deleteRecording}
                >
                  <Delete />
                </IconButton>
              </Tooltip>
            </Box>

            <audio
              ref={audioPlayerRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              style={{ width: '100%' }}
              controls
            />

            {isUploading ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                Uploading recording to cloud storage...
              </Alert>
            ) : s3Url ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                Recording uploaded successfully! You can play it back or delete and record again.
                <Typography variant="caption" display="block" sx={{ mt: 1, wordBreak: 'break-all' }}>
                  URL: {s3Url}
                </Typography>
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Recording complete but upload failed. Please try again.
              </Alert>
            )}
          </Box>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary">
        Click "Start Recording" to record your campaign message using your microphone.
        Maximum duration: {Math.floor(maxDurationSeconds / 60)} minutes.
      </Typography>
    </Paper>
  );
};
