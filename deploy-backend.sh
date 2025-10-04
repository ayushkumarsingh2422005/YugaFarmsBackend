#!/bin/bash

# YugaFarms Backend Only Deployment Script for AWS EC2
# Run this script on your EC2 instance

echo "🚀 Starting YugaFarms Backend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root. Use a regular user with sudo privileges."
    exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
print_status "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
print_status "Installing PM2..."
sudo npm install -g pm2

# Install Nginx
print_status "Installing Nginx..."
sudo apt install nginx -y

# Start and enable services
print_status "Starting services..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Create logs directory
print_status "Creating logs directory..."
mkdir -p logs

# Install backend dependencies
print_status "Installing backend dependencies..."
cd YugaFarmsBackend
npm install

# Go back to root directory
cd ..

print_status "✅ Backend setup completed!"
print_warning "Next steps:"
echo "1. Configure your backend .env file (using SQLite - no database setup needed)"
echo "2. Configure Nginx for api.yugafarms.com"
echo "3. Start backend with PM2:"
echo "   pm2 start ecosystem-backend.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "4. Setup SSL certificate:"
echo "   sudo certbot --nginx -d api.yugafarms.com"
