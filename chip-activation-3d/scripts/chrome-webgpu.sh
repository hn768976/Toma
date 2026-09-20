#!/usr/bin/env bash
#
# Chrome launcher that keeps WebGPU alive under Remotion.
#
# Remotion unconditionally passes --no-zygote when it launches Chrome. On
# Linux that stops Chrome from bringing up its GPU process, so
# navigator.gpu.requestAdapter() resolves to null, three.js quietly falls
# back to its WebGL backend, and the render dies with an unhelpful
# "cannot read getSupportedExtensions of null".
#
# There is no Remotion option to suppress that flag, so this shim filters it
# out and execs the real browser. Point Remotion at this script via
# REMOTION_BROWSER_EXECUTABLE.
#
# CHROME_BIN overrides which browser is launched. It must be a full Chrome
# or Chrome for Testing build, not chrome-headless-shell: Remotion runs the
# shell with --headless=old, which also has no GPU process.
set -euo pipefail

if [[ -z "${CHROME_BIN:-}" ]]; then
  for candidate in \
    "$HOME/.local/chrome/chrome-linux64/chrome" \
    /home/user/.local/chrome/chrome-linux64/chrome \
    /opt/google/chrome/chrome \
    /usr/bin/google-chrome \
    /usr/bin/chromium; do
    if [[ -x "$candidate" ]]; then
      CHROME_BIN="$candidate"
      break
    fi
  done
fi

if [[ -z "${CHROME_BIN:-}" || ! -x "$CHROME_BIN" ]]; then
  echo "chrome-webgpu.sh: no executable Chrome at $CHROME_BIN" >&2
  echo "Set CHROME_BIN to a full Chrome / Chrome for Testing binary." >&2
  exit 127
fi

args=()
for arg in "$@"; do
  [[ "$arg" == "--no-zygote" ]] && continue
  args+=("$arg")
done

exec "$CHROME_BIN" "${args[@]}"
