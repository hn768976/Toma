#!/usr/bin/env bash
# Local render helper: this container has 4 cores and no network access to
# Remotion's Chrome download, so point at the pre-installed headless shell.
set -euo pipefail
CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
exec npx remotion "$@" --browser-executable="$CHROME" --concurrency=4
