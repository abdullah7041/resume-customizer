#!/bin/bash

# Test script to verify skyline URL generation

echo "=== Testing Skyline URL Generation ==="
echo ""

# Test 1: Normal configuration
echo "Test 1: Normal Supabase URL"
export VITE_SUPABASE_URL="https://cwcjeujextkwpmzdfzdz.supabase.co"
export VITE_BUILD_TIMESTAMP="20241001"
npm test -- src/lib/assets.test.ts --run 2>&1 | grep -A 2 "returns a single segment"

echo ""
echo "Test 2: URL with trailing slashes"
npm test -- src/lib/assets.test.ts --run 2>&1 | grep -A 2 "trims accidental double slashes"

echo ""
echo "Test 3: Full object URL (should reject)"
npm test -- src/lib/assets.test.ts --run 2>&1 | grep -A 2 "rejects when VITE_SUPABASE_URL"

echo ""
echo "=== All Tests Summary ==="
npm test 2>&1 | tail -n 5

echo ""
echo "✅ Skyline URL generation tests complete!"
