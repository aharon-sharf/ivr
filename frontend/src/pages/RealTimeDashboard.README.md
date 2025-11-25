# Real-Time Dashboard Implementation

## Overview

The Real-Time Dashboard provides live monitoring of campaign metrics and system health with sub-2-second update latency. It uses WebSocket connections for real-time updates and falls back to polling if WebSocket is unavailable.

## Features

### 1. Live Metrics Display
- **Active Calls**: Current number of ongoing calls across all campaigns
- **Queue Depth**: Number of contacts waiting to be dialed
- **Dialing Rate**: Calls per second being initiated
- **Total Attempts**: Cumulative call attempts across all campaigns

### 2. Real-Time Charts
- **Activity Line Chart**: Shows active calls, queue depth, and dialing rate over time (last 20 data points)
- **Outcome Pie Chart**: Distribution of call outcomes (Answered, Busy, Failed, Converted, Opt-outs)
- **Progress Bar Chart**: Detailed breakdown of all call outcomes

### 3. System Health Monitoring
- CPU Usage
- Memory Usage
- Answer Rate
- Active Campaign Count

### 4. Per-Campaign Metrics
- Individual campaign performance cards
- Answer rate and conversion rate per campaign
- Real-time outcome counts

## Architecture

### WebSocket Connection

The dashboard uses AWS API Gateway WebSocket API for real-time updates:

```typescript
// WebSocket message format
interface WebSocketMessage {
  type: 'metrics_update' | 'campaign_status_change' | 'system_health_update' | 'call_event';
  data: any;
  timestamp: string;
}
```

**Connection Flow**:
1. Dashboard connects to WebSocket URL on mount
2. Subscribes to specific campaigns or all metrics
3. Receives real-time updates as events occur
4. Automatically reconnects on disconnection (exponential backoff)

### Fallback Polling

If WebSocket connection fails or is unavailable:
- Dashboard polls REST API every 2 seconds
- Uses same API endpoints as initial data fetch
- Seamlessly switches back to WebSocket when available

### State Management

Redux Toolkit manages metrics state:

```typescript
interface MetricsState {
  campaignMetrics: Record<string, CampaignMetrics>;
  systemHealth: SystemHealth;
  aggregateMetrics: AggregateMetrics;
  isConnected: boolean;
  lastUpdate: string | null;
}
```

## API Endpoints

### REST API (Initial Load & Fallback)

```
GET /analytics/metrics
  → Returns metrics for all active campaigns

GET /analytics/campaigns/:campaignId/metrics
  → Returns metrics for specific campaign

GET /analytics/system/health
  → Returns system health metrics
```

### WebSocket API

```
wss://your-api-gateway-url/production

Actions:
- subscribe: { action: 'subscribe', campaignId: 'xxx' }
- unsubscribe: { action: 'unsubscribe', campaignId: 'xxx' }

Events:
- metrics_update: Campaign metrics changed
- system_health_update: System health changed
- campaign_status_change: Campaign status changed
- call_event: Individual call event (answered, failed, etc.)
```

## Usage

### Basic Usage

```typescript
import { RealTimeDashboardPage } from './pages/RealTimeDashboardPage';

// In your router
<Route path="/analytics/realtime" element={<RealTimeDashboardPage />} />
```

### Using the Hook

```typescript
import { useRealTimeMetrics } from '../hooks/useRealTimeMetrics';

function MyComponent() {
  const {
    campaignMetrics,
    systemHealth,
    aggregateMetrics,
    isConnected,
    refreshMetrics,
  } = useRealTimeMetrics({
    campaignId: 'optional-campaign-id', // Omit for all campaigns
    autoConnect: true,
    pollingInterval: 2000,
  });

  return (
    <div>
      <p>Active Calls: {aggregateMetrics.totalActiveCalls}</p>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <button onClick={refreshMetrics}>Refresh</button>
    </div>
  );
}
```

## Configuration

### Environment Variables

```bash
# .env
VITE_WS_URL=wss://your-api-gateway-websocket-url.execute-api.us-east-1.amazonaws.com/production
VITE_API_BASE_URL=https://your-api-gateway-rest-url.execute-api.us-east-1.amazonaws.com/api
```

### WebSocket Service Configuration

```typescript
// Customize reconnection behavior
const websocketService = new WebSocketService();
websocketService.maxReconnectAttempts = 5;
websocketService.reconnectDelay = 1000; // Initial delay in ms
```

## Performance Considerations

### Update Frequency
- WebSocket: Real-time (< 100ms latency)
- Polling fallback: 2 seconds
- Chart updates: Throttled to prevent excessive re-renders

### Data Retention
- Historical chart data: Last 20 data points
- Metrics state: Current snapshot only
- No persistent storage in frontend

### Optimization
- Uses React.memo for chart components
- Debounced state updates
- Efficient Redux selectors
- Lazy loading of chart library

## Testing

### Mock WebSocket Server

For development without backend:

```typescript
// Mock WebSocket server
const mockWs = new WebSocket('ws://localhost:4000/ws');

// Send mock updates every 2 seconds
setInterval(() => {
  mockWs.send(JSON.stringify({
    type: 'metrics_update',
    data: {
      campaignId: 'test-campaign',
      activeCalls: Math.floor(Math.random() * 100),
      queueDepth: Math.floor(Math.random() * 500),
      dialingRate: Math.random() * 10,
      // ... other metrics
    },
    timestamp: new Date().toISOString(),
  }));
}, 2000);
```

### Unit Tests

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useRealTimeMetrics } from './useRealTimeMetrics';

test('should connect to WebSocket on mount', async () => {
  const { result, waitForNextUpdate } = renderHook(() =>
    useRealTimeMetrics({ autoConnect: true })
  );

  await waitForNextUpdate();
  expect(result.current.isConnected).toBe(true);
});
```

## Troubleshooting

### WebSocket Not Connecting

1. Check WebSocket URL in environment variables
2. Verify API Gateway WebSocket API is deployed
3. Check browser console for connection errors
4. Ensure CORS is configured for WebSocket endpoint

### Metrics Not Updating

1. Verify WebSocket connection status (check connection indicator)
2. Check if fallback polling is working
3. Verify backend is sending updates
4. Check Redux DevTools for state updates

### High Memory Usage

1. Reduce historical data retention (currently 20 points)
2. Unsubscribe from campaigns when not viewing
3. Clear metrics on component unmount
4. Use React.memo for expensive components

## Future Enhancements

- [ ] Add metric alerts and notifications
- [ ] Export real-time data to CSV
- [ ] Add custom time range selection
- [ ] Implement metric comparison over time
- [ ] Add campaign filtering and search
- [ ] Support multiple dashboard layouts
- [ ] Add dark mode support
- [ ] Implement metric thresholds and warnings
