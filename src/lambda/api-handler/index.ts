/**
 * API Handler Lambda
 * Main entry point for API Gateway requests
 * Handles campaign CRUD operations with Cognito JWT validation and RBAC
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CampaignService } from './services/CampaignService';
import { ContactService } from './services/ContactService';
import { BlacklistService } from './services/BlacklistService';
import { CampaignOrchestrationService } from './services/CampaignOrchestrationService';
import { AudioService } from './services/AudioService';
import { authenticateRequest, AuthenticatedUser } from './middleware/auth';
import { validateRequest } from './middleware/validation';
import { errorResponse, successResponse } from './utils/response';

// Initialize services
const campaignService = new CampaignService();
const contactService = new ContactService();
const blacklistService = new BlacklistService();
const orchestrationService = new CampaignOrchestrationService();
const audioService = new AudioService();

/**
 * Main Lambda handler
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Handle OPTIONS requests for CORS preflight (no authentication required)
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'CORS preflight successful' }),
      };
    }

    // Authenticate request and extract user
    const user = await authenticateRequest(event);
    if (!user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or missing authentication token');
    }

    // Route to appropriate handler based on path and method
    const path = event.path;
    const method = event.httpMethod;

    // Remove /api prefix if present (from API Gateway stage path)
    const normalizedPath = path.replace(/^\/api/, '');

    // Campaign CRUD routes
    if (normalizedPath.startsWith('/campaigns')) {
      return await handleCampaignRoutes(event, method, user);
    }

    // Contact routes
    if (normalizedPath.startsWith('/contacts')) {
      return await handleContactRoutes(event, method, user);
    }

    // Blacklist routes
    if (normalizedPath.startsWith('/blacklist')) {
      return await handleBlacklistRoutes(event, method, user);
    }

    // Audio routes
    if (normalizedPath.startsWith('/audio')) {
      return await handleAudioRoutes(event, method, user);
    }

    return errorResponse(404, 'NOT_FOUND', `Route not found: ${path}`);
  } catch (error) {
    console.error('Error handling request:', error);
    return errorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * Handle campaign-related routes
 */
async function handleCampaignRoutes(
  event: APIGatewayProxyEvent,
  method: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  const normalizedPath = event.path.replace(/^\/api/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);
  const campaignId = pathParts[1]; // /campaigns/{id}
  const subResource = pathParts[2]; // /campaigns/{id}/{subResource}

  switch (method) {
    case 'POST':
      if (pathParts.length === 1) {
        // POST /campaigns - Create campaign
        return await createCampaign(event, user);
      } else if (pathParts.length === 3 && campaignId && subResource === 'contacts') {
        // POST /campaigns/{id}/contacts - Create contact for campaign
        return await createContactForCampaign(campaignId, event, user);
      } else if (pathParts.length === 3 && campaignId && subResource === 'start') {
        // POST /campaigns/{id}/start - Start campaign immediately
        return await startCampaign(campaignId, user);
      } else if (pathParts.length === 3 && campaignId && subResource === 'schedule') {
        // POST /campaigns/{id}/schedule - Schedule campaign for future execution
        return await scheduleCampaign(campaignId, event, user);
      } else if (pathParts.length === 3 && campaignId && subResource === 'pause') {
        // POST /campaigns/{id}/pause - Pause active campaign
        return await pauseCampaign(campaignId, user);
      } else if (pathParts.length === 3 && campaignId && subResource === 'resume') {
        // POST /campaigns/{id}/resume - Resume paused campaign
        return await resumeCampaign(campaignId, user);
      }
      break;

    case 'GET':
      if (pathParts.length === 1) {
        // GET /campaigns - List campaigns
        return await listCampaigns(event, user);
      } else if (pathParts.length === 2 && campaignId) {
        // GET /campaigns/{id} - Get campaign
        return await getCampaign(campaignId, user);
      }
      break;

    case 'PUT':
      if (pathParts.length === 2 && campaignId) {
        // PUT /campaigns/{id} - Update campaign
        return await updateCampaign(campaignId, event, user);
      }
      break;

    case 'DELETE':
      if (pathParts.length === 2 && campaignId) {
        // DELETE /campaigns/{id} - Delete campaign
        return await deleteCampaign(campaignId, user);
      }
      break;
  }

  return errorResponse(404, 'NOT_FOUND', 'Route not found');
}

/**
 * Create a new campaign
 * Requires CampaignManager or Administrator role
 */
async function createCampaign(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC - only CampaignManager and Administrator can create campaigns
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can create campaigns'
    );
  }

  // Validate request body
  const validation = validateRequest(event, 'createCampaign');
  if (!validation.valid) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request', validation.errors);
  }

  const body = JSON.parse(event.body || '{}');

  try {
    const campaign = await campaignService.createCampaign(body, user.userId);
    return successResponse(201, campaign, 'Campaign created successfully');
  } catch (error) {
    console.error('Error creating campaign:', error);
    if (error instanceof Error && error.message.includes('validation')) {
      return errorResponse(400, 'VALIDATION_ERROR', error.message);
    }
    throw error;
  }
}

/**
 * Get a campaign by ID
 */
async function getCampaign(
  campaignId: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    const campaign = await campaignService.getCampaign(campaignId);
    
    if (!campaign) {
      return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
    }

    return successResponse(200, campaign);
  } catch (error) {
    console.error('Error getting campaign:', error);
    throw error;
  }
}

/**
 * List campaigns with optional filtering
 */
async function listCampaigns(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    const filters = {
      status: queryParams.status,
      type: queryParams.type as any,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
    };

    const result = await campaignService.listCampaigns(filters);
    return successResponse(200, result);
  } catch (error) {
    console.error('Error listing campaigns:', error);
    throw error;
  }
}

/**
 * Update a campaign
 * Requires CampaignManager or Administrator role
 */
async function updateCampaign(
  campaignId: string,
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can update campaigns'
    );
  }

  // Validate request body
  const validation = validateRequest(event, 'updateCampaign');
  if (!validation.valid) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request', validation.errors);
  }

  const body = JSON.parse(event.body || '{}');

  try {
    const campaign = await campaignService.updateCampaign(campaignId, body);
    
    if (!campaign) {
      return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
    }

    return successResponse(200, campaign, 'Campaign updated successfully');
  } catch (error) {
    console.error('Error updating campaign:', error);
    if (error instanceof Error && error.message.includes('validation')) {
      return errorResponse(400, 'VALIDATION_ERROR', error.message);
    }
    throw error;
  }
}

/**
 * Delete a campaign
 * Requires Administrator role
 */
async function deleteCampaign(
  campaignId: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC - only Administrator can delete campaigns
  if (!user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Administrators can delete campaigns'
    );
  }

  try {
    const deleted = await campaignService.deleteCampaign(campaignId);
    
    if (!deleted) {
      return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
    }

    return successResponse(200, null, 'Campaign deleted successfully');
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
}

/**
 * Start a campaign immediately
 * Requires CampaignManager or Administrator role
 */
async function startCampaign(
  campaignId: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can start campaigns'
    );
  }

  try {
    // Get campaign to validate it exists and is in correct state
    const campaign = await campaignService.getCampaign(campaignId);
    if (!campaign) {
      return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
    }

    // Check if campaign can be started
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return errorResponse(
        400,
        'INVALID_STATE',
        `Campaign cannot be started from status '${campaign.status}'. Must be 'draft' or 'scheduled'.`
      );
    }

    // Start the campaign via orchestration service
    const result = await orchestrationService.startCampaign(campaignId);
    
    return successResponse(200, result, 'Campaign started successfully');
  } catch (error) {
    console.error('Error starting campaign:', error);
    if (error instanceof Error && error.message.includes('validation')) {
      return errorResponse(400, 'VALIDATION_ERROR', error.message);
    }
    throw error;
  }
}

/**
 * Schedule a campaign for future execution
 * Requires CampaignManager or Administrator role
 */
async function scheduleCampaign(
  campaignId: string,
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can schedule campaigns'
    );
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    // Get campaign to validate it exists
    const campaign = await campaignService.getCampaign(campaignId);
    if (!campaign) {
      return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
    }

    // Check if campaign can be scheduled
    if (campaign.status !== 'draft') {
      return errorResponse(
        400,
        'INVALID_STATE',
        `Campaign cannot be scheduled from status '${campaign.status}'. Must be 'draft'.`
      );
    }

    // Use startTime from request body or campaign's existing startTime
    const startTime = body.startTime || campaign.startTime;
    if (!startTime) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Start time is required for scheduling');
    }

    // Schedule the campaign
    const result = await orchestrationService.scheduleCampaign(campaignId, startTime);
    
    return successResponse(200, result, 'Campaign scheduled successfully');
  } catch (error) {
    console.error('Error scheduling campaign:', error);
    if (error instanceof Error && error.message.includes('validation')) {
      return errorResponse(400, 'VALIDATION_ERROR', error.message);
    }
    throw error;
  }
}

/**
 * Pause an active campaign
 * Requires CampaignManager or Administrator role
 */
async function pauseCampaign(
  campaignId: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can pause campaigns'
    );
  }

  try {
    // Get campaign to validate it exists and is in correct state
    const campaign = await campaignService.getCampaign(campaignId);
    if (!campaign) {
      return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
    }

    // Check if campaign can be paused
    if (campaign.status !== 'active') {
      return errorResponse(
        400,
        'INVALID_STATE',
        `Campaign cannot be paused from status '${campaign.status}'. Must be 'active'.`
      );
    }

    // Pause the campaign
    const result = await orchestrationService.pauseCampaign(campaignId);
    
    return successResponse(200, result, 'Campaign paused successfully');
  } catch (error) {
    console.error('Error pausing campaign:', error);
    throw error;
  }
}

/**
 * Resume a paused campaign
 * Requires CampaignManager or Administrator role
 */
async function resumeCampaign(
  campaignId: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can resume campaigns'
    );
  }

  try {
    // Get campaign to validate it exists and is in correct state
    const campaign = await campaignService.getCampaign(campaignId);
    if (!campaign) {
      return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
    }

    // Check if campaign can be resumed
    if (campaign.status !== 'paused') {
      return errorResponse(
        400,
        'INVALID_STATE',
        `Campaign cannot be resumed from status '${campaign.status}'. Must be 'paused'.`
      );
    }

    // Resume the campaign
    const result = await orchestrationService.resumeCampaign(campaignId);
    
    return successResponse(200, result, 'Campaign resumed successfully');
  } catch (error) {
    console.error('Error resuming campaign:', error);
    throw error;
  }
}

/**
 * Create a contact for a specific campaign
 * Requires CampaignManager or Administrator role
 */
async function createContactForCampaign(
  campaignId: string,
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can create contacts'
    );
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    if (!body.phoneNumber || typeof body.phoneNumber !== 'string') {
      return errorResponse(400, 'VALIDATION_ERROR', 'Phone number is required and must be a string');
    }

    // Verify campaign exists
    const campaign = await campaignService.getCampaign(campaignId);
    if (!campaign) {
      return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
    }

    // Create the contact
    const contact = await contactService.createSingleContact(
      campaignId,
      body.phoneNumber,
      body.metadata || {}
    );

    return successResponse(201, contact, 'Contact created successfully');
  } catch (error) {
    console.error('Error creating contact:', error);
    if (error instanceof Error && error.message.includes('Invalid phone number')) {
      return errorResponse(400, 'VALIDATION_ERROR', error.message);
    }
    if (error instanceof Error && error.message.includes('already exists')) {
      return errorResponse(400, 'CONFLICT', error.message);
    }
    throw error;
  }
}

/**
 * Handle contact-related routes
 */
async function handleContactRoutes(
  event: APIGatewayProxyEvent,
  method: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  const normalizedPath = event.path.replace(/^\/api/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);

  switch (method) {
    case 'POST':
      if (pathParts.length === 2 && pathParts[1] === 'upload') {
        // POST /contacts/upload - Upload contact list
        return await uploadContactList(event, user);
      }
      break;

    case 'GET':
      if (pathParts.length === 1) {
        // GET /contacts?campaignId=xxx - List contacts
        return await listContacts(event, user);
      } else if (pathParts.length === 2) {
        // GET /contacts/{id} - Get contact
        return await getContact(pathParts[1], user);
      }
      break;
  }

  return errorResponse(404, 'NOT_FOUND', 'Route not found');
}

/**
 * Upload contact list from Excel or CSV file
 * Requires CampaignManager or Administrator role
 */
async function uploadContactList(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can upload contact lists'
    );
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    if (!body.campaignId) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Campaign ID is required');
    }

    if (!body.file) {
      return errorResponse(400, 'VALIDATION_ERROR', 'File data is required');
    }

    if (!body.fileType || !['excel', 'csv'].includes(body.fileType)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'File type must be excel or csv');
    }

    // Decode base64 file data
    const fileBuffer = Buffer.from(body.file, 'base64');

    const result = await contactService.uploadContactList(
      body.campaignId,
      fileBuffer,
      body.fileType
    );

    return successResponse(200, result, 'Contact list uploaded successfully');
  } catch (error) {
    console.error('Error uploading contact list:', error);
    if (error instanceof Error && error.message.includes('Could not find phone number column')) {
      return errorResponse(400, 'VALIDATION_ERROR', error.message);
    }
    throw error;
  }
}

/**
 * Get a contact by ID
 */
async function getContact(
  contactId: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    const contact = await contactService.getContact(contactId);
    
    if (!contact) {
      return errorResponse(404, 'NOT_FOUND', 'Contact not found');
    }

    return successResponse(200, contact);
  } catch (error) {
    console.error('Error getting contact:', error);
    throw error;
  }
}

/**
 * List contacts for a campaign
 */
async function listContacts(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    
    if (!queryParams.campaignId) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Campaign ID is required');
    }

    const filters = {
      status: queryParams.status,
      limit: queryParams.limit ? parseInt(queryParams.limit) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset) : 0,
    };

    const result = await contactService.listContacts(queryParams.campaignId, filters);
    return successResponse(200, result);
  } catch (error) {
    console.error('Error listing contacts:', error);
    throw error;
  }
}

/**
 * Handle blacklist-related routes
 */
async function handleBlacklistRoutes(
  event: APIGatewayProxyEvent,
  method: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  const normalizedPath = event.path.replace(/^\/api/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);

  switch (method) {
    case 'POST':
      if (pathParts.length === 1) {
        // POST /blacklist - Add to blacklist
        return await addToBlacklist(event, user);
      } else if (pathParts.length === 2 && pathParts[1] === 'import') {
        // POST /blacklist/import - Import blacklist file
        return await importBlacklistFile(event, user);
      }
      break;

    case 'DELETE':
      if (pathParts.length === 1) {
        // DELETE /blacklist - Remove from blacklist
        return await removeFromBlacklist(event, user);
      }
      break;

    case 'GET':
      if (pathParts.length === 1) {
        // GET /blacklist - Get blacklist
        return await getBlacklist(event, user);
      } else if (pathParts.length === 2 && pathParts[1] === 'check') {
        // GET /blacklist/check?phoneNumber=xxx - Check if blacklisted
        return await checkBlacklist(event, user);
      }
      break;
  }

  return errorResponse(404, 'NOT_FOUND', 'Route not found');
}

/**
 * Add phone numbers to blacklist
 * Requires CampaignManager or Administrator role
 */
async function addToBlacklist(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can manage blacklist'
    );
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    // Support both single phoneNumber and phoneNumbers array
    let phoneNumbers: string[];
    if (body.phoneNumber && typeof body.phoneNumber === 'string') {
      // Single phone number from frontend
      phoneNumbers = [body.phoneNumber];
    } else if (body.phoneNumbers && Array.isArray(body.phoneNumbers)) {
      // Array of phone numbers
      phoneNumbers = body.phoneNumbers;
    } else {
      return errorResponse(400, 'VALIDATION_ERROR', 'Phone number or phone numbers array is required');
    }

    if (!body.reason) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Reason is required');
    }

    if (!body.source || !['user_optout', 'admin_import', 'compliance'].includes(body.source)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Source must be user_optout, admin_import, or compliance');
    }

    const result = await blacklistService.addToBlacklist({
      phoneNumbers,
      reason: body.reason,
      source: body.source,
    });

    return successResponse(200, result);
  } catch (error) {
    console.error('Error adding to blacklist:', error);
    throw error;
  }
}

/**
 * Remove phone numbers from blacklist
 * Requires Administrator role
 */
async function removeFromBlacklist(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC - only Administrator can remove from blacklist
  if (!user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Administrators can remove numbers from blacklist'
    );
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    if (!body.phoneNumbers || !Array.isArray(body.phoneNumbers)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Phone numbers array is required');
    }

    const result = await blacklistService.removeFromBlacklist({
      phoneNumbers: body.phoneNumbers,
    });

    return successResponse(200, result);
  } catch (error) {
    console.error('Error removing from blacklist:', error);
    throw error;
  }
}

/**
 * Get blacklist entries
 */
async function getBlacklist(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  console.log('getBlacklist handler called');
  const startTime = Date.now();
  
  try {
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
    const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;

    console.log(`Calling blacklistService.getBlacklist(${limit}, ${offset})`);
    const result = await blacklistService.getBlacklist(limit, offset);
    console.log(`getBlacklist completed in ${Date.now() - startTime}ms`);
    return successResponse(200, result);
  } catch (error) {
    console.error(`Error getting blacklist after ${Date.now() - startTime}ms:`, error);
    return errorResponse(
      500,
      'DATABASE_ERROR',
      'Failed to retrieve blacklist',
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * Import blacklist from CSV file
 * Requires CampaignManager or Administrator role
 */
async function importBlacklistFile(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can import blacklist files'
    );
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    if (!body.file) {
      return errorResponse(400, 'VALIDATION_ERROR', 'File data is required');
    }

    if (!body.reason) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Reason is required');
    }

    // Decode base64 file data
    const fileBuffer = Buffer.from(body.file, 'base64');

    const result = await blacklistService.importBlacklistFile(
      fileBuffer,
      body.reason,
      'admin_import'
    );

    return successResponse(200, result);
  } catch (error) {
    console.error('Error importing blacklist file:', error);
    throw error;
  }
}

/**
 * Check if a phone number is blacklisted
 */
async function checkBlacklist(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    
    if (!queryParams.phoneNumber) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Phone number is required');
    }

    const isBlacklisted = await blacklistService.isBlacklisted(queryParams.phoneNumber);
    return successResponse(200, { isBlacklisted });
  } catch (error) {
    console.error('Error checking blacklist:', error);
    throw error;
  }
}

/**
 * Handle audio-related routes
 */
async function handleAudioRoutes(
  event: APIGatewayProxyEvent,
  method: string,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  const normalizedPath = event.path.replace(/^\/api/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);

  switch (method) {
    case 'POST':
      if (pathParts.length === 2 && pathParts[1] === 'upload-url') {
        // POST /audio/upload-url - Get presigned URL for upload
        return await getAudioUploadUrl(event, user);
      }
      break;
  }

  return errorResponse(404, 'NOT_FOUND', 'Route not found');
}

/**
 * Get presigned URL for audio upload
 * Requires CampaignManager or Administrator role
 */
async function getAudioUploadUrl(
  event: APIGatewayProxyEvent,
  user: AuthenticatedUser
): Promise<APIGatewayProxyResult> {
  // Check RBAC
  if (!user.roles.includes('CampaignManager') && !user.roles.includes('Administrator')) {
    return errorResponse(
      403,
      'FORBIDDEN',
      'Only Campaign Managers and Administrators can upload audio files'
    );
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    if (!body.fileName) {
      return errorResponse(400, 'VALIDATION_ERROR', 'File name is required');
    }

    if (!body.fileType) {
      return errorResponse(400, 'VALIDATION_ERROR', 'File type is required');
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/mp4'];
    if (!allowedTypes.includes(body.fileType)) {
      return errorResponse(400, 'VALIDATION_ERROR', `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    const result = await audioService.getPresignedUploadUrl(body.fileName, body.fileType);
    return successResponse(200, result);
  } catch (error) {
    console.error('Error getting audio upload URL:', error);
    throw error;
  }
}
