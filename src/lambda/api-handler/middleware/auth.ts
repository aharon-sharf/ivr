/**
 * Authentication Middleware
 * Validates Cognito JWT tokens and extracts user information
 * Automatically syncs users to the database on first authentication
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { UserService } from '../services/UserService';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
  username: string;
}

// Initialize UserService for syncing users to database
const userService = new UserService();

// Validate required environment variables
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;

if (!COGNITO_USER_POOL_ID) {
  console.error('FATAL: COGNITO_USER_POOL_ID environment variable is not set');
}

if (!COGNITO_CLIENT_ID) {
  console.error('FATAL: COGNITO_CLIENT_ID environment variable is not set');
}

// Initialize JWT verifier for Cognito
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

if (COGNITO_USER_POOL_ID && COGNITO_CLIENT_ID) {
  verifier = CognitoJwtVerifier.create({
    userPoolId: COGNITO_USER_POOL_ID,
    tokenUse: 'access',
    clientId: COGNITO_CLIENT_ID,
  });
  console.log('JWT verifier initialized successfully', {
    userPoolId: COGNITO_USER_POOL_ID,
    clientId: COGNITO_CLIENT_ID.substring(0, 8) + '...',
  });
} else {
  console.error('JWT verifier could not be initialized due to missing environment variables');
}

/**
 * Authenticate request by validating JWT token
 */
export async function authenticateRequest(
  event: APIGatewayProxyEvent
): Promise<AuthenticatedUser | null> {
  try {
    // Check if verifier is initialized
    if (!verifier) {
      console.error('Authentication failed: JWT verifier not initialized. Check environment variables.');
      return null;
    }

    // Extract token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      console.log('Authentication failed: No authorization header found', {
        path: event.path,
        method: event.httpMethod,
      });
      return null;
    }

    // Extract Bearer token
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token || token === authHeader) {
      console.log('Authentication failed: No Bearer token found in authorization header', {
        path: event.path,
        method: event.httpMethod,
      });
      return null;
    }

    // Verify JWT token
    const payload = await verifier.verify(token);
    
    // Extract user information from token
    const userId = payload.sub;
    const email = payload.email as string || '';
    const username = payload.username as string || payload['cognito:username'] as string || '';
    
    // Extract roles from Cognito groups
    const cognitoGroups = payload['cognito:groups'] as string[] || [];
    const roles = cognitoGroups;

    // Ensure user exists in database (auto-create on first authentication)
    try {
      await userService.ensureUserExists(userId, email, roles);
    } catch (syncError) {
      // Log but don't fail authentication if user sync fails
      // This allows the request to proceed even if DB is temporarily unavailable
      console.error('Warning: Failed to sync user to database:', {
        userId,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }

    console.log('Authentication successful', {
      userId,
      email,
      username,
      roles,
      path: event.path,
      method: event.httpMethod,
    });

    return {
      userId,
      email,
      username,
      roles,
    };
  } catch (error) {
    console.error('Authentication failed: Error validating JWT token', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      path: event.path,
      method: event.httpMethod,
    });
    return null;
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthenticatedUser, role: string): boolean {
  return user.roles.includes(role);
}

/**
 * Check if user has any of the required roles
 */
export function hasAnyRole(user: AuthenticatedUser, roles: string[]): boolean {
  return roles.some(role => user.roles.includes(role));
}
