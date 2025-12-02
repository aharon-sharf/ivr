import { useCallback, useState, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Input as InputIcon,
  Menu as MenuIcon,
  TouchApp as TouchAppIcon,
} from '@mui/icons-material';
import { IVRFlowDefinition, IVRNode, IVRAction } from '../types';

// Custom node components
const PlayAudioNode = ({ data }: { data: { audioUrl?: string; timeout?: number } }) => (
  <Box
    sx={{
      padding: 2,
      borderRadius: 1,
      border: '2px solid #4CAF50',
      backgroundColor: '#E8F5E9',
      minWidth: 200,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <PlayArrowIcon sx={{ mr: 1, color: '#4CAF50' }} />
      <Typography variant="subtitle2" fontWeight="bold">
        Play Audio
      </Typography>
    </Box>
    <Typography variant="body2" color="text.secondary" noWrap>
      {data.audioUrl || 'No audio selected'}
    </Typography>
    {data.timeout && (
      <Typography variant="caption" color="text.secondary">
        Timeout: {data.timeout}s
      </Typography>
    )}
  </Box>
);

const CaptureInputNode = ({ data }: { data: { validInputs?: string[]; timeout?: number } }) => (
  <Box
    sx={{
      padding: 2,
      borderRadius: 1,
      border: '2px solid #2196F3',
      backgroundColor: '#E3F2FD',
      minWidth: 200,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <InputIcon sx={{ mr: 1, color: '#2196F3' }} />
      <Typography variant="subtitle2" fontWeight="bold">
        Capture Input
      </Typography>
    </Box>
    {data.validInputs && data.validInputs.length > 0 && (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
        {data.validInputs.map((input: string) => (
          <Chip key={input} label={input} size="small" color="primary" />
        ))}
      </Box>
    )}
    {data.timeout && (
      <Typography variant="caption" color="text.secondary">
        Timeout: {data.timeout}s
      </Typography>
    )}
  </Box>
);

const MenuNode = ({ data }: { data: { actions?: Record<string, IVRAction> } }) => (
  <Box
    sx={{
      padding: 2,
      borderRadius: 1,
      border: '2px solid #FF9800',
      backgroundColor: '#FFF3E0',
      minWidth: 200,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <MenuIcon sx={{ mr: 1, color: '#FF9800' }} />
      <Typography variant="subtitle2" fontWeight="bold">
        Menu
      </Typography>
    </Box>
    {data.actions && Object.keys(data.actions).length > 0 && (
      <Box sx={{ mt: 1 }}>
        {Object.entries(data.actions).map(([key, action]) => (
          <Typography key={key} variant="caption" display="block">
            {key}: {action.type}
          </Typography>
        ))}
      </Box>
    )}
  </Box>
);

const ActionNode = ({ data }: { data: { actions?: Record<string, IVRAction> } }) => (
  <Box
    sx={{
      padding: 2,
      borderRadius: 1,
      border: '2px solid #9C27B0',
      backgroundColor: '#F3E5F5',
      minWidth: 200,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <TouchAppIcon sx={{ mr: 1, color: '#9C27B0' }} />
      <Typography variant="subtitle2" fontWeight="bold">
        Action
      </Typography>
    </Box>
    {data.actions && Object.keys(data.actions).length > 0 && (
      <Box sx={{ mt: 1 }}>
        {Object.entries(data.actions).map(([key, action]) => (
          <Chip
            key={key}
            label={`${key}: ${action.type}`}
            size="small"
            color="secondary"
            sx={{ mr: 0.5, mb: 0.5 }}
          />
        ))}
      </Box>
    )}
  </Box>
);

interface IVRFlowBuilderProps {
  initialFlow?: IVRFlowDefinition;
  onFlowChange?: (flow: IVRFlowDefinition) => void;
  onSave?: (flow: IVRFlowDefinition) => void;
}

export const IVRFlowBuilder = ({ initialFlow, onFlowChange, onSave }: IVRFlowBuilderProps) => {
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      play_audio: PlayAudioNode,
      capture_input: CaptureInputNode,
      menu: MenuNode,
      action: ActionNode,
    }),
    []
  );

  // Convert IVR flow to ReactFlow nodes and edges
  const convertToReactFlow = (flow?: IVRFlowDefinition) => {
    if (!flow || !flow.nodes || flow.nodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodes: Node[] = flow.nodes.map((node, index) => ({
      id: node.id,
      type: node.type,
      position: { x: 250 * (index % 3), y: 150 * Math.floor(index / 3) },
      data: {
        audioUrl: node.audioUrl,
        timeout: node.timeout,
        validInputs: node.validInputs,
        actions: node.actions,
        nextNodeId: node.nextNodeId,
      },
    }));

    const edges: Edge[] = [];
    flow.nodes.forEach((node) => {
      if (node.nextNodeId) {
        edges.push({
          id: `${node.id}-${node.nextNodeId}`,
          source: node.id,
          target: node.nextNodeId,
          animated: true,
        });
      }
      if (node.actions) {
        Object.entries(node.actions).forEach(([key, action]) => {
          if (action.parameters?.nextNodeId) {
            edges.push({
              id: `${node.id}-${key}-${action.parameters.nextNodeId}`,
              source: node.id,
              target: action.parameters.nextNodeId,
              label: key,
              animated: true,
            });
          }
        });
      }
    });

    return { nodes, edges };
  };

  const initialReactFlow = convertToReactFlow(initialFlow);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialReactFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialReactFlow.edges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Node creation state
  const [newNodeType, setNewNodeType] = useState<IVRNode['type']>('play_audio');
  const [newNodeData, setNewNodeData] = useState<Partial<IVRNode>>({});

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = () => {
    const id = `node-${Date.now()}`;
    const newNode: Node = {
      id,
      type: newNodeType,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { ...newNodeData },
    };
    setNodes((nds) => [...nds, newNode]);
    setIsNodeDialogOpen(false);
    setNewNodeData({});
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  const updateNodeData = (nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node))
    );
  };

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setIsEditDialogOpen(true);
  };

  const validateFlow = (): string[] => {
    const errors: string[] = [];

    if (nodes.length === 0) {
      errors.push('Flow must contain at least one node');
      return errors;
    }

    // Check for start node
    const startNode = nodes.find((n) => n.id === 'start' || n.data.isStart);
    if (!startNode && nodes.length > 0) {
      errors.push('Flow must have a designated start node');
    }

    // Validate each node
    nodes.forEach((node) => {
      if (node.type === 'play_audio' && !node.data.audioUrl) {
        errors.push(`Node ${node.id}: Audio URL is required for Play Audio nodes`);
      }

      if (node.type === 'capture_input' && (!node.data.validInputs || node.data.validInputs.length === 0)) {
        errors.push(`Node ${node.id}: Valid inputs are required for Capture Input nodes`);
      }

      if ((node.type === 'menu' || node.type === 'action') && (!node.data.actions || Object.keys(node.data.actions).length === 0)) {
        errors.push(`Node ${node.id}: At least one action is required for ${node.type} nodes`);
      }
    });

    // Check for orphaned nodes (except start node)
    const connectedNodes = new Set<string>();
    edges.forEach((edge) => {
      connectedNodes.add(edge.target);
    });

    nodes.forEach((node) => {
      if (!connectedNodes.has(node.id) && node.id !== (startNode?.id || nodes[0].id)) {
        errors.push(`Node ${node.id} is not connected to the flow`);
      }
    });

    return errors;
  };

  const convertToIVRFlow = (): IVRFlowDefinition => {
    const ivrNodes: IVRNode[] = nodes.map((node) => {
      const outgoingEdge = edges.find((e) => e.source === node.id && !e.label);
      return {
        id: node.id,
        type: node.type as IVRNode['type'],
        audioUrl: node.data.audioUrl,
        timeout: node.data.timeout,
        validInputs: node.data.validInputs,
        actions: node.data.actions,
        nextNodeId: outgoingEdge?.target,
      };
    });

    return {
      nodes: ivrNodes,
      startNodeId: nodes[0]?.id || '',
    };
  };

  const handleSave = () => {
    const errors = validateFlow();
    setValidationErrors(errors);

    if (errors.length === 0) {
      const flow = convertToIVRFlow();
      if (onSave) {
        onSave(flow);
      }
      if (onFlowChange) {
        onFlowChange(flow);
      }
    }
  };

  const handleAddAction = (dtmfKey: string, actionType: IVRAction['type']) => {
    if (!selectedNode) return;

    const newActions = {
      ...selectedNode.data.actions,
      [dtmfKey]: {
        type: actionType,
        parameters: {},
      },
    };

    updateNodeData(selectedNode.id, { actions: newActions });
    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, actions: newActions } });
  };

  const handleRemoveAction = (dtmfKey: string) => {
    if (!selectedNode) return;

    const newActions = { ...selectedNode.data.actions };
    delete newActions[dtmfKey];

    updateNodeData(selectedNode.id, { actions: newActions });
    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, actions: newActions } });
  };

  return (
    <Box sx={{ height: '600px', width: '100%' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">IVR Flow Builder</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setIsNodeDialogOpen(true)}
            >
              Add Node
            </Button>
            <Button variant="contained" onClick={handleSave}>
              Save Flow
            </Button>
          </Box>
        </Box>

        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Validation Errors:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}
      </Paper>

      <Paper sx={{ height: 'calc(100% - 100px)', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </Paper>

      {/* Add Node Dialog */}
      <Dialog open={isNodeDialogOpen} onClose={() => setIsNodeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Node</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Node Type</InputLabel>
              <Select
                value={newNodeType}
                label="Node Type"
                onChange={(e) => setNewNodeType(e.target.value as IVRNode['type'])}
              >
                <MenuItem value="play_audio">Play Audio</MenuItem>
                <MenuItem value="capture_input">Capture Input</MenuItem>
                <MenuItem value="menu">Menu</MenuItem>
                <MenuItem value="action">Action</MenuItem>
              </Select>
            </FormControl>

            {newNodeType === 'play_audio' && (
              <>
                <TextField
                  fullWidth
                  label="Audio URL"
                  value={newNodeData.audioUrl || ''}
                  onChange={(e) => setNewNodeData({ ...newNodeData, audioUrl: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Timeout (seconds)"
                  type="number"
                  value={newNodeData.timeout || ''}
                  onChange={(e) => setNewNodeData({ ...newNodeData, timeout: parseInt(e.target.value) })}
                />
              </>
            )}

            {newNodeType === 'capture_input' && (
              <>
                <TextField
                  fullWidth
                  label="Valid Inputs (comma-separated)"
                  placeholder="1,2,3,9"
                  value={newNodeData.validInputs?.join(',') || ''}
                  onChange={(e) =>
                    setNewNodeData({
                      ...newNodeData,
                      validInputs: e.target.value.split(',').map((s) => s.trim()),
                    })
                  }
                />
                <TextField
                  fullWidth
                  label="Timeout (seconds)"
                  type="number"
                  value={newNodeData.timeout || ''}
                  onChange={(e) => setNewNodeData({ ...newNodeData, timeout: parseInt(e.target.value) })}
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsNodeDialogOpen(false)}>Cancel</Button>
          <Button onClick={addNode} variant="contained">
            Add Node
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Node Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Edit Node: {selectedNode?.id}</span>
            <Tooltip title="Delete Node">
              <IconButton
                color="error"
                onClick={() => {
                  if (selectedNode) {
                    deleteNode(selectedNode.id);
                    setIsEditDialogOpen(false);
                  }
                }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedNode && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {selectedNode.type === 'play_audio' && (
                <>
                  <TextField
                    fullWidth
                    label="Audio URL"
                    value={selectedNode.data.audioUrl || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { audioUrl: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Timeout (seconds)"
                    type="number"
                    value={selectedNode.data.timeout || ''}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, { timeout: parseInt(e.target.value) })
                    }
                  />
                </>
              )}

              {selectedNode.type === 'capture_input' && (
                <>
                  <TextField
                    fullWidth
                    label="Valid Inputs (comma-separated)"
                    placeholder="1,2,3,9"
                    value={selectedNode.data.validInputs?.join(',') || ''}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, {
                        validInputs: e.target.value.split(',').map((s) => s.trim()),
                      })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Timeout (seconds)"
                    type="number"
                    value={selectedNode.data.timeout || ''}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, { timeout: parseInt(e.target.value) })
                    }
                  />
                </>
              )}

              {(selectedNode.type === 'menu' || selectedNode.type === 'action') && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    DTMF Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedNode.data.actions &&
                      Object.entries(selectedNode.data.actions).map(([key, action]) => (
                        <Box
                          key={key}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                          }}
                        >
                          <Chip label={key} size="small" />
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {action.type}
                          </Typography>
                          <IconButton size="small" onClick={() => handleRemoveAction(key)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <TextField
                      label="DTMF Key"
                      placeholder="1"
                      size="small"
                      id="dtmf-key-input"
                      sx={{ width: 100 }}
                    />
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Action Type</InputLabel>
                      <Select label="Action Type" defaultValue="send_sms" id="action-type-select">
                        <MenuItem value="send_sms">Send SMS</MenuItem>
                        <MenuItem value="transfer_agent">Transfer to Agent</MenuItem>
                        <MenuItem value="add_to_blacklist">Add to Blacklist</MenuItem>
                        <MenuItem value="trigger_donation">Trigger Donation</MenuItem>
                        <MenuItem value="end_call">End Call</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        const keyInput = document.getElementById('dtmf-key-input') as HTMLInputElement;
                        const actionSelect = document.getElementById(
                          'action-type-select'
                        ) as HTMLInputElement;
                        if (keyInput && actionSelect && keyInput.value) {
                          handleAddAction(keyInput.value, actionSelect.value as IVRAction['type']);
                          keyInput.value = '';
                        }
                      }}
                    >
                      Add
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
