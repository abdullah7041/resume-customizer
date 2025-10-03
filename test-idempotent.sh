#!/bin/bash
# Test script to demonstrate withVersion() idempotency

echo "==================================================================="
echo "Testing withVersion() Idempotency"
echo "==================================================================="
echo ""

# Run the specific idempotency tests
cd /workspaces/resume-customizer

echo "Running idempotency tests..."
echo ""
npm test -- src/lib/assets.test.ts -t "idempotent|does not append version" --reporter=verbose

echo ""
echo "==================================================================="
echo "Test Complete"
echo "==================================================================="
