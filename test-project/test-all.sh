#!/bin/bash

echo "🧪 Testing MarkoPress Test Project"
echo "=================================="
echo ""

# Clean previous build
echo "1. Cleaning previous build..."
rm -rf dist/
echo "   ✅ Cleaned"
echo ""

# Run build
echo "2. Building project..."
npx marko-run build
if [ $? -eq 0 ]; then
  echo "   ✅ Build successful"
else
  echo "   ❌ Build failed"
  exit 1
fi
echo ""

# Check output
echo "3. Checking output..."
if [ -f "dist/public/index.html" ]; then
  echo "   ✅ Static HTML generated"
  echo "   Size: $(wc -c < dist/public/index.html) bytes"
else
  echo "   ❌ No static HTML found"
  exit 1
fi
echo ""

# Show HTML preview
echo "4. HTML Preview:"
echo "   --------------"
head -c 500 dist/public/index.html
echo "..."
echo "   --------------"
echo ""

# Start preview server
echo "5. Starting preview server..."
echo "   Server will be available at: http://localhost:4173"
echo "   Press Ctrl+C to stop"
echo ""

npx marko-run preview
