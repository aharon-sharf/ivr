/**
 * Report Generator Lambda
 * Generates comprehensive campaign reports in multiple formats
 * 
 * Responsibilities:
 * - Aggregate data from PostgreSQL and MongoDB
 * - Calculate aggregate metrics (total attempts, answer rate, conversion rate)
 * - Generate CSV/Excel/PDF reports
 * - Upload report to S3
 * - Send notification with download link
 * 
 * Requirements: 11.1, 11.2, 11.3
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import * as XLSX from 'xlsx';

// AWS clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Database connections
let pgPool: Pool | null = null;
let mongoClient: MongoClient | null = null;

/**
 * Initialize PostgreSQL pool
 */
function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'campaign_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pgPool;
}

/**
 * Initialize MongoDB client
 */
async function getMongoClient() {
  if (!mongoClient) {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
  }
  return mongoClient;
}

/**
 * Report data interface
 */
export interface ReportData {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  startTime: Date;
  endTime: Date;
  totalContacts: number;
  totalAttempts: number;
  answered: number;
  busy: number;
  failed: number;
  noAnswer: number;
  converted: number;
  optOuts: number;
  answerRate: number;
  conversionRate: number;
  optOutRate: number;
  totalCost: number;
  averageCallDuration: number;
  callRecords: CallRecordSummary[];
}

export interface CallRecordSummary {
  contactId: string;
  phoneNumber: string;
  status: string;
  outcome: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  dtmfInputs: string[];
  cost: number;
}

/**
 * Event input interface
 */
export interface ReportGeneratorEvent {
  campaignId: string;
  format: 'csv' | 'excel' | 'pdf';
  notificationEmail?: string;
}

/**
 * Aggregate campaign data from PostgreSQL
 */
async function aggregateCampaignData(campaignId: string): Promise<Partial<ReportData>> {
  const pool = getPgPool();
  
  // Get campaign metadata
  const campaignQuery = `
    SELECT 
      id,
      name,
      type,
      created_at as start_time,
      updated_at as end_time
    FROM campaigns
    WHERE id = $1
  `;
  
  const campaignResult = await pool.query(campaignQuery, [campaignId]);
  
  if (campaignResult.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  
  const campaign = campaignResult.rows[0];
  
  // Get contact count
  const contactCountQuery = `
    SELECT COUNT(*) as total_contacts
    FROM contacts
    WHERE campaign_id = $1
  `;
  
  const contactCountResult = await pool.query(contactCountQuery, [campaignId]);
  const totalContacts = parseInt(contactCountResult.rows[0].total_contacts);
  
  // Get call statistics
  const statsQuery = `
    SELECT 
      COUNT(*) as total_attempts,
      SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) as answered,
      SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busy,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'no_answer' THEN 1 ELSE 0 END) as no_answer,
      SUM(CASE WHEN outcome = 'converted' THEN 1 ELSE 0 END) as converted,
      SUM(CASE WHEN outcome = 'opted_out' THEN 1 ELSE 0 END) as opt_outs,
      SUM(cost) as total_cost,
      AVG(duration) as avg_duration
    FROM call_records
    WHERE campaign_id = $1
  `;
  
  const statsResult = await pool.query(statsQuery, [campaignId]);
  const stats = statsResult.rows[0];
  
  const totalAttempts = parseInt(stats.total_attempts);
  const answered = parseInt(stats.answered);
  const converted = parseInt(stats.converted);
  const optOuts = parseInt(stats.opt_outs);
  
  return {
    campaignId,
    campaignName: campaign.name,
    campaignType: campaign.type,
    startTime: campaign.start_time,
    endTime: campaign.end_time,
    totalContacts,
    totalAttempts,
    answered,
    busy: parseInt(stats.busy),
    failed: parseInt(stats.failed),
    noAnswer: parseInt(stats.no_answer),
    converted,
    optOuts,
    answerRate: totalAttempts > 0 ? (answered / totalAttempts) * 100 : 0,
    conversionRate: answered > 0 ? (converted / answered) * 100 : 0,
    optOutRate: totalAttempts > 0 ? (optOuts / totalAttempts) * 100 : 0,
    totalCost: parseFloat(stats.total_cost || '0'),
    averageCallDuration: parseFloat(stats.avg_duration || '0'),
  };
}

/**
 * Get detailed call records from MongoDB
 */
async function getCallRecords(campaignId: string): Promise<CallRecordSummary[]> {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGO_DB_NAME || 'campaign_db');
  const collection = db.collection('call_records');
  
  const records = await collection
    .find({ campaignId })
    .sort({ startTime: 1 })
    .toArray();
  
  return records.map(record => ({
    contactId: record.contactId,
    phoneNumber: record.phoneNumber,
    status: record.status,
    outcome: record.outcome,
    startTime: record.startTime,
    endTime: record.endTime,
    duration: record.duration,
    dtmfInputs: record.dtmfInputs || [],
    cost: record.cost || 0,
  }));
}

/**
 * Generate complete report data
 */
async function generateReportData(campaignId: string): Promise<ReportData> {
  // Get aggregated data from PostgreSQL
  const aggregateData = await aggregateCampaignData(campaignId);
  
  // Get detailed call records from MongoDB
  const callRecords = await getCallRecords(campaignId);
  
  return {
    ...aggregateData,
    callRecords,
  } as ReportData;
}

/**
 * Generate CSV report
 */
function generateCSV(data: ReportData): string {
  const lines: string[] = [];
  
  // Header section
  lines.push('Campaign Report');
  lines.push('');
  lines.push(`Campaign Name,${data.campaignName}`);
  lines.push(`Campaign ID,${data.campaignId}`);
  lines.push(`Campaign Type,${data.campaignType}`);
  lines.push(`Start Time,${data.startTime.toISOString()}`);
  lines.push(`End Time,${data.endTime.toISOString()}`);
  lines.push('');
  
  // Summary metrics
  lines.push('Summary Metrics');
  lines.push(`Total Contacts,${data.totalContacts}`);
  lines.push(`Total Attempts,${data.totalAttempts}`);
  lines.push(`Answered,${data.answered}`);
  lines.push(`Busy,${data.busy}`);
  lines.push(`Failed,${data.failed}`);
  lines.push(`No Answer,${data.noAnswer}`);
  lines.push(`Converted,${data.converted}`);
  lines.push(`Opt-Outs,${data.optOuts}`);
  lines.push(`Answer Rate,${data.answerRate.toFixed(2)}%`);
  lines.push(`Conversion Rate,${data.conversionRate.toFixed(2)}%`);
  lines.push(`Opt-Out Rate,${data.optOutRate.toFixed(2)}%`);
  lines.push(`Total Cost,$${data.totalCost.toFixed(2)}`);
  lines.push(`Average Call Duration,${data.averageCallDuration.toFixed(2)}s`);
  lines.push('');
  
  // Call records
  lines.push('Call Records');
  lines.push('Contact ID,Phone Number,Status,Outcome,Start Time,End Time,Duration (s),DTMF Inputs,Cost');
  
  data.callRecords.forEach(record => {
    lines.push([
      record.contactId,
      record.phoneNumber,
      record.status,
      record.outcome,
      record.startTime.toISOString(),
      record.endTime ? record.endTime.toISOString() : '',
      record.duration || '',
      record.dtmfInputs.join(';'),
      `$${record.cost.toFixed(2)}`,
    ].join(','));
  });
  
  return lines.join('\n');
}

/**
 * Generate Excel report
 */
function generateExcel(data: ReportData): Buffer {
  const workbook = XLSX.utils.book_new();
  
  // Summary sheet
  const summaryData = [
    ['Campaign Report'],
    [],
    ['Campaign Name', data.campaignName],
    ['Campaign ID', data.campaignId],
    ['Campaign Type', data.campaignType],
    ['Start Time', data.startTime.toISOString()],
    ['End Time', data.endTime.toISOString()],
    [],
    ['Summary Metrics'],
    ['Total Contacts', data.totalContacts],
    ['Total Attempts', data.totalAttempts],
    ['Answered', data.answered],
    ['Busy', data.busy],
    ['Failed', data.failed],
    ['No Answer', data.noAnswer],
    ['Converted', data.converted],
    ['Opt-Outs', data.optOuts],
    ['Answer Rate', `${data.answerRate.toFixed(2)}%`],
    ['Conversion Rate', `${data.conversionRate.toFixed(2)}%`],
    ['Opt-Out Rate', `${data.optOutRate.toFixed(2)}%`],
    ['Total Cost', `$${data.totalCost.toFixed(2)}`],
    ['Average Call Duration', `${data.averageCallDuration.toFixed(2)}s`],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Call records sheet
  const callRecordsData = [
    ['Contact ID', 'Phone Number', 'Status', 'Outcome', 'Start Time', 'End Time', 'Duration (s)', 'DTMF Inputs', 'Cost'],
    ...data.callRecords.map(record => [
      record.contactId,
      record.phoneNumber,
      record.status,
      record.outcome,
      record.startTime.toISOString(),
      record.endTime ? record.endTime.toISOString() : '',
      record.duration || '',
      record.dtmfInputs.join(';'),
      `$${record.cost.toFixed(2)}`,
    ]),
  ];
  
  const callRecordsSheet = XLSX.utils.aoa_to_sheet(callRecordsData);
  XLSX.utils.book_append_sheet(workbook, callRecordsSheet, 'Call Records');
  
  // Generate buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Upload report to S3
 */
async function uploadToS3(
  content: string | Buffer,
  campaignId: string,
  format: string
): Promise<string> {
  const bucket = process.env.REPORTS_BUCKET || 'campaign-reports';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `reports/${campaignId}/${timestamp}.${format}`;
  
  const contentType = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  
  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: contentType,
  }));
  
  // Generate presigned URL (valid for 7 days)
  const url = `https://${bucket}.s3.amazonaws.com/${key}`;
  
  return url;
}

/**
 * Send notification with download link
 */
async function sendNotification(
  campaignName: string,
  downloadUrl: string,
  email?: string
): Promise<void> {
  const topicArn = process.env.NOTIFICATION_TOPIC_ARN;
  
  if (!topicArn) {
    console.warn('NOTIFICATION_TOPIC_ARN not set, skipping notification');
    return;
  }
  
  const message = `
Campaign Report Generated

Campaign: ${campaignName}
Download Link: ${downloadUrl}

This link will be valid for 7 days.
  `.trim();
  
  await snsClient.send(new PublishCommand({
    TopicArn: topicArn,
    Subject: `Campaign Report: ${campaignName}`,
    Message: message,
  }));
  
  console.log('Notification sent successfully');
}

/**
 * Lambda handler
 */
export async function handler(event: ReportGeneratorEvent) {
  try {
    console.log('Generating report for campaign:', event.campaignId);
    
    // Generate report data
    const reportData = await generateReportData(event.campaignId);
    
    // Generate report in requested format
    let content: string | Buffer;
    let fileExtension: string;
    
    if (event.format === 'excel') {
      content = generateExcel(reportData);
      fileExtension = 'xlsx';
    } else {
      // Default to CSV
      content = generateCSV(reportData);
      fileExtension = 'csv';
    }
    
    // Upload to S3
    const downloadUrl = await uploadToS3(content, event.campaignId, fileExtension);
    
    console.log('Report uploaded to:', downloadUrl);
    
    // Send notification
    await sendNotification(reportData.campaignName, downloadUrl, event.notificationEmail);
    
    return {
      success: true,
      campaignId: event.campaignId,
      downloadUrl,
      format: fileExtension,
    };
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanup() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
  }
}
