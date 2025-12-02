import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TableSortLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setCampaigns, setLoading, setError, removeCampaign, updateCampaign } from '../store/slices/campaignSlice';
import { campaignApi } from '../api/campaigns';
import { Campaign } from '../types';
import { format } from 'date-fns';

type Order = 'asc' | 'desc';
type OrderBy = 'name' | 'type' | 'status' | 'createdAt' | 'updatedAt';

export const CampaignListPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { campaigns, isLoading, error } = useAppSelector((state) => state.campaign);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<OrderBy>('createdAt');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCampaigns = async () => {
    try {
      dispatch(setLoading(true));
      const data = await campaignApi.getCampaigns();
      dispatch(setCampaigns(data));
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : 'Failed to load campaigns'));
    }
  };

  const handleRequestSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      await campaignApi.deleteCampaign(id);
      dispatch(removeCampaign(id));
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : 'Failed to delete campaign'));
    }
  };

  const handlePause = async (id: string) => {
    try {
      const updated = await campaignApi.pauseCampaign(id);
      dispatch(updateCampaign(updated));
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : 'Failed to pause campaign'));
    }
  };

  const handleResume = async (id: string) => {
    try {
      const updated = await campaignApi.resumeCampaign(id);
      dispatch(updateCampaign(updated));
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : 'Failed to resume campaign'));
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

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    const matchesType = typeFilter === 'all' || campaign.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Sort campaigns
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    let aValue: string | number = a[orderBy];
    let bValue: string | number = b[orderBy];

    if (orderBy === 'createdAt' || orderBy === 'updatedAt') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (order === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  // Paginate campaigns
  const paginatedCampaigns = sortedCampaigns.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Campaigns
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/campaigns/create')}
          >
            Create Campaign
          </Button>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(setError(''))}>
            {error}
          </Alert>
        )}

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Search campaigns"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: 250 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="paused">Paused</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="voice">Voice</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="hybrid">Hybrid</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>

        {/* Table */}
        <TableContainer component={Paper}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'name'}
                        direction={orderBy === 'name' ? order : 'asc'}
                        onClick={() => handleRequestSort('name')}
                      >
                        Name
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'type'}
                        direction={orderBy === 'type' ? order : 'asc'}
                        onClick={() => handleRequestSort('type')}
                      >
                        Type
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'status'}
                        direction={orderBy === 'status' ? order : 'asc'}
                        onClick={() => handleRequestSort('status')}
                      >
                        Status
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'createdAt'}
                        direction={orderBy === 'createdAt' ? order : 'asc'}
                        onClick={() => handleRequestSort('createdAt')}
                      >
                        Created
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === 'updatedAt'}
                        direction={orderBy === 'updatedAt' ? order : 'asc'}
                        onClick={() => handleRequestSort('updatedAt')}
                      >
                        Updated
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedCampaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                          No campaigns found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCampaigns.map((campaign) => (
                      <TableRow key={campaign.id} hover>
                        <TableCell>{campaign.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={campaign.type.toUpperCase()}
                            color={getTypeColor(campaign.type)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={campaign.status.toUpperCase()}
                            color={getStatusColor(campaign.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{format(new Date(campaign.createdAt), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{format(new Date(campaign.updatedAt), 'MMM dd, yyyy')}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/campaigns/${campaign.id}`)}
                            title="View details"
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
                            title="Edit campaign"
                            disabled={campaign.status === 'active' || campaign.status === 'completed'}
                          >
                            <EditIcon />
                          </IconButton>
                          {campaign.status === 'active' && (
                            <IconButton
                              size="small"
                              onClick={() => handlePause(campaign.id)}
                              title="Pause campaign"
                            >
                              <PauseIcon />
                            </IconButton>
                          )}
                          {campaign.status === 'paused' && (
                            <IconButton
                              size="small"
                              onClick={() => handleResume(campaign.id)}
                              title="Resume campaign"
                            >
                              <PlayIcon />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(campaign.id)}
                            title="Delete campaign"
                            disabled={campaign.status === 'active'}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={filteredCampaigns.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </>
          )}
        </TableContainer>
      </Box>
    </Container>
  );
};
