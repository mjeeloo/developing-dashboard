#!/usr/bin/env bash

# macOS launcher for Developing Dashboard
# This .command file can be double-clicked in Finder to start the dashboard

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the project directory
cd "$SCRIPT_DIR"

# Run the startup script
./startup.sh

# Keep terminal open to view logs
echo ""
echo "Press any key to close this window..."
read -n 1 -s

