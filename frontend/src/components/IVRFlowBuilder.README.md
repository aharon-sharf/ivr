# IVR Flow Builder Component

## Overview

The IVR Flow Builder is a visual drag-and-drop interface for designing Interactive Voice Response (IVR) flows for voice campaigns. It allows campaign managers to create complex call flows with multiple nodes and DTMF-based interactions.

## Features

### Node Types

1. **Play Audio Node** (Green)
   - Plays a pre-recorded audio message to the caller
   - Configurable audio URL
   - Optional timeout setting

2. **Capture Input Node** (Blue)
   - Captures DTMF (keypad) input from the caller
   - Configurable valid inputs (e.g., "1,2,3,9")
   - Optional timeout setting

3. **Menu Node** (Orange)
   - Presents a menu of options to the caller
   - Maps DTMF keys to specific actions
   - Supports multiple action types

4. **Action Node** (Purple)
   - Executes specific actions based on caller input
   - Supports multiple action types:
     - Send SMS
     - Transfer to Agent
     - Add to Blacklist
     - Trigger Donation
     - End Call

### Key Features

- **Drag-and-Drop Interface**: Visual flow design using ReactFlow
- **Node Connections**: Connect nodes to create call flow paths
- **DTMF Mapping**: Configure keypad inputs (1-9, *, #) to trigger actions
- **Flow Validation**: Validates flow before saving:
  - Ensures at least one node exists
  - Checks for required fields (audio URLs, valid inputs, actions)
  - Detects orphaned nodes
  - Validates start node configuration
- **Real-time Editing**: Edit node properties in-place
- **Visual Feedback**: Color-coded nodes for easy identification
- **Mini Map**: Overview of entire flow for large designs

## Usage

### Basic Usage

```tsx
import { IVRFlowBuilder } from '../components/IVRFlowBuilder';
import { IVRFlowDefinition } from '../types';

function MyComponent() {
  const [flow, setFlow] = useState<IVRFlowDefinition>();

  return (
    <IVRFlowBuilder
      initialFlow={flow}
      onFlowChange={(newFlow) => setFlow(newFlow)}
      onSave={(savedFlow) => {
        console.log('Flow saved:', savedFlow);
        // Save to backend
      }}
    />
  );
}
```

### Props

- `initialFlow?: IVRFlowDefinition` - Initial flow to load (optional)
- `onFlowChange?: (flow: IVRFlowDefinition) => void` - Callback when flow changes
- `onSave?: (flow: IVRFlowDefinition) => void` - Callback when user clicks Save

## Creating a Flow

### Step 1: Add Nodes

1. Click "Add Node" button
2. Select node type from dropdown
3. Configure node properties:
   - **Play Audio**: Enter audio URL and optional timeout
   - **Capture Input**: Enter valid DTMF inputs (comma-separated)
   - **Menu/Action**: Will configure actions after creation
4. Click "Add Node"

### Step 2: Connect Nodes

1. Click and drag from the edge of one node to another
2. This creates a connection showing the flow path
3. Connections are animated to show direction

### Step 3: Configure DTMF Actions

For Menu and Action nodes:

1. Click on the node to open edit dialog
2. In the "DTMF Actions" section:
   - Enter a DTMF key (1-9, *, #)
   - Select an action type
   - Click "Add"
3. Repeat for multiple actions
4. Remove actions by clicking the delete icon

### Step 4: Validate and Save

1. Click "Save Flow" button
2. Review any validation errors
3. Fix errors and save again
4. Flow is converted to IVRFlowDefinition format

## Validation Rules

The flow builder validates the following:

1. **Minimum Nodes**: At least one node must exist
2. **Start Node**: First node is designated as start node
3. **Required Fields**:
   - Play Audio nodes must have an audio URL
   - Capture Input nodes must have valid inputs
   - Menu/Action nodes must have at least one action
4. **Connectivity**: All nodes (except start) must be connected to the flow

## Data Format

### IVRFlowDefinition

```typescript
interface IVRFlowDefinition {
  nodes: IVRNode[];
  startNodeId: string;
}
```

### IVRNode

```typescript
interface IVRNode {
  id: string;
  type: 'play_audio' | 'capture_input' | 'action' | 'menu';
  audioUrl?: string;
  timeout?: number;
  validInputs?: string[];
  actions?: Record<string, IVRAction>;
  nextNodeId?: string;
}
```

### IVRAction

```typescript
interface IVRAction {
  type: 'send_sms' | 'transfer_agent' | 'add_to_blacklist' | 'trigger_donation' | 'end_call';
  parameters?: Record<string, any>;
}
```

## Example Flow

A typical donation campaign flow:

1. **Play Audio Node**: "Thank you for calling. Press 1 to donate, Press 9 to opt out."
2. **Capture Input Node**: Valid inputs: "1,9"
3. **Menu Node**: 
   - Key "1" → Action: trigger_donation
   - Key "9" → Action: add_to_blacklist
4. **Action Node** (for donation): Sends SMS with donation link
5. **Action Node** (for opt-out): Adds to blacklist and ends call

## Integration with Campaign Creation

The IVR Flow Builder is integrated into the Campaign Create Page:

- Appears in Step 3 (Configuration) for voice campaigns
- Flow is saved as part of the campaign configuration
- Flow is validated before campaign creation
- Stored in `campaignConfig.ivrFlow`

## Requirements Validation

This component validates the following requirements:

- **Requirement 4.1**: IVR plays configured pre-recorded audio message
- **Requirement 4.5**: Multi-level menu navigation based on DTMF input sequences

## Technical Details

### Dependencies

- `reactflow`: Visual flow editor library
- `@mui/material`: Material-UI components
- `@mui/icons-material`: Material-UI icons

### State Management

- Uses ReactFlow's built-in state management for nodes and edges
- Converts between ReactFlow format and IVRFlowDefinition format
- Maintains selected node state for editing

### Performance

- Optimized with `useMemo` for node types
- Efficient state updates with `useCallback`
- Minimal re-renders with proper React patterns

## Future Enhancements

Potential improvements:

1. **Undo/Redo**: Add history management
2. **Templates**: Pre-built flow templates
3. **Testing**: Simulate flow execution
4. **Export/Import**: Save/load flows as JSON
5. **Advanced Validation**: Check for infinite loops, unreachable nodes
6. **Conditional Routing**: Route based on contact metadata
7. **Variables**: Support dynamic content in audio playback
8. **Analytics**: Track which paths are most common

## Troubleshooting

### Flow Not Saving

- Check validation errors in the alert box
- Ensure all required fields are filled
- Verify all nodes are connected

### Nodes Not Connecting

- Make sure you're dragging from the edge of a node
- Check that target node exists
- Verify nodes are not already connected

### Actions Not Working

- Ensure DTMF key is entered correctly
- Check that action type is selected
- Verify node is saved after adding actions
