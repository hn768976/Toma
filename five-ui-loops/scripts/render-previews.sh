#!/usr/bin/env bash
# Render 1080p previews (scale 0.5 of the 3840x2160 compositions).
# Frames are rendered as a lossless PNG sequence (also used for the
# determinism check), then encoded: H.264, yuv420p, 30 fps, CRF 16, no audio.
# Usage: scripts/render-previews.sh [CompositionId ...]
set -euo pipefail
cd "$(dirname "$0")/.."
GL="${GL:-angle}"
CONC="${CONC:-4}"
OUT=out/previews
mkdir -p "$OUT" out/frames out/timing
declare -A FILE=(
  [AIDiagnosis-Medical]=AIDiagnosis_Medical [AIDiagnosis-DNA]=AIDiagnosis_DNA
  [CartCounter-SlateUSD]=CartCounter_SlateUSD [CartCounter-LightEUR]=CartCounter_LightEUR
  [DataStack-Cyan]=DataStack_Cyan [DataStack-Amber]=DataStack_Amber
  [DotWorldMap-Lime]=DotWorldMap_Lime [DotWorldMap-Cyan]=DotWorldMap_Cyan
  [GradientOrb-SunsetPink]=GradientOrb_SunsetPink [GradientOrb-OceanMint]=GradientOrb_OceanMint
)
IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=("${!FILE[@]}")
for id in "${IDS[@]}"; do
  name=${FILE[$id]}
  dir=out/frames/$id
  rm -rf "$dir"; mkdir -p "$dir"
  start=$(date +%s.%N)
  npx remotion render "$id" "$dir" --sequence --image-format=png --scale=0.5 \
    --gl="$GL" --concurrency="$CONC" --log=error
  end=$(date +%s.%N)
  n=$(ls "$dir" | wc -l)
  echo "$id frames=$n wall=$(echo "$end - $start" | bc) conc=$CONC" | tee out/timing/$id.txt
  first=$(ls "$dir" | head -1); pattern="${first%%[0-9]*.png}"
  digits=$(echo "$first" | sed -E 's/^[^0-9]*([0-9]+)\.png$/\1/' | wc -c); digits=$((digits-1))
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$dir/${pattern}%0${digits}d.png" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -r 30 \
    -vf "scale=out_color_matrix=bt709:out_range=tv" \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -movflags +faststart -an "$OUT/$name.mp4"
  echo "encoded $OUT/$name.mp4"
done
