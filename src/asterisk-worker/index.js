/**
 * Asterisk Node.js Worker - AMI/ARI Controller
 * 
 * This Express server receives dial commands from the Dialer Worker Lambda
 * and controls Asterisk via AMI (Asterisk Manager Interface) and ARI (Asterisk REST Interface).
 * 
 * Responsibilities:
 * - Receive dial commands from Lambda via HTTP
 * - Originate calls using AMI or ARI
 * - Handle call state events (DIALING, RINGING, ANSWERED)
 * - Process DTMF inputs from IVR
 * - Publish events to SNS topics
 * - Track call records
 * 
 * Validates: Requirements 4.1, 4.2
 */

const express = require('express');
const AsteriskManager = require('asterisk-manager');
const ariClient = require('ari-client');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Configuration
const PORT = process.env.PORT || 3000;
const AMI_HOST = process.env.AMI_HOST || 'localhost';
const AMI_PORT = parseInt(process.env.AMI_PORT || '5038');
const AMI_USERNAME = process.env.AMI_USERNAME || 'admin';
const AMI_PASSWORD = process.env.AMI_PASSWORD || 'password';
const ARI_HOST = process.env.ARI_HOST || 'localhost';
const ARI_PORT = parseInt(process.env.ARI_PORT || '8088');
const ARI_USERNAME = process.env.ARI_USERNAME || 'asterisk';
const ARI_PASSWORD = process.env.ARI_PASSWORD || 'password';
const AWS_REGION = process.env.AWS_REGION || 'il-central-1';
const S3_AUDIO_BUCKET = process.env.S3_AUDIO_BUCKET || '';
const SNS_CALL_EVENTS_TOPIC = process.env.SNS_CALL_EVENTS_TOPIC || '';
const SNS_DONATION_EVENTS_TOPIC = process.env.SNS_DONATION_EVENTS_TOPIC || '';
const SNS_OPTOUT_EVENTS_TOPIC = process.env.SNS_OPTOUT_EVENTS_TOPIC || '';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'asterisk-worker.log' })
  ]
});

// AWS Clients
const snsClient = new SNSClient({ region: AWS_REGION });
const s3Client = new S3Client({ region: AWS_REGION });
const pollyClient = new PollyClient({ region: AWS_REGION });

// Express app
const app = express();
app.use(express.json());

// In-memory call tracking
const activeCalls = new Map();

// AMI Client
let amiClient = null;
let ariClientInstance = null;

/**
 * Initialize AMI connection
 */
function initializeAMI() {
  amiClient = new AsteriskManager(
    AMI_PORT,
    AMI_HOST,
    AMI_USERNAME,
    AMI_PASSWORD,
    true // Enable events
  );

  amiClient.keepConnected();

  amiClient.on('connect', () => {
    logger.info('AMI connected');
  });

  amiClient.on('close', () => {
    logger.warn('AMI connection closed');
  });

  amiClient.on('error', (error) => {
    logger.error('AMI error:', error);
  });

  // Listen for call events
  amiClient.on('managerevent', (event) => {
    handleAMIEvent(event);
  });

  logger.info('AMI client initialized');
}

/**
 * Initialize ARI connection
 */
async function initializeARI() {
  try {
    ariClientInstance = await ariClient.connect(
      `http://${ARI_HOST}:${ARI_PORT}`,
      ARI_USERNAME,
      ARI_PASSWORD
    );

    logger.info('ARI connected');

    // Listen for StasisStart events (calls entering ARI application)
    ariClientInstance.on('StasisStart', (event, channel) => {
      handleARIStasisStart(event, channel);
    });

    // Listen for ChannelDtmfReceived events
    ariClientInstance.on('ChannelDtmfReceived', (event, channel) => {
      handleARIDTMF(event, channel);
    });

    // Listen for ChannelDestroyed events
    ariClientInstance.on('ChannelDestroyed', (event, channel) => {
      handleARIChannelDestroyed(event, channel);
    });

  } catch (error) {
    logger.error('Failed to connect to ARI:', error);
  }
}

/**
 * Handle AMI events
 */
function handleAMIEvent(event) {
  const eventName = event.event;

  switch (eventName) {
    case 'Newchannel':
      logger.info(`New channel: ${event.channel}`);
      break;

    case 'Newstate':
      logger.info(`Channel state changed: ${event.channel} -> ${event.channelstatedesc}`);
      handleChannelStateChange(event);
      break;

    case 'Hangup':
      logger.info(`Channel hangup: ${event.channel}`);
      handleChannelHangup(event);
      break;

    case 'DialBegin':
      logger.info(`Dial begin: ${event.destchannel}`);
      break;

    case 'DialEnd':
      logger.info(`Dial end: ${event.destchannel} - ${event.dialstatus}`);
      handleDialEnd(event);
      break;

    default:
      // Log other events at debug level
      logger.debug(`AMI Event: ${eventName}`, event);
  }
}

/**
 * Handle channel state changes
 */
function handleChannelStateChange(event) {
  const callId = event.uniqueid;
  const state = event.channelstatedesc;

  if (activeCalls.has(callId)) {
    const call = activeCalls.get(callId);
    call.state = state;
    call.lastUpdate = new Date();

    // Publish state change to SNS
    publishCallEvent({
      eventType: 'state_change',
      callId,
      state,
      channel: event.channel,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle dial end events
 */
function handleDialEnd(event) {
  const callId = event.uniqueid;
  const dialStatus = event.dialstatus;

  if (activeCalls.has(callId)) {
    const call = activeCalls.get(callId);
    call.dialStatus = dialStatus;
    call.lastUpdate = new Date();

    // Publish dial result
    publishCallEvent({
      eventType: 'dial_end',
      callId,
      dialStatus,
      timestamp: new Date().toISOString()
    });

    // If call was not answered, clean up
    if (dialStatus !== 'ANSWER') {
      logger.info(`Call ${callId} not answered: ${dialStatus}`);
      activeCalls.delete(callId);
    }
  }
}

/**
 * Handle channel hangup
 */
function handleChannelHangup(event) {
  const callId = event.uniqueid;

  if (activeCalls.has(callId)) {
    const call = activeCalls.get(callId);
    call.endTime = new Date();
    call.duration = Math.floor((call.endTime - call.startTime) / 1000);
    call.hangupCause = event.cause;
    call.hangupCauseText = event.causetxt;

    logger.info(`Call ${callId} ended: duration=${call.duration}s, cause=${call.hangupCauseText}`);

    // Publish call ended event
    publishCallEvent({
      eventType: 'call_ended',
      callId,
      duration: call.duration,
      hangupCause: call.hangupCauseText,
      dtmfInputs: call.dtmfInputs,
      timestamp: new Date().toISOString()
    });

    // Clean up
    activeCalls.delete(callId);
  }
}

/**
 * Handle ARI Stasis Start (call entering ARI application)
 */
function handleARIStasisStart(event, channel) {
  logger.info(`ARI Stasis Start: ${channel.id}`);

  const callId = channel.id;

  if (!activeCalls.has(callId)) {
    activeCalls.set(callId, {
      callId,
      channelId: channel.id,
      state: 'stasis',
      startTime: new Date(),
      dtmfInputs: []
    });
  }

  // Answer the channel
  channel.answer((err) => {
    if (err) {
      logger.error(`Failed to answer channel ${channel.id}:`, err);
      return;
    }

    logger.info(`Channel ${channel.id} answered`);

    // Play audio or start IVR
    // This would be customized based on campaign configuration
  });
}

/**
 * Handle ARI DTMF events
 */
function handleARIDTMF(event, channel) {
  const digit = event.digit;
  const callId = channel.id;

  logger.info(`DTMF received on ${callId}: ${digit}`);

  if (activeCalls.has(callId)) {
    const call = activeCalls.get(callId);
    call.dtmfInputs.push(digit);

    // Publish DTMF event
    publishCallEvent({
      eventType: 'dtmf_received',
      callId,
      digit,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle ARI channel destroyed
 */
function handleARIChannelDestroyed(event, channel) {
  logger.info(`ARI Channel destroyed: ${channel.id}`);

  const callId = channel.id;

  if (activeCalls.has(callId)) {
    activeCalls.delete(callId);
  }
}

/**
 * Publish event to SNS
 */
async function publishCallEvent(event) {
  try {
    const params = {
      TopicArn: SNS_CALL_EVENTS_TOPIC,
      Message: JSON.stringify(event),
      Subject: `Call Event: ${event.eventType}`
    };

    await snsClient.send(new PublishCommand(params));
    logger.debug(`Published event to SNS: ${event.eventType}`);
  } catch (error) {
    logger.error('Failed to publish event to SNS:', error);
  }
}

/**
 * Originate outbound call using AMI
 */
function originateCall(dialCommand) {
  return new Promise((resolve, reject) => {
    const { callId, phoneNumber, campaignId, contactId, audioFileUrl, ivrFlow, metadata } = dialCommand;

    logger.info(`Originating call ${callId} to ${phoneNumber}`);

    // Normalize phone number - remove + and any non-digit characters for Asterisk
    const normalizedPhoneNumber = phoneNumber.replace(/[^\d]/g, '');
    
    if (!normalizedPhoneNumber) {
      const error = new Error(`Invalid phone number: ${phoneNumber}`);
      logger.error(`Failed to originate call ${callId}:`, error);
      reject(error);
      return;
    }

    logger.info(`Normalized phone number: ${phoneNumber} -> ${normalizedPhoneNumber}`);

    // Store call info
    activeCalls.set(callId, {
      callId,
      phoneNumber: normalizedPhoneNumber,
      originalPhoneNumber: phoneNumber,
      campaignId,
      contactId: contactId || 'unknown',
      audioFileUrl: audioFileUrl || 'default-message',
      ivrFlow,
      metadata: metadata || {},
      state: 'originating',
      startTime: new Date(),
      dtmfInputs: []
    });

    // AMI Originate action - ensure all variables are strings
    const action = {
      action: 'Originate',
      channel: `PJSIP/${normalizedPhoneNumber}@{{ sip_trunk_provider }}-trunk`, // Will be replaced by Ansible template
      context: 'outbound-campaign',
      exten: normalizedPhoneNumber, // Use normalized number
      priority: 1,
      timeout: 30000, // 30 seconds
      callerid: (metadata && metadata.callerIdNumber) ? metadata.callerIdNumber : 'Campaign',
      variable: {
        CAMPAIGN_ID: String(campaignId || ''),
        CONTACT_ID: String(contactId || ''),
        CALL_ID: String(callId || ''),
        AUDIO_FILE: String(audioFileUrl || 'default-message'),
        ORIGINAL_PHONE: String(phoneNumber || '') // Keep original for reference
      },
      async: true
    };

    logger.info(`AMI Originate action:`, action);

    amiClient.action(action, (err, response) => {
      if (err) {
        logger.error(`Failed to originate call ${callId}:`, err);
        activeCalls.delete(callId);
        reject(err);
      } else {
        logger.info(`Call ${callId} originated successfully`);
        resolve({ success: true, callId, response });
      }
    });
  });
}

// ===== HTTP API Endpoints =====

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeCalls: activeCalls.size,
    amiConnected: amiClient && amiClient.connected,
    ariConnected: ariClientInstance !== null
  });
});

/**
 * Dial endpoint - receives dial commands from Lambda
 */
app.post('/dial', async (req, res) => {
  try {
    const dialCommand = req.body;

    logger.info('Received dial command:', dialCommand);

    // Validate dial command
    if (!dialCommand.callId || !dialCommand.phoneNumber || !dialCommand.campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: callId, phoneNumber, campaignId'
      });
    }

    // Ensure all fields have default values to prevent undefined errors
    const sanitizedDialCommand = {
      callId: dialCommand.callId,
      phoneNumber: dialCommand.phoneNumber,
      campaignId: dialCommand.campaignId,
      contactId: dialCommand.contactId || 'unknown',
      audioFileUrl: dialCommand.audioFileUrl || 'default-message',
      ivrFlow: dialCommand.ivrFlow || null,
      metadata: dialCommand.metadata || {}
    };

    // Originate call
    const result = await originateCall(sanitizedDialCommand);

    res.json({
      success: true,
      callId: result.callId,
      message: 'Call originated successfully'
    });

  } catch (error) {
    logger.error('Error processing dial command:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Call started callback from Asterisk dialplan
 */
app.get('/call-started', (req, res) => {
  const { call_id, phone, campaign_id } = req.query;

  logger.info(`Call started: ${call_id}`);

  if (activeCalls.has(call_id)) {
    const call = activeCalls.get(call_id);
    call.state = 'answered';
    call.answerTime = new Date();
  }

  res.json({ success: true });
});

/**
 * DTMF action callback from Asterisk dialplan
 */
app.get('/dtmf-action', async (req, res) => {
  const { call_id, dtmf, action, phone } = req.query;

  logger.info(`DTMF action: ${call_id} - ${dtmf} - ${action}`);

  if (activeCalls.has(call_id)) {
    const call = activeCalls.get(call_id);
    call.dtmfInputs.push(dtmf);

    // Handle different actions
    switch (action) {
      case 'donation':
        // Publish to donation events topic
        await publishDonationEvent(call, phone);
        break;

      case 'optout':
        // Publish to opt-out events topic
        await publishOptoutEvent(call, phone);
        break;

      case 'info':
        // Log info request
        logger.info(`Info requested for call ${call_id}`);
        break;

      default:
        logger.warn(`Unknown action: ${action}`);
    }
  }

  res.json({ success: true });
});

/**
 * Call timeout callback from Asterisk dialplan
 */
app.get('/call-timeout', (req, res) => {
  const { call_id } = req.query;

  logger.info(`Call timeout: ${call_id}`);

  if (activeCalls.has(call_id)) {
    const call = activeCalls.get(call_id);
    call.timeout = true;
  }

  res.json({ success: true });
});

/**
 * Call failed callback from Asterisk dialplan
 */
app.get('/call-failed', (req, res) => {
  const { call_id, status } = req.query;

  logger.info(`Call failed: ${call_id} - ${status}`);

  if (activeCalls.has(call_id)) {
    activeCalls.delete(call_id);
  }

  res.json({ success: true });
});

/**
 * Call ended callback from Asterisk dialplan
 */
app.get('/call-ended', (req, res) => {
  const { call_id, duration, status } = req.query;

  logger.info(`Call ended: ${call_id} - duration: ${duration}s - status: ${status}`);

  if (activeCalls.has(call_id)) {
    const call = activeCalls.get(call_id);
    call.endTime = new Date();
    call.duration = parseInt(duration);
    call.finalStatus = status;
  }

  res.json({ success: true });
});

/**
 * Get active calls
 */
app.get('/calls', (req, res) => {
  const calls = Array.from(activeCalls.values());
  res.json({
    count: calls.length,
    calls
  });
});

/**
 * Publish donation event to SNS
 */
async function publishDonationEvent(call, phone) {
  try {
    const event = {
      eventType: 'donation_requested',
      callId: call.callId,
      phoneNumber: phone,
      campaignId: call.campaignId,
      contactId: call.contactId,
      timestamp: new Date().toISOString()
    };

    const params = {
      TopicArn: SNS_DONATION_EVENTS_TOPIC,
      Message: JSON.stringify(event),
      Subject: 'Donation Requested'
    };

    await snsClient.send(new PublishCommand(params));
    logger.info(`Published donation event for call ${call.callId}`);
  } catch (error) {
    logger.error('Failed to publish donation event:', error);
  }
}

/**
 * Publish opt-out event to SNS
 */
async function publishOptoutEvent(call, phone) {
  try {
    const event = {
      eventType: 'optout_requested',
      callId: call.callId,
      phoneNumber: phone,
      campaignId: call.campaignId,
      contactId: call.contactId,
      timestamp: new Date().toISOString()
    };

    const params = {
      TopicArn: SNS_OPTOUT_EVENTS_TOPIC,
      Message: JSON.stringify(event),
      Subject: 'Opt-out Requested'
    };

    await snsClient.send(new PublishCommand(params));
    logger.info(`Published opt-out event for call ${call.callId}`);
  } catch (error) {
    logger.error('Failed to publish opt-out event:', error);
  }
}

// ===== Server Startup =====

async function startServer() {
  try {
    // Initialize AMI
    initializeAMI();

    // Initialize ARI (optional, can use AMI only)
    // await initializeARI();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Asterisk Worker listening on port ${PORT}`);
      logger.info(`AMI: ${AMI_HOST}:${AMI_PORT}`);
      logger.info(`ARI: ${ARI_HOST}:${ARI_PORT}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (amiClient) {
    amiClient.disconnect();
  }
  
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  if (amiClient) {
    amiClient.disconnect();
  }
  
  process.exit(0);
});

// Start the server
startServer();
