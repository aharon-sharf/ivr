-- Debug script to check campaign status and contact distribution
-- Replace 'YOUR_CAMPAIGN_ID' with the actual campaign ID that's stuck
-- Current campaign ID: 8b4e7492-4213-43f9-a055-fd193881ec7e

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
WHERE id = '8b4e7492-4213-43f9-a055-fd193881ec7e';

-- Contact status distribution
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM contacts 
WHERE campaign_id = '8b4e7492-4213-43f9-a055-fd193881ec7e'
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
WHERE campaign_id = '8b4e7492-4213-43f9-a055-fd193881ec7e' 
  AND status = 'in_progress'
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY updated_at;

-- Recent call records
SELECT 
    status,
    outcome,
    COUNT(*) as count
FROM call_records 
WHERE campaign_id = '8b4e7492-4213-43f9-a055-fd193881ec7e'
GROUP BY status, outcome
ORDER BY count DESC;

-- Emergency fix for stuck campaign with contacts in "in_progress" status
-- This addresses the root cause of the infinite loop

-- First, let's see what we're dealing with
SELECT 
    'CAMPAIGN INFO' as type,
    id::text, 
    name, 
    status, 
    end_time::text,
    CASE 
        WHEN end_time < NOW() THEN 'EXPIRED'
        ELSE 'ACTIVE'
    END as time_status
FROM campaigns 
WHERE id = '8b4e7492-4213-43f9-a055-fd193881ec7e'

UNION ALL

SELECT 
    'CONTACT STATS' as type,
    status as id,
    COUNT(*)::text as name,
    'contacts' as status,
    MIN(updated_at)::text as end_time,
    MAX(updated_at)::text as time_status
FROM contacts 
WHERE campaign_id = '8b4e7492-4213-43f9-a055-fd193881ec7e'
GROUP BY status
ORDER BY type, id;

-- Fix 1: Mark old "in_progress" contacts as "failed" 
-- (contacts that have been in_progress for more than 10 minutes are likely stuck)
UPDATE contacts 
SET status = 'failed', 
    updated_at = NOW()
WHERE campaign_id = '8b4e7492-4213-43f9-a055-fd193881ec7e' 
  AND status = 'in_progress'
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- Fix 2: Mark remaining "pending" contacts as "failed" if campaign end time has passed
UPDATE contacts 
SET status = 'failed', 
    updated_at = NOW()
WHERE campaign_id = '8b4e7492-4213-43f9-a055-fd193881ec7e' 
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM campaigns 
    WHERE id = '8b4e7492-4213-43f9-a055-fd193881ec7e' 
    AND end_time < NOW()
  );

-- Fix 3: Now mark the campaign as completed
UPDATE campaigns 
SET status = 'completed', 
    updated_at = NOW()
WHERE id = '8b4e7492-4213-43f9-a055-fd193881ec7e' 
  AND status = 'active';

-- Verify the fix
SELECT 
    'FINAL CAMPAIGN' as type,
    id::text, 
    name, 
    status, 
    updated_at::text as end_time,
    'FIXED' as time_status
FROM campaigns 
WHERE id = '8b4e7492-4213-43f9-a055-fd193881ec7e'

UNION ALL

SELECT 
    'FINAL CONTACTS' as type,
    status as id,
    COUNT(*)::text as name,
    'contacts' as status,
    MIN(updated_at)::text as end_time,
    MAX(updated_at)::text as time_status
FROM contacts 
WHERE campaign_id = '8b4e7492-4213-43f9-a055-fd193881ec7e'
GROUP BY status
ORDER BY type, id;