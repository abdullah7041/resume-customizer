#!/bin/bash
# Quick local testing script for AI Resume Optimizer

set -e  # Exit on error

echo "🧪 AI Resume Optimizer - Local Testing Suite"
echo "============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Check environment
echo "Step 1: Checking environment..."
if [ ! -f .env ]; then
    print_error ".env file not found!"
    echo "Please create .env with required variables (see LOCAL_TESTING_GUIDE.md)"
    exit 1
fi
print_step "Environment file found"

# Check for required env vars
if ! grep -q "VITE_SUPABASE_URL" .env; then
    print_warning "VITE_SUPABASE_URL not found in .env"
fi

if ! grep -q "OPENAI_API_KEY" .env; then
    print_warning "OPENAI_API_KEY not found in .env"
fi

echo ""

# Step 2: Run linting
echo "Step 2: Running ESLint..."
if npm run lint; then
    print_step "No lint errors found"
else
    print_error "Linting failed!"
    exit 1
fi
echo ""

# Step 3: Run tests
echo "Step 3: Running unit tests..."
if npm test; then
    print_step "All tests passed"
else
    print_error "Tests failed!"
    exit 1
fi
echo ""

# Step 4: Build check
echo "Step 4: Building production bundle..."
if npm run build; then
    print_step "Build successful"
    
    # Check build size
    if [ -d "dist" ]; then
        DIST_SIZE=$(du -sh dist | cut -f1)
        echo "   Bundle size: $DIST_SIZE"
    fi
else
    print_error "Build failed!"
    exit 1
fi
echo ""

# Step 5: Summary
echo "============================================="
echo "✅ All checks passed!"
echo ""
echo "Next steps:"
echo "1. Start local dev server: npm run dev:netlify"
echo "2. Open http://localhost:8888 in your browser"
echo "3. Test all features (see LOCAL_TESTING_GUIDE.md)"
echo "4. When ready, deploy with: netlify deploy --prod"
echo ""
echo "📖 Full testing guide: LOCAL_TESTING_GUIDE.md"
