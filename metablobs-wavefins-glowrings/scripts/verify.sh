#!/usr/bin/env bash
# Verify loop, steps 1-3: file checks, loop seam (frame 600 == frame 0, 601-frame
# variant), and cold-start determinism (still of frame 300 == frame 300 of the full render).
set -uo pipefail
cd "$(dirname "$0")/.."
ALL=(MetaBlobs-NeonBlueMagenta MetaBlobs-WhiteMatte MetaBlobs-SunsetCoral WaveFins-Blue WaveFins-Copper GlowRings-Magenta GlowRings-Violet GlowRings-Teal)
COMPS=("${@:-${ALL[@]}}")
mkdir -p out/verify
S="--scale=0.3333333333333333 --log=error"
for c in "${COMPS[@]}"; do
  name="${c/-/_}"
  echo "== $c"
  f="out/previews/$name.mp4"
  ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames \
    -show_entries format=duration -of default=noprint_wrappers=1 "$f" | tr '\n' ' '; echo
  # Step 2: loop seam
  npx remotion still "$c" out/verify/$c-f0.png --frame=0 --props='{"loopCheck":true}' $S
  npx remotion still "$c" out/verify/$c-f600.png --frame=600 --props='{"loopCheck":true}' $S
  if cmp -s out/verify/$c-f0.png out/verify/$c-f600.png; then echo "loop: frame 600 == frame 0 (identical bytes)"; else echo "loop: MISMATCH"; fi
  npx remotion still "$c" out/verify/$c-f599.png --frame=599 --props='{"loopCheck":true}' $S
  npx remotion still "$c" out/verify/$c-f1.png --frame=1 --props='{"loopCheck":true}' $S
  python3 scripts/seamdiff.py out/verify/$c-f599.png out/verify/$c-f600.png out/verify/$c-f0.png out/verify/$c-f1.png
  # Step 3: cold-start determinism
  npx remotion still "$c" out/verify/$c-cold300.png --frame=300 $S
  if cmp -s out/verify/$c-cold300.png out/full300/$c.png; then echo "determinism: cold frame 300 == full-render frame 300 (identical bytes)"; else echo "determinism: MISMATCH"; fi
done
