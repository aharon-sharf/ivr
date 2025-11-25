#!/bin/bash
# Integration Test Environment Setup Script
# This script sets up the complete integration test environment

set -e

echo "=========================================="
echo "Integration Test Environment Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker and Docker Compose are installed"
echo ""

# Stop any existing containers
echo "Stopping any existing test containers..."
docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
echo ""

# Start containers
echo "Starting test containers..."
docker-compose -f docker-compose.test.yml up -d

echo ""
echo "Waiting for services to be healthy..."
echo ""

# Wait for PostgreSQL
echo -n "PostgreSQL: "
for i in {1..30}; do
    if docker exec campaign-test-postgres pg_isready -U postgres &> /dev/null; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Wait for MongoDB
echo -n "MongoDB: "
for i in {1..30}; do
    if docker exec campaign-test-mongodb mongosh --quiet --eval "db.adminCommand('ping')" &> /dev/null; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Wait for Redis
echo -n "Redis: "
for i in {1..30}; do
    if docker exec campaign-test-redis redis-cli -a test_password ping &> /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Failed to start${NC}"
        exit 1
    fi
    sleep 1
done

# Wait for LocalStack (optional)
echo -n "LocalStack: "
for i in {1..30}; do
    if curl -s http://localhost:4566/_localstack/health &> /dev/null; then
        echo -e "${GREEN}✓ Ready${NC}"
        LOCALSTACK_READY=true
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠ Not available (optional)${NC}"
        LOCALSTACK_READY=false
        break
    fi
    sleep 1
done

echo ""

# Initialize LocalStack if it's ready
if [ "$LOCALSTACK_READY" = true ]; then
    echo "Initializing LocalStack AWS resources..."
    chmod +x setup/localstack-init.sh
    ./setup/localstack-init.sh
    echo ""
fi

# Create .env.test file if it doesn't exist
if [ ! -f "../../.env.test" ]; then
    echo "Creating .env.test file..."
    cat > ../../.env.test << EOF
# PostgreSQL
TEST_POSTGRES_HOST=localhost
TEST_POSTGRES_PORT=5433
TEST_POSTGRES_DB=campaign_test
TEST_POSTGRES_USER=postgres
TEST_POSTGRES_PASSWORD=test_password

# MongoDB
TEST_MONGODB_URL=mongodb://admin:test_password@localhost:27018
TEST_MONGODB_DB=campaign_test

# Redis
TEST_REDIS_URL=redis://:test_password@localhost:6380

# LocalStack
TEST_LOCALSTACK_ENDPOINT=http://localhost:4566
TEST_AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
EOF
    echo -e "${GREEN}✓${NC} Created .env.test file"
else
    echo -e "${GREEN}✓${NC} .env.test file already exists"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Services are running on:"
echo "  PostgreSQL: localhost:5433"
echo "  MongoDB:    localhost:27018"
echo "  Redis:      localhost:6380"
if [ "$LOCALSTACK_READY" = true ]; then
    echo "  LocalStack: localhost:4566"
fi
echo ""
echo "To run integration tests:"
echo "  npm run test:integration"
echo ""
echo "To view logs:"
echo "  npm run docker:test:logs"
echo ""
echo "To stop containers:"
echo "  npm run docker:test:down"
echo ""
echo "To clean everything:"
echo "  npm run docker:test:clean"
echo ""
