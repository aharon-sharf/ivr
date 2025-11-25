/**
 * Authentication Middleware
 * Validates Cognito JWT tokens and extracts user information
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
  username: string;
}

// Initialize JWT verifier for Cognito
// In production, these would come from environment variables
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || '',
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID || '',
});

/**
 * Authenticate request by validating JWT token
 */
export async function authenticateRequest(
  event: APIGatewayProxyEvent
): Promise<AuthenticatedUser | null> {
  try {
    // Extract token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      console.log('No authorization header found');
      return null;
    }

    // Extract Bearer token
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      console.log('No token found in authorization header');
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

    return {
      userId,
      email,
      username,
      roles,
    };
  } catch (error) {
    console.error('Error authenticating request:', error);
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
