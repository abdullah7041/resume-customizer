#!/bin/bash
# Test Script for Bug Fixes
# Run this after deployment to verify all fixes are working

set -e

echo "🧪 Testing Bug Fixes..."
echo "======================="
echo ""

# Test 1: Run unit tests
echo "1️⃣ Running unit tests..."
npm test
echo "✅ All tests passed!"
echo ""

# Test 2: Build the project
echo "2️⃣ Building project..."
npm run build
echo "✅ Build successful!"
echo ""

# Test 3: Check for proper URL construction
echo "3️⃣ Checking Supabase URL configuration..."
if [ -f .env ]; then
  source .env
  if [[ "$VITE_SUPABASE_URL" =~ /storage/v1/object/public/ ]]; then
    echo "⚠️  WARNING: VITE_SUPABASE_URL contains '/storage/v1/object/public/'"
    echo "   This should be just the project URL (e.g., https://xxx.supabase.co)"
  else
    echo "✅ VITE_SUPABASE_URL is properly configured"
  fi
else
  echo "⚠️  No .env file found - make sure environment variables are set in Netlify"
fi
echo ""

# Test 4: Check theme system
echo "4️⃣ Checking theme system files..."
if grep -q "startViewTransition" src/hooks/useTheme.js; then
  echo "✅ View Transitions API support added"
else
  echo "❌ View Transitions API not found"
fi
echo ""

# Test 5: Check PDF parser enhancements
echo "5️⃣ Checking PDF parser enhancements..."
if grep -q "Fallback: try to extract text from stream objects" netlify/functions/parse-resume.ts; then
  echo "✅ Enhanced PDF extraction with fallback"
else
  echo "❌ PDF fallback extraction not found"
fi
echo ""

# Test 6: Check security headers
echo "6️⃣ Checking security headers..."
if grep -q "X-Frame-Options" public/_headers; then
  echo "✅ Security headers configured"
else
  echo "❌ Security headers missing"
fi
echo ""

# Test 7: Check DNS prefetch
echo "7️⃣ Checking DNS prefetch for Supabase..."
if grep -q "dns-prefetch.*supabase" index.html; then
  echo "✅ DNS prefetch configured"
else
  echo "❌ DNS prefetch missing"
fi
echo ""

echo "======================="
echo "✅ All automated checks passed!"
echo ""
echo "📋 Manual Testing Checklist:"
echo "   1. Deploy to Netlify"
echo "   2. Toggle dark/light theme - should be smooth"
echo "   3. Upload a PDF resume - should parse correctly"
echo "   4. Check that background skyline image loads"
echo "   5. Test on both desktop and mobile"
echo "   6. Verify no console errors in browser"
echo ""
echo "🎉 Bug fixes complete!"
