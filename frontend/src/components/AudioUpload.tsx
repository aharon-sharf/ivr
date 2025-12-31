import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  CloudUpload,
  PlayArrow,
  Pause,
  Delete,
  CheckCircle,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { audioApi } from '../api/audio';

interface AudioUploadProps {
  onAudioReady: (file: File, audioUrl: string) => void;
  onError?: (error: string) => void;
  maxSizeMB?: number;
  acceptedFormats?: string[];
}

export const AudioUpload = ({
  onAudioReady,
  onError,
  maxSizeMB = 10,
  acceptedFormats = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
}: AudioUploadProps) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [s3Url, setS3Url] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      return `File size exceeds ${maxSizeMB}MB limit. Current size: ${fileSizeMB.toFixed(2)}MB`;
    }

    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file format. Accepted formats: ${acceptedFormats.join(', ')}`;
    }

    return null;
  };

  const handleFileDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      return;
    }

    const file = acceptedFiles[0];
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned URL from backend
      setUploadProgress(10);
      const { uploadUrl, audioUrl: s3AudioUrl } = await audioApi.getUploadUrl(file.name, file.type);
      
      // Step 2: Upload file to S3
      setUploadProgress(30);
      await audioApi.uploadToS3(uploadUrl, file);
      
      setUploadProgress(100);
      
      // Create local URL for preview playback
      const localPreviewUrl = URL.createObjectURL(file);
      
      setUploadedFile(file);
      setAudioUrl(localPreviewUrl);
      setS3Url(s3AudioUrl);
      setIsUploading(false);
      
      // Return the S3 URL (not the blob URL) to the parent
      onAudioReady(file, s3AudioUrl);
    } catch (err) {
      console.error('Error uploading audio file:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload audio file';
      setError(errorMessage);
      onError?.(errorMessage);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.ogg', '.webm'],
    },
    maxFiles: 1,
    multiple: false,
  });

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

  const deleteFile = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setUploadedFile(null);
    setAudioUrl(null);
    setS3Url(null);
    setIsPlaying(false);
    setUploadProgress(0);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Upload Audio File
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!uploadedFile && (
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.400',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
        >
          <input {...getInputProps()} />
          <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="body1" gutterBottom>
            {isDragActive
              ? 'Drop the audio file here'
              : 'Drag and drop an audio file here, or click to select'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supported formats: MP3, WAV, OGG, WebM
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Maximum file size: {maxSizeMB}MB
          </Typography>
        </Box>
      )}

      {isUploading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Uploading...
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      {uploadedFile && audioUrl && !isUploading && (
        <Box sx={{ mt: 2 }}>
          <List>
            <ListItem>
              <CheckCircle color="success" sx={{ mr: 2 }} />
              <ListItemText
                primary={uploadedFile.name}
                secondary={`Size: ${formatFileSize(uploadedFile.size)} | Type: ${uploadedFile.type}`}
              />
              <ListItemSecondaryAction>
                <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
                  <IconButton edge="end" onClick={playAudio} sx={{ mr: 1 }}>
                    {isPlaying ? <Pause /> : <PlayArrow />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton edge="end" onClick={deleteFile} color="error">
                    <Delete />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          </List>

          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            style={{ width: '100%', marginTop: '16px' }}
            controls
          />

          <Alert severity="success" sx={{ mt: 2 }}>
            File uploaded successfully to cloud storage! You can play it back or delete and upload a different file.
            {s3Url && (
              <Typography variant="caption" display="block" sx={{ mt: 1, wordBreak: 'break-all' }}>
                URL: {s3Url}
              </Typography>
            )}
          </Alert>
        </Box>
      )}
    </Paper>
  );
};
