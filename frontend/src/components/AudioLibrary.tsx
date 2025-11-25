import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Delete,
  Edit,
  Add,
  CheckCircle,
  AudioFile,
} from '@mui/icons-material';

interface AudioItem {
  id: string;
  name: string;
  description?: string;
  url: string;
  duration: number;
  size: number;
  createdAt: Date;
  tags?: string[];
}

interface AudioLibraryProps {
  onSelectAudio: (audio: AudioItem) => void;
  selectedAudioId?: string;
}

export const AudioLibrary = ({ onSelectAudio, selectedAudioId }: AudioLibraryProps) => {
  // Mock data - in real implementation, this would come from API
  const [audioItems, setAudioItems] = useState<AudioItem[]>([
    {
      id: '1',
      name: 'Welcome Message',
      description: 'Standard welcome greeting for campaigns',
      url: '/audio/welcome.mp3',
      duration: 45,
      size: 720000,
      createdAt: new Date('2024-01-15'),
      tags: ['greeting', 'welcome'],
    },
    {
      id: '2',
      name: 'Donation Request',
      description: 'Request for campaign donations',
      url: '/audio/donation.mp3',
      duration: 60,
      size: 960000,
      createdAt: new Date('2024-01-20'),
      tags: ['donation', 'fundraising'],
    },
    {
      id: '3',
      name: 'Event Reminder',
      description: 'Reminder about upcoming event',
      url: '/audio/event.mp3',
      duration: 30,
      size: 480000,
      createdAt: new Date('2024-02-01'),
      tags: ['event', 'reminder'],
    },
  ]);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<AudioItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [audioToDelete, setAudioToDelete] = useState<AudioItem | null>(null);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePlayPause = (audio: AudioItem) => {
    if (playingId === audio.id) {
      audioPlayerRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audio.url;
        audioPlayerRef.current.play();
        setPlayingId(audio.id);
      }
    }
  };

  const handleSelect = (audio: AudioItem) => {
    onSelectAudio(audio);
  };

  const handleEdit = (audio: AudioItem) => {
    setEditingAudio(audio);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingAudio) {
      setAudioItems((prev) =>
        prev.map((item) => (item.id === editingAudio.id ? editingAudio : item))
      );
      setEditDialogOpen(false);
      setEditingAudio(null);
    }
  };

  const handleDeleteClick = (audio: AudioItem) => {
    setAudioToDelete(audio);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (audioToDelete) {
      setAudioItems((prev) => prev.filter((item) => item.id !== audioToDelete.id));
      setDeleteConfirmOpen(false);
      setAudioToDelete(null);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Audio Library</Typography>
        <Button variant="outlined" startIcon={<Add />} size="small">
          Add to Library
        </Button>
      </Box>

      {audioItems.length === 0 ? (
        <Alert severity="info">
          No audio files in your library yet. Record or upload audio to get started.
        </Alert>
      ) : (
        <List>
          {audioItems.map((audio) => (
            <ListItem
              key={audio.id}
              sx={{
                border: '1px solid',
                borderColor: selectedAudioId === audio.id ? 'primary.main' : 'divider',
                borderRadius: 1,
                mb: 1,
                bgcolor: selectedAudioId === audio.id ? 'primary.50' : 'background.paper',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <AudioFile sx={{ mr: 2, color: 'primary.main' }} />
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">{audio.name}</Typography>
                    {selectedAudioId === audio.id && (
                      <CheckCircle color="primary" fontSize="small" />
                    )}
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {audio.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={formatDuration(audio.duration)} size="small" />
                      <Chip label={formatFileSize(audio.size)} size="small" />
                      <Chip label={formatDate(audio.createdAt)} size="small" />
                      {audio.tags?.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title={playingId === audio.id ? 'Pause' : 'Play'}>
                    <IconButton
                      edge="end"
                      onClick={() => handlePlayPause(audio)}
                      size="small"
                    >
                      {playingId === audio.id ? <Pause /> : <PlayArrow />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Use this audio">
                    <Button
                      size="small"
                      variant={selectedAudioId === audio.id ? 'contained' : 'outlined'}
                      onClick={() => handleSelect(audio)}
                    >
                      {selectedAudioId === audio.id ? 'Selected' : 'Select'}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton edge="end" onClick={() => handleEdit(audio)} size="small">
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteClick(audio)}
                      color="error"
                      size="small"
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {/* Hidden audio player */}
      <audio
        ref={audioPlayerRef}
        onEnded={() => setPlayingId(null)}
        onPause={() => setPlayingId(null)}
        style={{ display: 'none' }}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Audio Details</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            value={editingAudio?.name || ''}
            onChange={(e) =>
              setEditingAudio((prev) => (prev ? { ...prev, name: e.target.value } : null))
            }
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description"
            value={editingAudio?.description || ''}
            onChange={(e) =>
              setEditingAudio((prev) => (prev ? { ...prev, description: e.target.value } : null))
            }
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            fullWidth
            label="Tags (comma-separated)"
            value={editingAudio?.tags?.join(', ') || ''}
            onChange={(e) =>
              setEditingAudio((prev) =>
                prev
                  ? {
                      ...prev,
                      tags: e.target.value.split(',').map((tag) => tag.trim()),
                    }
                  : null
              )
            }
            margin="normal"
            helperText="Add tags to organize your audio files"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Audio File</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{audioToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
