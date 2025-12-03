/**
 * Response Utilities
 * Helper functions for creating standardized API responses
 */

import { APIGatewayProxyResult } from 'aws-lambda';

/**
 * Create a success response
 */
export function successResponse(
  statusCode: number,
  data: any
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(data),
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: any
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      error: {
        code,
        message,
        ...(details && { details }),
      },
    }),
  };
}
