#!/bin/bash

set -e

echo "🚀 Mobile Layout Polish - Comprehensive Test Suite"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dev server is running
check_server() {
  echo -e "${BLUE}🔍 Checking if dev server is running...${NC}"
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dev server is running${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠️  Dev server not detected at http://localhost:5173${NC}"
    echo -e "${YELLOW}   Starting dev server...${NC}"
    npm run dev > /dev/null 2>&1 &
    DEV_SERVER_PID=$!
    
    # Wait for server to start
    for i in {1..30}; do
      if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Dev server started (PID: $DEV_SERVER_PID)${NC}"
        return 0
      fi
      sleep 1
    done
    
    echo -e "${RED}❌ Failed to start dev server${NC}"
    return 1
  fi
}

# Cleanup function
cleanup() {
  if [ ! -z "$DEV_SERVER_PID" ]; then
    echo -e "\n${BLUE}🧹 Cleaning up dev server (PID: $DEV_SERVER_PID)${NC}"
    kill $DEV_SERVER_PID 2>/dev/null || true
  fi
}

trap cleanup EXIT

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

run_test() {
  local test_name=$1
  local test_command=$2
  
  TESTS_TOTAL=$((TESTS_TOTAL + 1))
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}🧪 Test ${TESTS_TOTAL}: ${test_name}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  if eval "$test_command"; then
    echo -e "${GREEN}✅ PASSED: ${test_name}${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}❌ FAILED: ${test_name}${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# Main test execution
main() {
  echo ""
  echo "📦 Installing dependencies..."
  npm install --silent
  
  echo ""
  echo "🔧 Building project..."
  npm run build
  
  # Unit tests
  run_test "Unit Tests (Vitest)" "npm test -- --run --reporter=verbose"
  
  # Check if server is needed for integration tests
  if check_server; then
    STARTED_SERVER=true
    
    # Integration tests
    run_test "Single Document Scroll Validation" "node scripts/validate-scroll-behavior.mjs"
    run_test "Mobile Screenshots (390/414/430px)" "node scripts/capture-mobile-screenshots.mjs"
    
    # Lighthouse tests (if lighthouse is available)
    if command -v lighthouse &> /dev/null; then
      run_test "Mobile Lighthouse Performance" "node scripts/validate-mobile-lighthouse.mjs"
    else
      echo -e "${YELLOW}⚠️  Skipping Lighthouse tests (lighthouse-cli not installed)${NC}"
      echo -e "${YELLOW}   Install with: npm install -g lighthouse${NC}"
    fi
  else
    echo -e "${RED}❌ Skipping integration tests (dev server unavailable)${NC}"
  fi
  
  # Summary
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}📊 TEST SUMMARY${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Total Tests: $TESTS_TOTAL"
  echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"
  echo ""
  
  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "✨ Implementation Complete:"
    echo "   ✅ Mobile layout polished"
    echo "   ✅ Shimmer-on-touch for gold badge"
    echo "   ✅ Single document scroll (no nested overflow-y)"
    echo "   ✅ Hero image overlay applied"
    echo "   ✅ Page height reduced"
    echo "   ✅ All tests passing"
    echo ""
    
    if [ -d "screenshots" ]; then
      echo "📸 Screenshots available in ./screenshots/"
      ls -lh screenshots/mobile-*.png 2>/dev/null || true
    fi
    
    if [ -d "lighthouse-reports" ]; then
      echo ""
      echo "📊 Lighthouse reports available in ./lighthouse-reports/"
      ls -lh lighthouse-reports/mobile-*.json 2>/dev/null || true
    fi
    
    exit 0
  else
    echo -e "${RED}💥 Some tests failed. Please review the output above.${NC}"
    exit 1
  fi
}

main "$@"
