#!/usr/bin/env bash
# Renders every 1080p master from a pre-built bundle.
#   ./scripts/render-all.sh            -> all 13 at 1080p into out/1080p
#   ./scripts/render-all.sh 4k         -> all 13 at 2160p into out/4k
# Requires a bundle in ./build (npx remotion bundle src/index.ts --out-dir=build).
set -uo pipefail
cd "$(dirname "$0")/.."

VARIANT="${1:-1080p}"
if [ "$VARIANT" = "4k" ]; then SUFFIX="4K"; OUTDIR="out/4k"; TAG="2160p"; else SUFFIX=""; OUTDIR="out/1080p"; TAG="1080p"; fi
mkdir -p "$OUTDIR"

NAMES=(
  "01:V01FrostedMolecules"
  "02:V02NavySparkle"
  "03:V03VioletCascade"
  "04:V04ParticleStrand"
  "05:V05GenomeHud"
  "06:V06ClinicalLight"
  "07:V07DualDust"
  "08:V08NeonWire"
  "09:V09CeramicStudio"
  "10:V10DeepFog"
  "11:V11CrimsonNetwork"
  "12:V12GlassRimlight"
  "13:V13AzureCopySpace"
)

for entry in "${NAMES[@]}"; do
  num="${entry%%:*}"
  comp="${entry##*:}${SUFFIX}"
  slug=$(echo "${entry##*:}" | sed 's/^V[0-9]*//')
  out="$OUTDIR/${num}_${slug}_${TAG}.mp4"
  echo "=== [$num/13] $comp -> $out"
  start=$(date +%s)
  npx remotion render build "$comp" "$out" \
    --gl=swangle --codec=h264 --crf=16 --pixel-format=yuv420p \
    --log=error 2>&1 | grep -viE "memory reported|differing memory|docker run|lower amount" || true
  end=$(date +%s)
  if [ -f "$out" ]; then
    echo "    done in $((end-start))s  $(du -h "$out" | cut -f1)"
  else
    echo "    FAILED: $out was not produced"
  fi
done
echo "ALL RENDERS COMPLETE"
