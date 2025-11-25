// MongoDB initialization script for test database
// This script runs when the MongoDB container starts

db = db.getSiblingDB('campaign_test');

// Create collections with validation schemas
db.createCollection('call_records', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['campaignId', 'contactId', 'phoneNumber', 'status', 'startTime'],
      properties: {
        campaignId: {
          bsonType: 'string',
          description: 'Campaign UUID - required'
        },
        contactId: {
          bsonType: 'string',
          description: 'Contact UUID - required'
        },
        phoneNumber: {
          bsonType: 'string',
          pattern: '^\\+[1-9][0-9]{1,14}$',
          description: 'E.164 phone number - required'
        },
        status: {
          enum: ['queued', 'dialing', 'ringing', 'answered', 'in_progress', 'completed', 'failed', 'busy', 'no_answer', 'blacklisted'],
          description: 'Call status - required'
        },
        startTime: {
          bsonType: 'date',
          description: 'Call start timestamp - required'
        },
        endTime: {
          bsonType: ['date', 'null'],
          description: 'Call end timestamp'
        },
        duration: {
          bsonType: ['int', 'null'],
          description: 'Call duration in seconds'
        },
        outcome: {
          bsonType: 'string',
          description: 'Call outcome'
        },
        dtmfInputs: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'DTMF inputs received'
        },
        actionsTriggered: {
          bsonType: 'array',
          description: 'Actions triggered during call'
        },
        cost: {
          bsonType: 'double',
          minimum: 0,
          description: 'Call cost'
        }
      }
    }
  }
});

db.createCollection('sms_records', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['campaignId', 'contactId', 'phoneNumber', 'message', 'status', 'sentAt'],
      properties: {
        campaignId: {
          bsonType: 'string',
          description: 'Campaign UUID - required'
        },
        contactId: {
          bsonType: 'string',
          description: 'Contact UUID - required'
        },
        phoneNumber: {
          bsonType: 'string',
          pattern: '^\\+[1-9][0-9]{1,14}$',
          description: 'E.164 phone number - required'
        },
        message: {
          bsonType: 'string',
          description: 'SMS message content - required'
        },
        status: {
          enum: ['queued', 'sent', 'delivered', 'failed', 'undelivered'],
          description: 'SMS delivery status - required'
        },
        sentAt: {
          bsonType: 'date',
          description: 'SMS sent timestamp - required'
        },
        deliveredAt: {
          bsonType: ['date', 'null'],
          description: 'SMS delivered timestamp'
        },
        failureReason: {
          bsonType: ['string', 'null'],
          description: 'Failure reason if delivery failed'
        },
        ttsFallbackTriggered: {
          bsonType: 'bool',
          description: 'Whether TTS fallback was triggered'
        },
        cost: {
          bsonType: 'double',
          minimum: 0,
          description: 'SMS cost'
        }
      }
    }
  }
});

db.createCollection('event_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['eventType', 'timestamp', 'data'],
      properties: {
        eventType: {
          bsonType: 'string',
          description: 'Type of event - required'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Event timestamp - required'
        },
        campaignId: {
          bsonType: ['string', 'null'],
          description: 'Associated campaign ID'
        },
        contactId: {
          bsonType: ['string', 'null'],
          description: 'Associated contact ID'
        },
        data: {
          bsonType: 'object',
          description: 'Event data - required'
        }
      }
    }
  }
});

// Create indexes for performance
db.call_records.createIndex({ campaignId: 1, startTime: -1 });
db.call_records.createIndex({ contactId: 1 });
db.call_records.createIndex({ phoneNumber: 1 });
db.call_records.createIndex({ status: 1 });
db.call_records.createIndex({ startTime: -1 });

db.sms_records.createIndex({ campaignId: 1, sentAt: -1 });
db.sms_records.createIndex({ contactId: 1 });
db.sms_records.createIndex({ phoneNumber: 1 });
db.sms_records.createIndex({ status: 1 });

db.event_logs.createIndex({ eventType: 1, timestamp: -1 });
db.event_logs.createIndex({ campaignId: 1, timestamp: -1 });
db.event_logs.createIndex({ timestamp: -1 });

print('MongoDB test database initialized successfully');
