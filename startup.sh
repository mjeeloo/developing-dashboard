#!/usr/bin/env bash
set -euo pipefail

# ---- SETTINGS ----
APP_URL="http://localhost:5173"
DASH_DIR="$HOME/developing-dashboard"

# Joe NL MP3 stream (works at time of writing; replace if it changes)
STREAM_URL="https://icecast-qmusic.cdp.triple-it.nl/Joe_nl_mp3"

# Browser: choose chromium or google-chrome
BROWSER_BIN="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"

# ---- PRECHECKS ----
if [[ -z "${BROWSER_BIN}" ]]; then
  echo "Chromium/Chrome not found. Install 'chromium' or 'google-chrome'." >&2
  exit 1
fi

if ! command -v mpv >/dev/null 2>&1 && ! command -v cvlc >/dev/null 2>&1; then
  echo "Install one audio player: 'mpv' or 'vlc' (for 'cvlc')." >&2
  exit 1
fi

# Unmute and set volume (PipeWire/PulseAudio)
if command -v pactl >/dev/null 2>&1; then
  pactl set-sink-mute @DEFAULT_SINK@ 0 || true
  pactl set-sink-volume @DEFAULT_SINK@ 70% || true
fi

# ---- START RADIO (headless) ----
if command -v mpv >/dev/null 2>&1; then
  nohup mpv --no-video --really-quiet "$STREAM_URL" >/dev/null 2>&1 &
else
  nohup cvlc --intf dummy --quiet --no-video "$STREAM_URL" >/dev/null 2>&1 &
fi

# ---- UPDATE & START DEV SERVER ----
cd "$DASH_DIR"
git pull --ff-only
# Prefer reproducible installs over 'sudo npm update'
if command -v npm >/dev/null 2>&1; then
  npm ci || npm install
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

# ---- OPEN IN KIOSK/FULLSCREEN ----
# --app removes tabs/URL bar and kiosk makes it fullscreen on most desktops
nohup "$BROWSER_BIN" \
  --app="$APP_URL" \
  --kiosk \
  --start-fullscreen \
  --incognito \
  --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  >/dev/null 2>&1 &

# (Optional) Hide the mouse cursor if this is a TV display:
# nohup unclutter --fork --timeout 0 >/dev/null 2>&1 &
