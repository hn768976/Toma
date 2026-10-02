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
  if [ "${ENCODE_ONLY:-0}" != 1 ]; then
    rm -rf "$dir"; mkdir -p "$dir"
    start=$(date +%s.%N)
    npx remotion render "$id" "$dir" --sequence --image-format=png --scale=0.5 \
      --gl="$GL" --concurrency="$CONC" --timeout=120000 --log=error
    end=$(date +%s.%N)
    files=("$dir"/*.png); n=${#files[@]}
    echo "$id frames=$n wall=$(echo "$end - $start" | bc) conc=$CONC" | tee out/timing/$id.txt
  fi
  files=("$dir"/*.png)
  # Dark looks (1, 3): keep the fine grain alive through H.264 so deep shadows
  # don't collapse into plateaus (same settings as remotion.config.ts).
  case $id in
    AIDiagnosis-*|DataStack-*) X264=(-tune grain -x264-params "aq-mode=3:deadzone-inter=0:deadzone-intra=0:no-dct-decimate=1") ;;
    *) X264=() ;;
  esac
  first=$(basename "${files[0]}"); pattern="${first%%[0-9]*.png}"
  digits=$(echo "$first" | sed -E 's/^[^0-9]*([0-9]+)\.png$/\1/' | wc -c); digits=$((digits-1))
  ffmpeg -v error -y -framerate 30 -start_number 0 -i "$dir/${pattern}%0${digits}d.png" \
    -c:v libx264 -preset slow -crf 16 "${X264[@]}" -pix_fmt yuv420p -r 30 \
    -vf "scale=out_color_matrix=bt709:out_range=tv" \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -movflags +faststart -an "$OUT/$name.mp4"
  echo "encoded $OUT/$name.mp4"
done
