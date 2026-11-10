#!/bin/bash

# Production start script for Linux / cPanel / VPS deployment
# This script optimizes Node.js for limited memory environments

# Set production environment
export NODE_ENV=production

# Memory optimization flags
export NODE_OPTIONS="--max-old-space-size=1024"

# Create required directories if they don't exist
mkdir -p logs sessions media auth_info_baileys data

# Check and install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "node_modules not found. Installing production dependencies..."
    npm install --production
fi

# Check if PM2 is available
if command -v pm2 &> /dev/null
then
    echo "Starting application with PM2..."
    pm2 start ecosystem.config.js
    echo ""
    echo "Application started with PM2!"
    echo "Check status with: pm2 status"
    echo "View logs with: pm2 logs whatsapp-api"
    echo "Monitor with: pm2 monit"
else
    echo "PM2 not found. Starting with Node.js directly..."
    echo "Recommendation: Install PM2 for better process management (npm install -g pm2)"
    echo ""
    
    # Start directly with Node.js
    node index.js
fi