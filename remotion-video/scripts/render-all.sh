#!/usr/bin/env bash
# Renders the six container-yard shots at 1080p, H.264 in an MP4 container.
#
# Concurrency is 3 rather than one-per-core: the heaviest shot holds a large
# scene per worker and a fourth was enough to make it fall over. Each shot gets
# its own full log and one retry, so a transient worker crash costs that shot
# rather than the rest of the batch.
#
# The 4K compositions are registered in the project but not rendered here --
# see README for the command that produces them.
set -u
cd "$(dirname "$0")/.."
OUT=out/deliverables
LOGS=out/render-logs
mkdir -p "$OUT" "$LOGS"

SHOTS="Yard01DockWall Yard02GoldenTruck Yard03GridWall Yard04AerialRows Yard05TwinStacks Yard06CornerDusk"

render_one() {
  npx remotion render "$1" "$OUT/${1}_1080p.mp4" \
    --codec=h264 \
    --crf=17 \
    --gl=angle \
    --concurrency=3 \
    --timeout=900000 \
    --log=info > "$LOGS/${1}.log" 2>&1
}

for id in $SHOTS; do
  echo "=== $id  start $(date +%T)"
  if ! render_one "$id" || [ ! -s "$OUT/${id}_1080p.mp4" ]; then
    echo "!!! $id failed, retrying once"
    tail -5 "$LOGS/${id}.log"
    render_one "$id"
  fi
  if [ -s "$OUT/${id}_1080p.mp4" ]; then
    echo "--- $id done $(date +%T)  $(du -h "$OUT/${id}_1080p.mp4" | cut -f1)"
  else
    echo "!!! $id FAILED after retry"
    tail -12 "$LOGS/${id}.log"
  fi
done
echo "ALL RENDERS COMPLETE $(date +%T)"
