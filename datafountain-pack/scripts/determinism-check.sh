#!/usr/bin/env bash
# Step 3: render the middle frame of each composition alone, from a cold
# start (fresh bundle + browser), and compare byte for byte with the same
# frame of the full render (PNG sequence written by render-previews.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:?render outdir}; mkdir -p "$OUT/cold"
for ID in DataFountain-Story DataFountain-Loop CodePanels-Dark PastelSilk-PinkBlue PastelSilk-PeachMint TealHUD-Soft LiquidRipples-White LiquidRipples-Black; do
  NAME=${ID//-/_}
  N=$(ls "$OUT/frames/$NAME" | wc -l); MID=$((N / 2))
  npx remotion still "$ID" "$OUT/cold/$NAME-$MID.png" --frame=$MID --scale=0.3333333333333333 --log=error >/dev/null
  A=$(python3 -c "from PIL import Image; import hashlib,sys; print(hashlib.sha256(Image.open('$OUT/cold/$NAME-$MID.png').convert('RGB').tobytes()).hexdigest())")
  B=$(python3 -c "from PIL import Image; import hashlib,sys; print(hashlib.sha256(Image.open('$OUT/frames/$NAME/element-$(printf %03d $MID).png').convert('RGB').tobytes()).hexdigest())")
  FA=$(sha256sum "$OUT/cold/$NAME-$MID.png" | cut -c1-16); FB=$(sha256sum "$OUT/frames/$NAME/element-$(printf %03d $MID).png" | cut -c1-16)
  echo "$NAME frame $MID: pixels $([ "$A" = "$B" ] && echo MATCH || echo MISMATCH)  file-bytes $([ "$FA" = "$FB" ] && echo MATCH || echo differ) ($FA / $FB)"
done
