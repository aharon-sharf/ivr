/**
 * Request Validation Middleware
 * Validates API request bodies against schemas
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { validateCampaign } from '../../../models/Campaign';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate request body based on operation type
 */
export function validateRequest(
  event: APIGatewayProxyEvent,
  operation: string
): ValidationResult {
  try {
    if (!event.body) {
      return {
        valid: false,
        errors: ['Request body is required'],
      };
    }

    const body = JSON.parse(event.body);

    switch (operation) {
      case 'createCampaign':
        return validateCreateCampaign(body);
      case 'updateCampaign':
        return validateUpdateCampaign(body);
      default:
        return { valid: true };
    }
  } catch (error) {
    return {
      valid: false,
      errors: ['Invalid JSON in request body'],
    };
  }
}

/**
 * Validate create campaign request
 */
function validateCreateCampaign(body: any): ValidationResult {
  const errors = validateCampaign(body);
  
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return { valid: true };
}

/**
 * Validate update campaign request
 */
function validateUpdateCampaign(body: any): ValidationResult {
  // For updates, we allow partial data
  // Only validate fields that are present
  const errors: string[] = [];

  if (body.name !== undefined && (!body.name || body.name.trim().length === 0)) {
    errors.push('Campaign name cannot be empty');
  }

  if (body.type !== undefined && !['voice', 'sms', 'hybrid'].includes(body.type)) {
    errors.push('Campaign type must be voice, sms, or hybrid');
  }

  if (body.config !== undefined) {
    // Validate calling windows if present
    if (body.config.callingWindows) {
      body.config.callingWindows.forEach((window: any, index: number) => {
        if (window.startHour < 0 || window.startHour > 23) {
          errors.push(`Calling window ${index}: startHour must be between 0 and 23`);
        }
        if (window.endHour < 0 || window.endHour > 23) {
          errors.push(`Calling window ${index}: endHour must be between 0 and 23`);
        }
        if (window.startHour >= window.endHour) {
          errors.push(`Calling window ${index}: startHour must be less than endHour`);
        }
      });
    }
  }

  if (body.startTime && body.endTime) {
    const start = new Date(body.startTime);
    const end = new Date(body.endTime);
    if (start >= end) {
      errors.push('Start time must be before end time');
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return { valid: true };
}
