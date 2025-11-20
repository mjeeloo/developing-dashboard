#!/usr/bin/env bash

# Installation script for Dashboard Launcher on Raspberry Pi/Linux

set -e

echo "=== Installing Developing Dashboard Launcher ==="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Make scripts executable
echo "Making scripts executable..."
chmod +x "$SCRIPT_DIR/startup.sh"
chmod +x "$SCRIPT_DIR/launch-dashboard"
chmod +x "$SCRIPT_DIR/developing-dashboard.desktop"

# Update the .desktop file with the correct path
echo "Updating .desktop file with correct paths..."
DESKTOP_FILE="$SCRIPT_DIR/developing-dashboard.desktop"

# Create a temporary desktop file with absolute paths
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Developing Dashboard
Comment=Start the Developing dashboard in a fullscreen window
Exec=$SCRIPT_DIR/startup.sh
Path=$SCRIPT_DIR
Icon=preferences-desktop
Terminal=false
Categories=Utility;
StartupNotify=false
NoDisplay=false
EOF

# Make desktop file executable
chmod +x "$DESKTOP_FILE"

# Copy to applications directory if it exists
if [ -d "$HOME/.local/share/applications" ]; then
    echo "Installing to applications menu..."
    cp "$DESKTOP_FILE" "$HOME/.local/share/applications/"
    echo "Added to applications menu"
fi

# Create desktop shortcut if Desktop directory exists
if [ -d "$HOME/Desktop" ]; then
    echo "Creating desktop shortcut..."
    cp "$DESKTOP_FILE" "$HOME/Desktop/"
    chmod +x "$HOME/Desktop/developing-dashboard.desktop"
    
    # Mark as trusted for GNOME-based systems
    if command -v gio >/dev/null 2>&1; then
        gio set "$HOME/Desktop/developing-dashboard.desktop" metadata::trusted true 2>/dev/null || true
    fi
    
    echo "Desktop shortcut created"
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "You can now start the dashboard in multiple ways:"
echo "1. Double-click: $SCRIPT_DIR/launch-dashboard"
echo "2. Double-click: developing-dashboard.desktop (on your desktop)"
echo "3. Find 'Developing Dashboard' in your applications menu"
echo ""
echo "Note: On first use, your file manager might ask for permission to run the file."
echo "      Choose 'Execute' or 'Trust and Launch' when prompted."
echo ""

