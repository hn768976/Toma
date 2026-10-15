#!/usr/bin/env bash
# Re-render the step-7 comparison frames and stack mine|reference pairs.
cd "$(dirname "$0")/.."
R=${REFS:-refs}
npx remotion bundle --out-dir build >/dev/null 2>&1
printf "CapsuleRelease-White 300\nDNAParticles-Violet 300\nDNAForm-Teal 330\nWaterDrop-Blue 300\nRadialBurst-Navy 300\n" | xargs -P 3 -n 2 sh -c 'npx remotion still build $0 out/cmp/$0.png --frame=$1 --scale=0.3333333333333333 >/dev/null 2>&1'
scripts/cmp.sh out/cmp/CapsuleRelease-White.png $R/f_cap.png out/cmp/c1.png
scripts/cmp.sh out/cmp/DNAParticles-Violet.png $R/f_dnav.png out/cmp/c3.png
scripts/cmp.sh out/cmp/DNAForm-Teal.png $R/f_dnat.png out/cmp/c4.png
scripts/cmp.sh out/cmp/WaterDrop-Blue.png $R/f_drop.png out/cmp/c6.png
scripts/cmp.sh out/cmp/RadialBurst-Navy.png $R/f_burst.png out/cmp/c7.png
ffmpeg -v error -y -i out/cmp/c1.png -i out/cmp/c3.png -i out/cmp/c4.png -i out/cmp/c6.png -i out/cmp/c7.png -filter_complex vstack=5 out/cmp/all.png
