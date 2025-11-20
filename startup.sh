#!/usr/bin/env bash
set -euo pipefail

# ---- SETTINGS ----
APP_URL="http://localhost:5173"

# Default to the folder that contains this script so the launcher keeps working
# even if the repository is not located at $HOME/developing-dashboard.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASH_DIR="${DASH_DIR:-$SCRIPT_DIR}"

LOG_FILE="${LOG_FILE:-/tmp/developing-dashboard-start.log}"

# Browser: choose chromium or google-chrome
BROWSER_BIN="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"

# ---- PRECHECKS ----
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[dashboard] Using repository at: $DASH_DIR"

if [[ ! -d "$DASH_DIR" ]]; then
  echo "[dashboard] Repository directory not found. Set DASH_DIR to the clone path." >&2
  exit 1
fi

if [[ -z "${BROWSER_BIN}" ]]; then
  echo "Chromium/Chrome not found. Install 'chromium' or 'google-chrome'." >&2
  exit 1
fi

# Unmute and set volume (PipeWire/PulseAudio)
if command -v pactl >/dev/null 2>&1; then
  pactl set-sink-mute @DEFAULT_SINK@ 0 || true
  pactl set-sink-volume @DEFAULT_SINK@ 50% || true
fi

# ---- UPDATE & START DEV SERVER ----
cd "$DASH_DIR"

if [[ -d .git ]]; then
  echo "[dashboard] Pulling latest changes..."
  git pull --ff-only || {
    echo "[dashboard] git pull failed; continuing with local checkout." >&2
  }
else
  echo "[dashboard] No .git directory found; skipping git pull."
fi

if command -v npm >/dev/null 2>&1; then
  echo "[dashboard] Starting dev server with npm run dev..."
  nohup npm run dev >/tmp/dashboard-dev.log 2>&1 &
else
  echo "npm not found. Install Node.js/npm." >&2
  exit 1
fi

# ---- WAIT FOR APP TO BE READY ----
echo "[dashboard] Waiting for $APP_URL ... (log: $LOG_FILE)"
for i in {1..60}; do
  if curl -fsS -o /dev/null "$APP_URL"; then
    break
  fi
  sleep 1
done

# ---- OPEN IN FULLSCREEN ----
# --app removes tabs/URL bar and kiosk makes it fullscreen on most desktops
nohup "$BROWSER_BIN" \
  --app="$APP_URL" \
  --start-fullscreen \
  --incognito \
  --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  >/dev/null 2>&1 &
