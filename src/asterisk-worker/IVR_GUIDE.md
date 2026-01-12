# IVR System Guide

## Overview

The Interactive Voice Response (IVR) system handles automated call interactions for the Mass Voice Campaign System. It plays pre-recorded messages, captures DTMF (keypad) input, and executes actions based on user responses.

## Architecture

```
┌─────────────┐
│   Caller    │
└──────┬──────┘
       │ Dials in / Called
       ▼
┌─────────────────────┐
│  Asterisk Server    │
│  (PBX)              │
└──────┬──────────────┘
       │ Executes Dialplan
       ▼
┌─────────────────────┐
│  IVR Dialplan       │
│  (extensions.conf)  │
└──────┬──────────────┘
       │ Plays Audio
       │ Captures DTMF
       ▼
┌─────────────────────┐
│  Node.js Worker     │
│  (HTTP Callbacks)   │
└──────┬──────────────┘
       │ Publishes Events
       ▼
┌─────────────────────┐
│  AWS SNS Topics     │
│  (Events)           │
└─────────────────────┘
```

## IVR Flow

### 1. Call Initiation

**Outbound Campaign Call:**
```
Lambda → Node.js Worker → AMI Originate → Asterisk → SIP Trunk → Recipient
```

**Inbound Call (if applicable):**
```
Recipient → SIP Trunk → Asterisk → Dialplan [from-trunk]
```

### 2. Call Answered

When the call is answered:

1. Asterisk executes `[ivr-main]` context
2. Sets DTMF timeouts (5s between digits, 10s to start)
3. Generates unique `CALL_ID` (Asterisk UNIQUEID)
4. Notifies Node.js Worker: `GET /call-started`
5. Plays campaign audio message
6. Waits for DTMF input

### 3. DTMF Input Processing

User presses a key on their phone:

1. Asterisk captures DTMF digit
2. Stores in `DTMF_INPUTS` variable
3. Routes to `[process-dtmf]` context
4. Executes action based on digit:
   - **1**: Donation/Transfer action
   - **2**: More information
   - **3**: Transfer to agent
   - **9**: Opt-out (blacklist)
   - **0**: Repeat menu
   - **Other**: Invalid input error

### 4. Action Execution

For each DTMF action:

1. Notifies Node.js Worker: `GET /dtmf-action?dtmf=X&action=Y`
2. Node.js Worker publishes event to SNS
3. Plays confirmation audio
4. Either:
   - Ends call (donation, opt-out)
   - Returns to menu (more info)
   - Transfers to agent

### 5. Timeout Handling

If no DTMF input within 10 seconds:

1. Routes to `[ivr-timeout]` context
2. Notifies Node.js Worker: `GET /call-timeout`
3. Plays goodbye message
4. Ends call

### 6. Call Termination

When call ends:

1. Hangup handler executes
2. Notifies Node.js Worker: `GET /call-ended?duration=X&status=Y`
3. Node.js Worker publishes call ended event
4. Cleans up call tracking

## Dialplan Contexts

### [ivr-main]

Main IVR menu context. Plays campaign audio and waits for input.

**Variables Set:**
- `CALL_ID`: Unique call identifier
- `DTMF_INPUTS`: Accumulated DTMF digits
- `TIMEOUT(digit)`: 5 seconds
- `TIMEOUT(response)`: 10 seconds

**Flow:**
1. Set timeouts and variables
2. Notify worker (call-started)
3. Play audio (${AUDIO_FILE})
4. Go to ivr-wait-input

### [ivr-wait-input]

Waits for single DTMF digit with timeout.

**Flow:**
1. Read single digit (10s timeout)
2. If timeout → ivr-timeout
3. If digit received → process-dtmf

### [process-dtmf]

Processes DTMF input and executes actions.

**Extensions:**
- `1`: Donation action
- `2`: More information
- `3`: Transfer to agent
- `9`: Opt-out (blacklist)
- `0`: Repeat menu
- `_X`: Invalid input (any other digit)

### [ivr-timeout]

Handles no input timeout.

**Flow:**
1. Notify worker (call-timeout)
2. Play goodbye message
3. Hangup

### [outbound-campaign]

Context for originating outbound calls.

**Flow:**
1. Set caller ID
2. Dial via SIP trunk
3. If answered → ivr-main
4. If not answered → notify worker and hangup

### [hangup-handler]

Executes when any call ends.

**Flow:**
1. Notify worker (call-ended)
2. Return

## DTMF Actions

### Action 1: Donation

**Trigger:** User presses 1

**Flow:**
1. Notify Node.js Worker: `/dtmf-action?dtmf=1&action=donation`
2. Worker publishes to `donation-events` SNS topic
3. Lambda function sends SMS with donation link
4. Play thank you message
5. Hangup

**Requirements:** 4.2, 5.1

### Action 2: More Information

**Trigger:** User presses 2

**Flow:**
1. Notify Node.js Worker: `/dtmf-action?dtmf=2&action=info`
2. Play additional information audio
3. Return to main menu

### Action 3: Transfer to Agent

**Trigger:** User presses 3

**Flow:**
1. Notify Node.js Worker: `/dtmf-action?dtmf=3&action=transfer`
2. Play transfer message
3. Transfer to agent queue (if configured)
4. Hangup

### Action 9: Opt-Out

**Trigger:** User presses 9

**Flow:**
1. Notify Node.js Worker: `/dtmf-action?dtmf=9&action=optout&phone=X`
2. Worker publishes to `optout-events` SNS topic
3. Lambda function adds number to blacklist
4. Play opt-out confirmation
5. Hangup immediately

**Requirements:** 3.3, 4.3

### Invalid Input

**Trigger:** User presses any other digit

**Flow:**
1. Play error message: "Invalid option"
2. Play retry message: "Please try again"
3. Return to wait for input

**Requirements:** 4.4

### Timeout

**Trigger:** No input for 10 seconds

**Flow:**
1. Notify Node.js Worker: `/call-timeout`
2. Play goodbye message
3. Hangup

**Requirements:** 4.6

## Audio Files

The IVR system requires the following audio files:

### Campaign Audio
- `${AUDIO_FILE}`: Main campaign message (set per campaign)

### System Prompts
- `thank-you-donation`: "Thank you for your interest. You will receive an SMS with a donation link shortly."
- `more-info`: Additional information message
- `transferring`: "Please hold while we transfer you to an agent."
- `optout-confirmed`: "You have been removed from our calling list. Goodbye."
- `invalid-option`: "Invalid option."
- `please-try-again`: "Please try again."
- `goodbye`: "Thank you for your time. Goodbye."

### Audio File Formats

Asterisk supports multiple formats:
- **WAV**: Uncompressed, high quality
- **GSM**: Compressed, telephony quality
- **ULAW/ALAW**: Telephony codecs
- **MP3**: Compressed (requires mp3 module)

**Recommended:** GSM or ULAW for telephony (8kHz, mono)

### Audio File Locations

1. **Local Files:** `/var/lib/asterisk/sounds/custom/`
2. **S3 Bucket:** Downloaded on-demand or cached locally
3. **HTTP URL:** Streamed from web server

## Configuration

### Timeouts

```asterisk
Set(TIMEOUT(digit)=5)      ; 5 seconds between digits
Set(TIMEOUT(response)=10)  ; 10 seconds to start input
```

Adjust based on campaign needs:
- Shorter timeouts: Faster call flow, may frustrate users
- Longer timeouts: More user-friendly, longer call duration

### Node.js Worker URL

```asterisk
[globals]
NODEJS_WORKER_URL=http://localhost:3000
```

Update if worker runs on different host/port.

### SIP Trunk

```asterisk
Dial(PJSIP/${EXTEN}@twilio-trunk,30,g)
```

Replace `twilio-trunk` with your configured trunk name.

### Caller ID

```asterisk
Set(CALLERID(num)=${CAMPAIGN_CALLER_ID})
```

Set per campaign in originate command.

## Multi-Level Menus

For complex IVR flows with submenus:

```asterisk
[ivr-main]
exten => s,1,NoOp(Main menu)
 same => n,Playback(main-menu)
 same => n,Read(INPUT,,1,,10,)
 same => n,GotoIf($["${INPUT}" = "1"]?submenu1,s,1)
 same => n,GotoIf($["${INPUT}" = "2"]?submenu2,s,1)

[submenu1]
exten => s,1,NoOp(Submenu 1)
 same => n,Playback(submenu1-options)
 same => n,Read(INPUT,,1,,10,)
 ; Process submenu1 input
 same => n,Goto(ivr-main,s,1)  ; Return to main menu

[submenu2]
exten => s,1,NoOp(Submenu 2)
 same => n,Playback(submenu2-options)
 same => n,Read(INPUT,,1,,10,)
 ; Process submenu2 input
 same => n,Goto(ivr-main,s,1)  ; Return to main menu
```

**Requirements:** 4.5

## Testing

### Test Call via Asterisk CLI

```bash
# Connect to Asterisk CLI
sudo asterisk -rvvv

# Originate test call
originate PJSIP/+972501234567@twilio-trunk extension test@outbound-campaign

# Watch call progress
core show channels verbose
```

### Test DTMF Input

```bash
# While call is active, send DTMF
channel originate PJSIP/+972501234567@twilio-trunk extension s@ivr-main
# Then send DTMF
core send dtmf <channel-id> 1
```

### Test via Node.js Worker

```bash
# Send dial command
curl -X POST http://localhost:3000/dial \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-call-123",
    "phoneNumber": "+972501234567",
    "campaignId": "test-campaign",
    "contactId": "test-contact",
    "audioFileUrl": "demo-congrats"
  }'
```

## Monitoring

### View Active Calls

```bash
sudo asterisk -rx "core show channels"
```

### View Call Details

```bash
sudo asterisk -rx "core show channel <channel-id>"
```

### View Dialplan

```bash
sudo asterisk -rx "dialplan show ivr-main"
sudo asterisk -rx "dialplan show process-dtmf"
```

### Enable Verbose Logging

```bash
sudo asterisk -rx "core set verbose 5"
sudo asterisk -rx "core set debug 5"
```

### View Logs

```bash
# Full log
sudo tail -f /var/log/asterisk/full

# Messages log
sudo tail -f /var/log/asterisk/messages
```

## Troubleshooting

### Audio Not Playing

1. Check audio file exists:
   ```bash
   ls -la /var/lib/asterisk/sounds/custom/
   ```

2. Check file format:
   ```bash
   file /var/lib/asterisk/sounds/custom/message.wav
   ```

3. Convert if needed:
   ```bash
   sox input.mp3 -r 8000 -c 1 output.wav
   ```

### DTMF Not Detected

1. Check DTMF mode in PJSIP:
   ```ini
   [twilio-trunk]
   dtmf_mode=rfc4733  ; or inband, info
   ```

2. Enable DTMF logging:
   ```bash
   sudo asterisk -rx "core set debug 5"
   ```

3. Test DTMF:
   ```bash
   sudo asterisk -rx "core send dtmf <channel> 1"
   ```

### Callbacks Not Working

1. Check Node.js Worker is running:
   ```bash
   curl http://localhost:3000/health
   ```

2. Check network connectivity:
   ```bash
   ping localhost
   ```

3. Check Asterisk can reach worker:
   ```bash
   sudo asterisk -rx "core show settings" | grep curl
   ```

4. Enable CURL debugging in Asterisk:
   ```ini
   ; logger.conf
   [logfiles]
   curl => notice,warning,error,debug
   ```

### Call Not Originating

1. Check SIP trunk registration:
   ```bash
   sudo asterisk -rx "pjsip show registrations"
   ```

2. Check endpoint status:
   ```bash
   sudo asterisk -rx "pjsip show endpoints"
   ```

3. Check dialplan:
   ```bash
   sudo asterisk -rx "dialplan show outbound-campaign"
   ```

4. Test dial manually:
   ```bash
   sudo asterisk -rx "originate PJSIP/+972501234567@twilio-trunk extension test@outbound-campaign"
   ```

## Best Practices

### Audio Quality

- Use 8kHz sample rate for telephony
- Mono channel (not stereo)
- Normalize audio levels
- Remove silence at start/end
- Keep messages concise (< 30 seconds)

### DTMF Handling

- Provide clear instructions
- Allow menu repeat (press 0)
- Handle invalid input gracefully
- Set reasonable timeouts
- Confirm destructive actions (opt-out)

### Error Handling

- Always have fallback for invalid input
- Log all errors for debugging
- Provide user-friendly error messages
- Don't leave caller in dead-end state

### Performance

- Cache audio files locally
- Use efficient audio formats (GSM)
- Limit concurrent calls per server
- Monitor system resources

### Security

- Validate all input
- Sanitize variables before use
- Restrict AMI/ARI access
- Use HTTPS for callbacks
- Encrypt sensitive data

## Requirements Validation

This IVR implementation validates the following requirements:

- ✅ **4.1**: Play pre-recorded audio on answer
- ✅ **4.2**: Execute configured action for DTMF 1
- ✅ **4.3**: Add to blacklist and terminate on DTMF 9
- ✅ **4.4**: Handle invalid DTMF input
- ✅ **4.5**: Navigate multi-level menu hierarchies
- ✅ **4.6**: Handle timeout with no DTMF input

## References

- [Asterisk Dialplan Documentation](https://wiki.asterisk.org/wiki/display/AST/Dialplan)
- [PJSIP Configuration](https://wiki.asterisk.org/wiki/display/AST/Configuring+res_pjsip)
- [Asterisk Applications](https://wiki.asterisk.org/wiki/display/AST/Asterisk+18+Application_Reference)
- [DTMF Handling](https://wiki.asterisk.org/wiki/display/AST/DTMF)
