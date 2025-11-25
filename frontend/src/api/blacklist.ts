import apiClient from './client';
import { BlacklistEntry, ApiResponse } from '../types';

/**
 * Blacklist API Client
 * Handles all blacklist-related API calls
 */

export interface BlacklistUploadResult {
  totalRecords: number;
  imported: number;
  duplicates: number;
  failures: number;
  errors: string[];
}

export interface BlacklistExportOptions {
  format: 'csv' | 'excel';
}

/**
 * Get all blacklist entries with optional pagination and filtering
 */
export const getBlacklist = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  source?: string;
}): Promise<ApiResponse<{ entries: BlacklistEntry[]; total: number }>> => {
  const response = await apiClient.get('/blacklist', { params });
  return response.data;
};

/**
 * Add a single phone number to the blacklist
 */
export const addToBlacklist = async (
  phoneNumber: string,
  reason: string,
  source: 'admin_import' | 'compliance' = 'admin_import'
): Promise<ApiResponse<BlacklistEntry>> => {
  const response = await apiClient.post('/blacklist', {
    phoneNumber,
    reason,
    source,
  });
  return response.data;
};

/**
 * Add multiple phone numbers to the blacklist
 */
export const addMultipleToBlacklist = async (
  entries: Array<{ phoneNumber: string; reason: string }>
): Promise<ApiResponse<{ added: number; failed: number }>> => {
  const response = await apiClient.post('/blacklist/bulk', {
    entries,
    source: 'admin_import',
  });
  return response.data;
};

/**
 * Remove a phone number from the blacklist
 */
export const removeFromBlacklist = async (
  phoneNumber: string
): Promise<ApiResponse<{ success: boolean }>> => {
  const response = await apiClient.delete(`/blacklist/${encodeURIComponent(phoneNumber)}`);
  return response.data;
};

/**
 * Upload a blacklist file (CSV or Excel)
 */
export const uploadBlacklistFile = async (
  file: File
): Promise<ApiResponse<BlacklistUploadResult>> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/blacklist/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Export blacklist to CSV or Excel
 */
export const exportBlacklist = async (
  options: BlacklistExportOptions = { format: 'csv' }
): Promise<Blob> => {
  const response = await apiClient.get('/blacklist/export', {
    params: options,
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Get opt-out history for a specific phone number
 */
export const getOptOutHistory = async (
  phoneNumber: string
): Promise<ApiResponse<BlacklistEntry[]>> => {
  const response = await apiClient.get(`/blacklist/history/${encodeURIComponent(phoneNumber)}`);
  return response.data;
};

/**
 * Check if a phone number is blacklisted
 */
export const checkBlacklisted = async (
  phoneNumber: string
): Promise<ApiResponse<{ blacklisted: boolean; entry?: BlacklistEntry }>> => {
  const response = await apiClient.get(`/blacklist/check/${encodeURIComponent(phoneNumber)}`);
  return response.data;
};
