#!/bin/bash

# UI-TARS Desktop Launcher
# This script launches the UI-TARS desktop application

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "🚀 Starting UI-TARS Desktop..."

# Change to the UI-TARS directory
cd "$SCRIPT_DIR/apps/ui-tars"

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Please install pnpm first:"
    echo "npm install -g pnpm"
    read -p "Press any key to exit..."
    exit 1
fi

# Kill any existing processes
echo "🧹 Cleaning up any existing processes..."
pkill -f "electron.*ui-tars" || true

# Start the app
echo "✨ Launching UI-TARS..."
cd "$SCRIPT_DIR/apps/ui-tars"
pnpm run dev

# Keep the terminal open if there's an error
if [ $? -ne 0 ]; then
    echo "❌ Failed to start UI-TARS"
    read -p "Press any key to exit..."
fi