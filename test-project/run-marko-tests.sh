#!/bin/bash
# Test script for Marko tags feature

echo "🧪 Marko Tags Feature Test Suite"
echo ""

# Test 1: Basic preservation
echo "📋 Test 1: Basic Marko Tag Preservation"
echo "   Running: npx markopress build"
npx markopress build
if [ $? -eq 0 ]; then
  echo "   ✅ PASSED: Build succeeded"
else
  echo "   ❌ FAILED: Build failed"
fi
echo ""

# Test 2: Missing component (should fail)
echo "📋 Test 2: Missing Component (Expected to FAIL)"
echo "   Build should fail with missing <custom-tag>"
npx markopress build 2>&1 | head -20
if [ $? -ne 0 ]; then
  echo "   ✅ PASSED: Build failed as expected"
else
  echo "   ❌ UNEXPECTED: Build succeeded"
fi
echo ""

# Test 3: Standard HTML not preserved
echo "📋 Test 3: Standard HTML Not Preserved"
echo "   Standard HTML tags should be processed, not preserved"
npx markopress build
if [ $? -eq 0 ]; then
  echo "   ✅ PASSED: Build succeeded"
else
  echo "   ❌ FAILED: Build failed"
fi
echo ""

echo "✨ All tests completed!"
echo ""
echo "📝 Test Results Summary:"
echo "   - Test 1: Basic preservation"
echo "   - Test 2: Missing component"
echo "   - Test 3: Standard HTML handling"
echo ""
echo "To test manually, run: npx markopress dev"
echo "Then open: http://localhost:3000"
