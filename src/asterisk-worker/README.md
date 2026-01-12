# Asterisk Node.js Worker

This Node.js application runs on the Asterisk EC2 instance and controls Asterisk via AMI (Asterisk Manager Interface) and ARI (Asterisk REST Interface).

## Overview

The Asterisk Worker acts as a bridge between AWS Lambda functions and the Asterisk telephony server. It receives dial commands via HTTP from the Dialer Worker Lambda and originates calls using Asterisk's AMI interface.

## Architecture

```
┌─────────────────┐      HTTP POST      ┌──────────────────┐
│ Dialer Worker   │ ──────────────────> │ Asterisk Worker  │
│ Lambda          │    /dial endpoint    │ (Node.js)        │
└─────────────────┘                      └──────────────────┘
                                                  │
                                                  │ AMI/ARI
                                                  ▼
                                         ┌──────────────────┐
                                         │ Asterisk Server  │
                                         │ (PBX)            │
                                         └──────────────────┘
                                                  │
                                                  │ SIP
                                                  ▼
                                         ┌──────────────────┐
                                         │ SIP Trunk        │
                                         │ (Twilio)         │
                                         └──────────────────┘
```

## Features

- **Call Origination**: Originates outbound calls via AMI
- **Event Handling**: Listens to Asterisk events (call state changes, DTMF, hangup)
- **DTMF Processing**: Handles keypad input from recipients
- **SNS Integration**: Publishes events to AWS SNS topics
- **Call Tracking**: Maintains in-memory state of active calls
- **Health Monitoring**: Provides health check endpoint

## Installation

### Prerequisites

- Node.js 18+ installed
- Asterisk installed and configured
- AWS credentials configured (for SNS access)

### Install Dependencies

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3000
AMI_HOST=localhost
AMI_PORT=5038
AMI_USERNAME=admin
AMI_PASSWORD=your-ami-password
ARI_HOST=localhost
ARI_PORT=8088
ARI_USERNAME=asterisk
ARI_PASSWORD=your-ari-password
AWS_REGION=il-central-1
S3_AUDIO_BUCKET=your-audio-bucket-name
SNS_CALL_EVENTS_TOPIC=arn:aws:sns:...
SNS_DONATION_EVENTS_TOPIC=arn:aws:sns:...
SNS_OPTOUT_EVENTS_TOPIC=arn:aws:sns:...
```

## Running

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### As Systemd Service

The Ansible playbook automatically sets up a systemd service:

```bash
sudo systemctl start asterisk-worker
sudo systemctl status asterisk-worker
sudo systemctl enable asterisk-worker
```

## API Endpoints

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "activeCalls": 5,
  "amiConnected": true,
  "ariConnected": true
}
```

### Originate Call

```http
POST /dial
Content-Type: application/json

{
  "callId": "call-campaign-123-contact-456-1234567890",
  "phoneNumber": "+972501234567",
  "campaignId": "campaign-123",
  "contactId": "contact-456",
  "audioFileUrl": "s3://bucket/audio/message.wav",
  "ivrFlow": { ... },
  "metadata": { ... }
}
```

Response:
```json
{
  "success": true,
  "callId": "call-campaign-123-contact-456-1234567890",
  "message": "Call originated successfully"
}
```

### Get Active Calls

```http
GET /calls
```

Response:
```json
{
  "count": 5,
  "calls": [
    {
      "callId": "call-123",
      "phoneNumber": "+972501234567",
      "campaignId": "campaign-123",
      "state": "answered",
      "startTime": "2024-01-01T12:00:00.000Z",
      "dtmfInputs": ["1"]
    }
  ]
}
```

### Asterisk Dialplan Callbacks

These endpoints are called by the Asterisk dialplan:

- `GET /call-started?call_id=...&phone=...&campaign_id=...`
- `GET /dtmf-action?call_id=...&dtmf=...&action=...&phone=...`
- `GET /call-timeout?call_id=...`
- `GET /call-failed?call_id=...&status=...`
- `GET /call-ended?call_id=...&duration=...&status=...`

## AMI Integration

The worker uses the `asterisk-manager` npm package to connect to Asterisk's Manager Interface.

### Supported AMI Actions

- **Originate**: Initiate outbound calls
- **Hangup**: Terminate active calls
- **GetVar**: Get channel variables
- **SetVar**: Set channel variables

### Monitored AMI Events

- **Newchannel**: New channel created
- **Newstate**: Channel state changed
- **Hangup**: Channel hung up
- **DialBegin**: Dial started
- **DialEnd**: Dial completed

## ARI Integration (Optional)

The worker can optionally use ARI for more advanced call control:

- **Stasis Applications**: Handle calls in ARI
- **Channel Control**: Answer, hangup, play audio
- **DTMF Events**: Real-time DTMF detection
- **Bridge Control**: Conference calls, transfers

## Event Publishing

The worker publishes events to SNS topics:

### Call Events Topic

- `state_change`: Channel state changed
- `dial_end`: Dial attempt completed
- `call_ended`: Call terminated
- `dtmf_received`: DTMF digit received

### Donation Events Topic

- `donation_requested`: User pressed 1 for donation

### Opt-out Events Topic

- `optout_requested`: User pressed 9 to opt-out

## Call Flow

1. **Lambda sends dial command** → `POST /dial`
2. **Worker originates call** → AMI Originate action
3. **Asterisk dials number** → SIP trunk
4. **Call answered** → Dialplan executes
5. **Audio played** → IVR menu
6. **DTMF received** → Dialplan calls `/dtmf-action`
7. **Worker publishes event** → SNS topic
8. **Call ends** → Dialplan calls `/call-ended`
9. **Worker cleans up** → Remove from active calls

## Logging

Logs are written to:
- Console (stdout)
- File: `asterisk-worker.log`
- Systemd journal: `journalctl -u asterisk-worker -f`

Log levels:
- `info`: Normal operations
- `warn`: Warnings (connection issues, etc.)
- `error`: Errors (failed calls, AMI errors)
- `debug`: Detailed debugging (AMI events, etc.)

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Active Calls

```bash
curl http://localhost:3000/calls
```

### Logs

```bash
# Systemd journal
sudo journalctl -u asterisk-worker -f

# Log file
tail -f asterisk-worker.log
```

### Asterisk CLI

```bash
# Connect to Asterisk CLI
sudo asterisk -rvvv

# Show active channels
core show channels

# Show AMI connections
manager show connected

# Show ARI applications
ari show apps
```

## Troubleshooting

### AMI Connection Failed

Check AMI configuration in `/etc/asterisk/manager.conf`:

```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[admin]
secret = your-password
permit = 127.0.0.1/255.255.255.255
read = all
write = all
```

Reload Asterisk:
```bash
sudo asterisk -rx "manager reload"
```

### ARI Connection Failed

Check ARI configuration in `/etc/asterisk/ari.conf`:

```ini
[general]
enabled = yes

[asterisk]
type = user
read_only = no
password = your-password
```

Check HTTP server in `/etc/asterisk/http.conf`:

```ini
[general]
enabled = yes
bindaddr = 0.0.0.0
bindport = 8088
```

Reload Asterisk:
```bash
sudo asterisk -rx "http reload"
sudo asterisk -rx "ari reload"
```

### Calls Not Originating

1. Check SIP trunk registration:
   ```bash
   sudo asterisk -rx "pjsip show registrations"
   ```

2. Check dialplan:
   ```bash
   sudo asterisk -rx "dialplan show outbound-campaign"
   ```

3. Check AMI permissions:
   ```bash
   sudo asterisk -rx "manager show user admin"
   ```

4. Check worker logs:
   ```bash
   sudo journalctl -u asterisk-worker -n 100
   ```

### SNS Publishing Failed

1. Check AWS credentials:
   ```bash
   aws sts get-caller-identity
   ```

2. Check IAM role permissions (EC2 instance role should have SNS publish permissions)

3. Check SNS topic ARNs in `.env`

## Development

### Running Tests

```bash
npm test
```

### Code Structure

```
src/asterisk-worker/
├── index.js              # Main application
├── package.json          # Dependencies
├── .env.example          # Configuration template
└── README.md             # This file
```

### Adding New Features

1. **New DTMF Actions**: Add cases in `handleARIDTMF()` or update dialplan
2. **New Events**: Add SNS publishing in event handlers
3. **New Endpoints**: Add Express routes in the API section

## Security

- **AMI Access**: Restricted to localhost and VPC CIDR
- **ARI Access**: Restricted to localhost and VPC CIDR
- **HTTP API**: Should be behind VPC security group (not public)
- **Credentials**: Stored in environment variables, never in code
- **AWS Permissions**: EC2 instance role with minimal required permissions

## Performance

- **Concurrent Calls**: Supports thousands of concurrent calls
- **Memory Usage**: ~50MB base + ~1KB per active call
- **CPU Usage**: Minimal (event-driven architecture)
- **Network**: Low bandwidth (only control messages, no media)

## License

MIT
