#!/bin/bash

# Trading ERP System - Database Reset Script
# CAUTION: This script will delete all data in the database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Confirmation
print_header "WARNING: Database Reset"

echo -e "${RED}This will DELETE ALL DATA from your database!${NC}"
echo ""
echo "This operation will:"
echo "  1. Drop all tables"
echo "  2. Re-create database schema"
echo "  3. Seed sample data"
echo ""
read -p "Are you absolutely sure? Type 'yes' to confirm: " -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_info "Cancelled"
    exit 0
fi

echo ""
read -p "Enter database name (default: trading_erp): " DB_NAME
DB_NAME=${DB_NAME:-trading_erp}

read -p "Enter database host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Enter database port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Enter database user (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "Enter database password: " DB_PASSWORD
echo ""

# Set PostgreSQL password environment variable
export PGPASSWORD=$DB_PASSWORD

print_header "Resetting Database"

print_info "Connecting to PostgreSQL..."

# Test connection
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "SELECT 1" > /dev/null 2>&1; then
    print_error "Failed to connect to PostgreSQL"
    print_error "Check your connection parameters"
    exit 1
fi

print_success "Connected to PostgreSQL"

# Drop all tables
print_info "Dropping all tables..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
-- Drop all tables, sequences, functions, and types
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

if [ $? -eq 0 ]; then
    print_success "All tables dropped"
else
    print_error "Failed to drop tables"
    exit 1
fi

# Run migrations
print_info "Running migrations..."
cd backend

if grep -q "\"migrate\":" package.json; then
    npm run migrate || {
        print_error "Migrations failed"
        cd ..
        exit 1
    }
else
    print_warning "Migrate script not found in backend package.json"
fi

cd ..

# Seed database
print_info "Seeding database with sample data..."

cd backend

if grep -q "\"seed\":" package.json; then
    npm run seed || {
        print_error "Seeding failed"
        cd ..
        exit 1
    }
else
    print_warning "Seed script not found in backend package.json"
fi

cd ..

print_header "Database Reset Complete"
print_success "Database has been reset and re-seeded"
print_info "Your data is ready for development"
