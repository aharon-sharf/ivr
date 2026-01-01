-- Debug script to check campaign status and contact distribution
-- Replace 'YOUR_CAMPAIGN_ID' with the actual campaign ID that's stuck

-- Campaign details
SELECT 
    id,
    name,
    status,
    created_at,
    start_time,
    end_time,
    EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_running
FROM campaigns 
WHERE id = 'YOUR_CAMPAIGN_ID';

-- Contact status distribution
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM contacts 
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
GROUP BY status
ORDER BY count DESC;

-- Contacts that have been in_progress for too long
SELECT 
    id,
    phone_number,
    status,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_in_current_status
FROM contacts 
WHERE campaign_id = 'YOUR_CAMPAIGN_ID' 
  AND status = 'in_progress'
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY updated_at;

-- Recent call records
SELECT 
    status,
    outcome,
    COUNT(*) as count
FROM call_records 
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
GROUP BY status, outcome
ORDER BY count DESC;