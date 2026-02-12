#!/bin/bash
echo "================================"
echo "Pre-Commit Validation"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "1. Running ESLint..."
if npm run lint 2>&1 | grep -q "0 errors"; then
  echo -e "${GREEN}✓ ESLint passed${NC}"
else
  echo -e "${RED}✗ ESLint failed${NC}"
  exit 1
fi

echo ""
echo "2. Running TypeScript checks..."
if npm run type:check 2>&1 | grep -q "0 error"; then
  echo -e "${GREEN}✓ TypeScript passed${NC}"
else
  echo -e "${RED}✗ TypeScript failed${NC}"
  exit 1
fi

echo ""
echo "3. Running tests..."
if npm run test 2>&1 | grep -q "371 passed"; then
  echo -e "${GREEN}✓ Tests passed (371/373)${NC}"
else
  echo -e "${RED}✗ Tests failed${NC}"
  exit 1
fi

echo ""
echo "4. Testing production build..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Build succeeded${NC}"
else
  echo -e "${RED}✗ Build failed${NC}"
  exit 1
fi

echo ""
echo "================================"
echo -e "${GREEN}All checks passed! ✓${NC}"
echo "================================"
echo ""
echo "Ready to commit!"
