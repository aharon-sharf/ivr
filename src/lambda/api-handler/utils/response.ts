/**
 * Response Utilities
 * Helper functions for creating standardized API responses
 */

import { APIGatewayProxyResult } from 'aws-lambda';

/**
 * Create a success response with standardized ApiResponse format
 */
export function successResponse<T>(
  statusCode: number,
  data: T,
  message?: string
): APIGatewayProxyResult {
  const responseBody = {
    success: true,
    data,
    ...(message && { message }),
  };

  // Safely serialize data, converting Date objects to ISO strings
  const body = JSON.stringify(responseBody, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  });

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': true,
    },
    body,
  };
}

/**
 * Create an error response with standardized ApiResponse format
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
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    }),
  };
}
