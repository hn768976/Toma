#!/usr/bin/env bash
# Renders one composition as a PNG sequence, in short chunks.
#
# Why chunks: on a machine without a GPU, a single browser session driving a 4K
# scene pass plus its blur taps wedges the software GL driver part-way through a
# 180-frame sequence. It is reproducible but lands on an unpredictable frame,
# the process stays alive, and Remotion's own timeout never fires. Each chunk
# gets a fresh browser, short enough to finish before that happens, and a chunk
# that does hang costs one `timeout` window instead of the whole render.
#
# A PNG sequence rather than a video per chunk: the final encode then happens
# once, from lossless frames, instead of concatenating separately compressed
# pieces.
#
#   ./render-chunked.sh <composition-id> <output-dir> [chunk-size]
set -euo pipefail
cd "$(dirname "$0")"

COMP="${1:?composition id required}"
OUTDIR="${2:?output dir required}"
CHUNK="${3:-30}"
FRAMES=180
ATTEMPTS=3
# Generous, but far below the point where a wedged chunk wastes real time.
CHUNK_TIMEOUT=1200

COMMON=(--sequence --image-format=png --concurrency=2 --timeout=600000 --log=error)
if [ -x /opt/pw-browsers/chromium-1194/chrome-linux/chrome ]; then
  COMMON+=(--gl=swangle --chrome-mode=chrome-for-testing
           --browser-executable=/opt/pw-browsers/chromium-1194/chrome-linux/chrome)
  # A box reached through this branch has no GPU, so the scene's WebGPU probe
  # has a foregone answer -- and it costs a full-size canvas per tab per chunk
  # to reach it, which intermittently left the real canvas with no GL context at
  # all. Pin the backend instead. The composition default stays `false`, so a
  # machine with a GPU still gets WebGPU. Input props merge over defaultProps,
  # so grade, meshDetail and samples are untouched.
  COMMON+=(--props={\"forceWebGL\":true})
fi

# -x matches the process name exactly, so this cannot match the shell running
# this script (or an editor window that happens to quote the same path).
reap() {
  pkill -9 -x chrome 2>/dev/null || true
  rm -rf /tmp/react-motion-render* 2>/dev/null || true
}

rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"

for (( START=0; START<FRAMES; START+=CHUNK )); do
  END=$(( START + CHUNK - 1 ))
  [ "$END" -ge "$FRAMES" ] && END=$(( FRAMES - 1 ))
  WANT=$(( END - START + 1 ))
  DIR="$OUTDIR/chunk_$(printf '%03d' "$START")"

  for (( TRY=1; TRY<=ATTEMPTS; TRY++ )); do
    rm -rf "$DIR"
    mkdir -p "$DIR"
    echo "--- frames ${START}-${END} (attempt ${TRY}/${ATTEMPTS}) ---"

    if timeout "$CHUNK_TIMEOUT" npx remotion render "$COMP" "$DIR" \
         --frames="${START}-${END}" "${COMMON[@]}"; then
      COUNT=$(find "$DIR" -name '*.png' | wc -l)
      if [ "$COUNT" -eq "$WANT" ]; then
        echo "ok: ${COUNT} frames"
        break
      fi
      echo "short chunk: got ${COUNT}, wanted ${WANT}"
    else
      echo "chunk failed or timed out"
    fi

    reap
    if [ "$TRY" -eq "$ATTEMPTS" ]; then
      echo "GIVING UP on frames ${START}-${END}"
      exit 1
    fi
    sleep 5
  done
done

# Flatten the chunks into one numbered sequence so the encode is a single pass.
echo "--- flattening ---"
N=0
for DIR in "$OUTDIR"/chunk_*; do
  while IFS= read -r F; do
    mv "$F" "$OUTDIR/$(printf 'frame_%04d.png' "$N")"
    N=$(( N + 1 ))
  done < <(find "$DIR" -name '*.png' | sort -V)
  rmdir "$DIR"
done

echo "DONE: ${N} frames in ${OUTDIR}"
