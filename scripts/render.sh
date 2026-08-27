#!/usr/bin/env bash
# Local render helper for this dev container: it has 4 cores and cannot reach
# Remotion's Chrome download, so point at a pre-installed headless shell.
# Override with CHROME=/path/to/chrome and CONCURRENCY=n.
set -euo pipefail
CHROME="${CHROME:-/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell}"
CONCURRENCY="${CONCURRENCY:-4}"
exec npx remotion "$@" --browser-executable="$CHROME" --concurrency="$CONCURRENCY"
