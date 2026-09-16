#!/bin/sh
# Launcher shim that makes Remotion's headless Chrome expose a working
# WebGPU adapter on a GPU-less machine.
#
# Remotion has no option for passing arbitrary Chrome flags, but it does
# let you point it at any executable (`Config.setBrowserExecutable`). So
# this script sits in front of the real Chrome, forwards every argument
# Remotion passes, and fixes up the two things needed for WebGPU here:
#
#   1. Dawn (Chrome's WebGPU impl) needs a Vulkan driver. There is no GPU,
#      so we point it at Chrome's bundled SwiftShader Vulkan ICD
#      (--use-vulkan=swiftshader). Remotion's `gl: "vulkan"` renderer asks
#      for `--use-vulkan=native`, which finds no device and leaves
#      navigator.gpu.requestAdapter() returning null.
#   2. Software adapters are gated behind --enable-unsafe-swiftshader.
#
# It also rewrites --headless=old to --headless=new: old headless was
# removed from Chrome 132+, and the full Chrome build we use here (rather
# than Remotion's headless shell) refuses to start with it.
#
# Point CHROME_WEBGPU_BINARY at a Chrome/Chromium binary to override the
# autodetected one.

set -e

find_chrome() {
  if [ -n "$CHROME_WEBGPU_BINARY" ]; then
    echo "$CHROME_WEBGPU_BINARY"
    return
  fi
  for candidate in \
    /opt/pw-browsers/chromium-*/chrome-linux/chrome \
    /usr/bin/google-chrome \
    /usr/bin/chromium \
    /usr/bin/chromium-browser
  do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done
  echo "chrome-webgpu.sh: no Chrome binary found; set CHROME_WEBGPU_BINARY" >&2
  exit 1
}

CHROME=$(find_chrome)

# Forward Remotion's own arguments, dropping the two we need to override.
set -- "$@"
FORWARDED=""
for arg in "$@"; do
  case "$arg" in
    --use-vulkan=*|--headless=old|--headless) continue ;;
  esac
  FORWARDED="$FORWARDED
$arg"
done

OLD_IFS=$IFS
IFS="
"
# shellcheck disable=SC2086
set -- $FORWARDED
IFS=$OLD_IFS

exec "$CHROME" \
  "$@" \
  --headless=new \
  --use-vulkan=swiftshader \
  --enable-unsafe-swiftshader \
  --enable-unsafe-webgpu
