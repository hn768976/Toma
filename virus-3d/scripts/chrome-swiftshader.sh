#!/usr/bin/env bash
# Remotion 4.x passes --use-gl=angle --use-angle=swiftshader for `--gl=swangle`,
# but Chrome >=140 refuses the software WebGL fallback unless
# --enable-unsafe-swiftshader is also set, so the canvases come back empty.
# This shim injects the flag and hands everything else straight through.
#
# Point Remotion at it with:  --browser-executable=scripts/chrome-swiftshader.sh
set -euo pipefail

CHROME_BIN="${VIRUS3D_CHROME_BIN:-}"

if [ -z "$CHROME_BIN" ]; then
  for candidate in \
    /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell \
    /opt/pw-browsers/chromium-*/chrome-linux/chrome \
    "$(command -v chromium 2>/dev/null || true)" \
    "$(command -v google-chrome 2>/dev/null || true)"; do
    if [ -x "$candidate" ]; then CHROME_BIN="$candidate"; break; fi
  done
fi

if [ -z "$CHROME_BIN" ] || [ ! -x "$CHROME_BIN" ]; then
  echo "chrome-swiftshader.sh: no Chrome/Chromium binary found. Set VIRUS3D_CHROME_BIN." >&2
  exit 127
fi

exec "$CHROME_BIN" --enable-unsafe-swiftshader "$@"
