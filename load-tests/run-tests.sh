#!/bin/bash

# Trading ERP Load Test Runner
# Orchestrates running different load test scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:5000/api"}
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="$TEST_DIR/k6/scenarios"

# Print functions
print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if k6 is installed
check_k6_installed() {
  if ! command -v k6 &> /dev/null; then
    print_error "k6 is not installed. Please install from https://k6.io/docs/getting-started/installation/"
    exit 1
  fi
  print_success "k6 is installed: $(k6 version)"
}

# Check if scenario file exists
check_scenario_exists() {
  local scenario=$1
  if [ ! -f "$SCENARIOS_DIR/$scenario" ]; then
    print_error "Scenario not found: $scenario"
    return 1
  fi
  return 0
}

# Run a single test scenario
run_scenario() {
  local scenario=$1
  local scenario_name=$(basename "$scenario" .js)

  print_header "Running: $scenario_name"
  print_info "Base URL: $BASE_URL"

  export BASE_URL=$BASE_URL

  if k6 run "$scenario"; then
    print_success "$scenario_name completed successfully"
    return 0
  else
    print_error "$scenario_name failed"
    return 1
  fi
}

# Display available scenarios
list_scenarios() {
  print_header "Available Test Scenarios"

  echo "Smoke Tests (2-5 minutes):"
  echo "  - auth-flow.js         Auth & token management (100 VUs)"
  echo "  - browse-orders.js     Order browsing (50 VUs)"
  echo ""
  echo "Load Tests (5-10 minutes):"
  echo "  - dashboard-load.js    Dashboard & analytics (100 VUs)"
  echo "  - concurrent-users.js  Mixed operations (50 VUs)"
  echo ""
  echo "Stress Tests (10+ minutes):"
  echo "  - spike-test.js        Spike from 10-200 VUs"
  echo "  - soak-test.js         30 minutes sustained load (30 VUs)"
}

# Run predefined test profiles
run_profile() {
  local profile=$1
  local failed=0

  case "$profile" in
    smoke)
      print_header "Running: Smoke Test Profile"
      run_scenario "$SCENARIOS_DIR/auth-flow.js" || failed=$((failed + 1))
      run_scenario "$SCENARIOS_DIR/browse-orders.js" || failed=$((failed + 1))
      ;;

    load)
      print_header "Running: Load Test Profile"
      run_scenario "$SCENARIOS_DIR/dashboard-load.js" || failed=$((failed + 1))
      run_scenario "$SCENARIOS_DIR/concurrent-users.js" || failed=$((failed + 1))
      ;;

    stress)
      print_header "Running: Stress Test Profile"
      run_scenario "$SCENARIOS_DIR/spike-test.js" || failed=$((failed + 1))
      ;;

    endurance)
      print_header "Running: Endurance Test Profile"
      print_info "This test will run for 30 minutes"
      read -p "Continue? (y/n) " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_scenario "$SCENARIOS_DIR/soak-test.js" || failed=$((failed + 1))
      fi
      ;;

    all)
      print_header "Running: Full Test Suite"
      print_info "This will run all scenarios (approximately 60+ minutes)"
      read -p "Continue? (y/n) " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        for scenario in "$SCENARIOS_DIR"/*.js; do
          run_scenario "$scenario" || failed=$((failed + 1))
          echo ""
        done
      fi
      ;;

    *)
      print_error "Unknown profile: $profile"
      echo ""
      echo "Valid profiles:"
      echo "  - smoke      Run quick smoke tests (2-5 min)"
      echo "  - load       Run load tests (5-10 min)"
      echo "  - stress     Run stress tests"
      echo "  - endurance  Run 30-minute soak test"
      echo "  - all        Run all tests"
      echo ""
      exit 1
      ;;
  esac

  if [ $failed -gt 0 ]; then
    print_error "$failed test(s) failed"
    return 1
  else
    print_success "All tests passed"
    return 0
  fi
}

# Display usage
usage() {
  cat << EOF
${BLUE}Trading ERP Load Test Runner${NC}

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  list              List available test scenarios
  run <scenario>    Run a specific scenario (e.g., auth-flow.js)
  profile <name>    Run a predefined profile

Profiles:
  smoke             Quick smoke tests (default: 2-5 minutes)
  load              Load tests (5-10 minutes)
  stress            Stress tests (variable duration)
  endurance         30-minute soak test
  all               Run all scenarios

Examples:
  $0 list                           # Show available scenarios
  $0 run auth-flow.js               # Run authentication test
  $0 profile smoke                  # Run smoke test profile
  $0 profile load                   # Run load test profile

Environment Variables:
  BASE_URL                          API base URL (default: http://localhost:5000/api)
  AUTH_TOKEN                        Authentication token

Examples with env vars:
  BASE_URL=https://api.prod.com $0 profile smoke
  AUTH_TOKEN=token123 $0 run dashboard-load.js

EOF
}

# Main execution
main() {
  check_k6_installed

  if [ $# -eq 0 ]; then
    print_info "Running default smoke tests..."
    run_profile smoke
    exit $?
  fi

  case "$1" in
    help|-h|--help)
      usage
      exit 0
      ;;

    list)
      list_scenarios
      exit 0
      ;;

    run)
      if [ -z "$2" ]; then
        print_error "Scenario name required"
        usage
        exit 1
      fi
      run_scenario "$SCENARIOS_DIR/$2"
      exit $?
      ;;

    profile)
      if [ -z "$2" ]; then
        print_error "Profile name required"
        usage
        exit 1
      fi
      run_profile "$2"
      exit $?
      ;;

    *)
      print_error "Unknown command: $1"
      usage
      exit 1
      ;;
  esac
}

# Run main function
main "$@"
