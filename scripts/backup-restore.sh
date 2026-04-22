#!/bin/bash
#
# Database Backup and Restore CLI
# Manages backup operations: create, restore, list, verify
#
# Usage:
#   ./backup-restore.sh backup              - Create a new backup
#   ./backup-restore.sh restore <filename>  - Restore from backup
#   ./backup-restore.sh list                - List available backups
#   ./backup-restore.sh verify <filename>   - Verify backup integrity
#   ./backup-restore.sh rotate              - Rotate backups (cleanup old)
#   ./backup-restore.sh stats               - Show backup statistics
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
BACKUPS_DIR="$BACKEND_DIR/backups"
DB_FILE="$BACKEND_DIR/database.sqlite"

# Database type detection
if grep -q "DB_TYPE=postgresql" "$PROJECT_ROOT/.env" 2>/dev/null; then
  DB_TYPE="postgresql"
else
  DB_TYPE="sqlite"
fi

# Status functions
print_status() {
  echo -e "${GREEN}[BACKUP]${NC} $1"
}

print_error() {
  echo -e "${RED}[BACKUP] ERROR:${NC} $1" >&2
}

print_warning() {
  echo -e "${YELLOW}[BACKUP] WARNING:${NC} $1"
}

print_info() {
  echo -e "${BLUE}[BACKUP] INFO:${NC} $1"
}

# Check dependencies
check_dependencies() {
  if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
  fi

  if [ "$DB_TYPE" = "postgresql" ] && ! command -v pg_dump &> /dev/null; then
    print_warning "pg_dump not found. PostgreSQL backup may fail."
  fi
}

# Create backup
backup() {
  print_status "Creating database backup..."
  echo "  Database: $DB_TYPE"
  echo "  Location: $BACKUPS_DIR"
  echo ""

  mkdir -p "$BACKUPS_DIR"

  if [ "$DB_TYPE" = "sqlite" ]; then
    # SQLite backup
    if [ ! -f "$DB_FILE" ]; then
      print_error "Database file not found: $DB_FILE"
      exit 1
    fi

    TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
    BACKUP_FILE="$BACKUPS_DIR/backup-sqlite-$TIMESTAMP.sql.gz"

    # Compress database file
    gzip -c "$DB_FILE" > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
      SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
      print_status "✓ Backup created successfully"
      echo "  File: backup-sqlite-$TIMESTAMP.sql.gz"
      echo "  Size: $SIZE"
      echo "  Path: $BACKUP_FILE"
    else
      print_error "Failed to create backup"
      exit 1
    fi

  elif [ "$DB_TYPE" = "postgresql" ]; then
    # PostgreSQL backup
    source "$PROJECT_ROOT/.env" 2>/dev/null || true

    TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
    BACKUP_FILE="$BACKUPS_DIR/backup-postgres-$TIMESTAMP.sql.gz"

    # Get database info from environment
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-trading_erp}"
    DB_USER="${DB_USER:-postgres}"

    export PGPASSWORD="${DB_PASSWORD:-postgres}"

    # Create backup
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
      SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
      print_status "✓ Backup created successfully"
      echo "  File: backup-postgres-$TIMESTAMP.sql.gz"
      echo "  Size: $SIZE"
      echo "  Host: $DB_HOST:$DB_PORT/$DB_NAME"
      echo "  Path: $BACKUP_FILE"
    else
      print_error "Failed to create PostgreSQL backup"
      exit 1
    fi

    unset PGPASSWORD
  fi

  echo ""
  print_status "Backup location: $BACKUP_FILE"
}

# Restore backup
restore() {
  if [ -z "$1" ]; then
    print_error "Backup filename required"
    echo ""
    echo "Usage: $0 restore <filename>"
    echo ""
    echo "Available backups:"
    list
    exit 1
  fi

  BACKUP_FILE="$BACKUPS_DIR/$1"

  if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found: $1"
    exit 1
  fi

  print_warning "This will restore the database from: $1"
  read -p "Continue? (type 'yes' to confirm): " -r
  echo

  if [ "$REPLY" != "yes" ]; then
    print_status "Restore cancelled"
    exit 0
  fi

  print_status "Creating safety backup before restore..."
  backup

  print_status "Restoring from backup: $1"
  echo ""

  if [ "$DB_TYPE" = "sqlite" ]; then
    # SQLite restore
    TEMP_FILE=$(mktemp)
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"

    if [ $? -ne 0 ]; then
      print_error "Failed to decompress backup"
      rm -f "$TEMP_FILE"
      exit 1
    fi

    # Create backup of current database
    if [ -f "$DB_FILE" ]; then
      cp "$DB_FILE" "$DB_FILE.backup-before-restore"
      print_status "Safety backup created: $DB_FILE.backup-before-restore"
    fi

    # Restore
    cp "$TEMP_FILE" "$DB_FILE"
    rm -f "$TEMP_FILE"

    print_status "✓ Database restored successfully"
    echo "  To rollback, copy: $DB_FILE.backup-before-restore"

  elif [ "$DB_TYPE" = "postgresql" ]; then
    # PostgreSQL restore
    source "$PROJECT_ROOT/.env" 2>/dev/null || true

    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-trading_erp}"
    DB_USER="${DB_USER:-postgres}"

    export PGPASSWORD="${DB_PASSWORD:-postgres}"

    print_warning "Dropping and recreating database: $DB_NAME"

    # Drop and recreate database
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" || true
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

    # Restore backup
    gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

    if [ $? -eq 0 ]; then
      print_status "✓ Database restored successfully"
      echo "  Database: $DB_HOST:$DB_PORT/$DB_NAME"
    else
      print_error "Failed to restore PostgreSQL database"
      exit 1
    fi

    unset PGPASSWORD
  fi

  echo ""
  print_status "Restore completed successfully"
}

# List backups
list() {
  if [ ! -d "$BACKUPS_DIR" ]; then
    print_warning "No backups directory found"
    return
  fi

  BACKUPS=$(find "$BACKUPS_DIR" -name "backup-*" -type f 2>/dev/null | sort -r)

  if [ -z "$BACKUPS" ]; then
    print_warning "No backups found"
    return
  fi

  echo -e "${BLUE}Available Backups:${NC}"
  echo ""

  # Header
  printf "%-40s %10s %20s\n" "Filename" "Size" "Created"
  echo "-------------------------------------------------------------------"

  while IFS= read -r FILE; do
    FILENAME=$(basename "$FILE")
    SIZE=$(du -h "$FILE" | cut -f1)
    MTIME=$(stat -c %y "$FILE" 2>/dev/null | cut -d' ' -f1,2 || stat -f "%Sm" "$FILE" 2>/dev/null)

    printf "%-40s %10s %20s\n" "$FILENAME" "$SIZE" "$MTIME"
  done <<< "$BACKUPS"

  echo ""
  echo "Total backups: $(echo "$BACKUPS" | wc -l)"
}

# Verify backup
verify() {
  if [ -z "$1" ]; then
    print_error "Backup filename required"
    exit 1
  fi

  BACKUP_FILE="$BACKUPS_DIR/$1"

  if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found: $1"
    exit 1
  fi

  print_status "Verifying backup: $1"
  echo ""

  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "  File: $1"
  echo "  Size: $SIZE"
  echo ""

  # Try to decompress and verify
  print_status "Testing gzip integrity..."
  if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    print_status "✓ Backup is valid and can be decompressed"
  else
    print_error "✗ Backup appears to be corrupted"
    exit 1
  fi

  # Test if it's a valid SQL file
  if gunzip -c "$BACKUP_FILE" 2>/dev/null | head -c 100 | grep -q "SQL\|CREATE\|INSERT" 2>/dev/null; then
    print_status "✓ Backup contains SQL data"
  else
    print_warning "⚠ Could not verify SQL content (may be binary database)"
  fi

  echo ""
  print_status "Verification complete"
}

# Rotate backups
rotate() {
  print_status "Rotating backups (removing old files)..."

  if [ ! -d "$BACKUPS_DIR" ]; then
    print_warning "No backups directory found"
    return
  fi

  # Keep only last 7 daily backups
  print_info "Keeping last 7 daily backups"

  DAILY_BACKUPS=$(find "$BACKUPS_DIR" -name "backup-*" -type f 2>/dev/null | sort -r)
  COUNT=0
  DELETED=0

  while IFS= read -r FILE; do
    COUNT=$((COUNT + 1))
    if [ $COUNT -gt 7 ]; then
      FILENAME=$(basename "$FILE")
      rm -f "$FILE"
      print_status "✓ Deleted: $FILENAME"
      DELETED=$((DELETED + 1))
    fi
  done <<< "$DAILY_BACKUPS"

  echo ""
  if [ $DELETED -gt 0 ]; then
    print_status "Rotation completed. Deleted $DELETED old backups"
  else
    print_status "No old backups to delete"
  fi
}

# Show statistics
stats() {
  if [ ! -d "$BACKUPS_DIR" ]; then
    print_warning "No backups found"
    return
  fi

  BACKUPS=$(find "$BACKUPS_DIR" -name "backup-*" -type f 2>/dev/null | sort -r)

  if [ -z "$BACKUPS" ]; then
    print_warning "No backups found"
    return
  fi

  TOTAL_COUNT=$(echo "$BACKUPS" | wc -l)
  TOTAL_SIZE=$(du -c "$BACKUPS_DIR"/* 2>/dev/null | tail -1 | cut -f1)

  echo -e "${BLUE}Backup Statistics:${NC}"
  echo ""
  echo "  Total backups: $TOTAL_COUNT"
  echo "  Total size: $TOTAL_SIZE"
  echo "  Database type: $DB_TYPE"
  echo "  Location: $BACKUPS_DIR"
  echo ""

  if [ "$TOTAL_COUNT" -gt 0 ]; then
    LATEST=$(echo "$BACKUPS" | head -1)
    OLDEST=$(echo "$BACKUPS" | tail -1)
    LATEST_DATE=$(stat -c %y "$LATEST" 2>/dev/null | cut -d' ' -f1 || stat -f "%Sm" "$LATEST" 2>/dev/null)
    OLDEST_DATE=$(stat -c %y "$OLDEST" 2>/dev/null | cut -d' ' -f1 || stat -f "%Sm" "$OLDEST" 2>/dev/null)

    echo "  Latest: $(basename "$LATEST") ($LATEST_DATE)"
    echo "  Oldest: $(basename "$OLDEST") ($OLDEST_DATE)"
  fi

  echo ""
}

# Show help
show_help() {
  cat << 'EOF'
Database Backup and Restore CLI

Usage: ./backup-restore.sh <command> [options]

Commands:
  backup                    Create a new database backup
  restore <filename>        Restore from a specific backup file
  list                      List all available backups
  verify <filename>         Verify backup integrity
  rotate                    Rotate backups (cleanup old files)
  stats                     Show backup statistics
  help                      Show this help message

Examples:
  ./backup-restore.sh backup
  ./backup-restore.sh restore backup-2026-03-17_14-30-00.sql.gz
  ./backup-restore.sh list
  ./backup-restore.sh verify backup-2026-03-17_14-30-00.sql.gz
  ./backup-restore.sh rotate
  ./backup-restore.sh stats

Database Detection:
  SQLite:    Uses ./backend/database.sqlite
  PostgreSQL: Uses environment variables (DB_HOST, DB_NAME, etc)

Features:
  - Automatic compression with gzip
  - Backup verification
  - Safety backups before restore
  - Backup rotation/cleanup
  - Statistics and reporting

For more information, see: ./backend/config/backupConfig.js

EOF
}

# Main
main() {
  COMMAND="${1:-help}"

  case "$COMMAND" in
    backup)
      check_dependencies
      backup
      ;;
    restore)
      check_dependencies
      restore "$2"
      ;;
    list)
      list
      ;;
    verify)
      verify "$2"
      ;;
    rotate)
      check_dependencies
      rotate
      ;;
    stats)
      stats
      ;;
    help)
      show_help
      ;;
    *)
      print_error "Unknown command: $COMMAND"
      echo ""
      show_help
      exit 1
      ;;
  esac
}

main "$@"
