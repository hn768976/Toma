#!/usr/bin/env sh
# Install uv (https://docs.astral.sh/uv/) on Linux and macOS.
#
# Usage:
#   ./scripts/install-uv.sh              # install the latest release
#   ./scripts/install-uv.sh 0.8.17       # install a pinned release
#   UV_INSTALL_DIR=/usr/local/bin ./scripts/install-uv.sh
#   FORCE=1 ./scripts/install-uv.sh      # reinstall even if uv is already present
#
# Windows equivalent: scripts/install-uv.ps1

set -eu

VERSION="${1:-${UV_VERSION:-latest}}"
FORCE="${FORCE:-0}"

if command -v uv >/dev/null 2>&1 && [ "$FORCE" != "1" ]; then
  echo "uv is already installed: $(command -v uv) ($(uv --version))"
  echo "Re-run with FORCE=1 to reinstall, or use 'uv self update'."
  exit 0
fi

if [ "$VERSION" = "latest" ]; then
  URL="https://astral.sh/uv/install.sh"
else
  URL="https://astral.sh/uv/${VERSION}/install.sh"
fi

echo "Installing uv from ${URL} ..."

if command -v curl >/dev/null 2>&1; then
  curl -LsSf "$URL" | sh
elif command -v wget >/dev/null 2>&1; then
  wget -qO- "$URL" | sh
else
  echo "error: neither curl nor wget is available" >&2
  exit 1
fi

INSTALL_DIR="${UV_INSTALL_DIR:-$HOME/.local/bin}"
if ! command -v uv >/dev/null 2>&1; then
  echo
  echo "uv was installed to ${INSTALL_DIR} but is not on your PATH yet."
  echo "Add it for this shell with:"
  echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
  exit 0
fi

echo
echo "Installed: $(command -v uv) ($(uv --version))"
