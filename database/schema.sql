-- Mass Voice Campaign System - PostgreSQL Database Schema
-- This schema supports campaign management, contact lists, blacklist, call records, and SMS records

-- Enable UUID extension for generating unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and authorization
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('CampaignManager', 'Administrator', 'Analyst')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('voice', 'sms', 'hybrid')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
    
    -- Campaign configuration (stored as JSONB for flexibility)
    config JSONB NOT NULL,
    
    -- Scheduling
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Metadata
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    CONSTRAINT valid_time_range CHECK (end_time IS NULL OR start_time < end_time)
);

-- Contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    
    -- Contact metadata (name, address, custom fields)
    metadata JSONB DEFAULT '{}',
    
    -- Contact preferences
    timezone VARCHAR(50),
    sms_capable BOOLEAN DEFAULT true,
    
    -- ML predictions
    optimal_call_time JSONB,
    
    -- Contact status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'blacklisted')),
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicate contacts per campaign
    CONSTRAINT unique_contact_per_campaign UNIQUE (campaign_id, phone_number)
);

-- Blacklist table for Do-Not-Call registry
CREATE TABLE blacklist (
    phone_number VARCHAR(20) PRIMARY KEY,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason TEXT,
    source VARCHAR(50) NOT NULL CHECK (source IN ('user_optout', 'admin_import', 'compliance')),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'
);

-- Call records table for voice campaign outcomes
CREATE TABLE call_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    
    -- Call status and outcome
    status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'dialing', 'ringing', 'answered', 'in_progress', 'completed', 'failed', 'busy', 'no_answer', 'blacklisted')),
    outcome VARCHAR(50),
    
    -- Call timing
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in seconds
    
    -- IVR interaction data
    dtmf_inputs TEXT[], -- Array of DTMF digits pressed
    actions_triggered JSONB DEFAULT '[]', -- Array of IVR actions executed
    
    -- Cost tracking
    cost DECIMAL(10, 4) DEFAULT 0.0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SMS records table for SMS campaign outcomes
CREATE TABLE sms_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    
    -- SMS content and status
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'undelivered')),
    
    -- Timing
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Failure tracking
    failure_reason TEXT,
    
    -- TTS fallback
    tts_fallback_triggered BOOLEAN DEFAULT false,
    
    -- Cost tracking
    cost DECIMAL(10, 4) DEFAULT 0.0,
    
    -- External provider message ID
    provider_message_id VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization

-- Campaign indexes
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_start_time ON campaigns(start_time);

-- Contact indexes
CREATE INDEX idx_contacts_campaign_id ON contacts(campaign_id);
CREATE INDEX idx_contacts_phone_number ON contacts(phone_number);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_campaign_status ON contacts(campaign_id, status);

-- Blacklist index (phone_number is already primary key, so indexed)

-- Call records indexes
CREATE INDEX idx_call_records_campaign_id ON call_records(campaign_id);
CREATE INDEX idx_call_records_contact_id ON call_records(contact_id);
CREATE INDEX idx_call_records_phone_number ON call_records(phone_number);
CREATE INDEX idx_call_records_status ON call_records(status);
CREATE INDEX idx_call_records_start_time ON call_records(start_time);
CREATE INDEX idx_call_records_campaign_status ON call_records(campaign_id, status);

-- SMS records indexes
CREATE INDEX idx_sms_records_campaign_id ON sms_records(campaign_id);
CREATE INDEX idx_sms_records_contact_id ON sms_records(contact_id);
CREATE INDEX idx_sms_records_phone_number ON sms_records(phone_number);
CREATE INDEX idx_sms_records_status ON sms_records(status);
CREATE INDEX idx_sms_records_sent_at ON sms_records(sent_at);
CREATE INDEX idx_sms_records_campaign_status ON sms_records(campaign_id, status);

-- Trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
