#!/bin/bash

# Frontend Installation Script
echo "Installing frontend dependencies..."

# Navigate to frontend directory
cd "$(dirname "$0")"

# Install dependencies
npm install

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Frontend dependencies installed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Copy .env.example to .env and configure your environment variables"
    echo "  2. Run 'npm run dev' to start the development server"
    echo "  3. Run 'npm run build' to build for production"
else
    echo "❌ Installation failed. Please check the error messages above."
    exit 1
fi
