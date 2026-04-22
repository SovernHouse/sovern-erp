#!/bin/bash

# Trading ERP System - Setup Script
# This script sets up the entire Trading ERP system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check Node.js version
check_node_version() {
    print_header "Checking Node.js Version"

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required (you have v$(node -v))"
        exit 1
    fi

    print_success "Node.js $(node -v) detected"
}

# Check npm version
check_npm_version() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi

    NPM_VERSION=$(npm -v | cut -d'.' -f1)
    if [ "$NPM_VERSION" -lt 9 ]; then
        print_warning "npm version 9+ recommended (you have npm $(npm -v))"
    else
        print_success "npm $(npm -v) detected"
    fi
}

# Check PostgreSQL
check_postgres() {
    print_header "Checking PostgreSQL"

    if command -v psql &> /dev/null; then
        print_success "PostgreSQL is installed"
        PG_VERSION=$(psql --version | awk '{print $3}')
        print_info "PostgreSQL version: $PG_VERSION"
        export DB_HOST=localhost
        export DB_PORT=5432
    else
        print_warning "PostgreSQL is not installed locally"
        print_info "You can use Docker to run PostgreSQL"
        print_info "Run 'npm run docker:up' to start services in Docker"
        read -p "Continue with local setup? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Create .env file
create_env_file() {
    print_header "Setting Up Environment Variables"

    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Overwrite? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping .env creation"
            return
        fi
    fi

    if [ ! -f .env.example ]; then
        print_error ".env.example not found"
        exit 1
    fi

    cp .env.example .env
    print_success ".env file created from .env.example"

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
    rm -f .env.bak

    # Generate session secret
    SESSION_SECRET=$(openssl rand -base64 32)
    sed -i.bak "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|g" .env
    rm -f .env.bak

    print_success "Generated secure JWT and Session secrets"
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"

    if [ ! -d "backend" ] || [ ! -d "portals/admin" ]; then
        print_error "Project structure not found. Please ensure you're in the correct directory"
        exit 1
    fi

    print_info "Installing root dependencies..."
    npm install

    print_info "Installing backend dependencies..."
    cd backend && npm install && cd ..

    print_info "Installing admin portal dependencies..."
    cd portals/admin && npm install && cd ../..

    print_info "Installing customer portal dependencies..."
    cd portals/customer && npm install && cd ../..

    print_info "Installing factory portal dependencies..."
    cd portals/factory && npm install && cd ../..

    print_success "All dependencies installed successfully"
}

# Create database
create_database() {
    print_header "Setting Up Database"

    if [ -z "$DB_HOST" ]; then
        print_warning "PostgreSQL not found locally. Skipping database creation."
        print_info "You can set up the database using Docker:"
        print_info "  npm run docker:up"
        return
    fi

    # Source .env
    set -a
    [ -f .env ] && source .env
    set +a

    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_USER=${DB_USER:-postgres}
    DB_PASSWORD=${DB_PASSWORD:-postgres}
    DB_NAME=${DB_NAME:-trading_erp}

    print_info "Creating database: $DB_NAME"

    # Create database if it doesn't exist
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc \
        "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER \
        -c "CREATE DATABASE $DB_NAME;"

    print_success "Database ready: $DB_NAME"
}

# Run migrations
run_migrations() {
    print_header "Running Database Migrations"

    if [ ! -f "backend/package.json" ]; then
        print_warning "Backend package.json not found. Skipping migrations."
        return
    fi

    print_info "Running migrations in backend..."
    cd backend

    if grep -q "\"migrate\":" package.json; then
        npm run migrate || print_warning "Migrations may not be set up yet"
    else
        print_warning "Migrate script not found in backend package.json"
    fi

    cd ..
}

# Seed database
seed_database() {
    print_header "Seeding Database"

    read -p "Do you want to seed the database with sample data? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Skipping database seeding"
        return
    fi

    if [ ! -f "backend/package.json" ]; then
        print_warning "Backend package.json not found. Skipping seeding."
        return
    fi

    cd backend

    if grep -q "\"seed\":" package.json; then
        print_info "Running seed script..."
        npm run seed || print_warning "Seeding may have failed"
    else
        print_warning "Seed script not found in backend package.json"
    fi

    cd ..
}

# Print next steps
print_next_steps() {
    print_header "Setup Complete!"

    echo -e "${GREEN}Trading ERP System is ready to use${NC}\n"

    echo "Default Credentials:"
    echo -e "  ${BLUE}Email:${NC} admin@floortrading.com"
    echo -e "  ${BLUE}Password:${NC} admin123\n"

    echo "Quick Start:"
    echo -e "  ${BLUE}Development (local):${NC}"
    echo "    npm run dev"
    echo ""
    echo -e "  ${BLUE}Development (Docker):${NC}"
    echo "    npm run docker:up"
    echo ""

    echo "Access URLs:"
    echo -e "  ${BLUE}Admin Portal:${NC}     http://localhost:3000"
    echo -e "  ${BLUE}Customer Portal:${NC}  http://localhost:3002"
    echo -e "  ${BLUE}Factory Portal:${NC}   http://localhost:3003"
    echo -e "  ${BLUE}API Server:${NC}       http://localhost:3001"
    echo ""

    echo "Useful Commands:"
    echo "  npm run dev              - Start all services"
    echo "  npm run dev:backend      - Start backend only"
    echo "  npm run build:all        - Build all frontends"
    echo "  npm run docker:up        - Start with Docker"
    echo "  npm run docker:down      - Stop Docker containers"
    echo "  npm run docker:logs      - View Docker logs"
    echo ""

    echo "Documentation:"
    echo "  README.md                - Project overview and architecture"
    echo "  docs/API_REFERENCE.md    - API endpoint documentation"
    echo "  docs/DATABASE_SCHEMA.md  - Database schema details"
    echo "  docs/USER_GUIDE.md       - User guides for each portal"
    echo ""

    print_success "Happy coding!"
}

# Main execution
main() {
    print_header "Trading ERP System - Setup"

    check_node_version
    check_npm_version
    check_postgres
    create_env_file
    install_dependencies
    create_database
    run_migrations
    seed_database
    print_next_steps
}

# Run main function
main
