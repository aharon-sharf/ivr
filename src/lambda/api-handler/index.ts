/**
 * API Handler Lambda
 * Main entry point for API Gateway requests
 * Handles campaign CRUD operations with Cognito JWT validation and RBAC
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CampaignService } from './services/CampaignService';
import { ContactService } from './services/ContactService';
import { BlacklistService } from './services/BlacklistService';
import { authenticateRequest, AuthenticatedUser } from './middleware/auth';
import { validateRequest } from './middleware/validation';
import { errorResponse, successResponse } from './utils/response';

// Initialize services
const campaignService = new CampaignService();
const contactService = new ContactService();
const blacklistService = new BlacklistService();

/**
 * Main Lambda handler
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
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

  switch (method) {
    case 'POST':
      if (pathParts.length === 1) {
        // POST /campaigns - Create campaign
        return await createCampaign(event, user);
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
    return successResponse(201, { campaign });
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

    return successResponse(200, { campaign });
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

    return successResponse(200, { campaign });
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

    return successResponse(200, { message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
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

    return successResponse(200, { result });
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

    return successResponse(200, { contact });
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
    return successResponse(200, {
      contacts: result.contacts,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    });
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
  try {
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
    const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;

    const result = await blacklistService.getBlacklist(limit, offset);
    return successResponse(200, result);
  } catch (error) {
    console.error('Error getting blacklist:', error);
    throw error;
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
