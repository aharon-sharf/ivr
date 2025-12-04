import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { BlacklistEntry } from '../types';
import {
  getBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  uploadBlacklistFile,
  exportBlacklist,
  BlacklistUploadResult,
} from '../api/blacklist';

export const BlacklistManagementPage = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newReason, setNewReason] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<BlacklistUploadResult | null>(null);

  // Snackbar states
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Load blacklist entries
  const loadBlacklist = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: page + 1,
        limit: rowsPerPage,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      if (sourceFilter !== 'all') {
        params.source = sourceFilter;
      }

      const response = await getBlacklist(params);
      if (response.success && response.data) {
        setEntries(response.data.entries);
        setTotal(response.data.total);
      }
    } catch (error) {
      showSnackbar('Failed to load blacklist', 'error');
      console.error('Error loading blacklist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlacklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, searchQuery, sourceFilter]);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = () => {
    setPage(0);
    loadBlacklist();
  };

  const handleAddNumber = async () => {
    if (!newPhoneNumber || !newReason) {
      showSnackbar('Phone number and reason are required', 'error');
      return;
    }

    try {
      const response = await addToBlacklist(newPhoneNumber, newReason);
      if (response.success) {
        showSnackbar('Phone number added to blacklist', 'success');
        setAddDialogOpen(false);
        setNewPhoneNumber('');
        setNewReason('');
        loadBlacklist();
      } else {
        showSnackbar(response.error || 'Failed to add number', 'error');
      }
    } catch (error) {
      showSnackbar('Failed to add number to blacklist', 'error');
      console.error('Error adding to blacklist:', error);
    }
  };

  const handleRemoveNumber = async (phoneNumber: string) => {
    if (!confirm(`Are you sure you want to remove ${phoneNumber} from the blacklist?`)) {
      return;
    }

    try {
      const response = await removeFromBlacklist(phoneNumber);
      if (response.success) {
        showSnackbar('Phone number removed from blacklist', 'success');
        loadBlacklist();
      } else {
        showSnackbar(response.error || 'Failed to remove number', 'error');
      }
    } catch (error) {
      showSnackbar('Failed to remove number from blacklist', 'error');
      console.error('Error removing from blacklist:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      showSnackbar('Please select a file', 'error');
      return;
    }

    try {
      const response = await uploadBlacklistFile(selectedFile);
      if (response.success && response.data) {
        setUploadResult(response.data);
        showSnackbar(
          `Uploaded ${response.data.imported} numbers successfully`,
          'success'
        );
        loadBlacklist();
      } else {
        showSnackbar(response.error || 'Failed to upload file', 'error');
      }
    } catch (error) {
      showSnackbar('Failed to upload blacklist file', 'error');
      console.error('Error uploading file:', error);
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const blob = await exportBlacklist({ format });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `blacklist-${new Date().toISOString().split('T')[0]}.${
        format === 'csv' ? 'csv' : 'xlsx'
      }`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSnackbar(`Blacklist exported as ${format.toUpperCase()}`, 'success');
    } catch (error) {
      showSnackbar('Failed to export blacklist', 'error');
      console.error('Error exporting blacklist:', error);
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'user_optout':
        return 'error';
      case 'admin_import':
        return 'warning';
      case 'compliance':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatSource = (source: string) => {
    switch (source) {
      case 'user_optout':
        return 'User Opt-Out';
      case 'admin_import':
        return 'Admin Import';
      case 'compliance':
        return 'Compliance';
      default:
        return source;
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BlockIcon sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
            <Typography variant="h4" component="h1">
              Blacklist Management
            </Typography>
          </Box>
          <Box>
            <Button
              variant="outlined"
              onClick={() => navigate('/dashboard')}
              sx={{ mr: 2 }}
            >
              Back to Dashboard
            </Button>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Number
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload File
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => handleExport('excel')}
            >
              Export Excel
            </Button>
          </Box>
        </Paper>

        {/* Search and Filter */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label="Search Phone Number"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              sx={{ flexGrow: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Source</InputLabel>
              <Select
                value={sourceFilter}
                label="Source"
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <MenuItem value="all">All Sources</MenuItem>
                <MenuItem value="user_optout">User Opt-Out</MenuItem>
                <MenuItem value="admin_import">Admin Import</MenuItem>
                <MenuItem value="compliance">Compliance</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
            >
              Search
            </Button>
          </Box>
        </Paper>

        {/* Blacklist Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Phone Number</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Added At</TableCell>
                  <TableCell>Added By</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No blacklist entries found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.phoneNumber}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {entry.phoneNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{entry.reason || 'No reason provided'}</TableCell>
                      <TableCell>
                        <Chip
                          label={formatSource(entry.source || 'unknown')}
                          color={getSourceColor(entry.source || 'unknown')}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(entry.addedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{entry.addedBy || 'System'}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveNumber(entry.phoneNumber)}
                          title="Remove from blacklist"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>

        {/* Add Number Dialog */}
        <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Number to Blacklist</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Phone Number"
                variant="outlined"
                fullWidth
                value={newPhoneNumber}
                onChange={(e) => setNewPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                helperText="Enter phone number in E.164 format"
              />
              <TextField
                label="Reason"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Reason for blacklisting this number"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddNumber}>
              Add to Blacklist
            </Button>
          </DialogActions>
        </Dialog>

        {/* Upload File Dialog */}
        <Dialog
          open={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Upload Blacklist File</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Upload a CSV or Excel file with columns: phone_number, reason
              </Alert>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                style={{ marginBottom: '16px' }}
              />
              {selectedFile && (
                <Typography variant="body2" color="text.secondary">
                  Selected: {selectedFile.name}
                </Typography>
              )}
              {uploadResult && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Upload Complete:</strong>
                  </Typography>
                  <Typography variant="body2">
                    Total: {uploadResult.totalRecords} | Imported: {uploadResult.imported} |
                    Duplicates: {uploadResult.duplicates} | Failures: {uploadResult.failures}
                  </Typography>
                  {uploadResult.errors.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="error">
                        Errors:
                      </Typography>
                      {uploadResult.errors.slice(0, 5).map((error, index) => (
                        <Typography key={index} variant="caption" display="block">
                          {error}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUploadDialogOpen(false)}>Close</Button>
            <Button
              variant="contained"
              onClick={handleUploadFile}
              disabled={!selectedFile}
            >
              Upload
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};
