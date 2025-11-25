#!/bin/bash
# Quick validation script to check if all files are in place

set -e

echo "Validating integration test environment setup..."
echo ""

ERRORS=0

# Check required files
FILES=(
  "docker-compose.test.yml"
  "setup.sh"
  "health-check.ts"
  "example.integration.test.ts"
  "README.md"
  "TESTING_GUIDE.md"
  "QUICK_START.md"
  "fixtures/mongodb-init.js"
  "fixtures/test-data.ts"
  "setup/test-environment.ts"
  "setup/localstack-init.sh"
)

echo "Checking required files..."
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ $file (missing)"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""

# Check if scripts are executable
echo "Checking script permissions..."
if [ -x "setup.sh" ]; then
  echo "✓ setup.sh is executable"
else
  echo "✗ setup.sh is not executable"
  echo "  Run: chmod +x setup.sh"
  ERRORS=$((ERRORS + 1))
fi

if [ -x "setup/localstack-init.sh" ]; then
  echo "✓ localstack-init.sh is executable"
else
  echo "✗ localstack-init.sh is not executable"
  echo "  Run: chmod +x setup/localstack-init.sh"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# Check Docker
echo "Checking Docker..."
if command -v docker &> /dev/null; then
  echo "✓ Docker is installed"
  if docker ps &> /dev/null; then
    echo "✓ Docker is running"
  else
    echo "✗ Docker is not running"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "✗ Docker is not installed"
  ERRORS=$((ERRORS + 1))
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
  echo "✓ Docker Compose is installed"
else
  echo "✗ Docker Compose is not installed"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# Summary
if [ $ERRORS -eq 0 ]; then
  echo "=========================================="
  echo "✓ All validation checks passed!"
  echo "=========================================="
  echo ""
  echo "You can now run:"
  echo "  ./setup.sh"
  echo ""
  exit 0
else
  echo "=========================================="
  echo "✗ Validation failed with $ERRORS error(s)"
  echo "=========================================="
  echo ""
  echo "Please fix the errors above and try again."
  echo ""
  exit 1
fi
