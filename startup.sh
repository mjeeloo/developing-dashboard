#!/usr/bin/env bash
set -euo pipefail

# ---- SETTINGS ----
APP_URL="http://localhost:5173"
DASH_DIR="$HOME/developing-dashboard"

# Browser: choose chromium or google-chrome
BROWSER_BIN="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"

# ---- PRECHECKS ----
if [[ -z "${BROWSER_BIN}" ]]; then
  echo "Chromium/Chrome not found. Install 'chromium' or 'google-chrome'." >&2
  exit 1
fi

# Unmute and set volume (PipeWire/PulseAudio)
if command -v pactl >/dev/null 2>&1; then
  pactl set-sink-mute @DEFAULT_SINK@ 0 || true
  pactl set-sink-volume @DEFAULT_SINK@ 70% || true
fi

# ---- UPDATE & START DEV SERVER ----
cd "$DASH_DIR"
git pull --ff-only
# Prefer reproducible installs over 'sudo npm update'
if command -v npm >/dev/null 2>&1; then
  nohup npm run dev >/tmp/dashboard-dev.log 2>&1 &
else
  echo "npm not found. Install Node.js/npm." >&2
  exit 1
fi

# ---- WAIT FOR APP TO BE READY ----
echo "Waiting for $APP_URL ..."
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
