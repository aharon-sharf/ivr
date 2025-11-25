/**
 * Test Data Fixtures for Integration Tests
 * 
 * This module provides reusable test data for integration tests.
 * All fixtures use deterministic data for reproducible tests.
 */

export interface TestUser {
  email: string;
  cognitoUserId: string;
  role: 'CampaignManager' | 'Administrator' | 'Analyst';
}

export interface TestCampaign {
  name: string;
  type: 'voice' | 'sms' | 'hybrid';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  config: {
    audioFileUrl?: string;
    smsTemplate?: string;
    ivrFlow?: any;
    schedule?: {
      startTime: Date;
      endTime: Date;
      timezone: string;
    };
    callingWindows?: Array<{
      dayOfWeek: number[];
      startHour: number;
      endHour: number;
    }>;
  };
}

export interface TestContact {
  phoneNumber: string;
  metadata: {
    firstName?: string;
    lastName?: string;
    customField?: string;
  };
  timezone?: string;
  smsCapable: boolean;
}

export interface TestCallRecord {
  phoneNumber: string;
  status: 'queued' | 'dialing' | 'ringing' | 'answered' | 'completed' | 'failed' | 'busy' | 'no_answer';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  outcome: string;
  dtmfInputs: string[];
  actionsTriggered: any[];
  cost: number;
}

export interface TestSMSRecord {
  phoneNumber: string;
  message: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  sentAt: Date;
  deliveredAt?: Date;
  failureReason?: string;
  ttsFallbackTriggered: boolean;
  cost: number;
}

/**
 * Test Users
 */
export const testUsers: TestUser[] = [
  {
    email: 'campaign.manager@test.com',
    cognitoUserId: 'test-cognito-cm-001',
    role: 'CampaignManager',
  },
  {
    email: 'admin@test.com',
    cognitoUserId: 'test-cognito-admin-001',
    role: 'Administrator',
  },
  {
    email: 'analyst@test.com',
    cognitoUserId: 'test-cognito-analyst-001',
    role: 'Analyst',
  },
];

/**
 * Test Campaigns
 */
export const testCampaigns: TestCampaign[] = [
  {
    name: 'Test Voice Campaign 1',
    type: 'voice',
    status: 'draft',
    config: {
      audioFileUrl: 'https://test-bucket.s3.amazonaws.com/audio/test-message-1.mp3',
      ivrFlow: {
        nodes: [
          {
            id: 'start',
            type: 'play_audio',
            audioUrl: 'https://test-bucket.s3.amazonaws.com/audio/test-message-1.mp3',
            nextNodeId: 'capture',
          },
          {
            id: 'capture',
            type: 'capture_input',
            timeout: 10,
            validInputs: ['1', '9'],
            actions: {
              '1': { type: 'send_sms', parameters: { template: 'donation_link' } },
              '9': { type: 'add_to_blacklist' },
            },
          },
        ],
        startNodeId: 'start',
      },
      schedule: {
        startTime: new Date('2024-01-01T09:00:00Z'),
        endTime: new Date('2024-01-01T17:00:00Z'),
        timezone: 'America/New_York',
      },
      callingWindows: [
        {
          dayOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
          startHour: 9,
          endHour: 17,
        },
      ],
    },
  },
  {
    name: 'Test SMS Campaign 1',
    type: 'sms',
    status: 'draft',
    config: {
      smsTemplate: 'Hello {{firstName}}, this is a test message from our campaign.',
      schedule: {
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T18:00:00Z'),
        timezone: 'America/New_York',
      },
      callingWindows: [
        {
          dayOfWeek: [1, 2, 3, 4, 5, 6, 7], // All days
          startHour: 10,
          endHour: 18,
        },
      ],
    },
  },
];

/**
 * Test Contacts
 */
export const testContacts: TestContact[] = [
  {
    phoneNumber: '+12125551001',
    metadata: {
      firstName: 'John',
      lastName: 'Doe',
      customField: 'VIP',
    },
    timezone: 'America/New_York',
    smsCapable: true,
  },
  {
    phoneNumber: '+12125551002',
    metadata: {
      firstName: 'Jane',
      lastName: 'Smith',
    },
    timezone: 'America/New_York',
    smsCapable: true,
  },
  {
    phoneNumber: '+442071234567',
    metadata: {
      firstName: 'David',
      lastName: 'Johnson',
    },
    timezone: 'Europe/London',
    smsCapable: false, // Landline
  },
  {
    phoneNumber: '+972501234567',
    metadata: {
      firstName: 'Sarah',
      lastName: 'Cohen',
    },
    timezone: 'Asia/Jerusalem',
    smsCapable: true,
  },
  {
    phoneNumber: '+12125551005',
    metadata: {
      firstName: 'Michael',
      lastName: 'Brown',
    },
    timezone: 'America/Los_Angeles',
    smsCapable: true,
  },
];

/**
 * Test Blacklist Entries
 */
export const testBlacklistEntries = [
  {
    phoneNumber: '+12125559999',
    reason: 'User opt-out via DTMF',
    source: 'user_optout' as const,
  },
  {
    phoneNumber: '+12125559998',
    reason: 'Compliance requirement',
    source: 'compliance' as const,
  },
];

/**
 * Test Call Records
 */
export const testCallRecords: TestCallRecord[] = [
  {
    phoneNumber: '+12125551001',
    status: 'completed',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:02:30Z'),
    duration: 150,
    outcome: 'converted',
    dtmfInputs: ['1'],
    actionsTriggered: [{ type: 'send_sms', parameters: { template: 'donation_link' } }],
    cost: 0.05,
  },
  {
    phoneNumber: '+12125551002',
    status: 'completed',
    startTime: new Date('2024-01-01T10:05:00Z'),
    endTime: new Date('2024-01-01T10:06:00Z'),
    duration: 60,
    outcome: 'opted_out',
    dtmfInputs: ['9'],
    actionsTriggered: [{ type: 'add_to_blacklist' }],
    cost: 0.03,
  },
  {
    phoneNumber: '+442071234567',
    status: 'busy',
    startTime: new Date('2024-01-01T10:10:00Z'),
    duration: 0,
    outcome: 'busy',
    dtmfInputs: [],
    actionsTriggered: [],
    cost: 0.01,
  },
];

/**
 * Test SMS Records
 */
export const testSMSRecords: TestSMSRecord[] = [
  {
    phoneNumber: '+12125551001',
    message: 'Thank you for your interest! Visit: https://donate.example.com/abc123',
    status: 'delivered',
    sentAt: new Date('2024-01-01T10:02:35Z'),
    deliveredAt: new Date('2024-01-01T10:02:40Z'),
    ttsFallbackTriggered: false,
    cost: 0.0075,
  },
  {
    phoneNumber: '+442071234567',
    message: 'Thank you for your interest! Visit: https://donate.example.com/def456',
    status: 'failed',
    sentAt: new Date('2024-01-01T10:15:00Z'),
    failureReason: 'Landline detected - SMS not supported',
    ttsFallbackTriggered: true,
    cost: 0.0075,
  },
];

/**
 * Helper function to generate a unique test identifier
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Helper function to create a test campaign with unique name
 */
export function createTestCampaign(overrides: Partial<TestCampaign> = {}): TestCampaign {
  return {
    ...testCampaigns[0],
    name: generateTestId('campaign'),
    ...overrides,
  };
}

/**
 * Helper function to create a test contact with unique phone number
 */
export function createTestContact(overrides: Partial<TestContact> = {}): TestContact {
  const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return {
    ...testContacts[0],
    phoneNumber: `+1212555${randomDigits}`,
    ...overrides,
  };
}

/**
 * Helper function to create multiple test contacts
 */
export function createTestContacts(count: number): TestContact[] {
  return Array.from({ length: count }, (_, i) => ({
    phoneNumber: `+1212555${(1000 + i).toString().padStart(4, '0')}`,
    metadata: {
      firstName: `TestUser${i}`,
      lastName: `LastName${i}`,
    },
    timezone: 'America/New_York',
    smsCapable: i % 3 !== 0, // Every 3rd contact is not SMS capable
  }));
}
