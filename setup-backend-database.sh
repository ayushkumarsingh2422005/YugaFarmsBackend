#!/bin/bash

# Database Setup Script for YugaFarms Backend
# Run this script to set up PostgreSQL database

echo "🗄️ Setting up PostgreSQL database for YugaFarms Backend..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Database configuration
DB_NAME="yugafarms_db"
DB_USER="yugafarms_user"
DB_PASSWORD="YugaFarms2024!Secure"

print_status "Creating database and user..."

# Create database and user
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE $DB_NAME;

-- Create user
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Grant schema privileges
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Exit
\q
EOF

print_status "✅ Database setup completed!"
print_warning "Database credentials:"
echo "Database Name: $DB_NAME"
echo "Username: $DB_USER"
echo "Password: $DB_PASSWORD"
echo ""
echo "Update your backend .env file with these credentials:"
echo "DATABASE_CLIENT=postgres"
echo "DATABASE_HOST=localhost"
echo "DATABASE_PORT=5432"
echo "DATABASE_NAME=$DB_NAME"
echo "DATABASE_USERNAME=$DB_USER"
echo "DATABASE_PASSWORD=$DB_PASSWORD"
