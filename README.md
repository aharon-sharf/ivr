# Mass Voice Campaign System

Enterprise-grade platform for managing and executing large-scale outbound voice campaigns with interactive IVR, SMS integration, and machine learning optimization.

## Project Structure

```
.
├── database/                    # Database schema and migrations
│   ├── schema.sql              # Complete PostgreSQL schema
│   └── migrations/             # Versioned migration scripts
│       ├── 001_initial_schema.sql
│       └── README.md
├── src/                        # Source code
│   ├── models/                 # Data models and validation
│   │   ├── Campaign.ts         # Campaign model and validation
│   │   ├── Contact.ts          # Contact model with phone validation
│   │   ├── BlacklistEntry.ts   # Blacklist model
│   │   ├── CallRecord.ts       # Call record model
│   │   ├── SMSRecord.ts        # SMS record model
│   │   └── index.ts            # Model exports
│   └── types/                  # TypeScript type definitions
│       ├── api.ts              # API request/response types
│       └── index.ts            # Type exports
├── tests/                      # Test suite
│   ├── database/               # Database property tests
│   │   ├── schema-integrity.test.ts
│   │   └── TEST_SETUP.md
│   ├── models/                 # Model property tests
│   │   ├── phone-validation.test.ts
│   │   └── TEST_SETUP.md
│   ├── integration/            # Integration tests
│   │   ├── docker-compose.test.yml
│   │   ├── setup.sh            # Automated setup
│   │   ├── example.integration.test.ts
│   │   ├── fixtures/           # Test data
│   │   ├── setup/              # Test utilities
│   │   └── README.md           # Integration test guide
│   └── README.md               # Testing guide
├── terraform/                  # Infrastructure as Code
│   └── modules/                # Terraform modules
├── package.json                # Node.js dependencies
├── tsconfig.json               # TypeScript configuration
├── vitest.config.ts            # Test configuration
└── .env.example                # Environment variables template
```

## Features

- ✅ **Campaign Management**: Create and manage voice, SMS, and hybrid campaigns
- ✅ **Contact Management**: Import contacts from Excel/CSV or external databases
- ✅ **Blacklist Management**: Do-Not-Call registry with automatic enforcement
- ✅ **IVR System**: Interactive voice response with DTMF input handling
- ✅ **SMS Integration**: SMS delivery with TTS fallback for landlines
- ✅ **ML Optimization**: Machine learning-based optimal call time prediction
- ✅ **Real-time Analytics**: Live dashboard with campaign metrics
- ✅ **Property-Based Testing**: Comprehensive test coverage with fast-check

## Technology Stack

### Backend
- **Language**: TypeScript (Node.js)
- **Database**: PostgreSQL (AWS RDS)
- **Caching**: Redis (ElastiCache)
- **Message Queue**: AWS SQS
- **Event Bus**: AWS SNS
- **Compute**: AWS Lambda (serverless)
- **Orchestration**: AWS Step Functions
- **Telephony**: Asterisk (self-hosted on EC2)

### Testing
- **Framework**: Vitest
- **Property Testing**: fast-check
- **Coverage**: 100 iterations per property test

### Infrastructure
- **IaC**: Terraform
- **Configuration**: Ansible
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

1. **Node.js** v18 or higher
2. **PostgreSQL** v14 or higher
3. **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd mass-voice-campaign-system

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
```

### Database Setup

#### Using Docker

```bash
# Start PostgreSQL container
docker run -d \
  --name campaign-db \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=campaign_system \
  postgres:15

# Apply schema
psql -h localhost -U postgres -d campaign_system -f database/migrations/001_initial_schema.sql
```

#### Using Existing PostgreSQL

```bash
# Create database
createdb campaign_system

# Apply schema
psql -d campaign_system -f database/migrations/001_initial_schema.sql
```

### Running Tests

#### Unit and Property Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run specific test suite
npm test tests/models/phone-validation.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

#### Integration Tests

Integration tests use Docker containers for PostgreSQL, MongoDB, and Redis.

```bash
# Quick start (automated setup)
cd tests/integration
./setup.sh

# Or manually
npm run docker:test:up    # Start containers
npm run test:integration  # Run tests
npm run docker:test:down  # Stop containers

# View logs
npm run docker:test:logs

# Clean everything
npm run docker:test:clean
```

See [Integration Testing Guide](tests/integration/TESTING_GUIDE.md) for details.

## Database Schema

### Tables

- **users**: User accounts with role-based access control
- **campaigns**: Campaign configurations and metadata
- **contacts**: Contact lists with phone numbers and metadata
- **blacklist**: Do-Not-Call registry
- **call_records**: Call outcomes and CDRs
- **sms_records**: SMS delivery records

### Key Features

- ✅ Foreign key constraints for referential integrity
- ✅ Unique constraints to prevent duplicates
- ✅ Indexes for performance optimization
- ✅ Automatic timestamp updates via triggers
- ✅ JSONB columns for flexible metadata storage

## Data Models

### Campaign

```typescript
interface Campaign {
  id: string;
  name: string;
  type: 'voice' | 'sms' | 'hybrid';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  config: CampaignConfig;
  startTime?: Date;
  endTime?: Date;
  timezone: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Contact

```typescript
interface Contact {
  id: string;
  campaignId: string;
  phoneNumber: string; // E.164 format
  metadata: Record<string, any>;
  timezone?: string;
  smsCapable: boolean;
  optimalCallTime?: OptimalTimeWindow;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blacklisted';
  attempts: number;
  lastAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Phone Number Validation

Phone numbers must follow E.164 format:
- Start with `+`
- Country code (1-3 digits, cannot start with 0)
- Subscriber number
- Total length: 2-15 digits

```typescript
import { validatePhoneNumber, normalizePhoneNumber } from './src/models/Contact';

// Validation
validatePhoneNumber('+1234567890'); // true
validatePhoneNumber('1234567890'); // false (missing +)

// Normalization
normalizePhoneNumber('(123) 456-7890'); // '+1234567890'
```

## Property-Based Testing

The system uses property-based testing to verify correctness across all inputs.

### Property 2: Database Synchronization Consistency

**Statement**: For any external database connection, after synchronization completes, the local contact records should match the remote records exactly.

**Validates**: Requirements 1.2

**Test**: `tests/database/schema-integrity.test.ts`

### Property 3: Phone Number Validation Correctness

**Statement**: For any string input, the validation function should accept it if and only if it matches valid E.164 format.

**Validates**: Requirements 1.3

**Test**: `tests/models/phone-validation.test.ts`

## API Types

All API request/response types are defined in `src/types/api.ts`:

- Campaign CRUD operations
- Contact upload and synchronization
- Blacklist management
- Campaign execution control
- Analytics and reporting
- Call and SMS record queries

## Development

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for formatting

### Testing Guidelines

1. Write property tests for universal properties
2. Run 100 iterations per property test
3. Tag tests with property number and requirement
4. Use transactions for database tests
5. Clean up test data after each run

### Contributing

1. Create a feature branch
2. Write tests first (TDD)
3. Implement the feature
4. Ensure all tests pass
5. Submit a pull request

## Deployment

### Infrastructure Provisioning

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### Lambda Deployment

```bash
# Build Docker images
docker build -t campaign-api-lambda .

# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <ecr-url>
docker push <ecr-url>/campaign-api-lambda:latest

# Update Lambda function
aws lambda update-function-code \
  --function-name campaign-api \
  --image-uri <ecr-url>/campaign-api-lambda:latest
```

### Database Migrations

```bash
# Apply migration
psql -h <rds-endpoint> -U <username> -d campaign_system -f database/migrations/001_initial_schema.sql
```

## Monitoring

- **CloudWatch Logs**: Lambda function logs
- **CloudWatch Metrics**: Custom metrics for campaigns
- **CloudWatch Dashboards**: Real-time campaign monitoring
- **X-Ray**: Distributed tracing

## Security

- JWT authentication via AWS Cognito
- Role-based access control (RBAC)
- Encryption at rest (RDS, S3)
- Encryption in transit (TLS 1.3)
- VPC isolation for databases
- Security groups for network access control

## Cost Optimization

- Serverless architecture (scale-to-zero)
- VPC Endpoints instead of NAT Gateway
- SageMaker Serverless Inference
- S3 lifecycle policies
- Reserved capacity for predictable workloads

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
