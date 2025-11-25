/**
 * API Request and Response Types
 * Defines the structure of API requests and responses
 */

import { Campaign, CampaignConfig, CampaignType } from '../models/Campaign';
import { Contact } from '../models/Contact';
import { BlacklistEntry, BlacklistSource } from '../models/BlacklistEntry';
import { CallRecord } from '../models/CallRecord';
import { SMSRecord } from '../models/SMSRecord';

// ============================================================================
// Campaign API Types
// ============================================================================

export interface CreateCampaignRequest {
  name: string;
  type: CampaignType;
  config: CampaignConfig;
  startTime?: string; // ISO 8601 format
  endTime?: string; // ISO 8601 format
  timezone?: string;
}

export interface CreateCampaignResponse {
  campaign: Campaign;
}

export interface UpdateCampaignRequest {
  name?: string;
  config?: Partial<CampaignConfig>;
  startTime?: string;
  endTime?: string;
  timezone?: string;
}

export interface UpdateCampaignResponse {
  campaign: Campaign;
}

export interface GetCampaignResponse {
  campaign: Campaign;
}

export interface ListCampaignsRequest {
  status?: string;
  type?: CampaignType;
  limit?: number;
  offset?: number;
}

export interface ListCampaignsResponse {
  campaigns: Campaign[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Contact API Types
// ============================================================================

export interface UploadContactListRequest {
  campaignId: string;
  file: File | Buffer;
  fileType: 'excel' | 'csv';
}

export interface ImportResult {
  totalRecords: number;
  successfulImports: number;
  duplicatesRemoved: number;
  validationFailures: number;
  errors: Array<{
    row: number;
    phoneNumber?: string;
    error: string;
  }>;
}

export interface UploadContactListResponse {
  result: ImportResult;
}

export interface DatabaseSyncConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  query: string;
  phoneNumberColumn: string;
  metadataColumns?: string[];
}

export interface SyncContactsFromDatabaseRequest {
  campaignId: string;
  dbConfig: DatabaseSyncConfig;
}

export interface SyncContactsFromDatabaseResponse {
  result: ImportResult;
}

export interface GetContactResponse {
  contact: Contact;
}

export interface ListContactsRequest {
  campaignId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ListContactsResponse {
  contacts: Contact[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Blacklist API Types
// ============================================================================

export interface AddToBlacklistRequest {
  phoneNumbers: string[];
  reason: string;
  source: BlacklistSource;
}

export interface AddToBlacklistResponse {
  added: number;
  entries: BlacklistEntry[];
}

export interface RemoveFromBlacklistRequest {
  phoneNumbers: string[];
}

export interface RemoveFromBlacklistResponse {
  removed: number;
}

export interface GetBlacklistRequest {
  limit?: number;
  offset?: number;
}

export interface GetBlacklistResponse {
  entries: BlacklistEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface ImportBlacklistFileRequest {
  file: File | Buffer;
  fileType: 'csv';
  reason: string;
}

export interface ImportBlacklistFileResponse {
  imported: number;
  errors: Array<{
    row: number;
    phoneNumber?: string;
    error: string;
  }>;
}

// ============================================================================
// Campaign Execution API Types
// ============================================================================

export interface ScheduleCampaignRequest {
  campaignId: string;
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
}

export interface ScheduleCampaignResponse {
  campaign: Campaign;
  scheduledAt: string;
}

export interface PauseCampaignRequest {
  campaignId: string;
}

export interface PauseCampaignResponse {
  campaign: Campaign;
}

export interface ResumeCampaignRequest {
  campaignId: string;
}

export interface ResumeCampaignResponse {
  campaign: Campaign;
}

// ============================================================================
// Analytics API Types
// ============================================================================

export interface CampaignMetrics {
  campaignId: string;
  activeCalls: number;
  queueDepth: number;
  dialingRate: number;
  totalAttempts: number;
  answered: number;
  busy: number;
  failed: number;
  converted: number;
  optOuts: number;
  answerRate: number;
  conversionRate: number;
}

export interface GetRealTimeMetricsRequest {
  campaignId: string;
}

export interface GetRealTimeMetricsResponse {
  metrics: CampaignMetrics;
  timestamp: string;
}

export interface DateRange {
  startDate: string; // ISO 8601 format
  endDate: string; // ISO 8601 format
}

export interface HistoricalMetrics {
  campaignId: string;
  dateRange: DateRange;
  totalAttempts: number;
  answered: number;
  busy: number;
  failed: number;
  converted: number;
  optOuts: number;
  answerRate: number;
  conversionRate: number;
  optOutRate: number;
  averageDuration: number;
  totalCost: number;
}

export interface GetHistoricalDataRequest {
  campaignId: string;
  dateRange: DateRange;
}

export interface GetHistoricalDataResponse {
  metrics: HistoricalMetrics;
}

export interface ComparisonReport {
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    metrics: HistoricalMetrics;
  }>;
}

export interface CompareCampaignsRequest {
  campaignIds: string[];
  dateRange?: DateRange;
}

export interface CompareCampaignsResponse {
  report: ComparisonReport;
}

export interface GenerateReportRequest {
  campaignId: string;
  format: 'csv' | 'excel' | 'pdf';
  dateRange?: DateRange;
}

export interface Report {
  reportId: string;
  format: string;
  downloadUrl: string;
  generatedAt: string;
}

export interface GenerateReportResponse {
  report: Report;
}

// ============================================================================
// Call and SMS Record API Types
// ============================================================================

export interface GetCallRecordsRequest {
  campaignId?: string;
  contactId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface GetCallRecordsResponse {
  records: CallRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetSMSRecordsRequest {
  campaignId?: string;
  contactId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface GetSMSRecordsResponse {
  records: SMSRecord[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    validationErrors: ValidationError[];
  };
}
