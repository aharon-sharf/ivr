import { useState } from 'react';
import { Container, Box, Typography, Paper, Button, Alert } from '@mui/material';
import { IVRFlowBuilder } from '../components/IVRFlowBuilder';
import { IVRFlowDefinition } from '../types';

/**
 * Demo page for the IVR Flow Builder component
 * This page demonstrates how to use the IVR Flow Builder in isolation
 */
export const IVRFlowBuilderDemo = () => {
  const [flow, setFlow] = useState<IVRFlowDefinition | undefined>();
  const [savedFlow, setSavedFlow] = useState<IVRFlowDefinition | undefined>();
  const [showSuccess, setShowSuccess] = useState(false);

  // Example initial flow for demonstration
  const exampleFlow: IVRFlowDefinition = {
    startNodeId: 'welcome',
    nodes: [
      {
        id: 'welcome',
        type: 'play_audio',
        audioUrl: 'https://example.com/welcome.mp3',
        timeout: 10,
        nextNodeId: 'menu',
      },
      {
        id: 'menu',
        type: 'capture_input',
        validInputs: ['1', '2', '9'],
        timeout: 10,
        nextNodeId: 'action',
      },
      {
        id: 'action',
        type: 'menu',
        actions: {
          '1': {
            type: 'trigger_donation',
            parameters: {},
          },
          '2': {
            type: 'transfer_agent',
            parameters: {},
          },
          '9': {
            type: 'add_to_blacklist',
            parameters: {},
          },
        },
      },
    ],
  };

  const handleSave = (savedFlow: IVRFlowDefinition) => {
    setSavedFlow(savedFlow);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    console.log('Flow saved:', JSON.stringify(savedFlow, null, 2));
  };

  const loadExampleFlow = () => {
    setFlow(exampleFlow);
  };

  const clearFlow = () => {
    setFlow(undefined);
    setSavedFlow(undefined);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          IVR Flow Builder Demo
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          This is a demonstration of the IVR Flow Builder component. Use the controls below to test
          the functionality.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button variant="outlined" onClick={loadExampleFlow}>
            Load Example Flow
          </Button>
          <Button variant="outlined" onClick={clearFlow}>
            Clear Flow
          </Button>
        </Box>

        {showSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Flow saved successfully!
          </Alert>
        )}

        <IVRFlowBuilder
          initialFlow={flow}
          onFlowChange={(newFlow) => setFlow(newFlow)}
          onSave={handleSave}
        />

        {savedFlow && (
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Saved Flow JSON
            </Typography>
            <Box
              component="pre"
              sx={{
                backgroundColor: '#f5f5f5',
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: 400,
              }}
            >
              {JSON.stringify(savedFlow, null, 2)}
            </Box>
          </Paper>
        )}

        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Instructions
          </Typography>
          <Typography variant="body2" component="div">
            <ol>
              <li>Click "Add Node" to create a new node in the flow</li>
              <li>Select the node type and configure its properties</li>
              <li>Drag from one node's edge to another to create connections</li>
              <li>Click on a node to edit its properties and configure DTMF actions</li>
              <li>Click "Save Flow" to validate and save the flow</li>
            </ol>
          </Typography>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Node Types:
          </Typography>
          <Typography variant="body2" component="div">
            <ul>
              <li>
                <strong>Play Audio (Green):</strong> Plays a pre-recorded message
              </li>
              <li>
                <strong>Capture Input (Blue):</strong> Captures DTMF keypad input
              </li>
              <li>
                <strong>Menu (Orange):</strong> Presents options and routes based on input
              </li>
              <li>
                <strong>Action (Purple):</strong> Executes specific actions (SMS, transfer, etc.)
              </li>
            </ul>
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};
