#!/bin/bash
# Bash build script for MacDrop on macOS
echo "========================================"
echo "         MacDrop macOS Builder          "
echo "========================================"

cd "$(dirname "$0")/.."

echo "\n[1/3] Generating icons..."
python3 scripts/generate_icons.py

echo "\n[2/3] Compiling TypeScript & UI assets..."
npx vite build

echo "\n[3/3] Packaging macOS bundle (.dmg & .app)..."
npx electron-builder --mac

echo "\n[SUCCESS] Build complete! Check the release/ directory."
ls -lh release/*.dmg 2>/dev/null || true
