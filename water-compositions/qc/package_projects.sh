#!/usr/bin/env bash
# Builds the delivery ZIPs (source + config + lockfile, no node_modules/out).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/deliverables"
mkdir -p "$DEST"
for P in caustic-pool ripple-surface; do
  case $P in
    caustic-pool) Z="Composition1_CausticPool_4K_RemotionProject.zip" ;;
    ripple-surface) Z="Composition2_RippleSurface_4K_RemotionProject.zip" ;;
  esac
  rm -f "$DEST/$Z"
  (cd "$ROOT" && zip -X -r -9 "$DEST/$Z" "$P" \
      -x "$P/node_modules/*" "$P/out/*" "$P/dist/*" "$P/.DS_Store")
  (cd "$DEST" && unzip -t "$Z" >/dev/null && echo "OK $Z" && unzip -l "$Z" | tail -1)
done
