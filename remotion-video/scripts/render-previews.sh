#!/usr/bin/env bash
# Render the Brain Pack previews (default 720p) or the 4K masters.
#
#   scripts/render-previews.sh            # 8 x 1280x720 previews into out/brain-pack/
#   SCALE=1 scripts/render-previews.sh    # 3840x2160 masters (slow, CPU WebGL)
#   ONLY=BrainSolid-Green scripts/render-previews.sh
#
# Composition ids use "-" (Remotion forbids "_"); files get the delivery names.
set -euo pipefail
cd "$(dirname "$0")/.."

SCALE="${SCALE:-0.3333333333333333}"
OUT="${OUT:-out/brain-pack}"
CONCURRENCY="${CONCURRENCY:-2}"
mkdir -p "$OUT"

declare -A NAMES=(
  [BrainMembrane-Violet]=BrainMembrane_Violet
  [BrainFibre-LightReveal]=BrainFibre_LightReveal
  [BrainFibre-LightLoop]=BrainFibre_LightLoop
  [BrainSolid-Black]=BrainSolid_Black
  [BrainSolid-Green]=BrainSolid_Green
  [BrainGlass-Thoughts]=BrainGlass_Thoughts
  [BrainParticles-Assemble]=BrainParticles_Assemble
  [BrainOrbit-DeepBlue]=BrainOrbit_DeepBlue
)

BUNDLE="${BUNDLE:-$(mktemp -d)/bundle}"
if [ ! -f "$BUNDLE/index.html" ]; then
  npx remotion bundle src/index.ts --out-dir "$BUNDLE" >/dev/null
fi

for id in BrainMembrane-Violet BrainFibre-LightReveal BrainFibre-LightLoop BrainSolid-Black BrainSolid-Green BrainGlass-Thoughts BrainParticles-Assemble BrainOrbit-DeepBlue; do
  if [ -n "${ONLY:-}" ] && [[ ",${ONLY}," != *",${id},"* ]]; then continue; fi
  start=$(date +%s)
  npx remotion render "$BUNDLE" "$id" "$OUT/${NAMES[$id]}.mp4" \
    --gl=angle \
    --scale="$SCALE" \
    --codec=h264 --crf=16 --pixel-format=yuv420p \
    --image-format=png \
    --concurrency="$CONCURRENCY" \
    --log=error
  end=$(date +%s)
  echo "$id -> $OUT/${NAMES[$id]}.mp4  $((end - start)) s"
done
