#!/usr/bin/env bash

# ---- REDIRECT ALL OUTPUT TO LOG ----
LOGFILE="/tmp/dashboard-startup.log"
exec > "$LOGFILE" 2>&1

set -euo pipefail

echo "=== Dashboard Startup Script ==="
echo "Started at: $(date)"

# ---- SETTINGS ----
APP_URL="http://localhost:5173"
DASH_DIR="$HOME/developing-dashboard"

# Browser: choose chromium or google-chrome
BROWSER_BIN="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"

# ---- PRECHECKS ----
echo "Checking browser..."
if [[ -z "${BROWSER_BIN}" ]]; then
  echo "ERROR: Chromium/Chrome not found. Install 'chromium' or 'google-chrome'."
  exit 1
fi
echo "Browser found: $BROWSER_BIN"

# Unmute and set volume (PipeWire/PulseAudio)
echo "Setting audio..."
if command -v pactl >/dev/null 2>&1; then
  pactl set-sink-mute @DEFAULT_SINK@ 0 || true
  pactl set-sink-volume @DEFAULT_SINK@ 50% || true
  echo "Audio configured"
else
  echo "pactl not found, skipping audio setup"
fi

# ---- UPDATE & START DEV SERVER ----
echo "Changing to directory: $DASH_DIR"
cd "$DASH_DIR" || { echo "ERROR: Cannot cd to $DASH_DIR"; exit 1; }

echo "Pulling latest changes..."
git pull --ff-only || echo "WARNING: git pull failed (might be offline or no changes)"

# Prefer reproducible installs over 'sudo npm update'
echo "Checking npm..."
if command -v npm >/dev/null 2>&1; then
  echo "Starting dev server..."
  npm run dev >/tmp/dashboard-dev.log 2>&1 &
  DEV_PID=$!
  echo "Dev server started with PID: $DEV_PID"
else
  echo "ERROR: npm not found. Install Node.js/npm."
  exit 1
fi

# ---- WAIT FOR APP TO BE READY ----
echo "Waiting for $APP_URL to be ready..."
for i in {1..60}; do
  if curl -fsS -o /dev/null "$APP_URL" 2>/dev/null; then
    echo "App is ready after $i seconds"
    break
  fi
  if [[ $i -eq 60 ]]; then
    echo "WARNING: App did not respond after 60 seconds"
  fi
  sleep 1
done

# ---- OPEN IN FULLSCREEN ----
echo "Opening browser..."
# --app removes tabs/URL bar and kiosk makes it fullscreen on most desktops
"$BROWSER_BIN" \
  --app="$APP_URL" \
  --start-fullscreen \
  --incognito \
  --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  >/dev/null 2>&1 &
BROWSER_PID=$!

echo "Browser started with PID: $BROWSER_PID"
echo "Startup complete. Log available at: $LOGFILE"
echo "Dev server log available at: /tmp/dashboard-dev.log"

# Keep script running to maintain process tree
wait $BROWSER_PID
