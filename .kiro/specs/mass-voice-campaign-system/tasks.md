# Implementation Plan

## Overview

This implementation plan breaks down the Mass Voice Campaign System into discrete, manageable coding tasks. Each task builds incrementally on previous work, with property-based tests integrated throughout to validate correctness. The plan follows a bottom-up approach: infrastructure → data layer → core services → integration → frontend.

## Task List

- [x] 1. Infrastructure Setup




- [x] 1.1 Set up Terraform project structure and AWS provider configuration


  - Create Terraform modules for networking, compute, data, messaging, orchestration
  - Configure remote state backend (S3 + DynamoDB)
  - Set up AWS credentials and region configuration
  - _Requirements: 12.1, 13.2_

- [x] 1.2 Provision VPC with public/private subnets and VPC Endpoints

  - Create VPC with CIDR 10.0.0.0/16
  - Create public subnets (10.0.1.0/24, 10.0.2.0/24) across 2 AZs
  - Create private subnets (10.0.10.0/24, 10.0.11.0/24) across 2 AZs
  - Set up S3 Gateway Endpoint (free)
  - Set up Interface Endpoints for SQS, SNS, Lambda, Polly, SageMaker
  - Configure security groups and route tables
  - _Requirements: 12.1_

- [x] 1.3 Provision RDS PostgreSQL and ElastiCache Redis

  - Create RDS PostgreSQL instance (db.t3.medium, Multi-AZ)
  - Configure automated backups and retention
  - Create ElastiCache Redis cluster (cache.t3.medium, Multi-AZ)
  - Set up security groups for database access
  - _Requirements: 1.1, 1.2, 3.1_

- [x] 1.4 Set up S3 buckets with lifecycle policies

  - Create buckets: audio-files, ml-models, campaign-reports, contact-uploads, frontend-hosting
  - Configure lifecycle policies (Glacier transitions, deletions)
  - Enable versioning and encryption
  - Set up CORS for frontend uploads
  - _Requirements: 1.1, 11.3_

- [x] 1.5 Provision SQS queues and SNS topics

  - Create SQS queue: dial-tasks (standard queue)
  - Create dead letter queue for failed messages
  - Create SNS topics: call-events, donation-events, optout-events, campaign-notifications
  - Configure queue policies and topic subscriptions
  - _Requirements: 2.1, 4.2, 4.3_

- [x] 1.6 Set up AWS Cognito for authentication


  - Create Cognito User Pool with password policy
  - Configure MFA (SMS and TOTP)
  - Create user groups: CampaignManager, Administrator, Analyst
  - Set up App Client for frontend
  - Configure JWT token expiration (1 hour access, 30 days refresh)
  - _Requirements: 13.2_

- [x] 2. Database Schema and Models



- [x] 2.1 Design and implement PostgreSQL schema


  - Create tables: campaigns, contacts, blacklist, users, call_records, sms_records
  - Define indexes for performance (phone_number, campaign_id, status)
  - Set up foreign key constraints
  - Create database migration scripts
  - _Requirements: 1.1, 1.2, 3.1_

- [x] 2.2 Write property test for database schema integrity




  - **Property 2: Database synchronization consistency**
  - **Validates: Requirements 1.2**

- [x] 2.3 Implement TypeScript data models and interfaces


  - Create interfaces: Campaign, Contact, BlacklistEntry, CallRecord, SMSRecord
  - Implement validation functions for each model
  - Create TypeScript types for API requests/responses
  - _Requirements: 1.1, 1.3_

- [x] 2.4 Write property test for phone number validation




  - **Property 3: Phone number validation correctness**
  - **Validates: Requirements 1.3**

- [x] 3. Core Lambda Functions - Campaign Management





- [x] 3.1 Implement API Handler Lambda for campaign CRUD


  - Create Lambda function with API Gateway integration
  - Implement createCampaign, getCampaign, updateCampaign, deleteCampaign endpoints
  - Add Cognito JWT validation middleware
  - Implement RBAC checks (only CampaignManager/Admin can create)
  - _Requirements: 2.1, 2.2_

- [ ]* 3.2 Write unit tests for campaign CRUD operations
  - Test campaign creation with valid/invalid data
  - Test authorization checks
  - Test database persistence
  - _Requirements: 2.1_

- [x] 3.3 Implement contact list upload and parsing


  - Create uploadContactList endpoint
  - Implement Excel/CSV parsing (using xlsx library)
  - Validate phone numbers (E.164 format)
  - Handle duplicate detection and merging
  - Generate import summary report
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [ ]* 3.4 Write property test for contact extraction completeness
  - **Property 1: Contact extraction completeness**
  - **Validates: Requirements 1.1**

- [ ]* 3.5 Write property test for deduplication rule compliance
  - **Property 4: Deduplication rule compliance**
  - **Validates: Requirements 1.4**

- [ ]* 3.6 Write property test for import summary accuracy
  - **Property 5: Import summary accuracy**
  - **Validates: Requirements 1.5**

- [x] 3.7 Implement blacklist management endpoints


  - Create addToBlacklist, removeFromBlacklist, getBlacklist endpoints
  - Implement blacklist file import (CSV)
  - Add timestamp and reason tracking
  - Update Redis cache for fast lookups
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [ ]* 3.8 Write property test for blacklist persistence
  - **Property 14: Blacklist persistence with timestamp**
  - **Validates: Requirements 3.5**

- [ ] 4. Machine Learning Integration

- [x] 4.1 Set up SageMaker Serverless Inference endpoint






  - Create SageMaker model from S3 artifact
  - Configure Serverless Inference endpoint (1024 MB memory, 200 max concurrency)
  - Set up IAM roles for Lambda to invoke endpoint
  - _Requirements: 8.2, 8.4_

- [x] 4.2 Implement ML Inference Lambda


  - Create Lambda to call SageMaker endpoint
  - Implement predictOptimalCallTime function
  - Handle fallback to default patterns when insufficient data
  - Cache predictions in Redis
  - _Requirements: 8.2, 8.4_

- [ ]* 4.3 Write property test for ML prediction completeness
  - **Property 32: ML prediction completeness**
  - **Validates: Requirements 8.2, 8.4**

- [x] 4.4 Integrate ML predictions into contact ingestion



  - Call ML Inference Lambda during contact upload
  - Store optimal call time in contacts table
  - Handle batch prediction for large contact lists
  - _Requirements: 8.3_

- [ ]* 4.5 Write property test for optimal time scheduling priority
  - **Property 33: Optimal time scheduling priority**
  - **Validates: Requirements 8.3**

- [x] 5. Step Functions Workflow





- [x] 5.1 Create Step Functions state machine for campaign execution


  - Define state machine JSON (ValidateCampaign → QueryContacts → PushToQueue → Monitor → GenerateReport)
  - Configure error handling and retry logic
  - Set up CloudWatch integration for monitoring
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5.2 Implement Validate Campaign Lambda


  - Validate campaign configuration (time windows, IVR flow, audio files)
  - Check for required fields and valid values
  - Return validation errors to Step Functions
  - _Requirements: 2.1_

- [x] 5.3 Implement Dispatcher Lambda


  - Query PostgreSQL for eligible contacts (not blacklisted, within time window, not exceeded attempts)
  - Apply ML-based prioritization (optimal call times)
  - Batch contacts and push to SQS dial-tasks queue
  - Update campaign status to "active"
  - _Requirements: 2.2, 2.3, 2.4, 3.1, 8.3_

- [ ]* 5.4 Write property test for calling window enforcement
  - **Property 6: Calling window enforcement**
  - **Validates: Requirements 2.2**

- [ ]* 5.5 Write property test for timezone-aware calling windows
  - **Property 8: Timezone-aware calling windows**
  - **Validates: Requirements 2.4**

- [ ]* 5.6 Write property test for blacklist pre-dial check
  - **Property 10: Blacklist pre-dial check**
  - **Validates: Requirements 3.1**

- [x] 5.7 Implement Campaign Status Checker Lambda


  - Query campaign progress from PostgreSQL
  - Calculate completion percentage
  - Return status to Step Functions for monitoring loop
  - _Requirements: 2.3_

- [x] 6. EventBridge Pipes and Dialer Worker




- [x] 6.1 Set up EventBridge Pipe from SQS to Lambda


  - Create Pipe connecting dial-tasks queue to Dialer Worker Lambda
  - Configure filtering (skip invalid messages)
  - Set up enrichment Lambda to add campaign config
  - Configure batching (10 messages, 5 second window)
  - _Requirements: 9.1, 9.2_



- [x] 6.2 Implement Enrich Dial Task Lambda

  - Fetch campaign configuration from PostgreSQL
  - Add IVR flow, audio URLs, and settings to message
  - Return enriched message to Pipe
  - _Requirements: 4.1_

- [x] 6.3 Implement Dialer Worker Lambda



  - Process batch of dial tasks from EventBridge Pipe
  - Check Redis for current CPS rate
  - Increment Redis counter (1-second TTL) if under limit
  - Send dial command to Node.js Worker via HTTP
  - Handle rate limit exceeded (return for retry)
  - _Requirements: 9.1, 9.2, 9.4_

- [ ]* 6.4 Write property test for adaptive pace reduction
  - **Property 36: Adaptive pace reduction on high load**
  - **Validates: Requirements 9.2**

- [ ]* 6.5 Write property test for pace adjustment logging
  - **Property 39: Pace adjustment audit logging**
  - **Validates: Requirements 9.5**

- [x] 7. Asterisk Telephony Engine






- [x] 7.1 Provision EC2 instance for Asterisk


  - Launch c5.large instance in public subnet
  - Assign Elastic IP for SIP trunk whitelisting
  - Configure security group (SIP 5060/5061, RTP 10000-20000, AMI 5038)
  - _Requirements: 12.1_


- [x] 7.2 Create Ansible playbook for Asterisk installation

  - Install Asterisk from source or package manager
  - Configure SIP trunk connection to Israeli provider (019/Partner)
  - Set up AMI/ARI for external control
  - Configure dialplan for IVR logic
  - Set up systemd service for auto-restart
  - _Requirements: 4.1_

- [x] 7.3 Implement Node.js Worker for AMI/ARI control


  - Create Express server to receive dial commands from Lambda
  - Implement AMI/ARI client to control Asterisk
  - Implement originateCall function (generate call file or use ARI)
  - Handle call state events (DIALING, RINGING, ANSWERED)
  - _Requirements: 4.1, 4.2_

- [x] 7.4 Implement IVR logic in Asterisk dialplan


  - Play pre-recorded audio on answer
  - Capture DTMF input with timeout
  - Route DTMF to Node.js Worker for processing
  - Handle invalid input and timeouts
  - _Requirements: 4.1, 4.2, 4.4, 4.6_

- [ ]* 7.5 Write property test for DTMF action execution
  - **Property 15: DTMF action execution**
  - **Validates: Requirements 4.2**

- [ ]* 7.6 Write property test for invalid DTMF error handling
  - **Property 16: Invalid DTMF error handling**
  - **Validates: Requirements 4.4**

- [ ]* 7.7 Write property test for IVR timeout handling
  - **Property 18: IVR timeout handling**
  - **Validates: Requirements 4.6**

- [x] 8. SMS and TTS Integration



- [x] 8.1 Implement SMS Gateway Lambda


  - Create Lambda to send SMS via Vonage/Local provider
  - Implement sendSMS function with template variable substitution
  - Track delivery status via webhook
  - Detect SMS capability failures (landline detection)
  - Trigger TTS fallback on failure
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1_

- [ ]* 8.2 Write property test for SMS template variable substitution
  - **Property 22: SMS template variable substitution**
  - **Validates: Requirements 5.4**

- [ ]* 8.3 Write property test for SMS failure triggers TTS fallback
  - **Property 21: SMS failure triggers TTS fallback**
  - **Validates: Requirements 5.3, 7.1**

- [x] 8.4 Implement Amazon Polly TTS integration


  - Create function to call Polly synthesizeSpeech API
  - Support Hebrew and English voices (neural engine)
  - Implement audio caching in S3 (hash text content for cache key)
  - Return S3 URL for generated audio
  - _Requirements: 7.2, 7.5_

- [ ]* 8.5 Write property test for TTS text-to-speech conversion
  - **Property 29: TTS text-to-speech conversion**
  - **Validates: Requirements 7.2**

- [x] 8.6 Implement TTS fallback call initiation


  - Trigger TTS call when SMS fails
  - Call Polly to generate speech
  - Send dial command to Node.js Worker with TTS audio URL
  - Track TTS fallback outcome
  - _Requirements: 7.1, 7.4_

- [ ]* 8.7 Write property test for TTS fallback outcome recording
  - **Property 30: TTS fallback outcome recording**
  - **Validates: Requirements 7.4**

- [x] 9. Event Processing and Actions





- [x] 9.1 Implement SNS event handlers for donation flow


  - Create Lambda subscribed to donation-events topic
  - Trigger SMS sending with donation link
  - Handle SMS failure and TTS fallback
  - Record action in database
  - _Requirements: 4.2, 5.1_

- [ ]* 9.2 Write property test for DTMF-triggered SMS delivery
  - **Property 19: DTMF-triggered SMS delivery**
  - **Validates: Requirements 5.1**

- [x] 9.3 Implement SNS event handler for opt-out flow


  - Create Lambda subscribed to optout-events topic
  - Add phone number to blacklist table
  - Update Redis cache for fast lookups
  - Terminate active call
  - _Requirements: 3.3, 4.3_

- [ ]* 9.4 Write property test for DTMF opt-out immediate effect
  - **Property 12: DTMF opt-out immediate effect**
  - **Validates: Requirements 3.3, 4.3**



- [x] 9.5 Implement CDR logging to MongoDB


  - Create Lambda to write call events to MongoDB
  - Store CDR with call ID, timestamps, outcome, DTMF inputs, cost
  - Update Redis counters for live dashboard
  - _Requirements: 10.1, 10.2, 11.1_

- [ ]* 9.6 Write property test for campaign report completeness
  - **Property 44: Campaign report completeness**
  - **Validates: Requirements 11.1**

- [x] 10. Analytics and Reporting



- [x] 10.1 Implement Analytics Lambda for real-time metrics


  - Query Redis for live metrics (active calls, queue depth, dialing rate)
  - Query PostgreSQL for campaign progress
  - Calculate answer rate, conversion rate, opt-out rate
  - Return metrics to API Gateway
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ]* 10.2 Write property test for dashboard real-time metrics display
  - **Property 40: Dashboard real-time metrics display**
  - **Validates: Requirements 10.1, 10.3**

- [ ]* 10.3 Write property test for real-time outcome metric updates
  - **Property 41: Real-time outcome metric updates**
  - **Validates: Requirements 10.2**

- [x] 10.4 Implement Report Generator Lambda


  - Aggregate data from PostgreSQL and MongoDB
  - Calculate aggregate metrics (total attempts, answer rate, conversion rate)
  - Generate CSV/Excel/PDF reports
  - Upload report to S3
  - Send notification with download link
  - _Requirements: 11.1, 11.2, 11.3_

- [ ]* 10.5 Write property test for report metric calculation accuracy
  - **Property 45: Report metric calculation accuracy**
  - **Validates: Requirements 11.2**

- [x] 10.6 Implement campaign comparison functionality


  - Query multiple campaigns from database
  - Calculate side-by-side metrics
  - Return comparison data to frontend
  - _Requirements: 11.5_

- [ ]* 10.7 Write property test for campaign comparison correctness
  - **Property 47: Campaign comparison correctness**
  - **Validates: Requirements 11.5**

- [x] 11. Frontend - React Dashboard







- [x] 11.1 Set up React project with TypeScript and Vite



  - Initialize React 18 project with Vite
  - Configure TypeScript, ESLint, Prettier
  - Set up Material-UI (MUI) or Ant Design
  - Configure Redux Toolkit and React Query
  - _Requirements: 10.1_

- [x] 11.2 Implement authentication flow with Cognito



  - Integrate AWS Amplify for Cognito authentication
  - Implement login/signup pages
  - Handle JWT token storage (httpOnly cookies)
  - Implement token refresh logic
  - Add protected route wrapper
  - _Requirements: 13.2_

- [x] 11.3 Implement campaign management UI











  - Create campaign list page with filtering/sorting
  - Implement campaign creation wizard (multi-step form)
  - Add campaign detail view
  - Implement campaign edit/delete functionality
  - _Requirements: 2.1_

- [x] 11.4 Implement contact upload UI




  - Create drag-and-drop file upload component
  - Implement Excel/CSV file validation
  - Show upload progress indicator
  - Display import summary (success/failures)
  - _Requirements: 1.1_

- [x] 11.5 Implement audio recording features






  - Add in-browser recording using MediaRecorder API
  - Implement audio file upload with validation
  - Create audio preview player
  - Display phone-in recording instructions
  - Implement audio library (reusable recordings)
  - _Requirements: 4.1_

- [x] 11.6 Implement IVR flow builder













  - Create visual drag-and-drop flow designer
  - Add node types: Play Audio, Capture Input, Menu, Action
  - Implement DTMF mapping configuration
  - Add flow validation before save
  - _Requirements: 4.1, 4.5_

- [x] 11.7 Implement real-time dashboard





  - Create WebSocket connection via API Gateway
  - Display live metrics: active calls, queue depth, dialing rate
  - Show campaign progress charts (Recharts)
  - Implement auto-refresh for critical metrics
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 11.8 Implement analytics and reporting UI




  - Create historical campaign performance charts
  - Implement campaign comparison view
  - Add date range filtering
  - Implement report export (CSV, Excel, PDF download)
  - _Requirements: 11.3, 11.4, 11.5_

- [x] 11.9 Implement blacklist management UI






  - Create blacklist upload page
  - Add manual add/remove number functionality
  - Display opt-out history table
  - Implement blacklist export
  - _Requirements: 3.4_

- [x] 11.10 Deploy frontend to S3 + CloudFront


  - Build React app for production
  - Upload to S3 bucket
  - Configure CloudFront distribution
  - Set up custom domain and SSL certificate
  - _Requirements: 13.2_

- [ ] 12. SMS-Only Campaigns

- [x] 12.1 Implement SMS campaign creation


  - Add SMS campaign type to campaign creation flow
  - Allow SMS template configuration without voice components
  - Implement SMS scheduling with time windows
  - _Requirements: 6.1, 6.2_

- [x] 12.2 Implement SMS campaign execution


  - Create SMS dispatcher Lambda
  - Send SMS messages within configured time windows
  - Track delivery status, open rates, link clicks
  - _Requirements: 6.2, 6.3_

- [ ]* 12.3 Write property test for SMS campaign time window compliance
  - **Property 24: SMS campaign time window compliance**
  - **Validates: Requirements 6.2**

- [x] 12.4 Implement inbound SMS reply handling


  - Set up webhook for SMS provider
  - Create Lambda to process inbound SMS
  - Associate reply with contact record
  - Store reply in database
  - _Requirements: 6.4_

- [ ]* 12.5 Write property test for SMS reply capture and association
  - **Property 26: SMS reply capture and association**
  - **Validates: Requirements 6.4**

- [x] 12.6 Implement concurrent campaign management



  - Ensure SMS and voice campaigns run independently
  - Prevent resource conflicts between campaign types
  - Test concurrent execution
  - _Requirements: 6.5_

- [ ]* 12.7 Write property test for campaign type independence
  - **Property 27: Campaign type independence**
  - **Validates: Requirements 6.5**

- [ ] 13. Integration and End-to-End Testing

- [x] 13.1 Set up integration test environment



  - Create test containers for PostgreSQL, MongoDB, Redis
  - Set up test AWS resources (LocalStack or dedicated test account)
  - Configure test data fixtures
  - _Requirements: 12.1_

- [ ]* 13.2 Write integration tests for campaign execution flow
  - Test: Create campaign → Upload contacts → Schedule → Execute → Generate report
  - Test: Voice campaign with opt-outs → Blacklist updates → Verify exclusion
  - Test: SMS campaign with replies → Capture responses → Export data
  - _Requirements: 2.1, 2.2, 3.3, 4.3, 6.4_

- [ ]* 13.3 Write load tests for concurrent call handling
  - Test: 5000 concurrent calls with <200ms latency
  - Test: Measure maximum calls per second
  - Test: Stress test with 10000 concurrent calls
  - _Requirements: 12.1_

- [ ]* 13.4 Write property test for concurrent call performance
  - **Property 48: Concurrent call performance**
  - **Validates: Requirements 12.1**

- [-] 14. Monitoring and Observability


- [x] 14.1 Set up CloudWatch dashboards


  - Create campaign overview dashboard (active calls, queue depth, dialing rate)
  - Create system health dashboard (Lambda errors, SQS backlog, EC2 CPU)
  - Create business metrics dashboard (answer rate, conversion rate, cost per call)
  - _Requirements: 10.1, 10.5_

- [x] 14.2 Configure CloudWatch alarms


  - Set up critical alarms (Lambda errors > 5%, SQS queue depth > 10000, EC2 CPU > 90%)
  - Set up warning alarms (answer rate < 20%, RDS connections > 80%)
  - Configure SNS notifications to operations team
  - _Requirements: 10.5_

- [ ]* 14.3 Write property test for health indicator alerting
  - **Property 43: Health indicator alerting**
  - **Validates: Requirements 10.5**

- [x] 14.4 Set up AWS X-Ray tracing




  - Enable X-Ray for all Lambda functions
  - Configure trace sampling rules
  - Set up service map visualization
  - _Requirements: 12.1_

- [x] 15. CI/CD Pipeline




- [x] 15.1 Create GitHub Actions workflow for Lambda deployment


  - Build Docker images for Lambda functions
  - Run unit tests and property tests
  - Push images to ECR
  - Update Lambda function code
  - Run integration tests
  - _Requirements: 13.2_

- [x] 15.2 Create GitHub Actions workflow for infrastructure updates


  - Run Terraform plan
  - Require manual approval for production
  - Apply Terraform changes
  - _Requirements: 13.2_

- [x] 15.3 Create GitHub Actions workflow for frontend deployment


  - Build React app
  - Upload to S3
  - Invalidate CloudFront cache
  - _Requirements: 13.2_

- [x] 15.4 Create GitHub Actions workflow for Asterisk configuration


  - Run Ansible playbooks
  - Deploy Node.js worker
  - Restart services
  - Run health checks
  - _Requirements: 13.2_

- [x] 16. Final Checkpoint - Ensure all tests pass








  - Ensure all tests pass, ask the user if questions arise.
