-- Migration: Add SMS replies table
-- This table stores inbound SMS replies from recipients

CREATE TABLE IF NOT EXISTS sms_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  reply_text TEXT NOT NULL,
  received_at TIMESTAMP NOT NULL,
  provider_message_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign keys
  CONSTRAINT fk_sms_replies_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  CONSTRAINT fk_sms_replies_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_sms_replies_contact_id ON sms_replies(contact_id);
CREATE INDEX idx_sms_replies_campaign_id ON sms_replies(campaign_id);
CREATE INDEX idx_sms_replies_phone_number ON sms_replies(phone_number);
CREATE INDEX idx_sms_replies_received_at ON sms_replies(received_at);

-- Comments
COMMENT ON TABLE sms_replies IS 'Stores inbound SMS replies from campaign recipients';
COMMENT ON COLUMN sms_replies.id IS 'Unique identifier for the SMS reply';
COMMENT ON COLUMN sms_replies.contact_id IS 'Reference to the contact who sent the reply';
COMMENT ON COLUMN sms_replies.campaign_id IS 'Reference to the campaign the reply is associated with';
COMMENT ON COLUMN sms_replies.phone_number IS 'Phone number of the sender';
COMMENT ON COLUMN sms_replies.reply_text IS 'Content of the SMS reply';
COMMENT ON COLUMN sms_replies.received_at IS 'Timestamp when the reply was received';
COMMENT ON COLUMN sms_replies.provider_message_id IS 'Message ID from the SMS provider (Vonage)';
