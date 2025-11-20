#!/usr/bin/env bash
set -euo pipefail

# ---- LOGGING SETUP ----
LOGFILE="/tmp/dashboard-startup.log"
exec > >(tee -a "$LOGFILE") 2>&1

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "========================================="
log "Starting Developing Dashboard"
log "Log file: $LOGFILE"
log "========================================="

# ---- SETTINGS ----
APP_URL="http://localhost:5173"
DASH_DIR="$HOME/developing-dashboard"

log "Settings:"
log "  APP_URL: $APP_URL"
log "  DASH_DIR: $DASH_DIR"

# Browser: choose chromium or google-chrome
BROWSER_BIN="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"

# ---- PRECHECKS ----
log "Running prechecks..."
if [[ -z "${BROWSER_BIN}" ]]; then
  log "ERROR: Chromium/Chrome not found. Install 'chromium' or 'google-chrome'."
  exit 1
fi
log "Browser found: $BROWSER_BIN"

# Unmute and set volume (PipeWire/PulseAudio)
if command -v pactl >/dev/null 2>&1; then
  log "Setting audio volume..."
  pactl set-sink-mute @DEFAULT_SINK@ 0 || true
  pactl set-sink-volume @DEFAULT_SINK@ 50% || true
else
  log "pactl not found, skipping audio setup (not on Linux with PulseAudio/PipeWire)"
fi

# ---- UPDATE & START DEV SERVER ----
log "Changing to directory: $DASH_DIR"
cd "$DASH_DIR"

log "Pulling latest changes from git..."
if git pull --ff-only; then
  log "Git pull successful"
else
  log "WARNING: Git pull failed or not needed, continuing anyway"
fi

# Prefer reproducible installs over 'sudo npm update'
if command -v npm >/dev/null 2>&1; then
  log "Starting npm dev server..."
  nohup npm run dev >/tmp/dashboard-dev.log 2>&1 &
  NPM_PID=$!
  log "npm dev server started (PID: $NPM_PID)"
  log "Dev server logs: /tmp/dashboard-dev.log"
else
  log "ERROR: npm not found. Install Node.js/npm."
  exit 1
fi

# ---- WAIT FOR APP TO BE READY ----
log "Waiting for $APP_URL to be ready..."
for i in {1..60}; do
  if curl -fsS -o /dev/null "$APP_URL"; then
    log "App is ready after $i seconds!"
    break
  fi
  if [[ $i -eq 60 ]]; then
    log "ERROR: Timeout waiting for app to start. Check /tmp/dashboard-dev.log"
    exit 1
  fi
  sleep 1
done

# ---- OPEN IN FULLSCREEN ----
log "Opening browser in fullscreen mode..."
# --app removes tabs/URL bar and kiosk makes it fullscreen on most desktops
nohup "$BROWSER_BIN" \
  --app="$APP_URL" \
  --start-fullscreen \
  --incognito \
  --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  >/dev/null 2>&1 &
BROWSER_PID=$!
log "Browser opened (PID: $BROWSER_PID)"
log "========================================="
log "Dashboard started successfully!"
log "To view logs: tail -f $LOGFILE"
log "========================================="
