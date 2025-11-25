# Campaign Dashboard - Frontend

React-based web dashboard for the Mass Voice Campaign System.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Material-UI (MUI)** - Component library
- **Redux Toolkit** - State management
- **React Query** - Server state management
- **React Router** - Routing
- **AWS Amplify** - Authentication with Cognito
- **Recharts** - Data visualization
- **Axios** - HTTP client

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your AWS Cognito and API configuration
```

### Development

```bash
# Start development server (runs on http://localhost:3000)
npm run dev

# Run linter
npm run lint

# Format code
npm run format
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── api/              # API client and service functions
│   ├── components/       # Reusable UI components
│   ├── pages/            # Page components
│   ├── store/            # Redux store and slices
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Application entry point
│   └── theme.ts          # MUI theme configuration
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Features

- Campaign management (create, edit, delete, schedule)
- Contact list upload and management
- Audio recording and library
- IVR flow builder
- Real-time analytics dashboard
- Campaign reporting and comparison
- Blacklist management
- User authentication with AWS Cognito

## Environment Variables

See `.env.example` for required environment variables.

## Deployment

The frontend is deployed to AWS S3 + CloudFront for global content delivery.

### Quick Deploy

```bash
# Run pre-deployment checks
chmod +x pre-deploy-check.sh
./pre-deploy-check.sh

# Deploy to development
chmod +x deploy.sh
./deploy.sh dev

# Deploy to production
./deploy.sh production
```

### Manual Deployment

```bash
# 1. Build the app
npm run build

# 2. Get infrastructure details from Terraform
cd ../terraform
BUCKET_NAME=$(terraform output -raw frontend_hosting_bucket)
DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id)

# 3. Upload to S3
aws s3 sync dist/ "s3://${BUCKET_NAME}/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

aws s3 cp dist/index.html "s3://${BUCKET_NAME}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate"

# 4. Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*"
```

### CI/CD Deployment

The repository includes a GitHub Actions workflow that automatically deploys on push to `main` or `develop` branches.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions, including:
- Custom domain setup with SSL
- Rollback procedures
- Monitoring and troubleshooting
- Cost optimization
- Security best practices

## License

MIT
