#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
render() {
  id="$1"; name="$2"
  echo "=== $name mp4 ==="
  npx remotion render "$id" "out/$name.mp4" --scale=0.5 --codec=h264 --pixel-format=yuv420p --crf=18 --muted --log=error
  echo "=== $name still ==="
  npx remotion still "$id" "out/$name.png" --frame=500 --scale=0.5 --log=error
}
render V1-AIEditorDarkPython     V1_AIEditorDarkPython
render V2-AIEditorDarkTypeScript V2_AIEditorDarkTypeScript
render V3-AIEditorLightPython    V3_AIEditorLightPython
echo "ALL RENDERS DONE"
