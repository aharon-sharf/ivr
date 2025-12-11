/**
 * Test script for campaign scheduling functionality
 * Run this after deploying the fixes to verify everything works
 */

const API_BASE_URL = 'https://d199b7kvouzq58.cloudfront.net/api';

async function testCampaignScheduling() {
  console.log('🧪 Testing Campaign Scheduling Functionality\n');

  try {
    // 1. Get list of campaigns
    console.log('1. Fetching campaigns...');
    const campaignsResponse = await fetch(`${API_BASE_URL}/campaigns`, {
      headers: {
        'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE', // Replace with actual token
        'Content-Type': 'application/json'
      }
    });
    
    if (!campaignsResponse.ok) {
      throw new Error(`Failed to fetch campaigns: ${campaignsResponse.status}`);
    }
    
    const campaignsData = await campaignsResponse.json();
    const campaigns = campaignsData.data.campaigns;
    console.log(`✅ Found ${campaigns.length} campaigns`);
    
    // Find a draft campaign
    const draftCampaign = campaigns.find(c => c.status === 'draft');
    if (!draftCampaign) {
      console.log('❌ No draft campaigns found. Create a campaign first.');
      return;
    }
    
    console.log(`📋 Testing with campaign: ${draftCampaign.name} (${draftCampaign.id})`);
    
    // 2. Test scheduling a campaign
    console.log('\n2. Testing campaign scheduling...');
    const scheduleTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    
    const scheduleResponse = await fetch(`${API_BASE_URL}/campaigns/${draftCampaign.id}/schedule`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE', // Replace with actual token
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startTime: scheduleTime.toISOString()
      })
    });
    
    if (!scheduleResponse.ok) {
      const errorText = await scheduleResponse.text();
      throw new Error(`Failed to schedule campaign: ${scheduleResponse.status} - ${errorText}`);
    }
    
    const scheduleData = await scheduleResponse.json();
    console.log('✅ Campaign scheduled successfully');
    console.log(`📅 Scheduled for: ${scheduleTime.toISOString()}`);
    console.log(`📊 New status: ${scheduleData.data.campaign.status}`);
    
    // 3. Test starting a campaign immediately (create another draft first)
    console.log('\n3. Testing immediate campaign start...');
    
    // For this test, we'd need another draft campaign or we could create one
    // This is just a demonstration of the API call
    console.log('ℹ️  To test immediate start, use:');
    console.log(`POST ${API_BASE_URL}/campaigns/{campaign-id}/start`);
    
    console.log('\n🎉 Campaign scheduling test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Helper function to test with curl commands
function printCurlCommands() {
  console.log('\n📝 Manual testing with curl commands:');
  console.log('\n# 1. List campaigns');
  console.log(`curl -X GET "${API_BASE_URL}/campaigns" \\`);
  console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
  console.log('  -H "Content-Type: application/json"');
  
  console.log('\n# 2. Start campaign immediately');
  console.log(`curl -X POST "${API_BASE_URL}/campaigns/CAMPAIGN_ID/start" \\`);
  console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
  console.log('  -H "Content-Type: application/json"');
  
  console.log('\n# 3. Schedule campaign');
  console.log(`curl -X POST "${API_BASE_URL}/campaigns/CAMPAIGN_ID/schedule" \\`);
  console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"startTime": "2024-12-11T15:00:00Z"}\'');
  
  console.log('\n# 4. Pause campaign');
  console.log(`curl -X POST "${API_BASE_URL}/campaigns/CAMPAIGN_ID/pause" \\`);
  console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
  console.log('  -H "Content-Type: application/json"');
}

// Run the test
if (typeof window === 'undefined') {
  // Node.js environment
  testCampaignScheduling();
  printCurlCommands();
} else {
  // Browser environment
  console.log('Run testCampaignScheduling() in the browser console');
  window.testCampaignScheduling = testCampaignScheduling;
  window.printCurlCommands = printCurlCommands;
}