import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Stack,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { contactsApi } from '../api/contacts';
import { ImportResult } from '../types';

interface ContactUploadProps {
  campaignId: string;
  onUploadComplete?: (result: ImportResult) => void;
}

export const ContactUpload = ({ campaignId, onUploadComplete }: ContactUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      return 'Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.';
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'File size exceeds 10MB limit.';
    }

    return null;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError('');
    setImportResult(null);
    
    if (acceptedFiles.length === 0) {
      return;
    }

    const file = acceptedFiles[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: false,
    disabled: uploading,
  });

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setUploadProgress(0);

      // Simulate progress (since we don't have real progress from the API)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await contactsApi.uploadContactList(campaignId, selectedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setImportResult(result);
      setSelectedFile(null);
      
      if (onUploadComplete) {
        onUploadComplete(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload contact list';
      setError(message);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImportResult(null);
    setError('');
    setUploadProgress(0);
  };

  return (
    <Box>
      {/* Drag and Drop Area */}
      {!importResult && (
        <Paper
          {...getRootProps()}
          sx={{
            p: 4,
            textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            bgcolor: isDragActive ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: uploading ? 'grey.300' : 'primary.main',
              bgcolor: uploading ? 'background.paper' : 'action.hover',
            },
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          
          {selectedFile ? (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
                <DescriptionIcon color="primary" />
                <Typography variant="body1">{selectedFile.name}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {(selectedFile.size / 1024).toFixed(2)} KB
              </Typography>
              <Button
                variant="text"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                disabled={uploading}
              >
                Choose Different File
              </Button>
            </Box>
          ) : (
            <Box>
              <Typography variant="h6" gutterBottom>
                {isDragActive ? 'Drop the file here' : 'Drag & drop contact list here'}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                or click to browse
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Supported formats: Excel (.xlsx, .xls) or CSV (.csv) • Max size: 10MB
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Upload Button */}
      {selectedFile && !importResult && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleUpload}
            disabled={uploading}
            startIcon={<CloudUploadIcon />}
          >
            {uploading ? 'Uploading...' : 'Upload Contact List'}
          </Button>
        </Box>
      )}

      {/* Upload Progress */}
      {uploading && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Uploading and processing contacts...
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {uploadProgress}% complete
          </Typography>
        </Box>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Import Summary */}
      {importResult && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h6">Upload Complete</Typography>
              <Typography variant="body2" color="text.secondary">
                Contact list has been processed successfully
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>
            Import Summary
          </Typography>

          <List dense>
            <ListItem>
              <ListItemText
                primary="Total Records"
                secondary={importResult.totalRecords.toLocaleString()}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Successfully Imported"
                secondary={importResult.imported.toLocaleString()}
                secondaryTypographyProps={{ color: 'success.main' }}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Duplicates Removed"
                secondary={importResult.duplicates.toLocaleString()}
                secondaryTypographyProps={{ color: 'warning.main' }}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Validation Failures"
                secondary={importResult.failures.toLocaleString()}
                secondaryTypographyProps={{ color: 'error.main' }}
              />
            </ListItem>
          </List>

          {/* Error Details */}
          {importResult.errors && importResult.errors.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" icon={<ErrorIcon />}>
                <Typography variant="subtitle2" gutterBottom>
                  Validation Errors ({importResult.errors.length})
                </Typography>
                <List dense>
                  {importResult.errors.slice(0, 5).map((error, index) => (
                    <ListItem key={index} sx={{ py: 0 }}>
                      <Typography variant="caption">• {error}</Typography>
                    </ListItem>
                  ))}
                  {importResult.errors.length > 5 && (
                    <ListItem sx={{ py: 0 }}>
                      <Typography variant="caption" color="text.secondary">
                        ... and {importResult.errors.length - 5} more errors
                      </Typography>
                    </ListItem>
                  )}
                </List>
              </Alert>
            </Box>
          )}

          {/* Action Buttons */}
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button variant="contained" onClick={handleReset}>
              Upload Another File
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};
