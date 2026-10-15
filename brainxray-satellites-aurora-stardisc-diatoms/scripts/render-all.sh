#!/usr/bin/env bash
# Render + verify every composition (720p previews) from a frozen bundle copy.
# ONLY="Name1 Name2" restricts the list.
set -uo pipefail
export BUNDLE=out/bundle-render
declare -A PROBE=(
  [BrainXRay_Gold]='{"navy_left":[150,600,10,220],"navy_right":[150,600,1150,1275]}'
  [BrainXRay_Cyan]='{"navy_left":[150,600,10,220],"navy_right":[150,600,1150,1275]}'
  [SatelliteNetwork_Blue]='{"space_glow":[300,420,20,420],"night_globe":[150,300,1000,1270]}'
  [SatelliteNetwork_Close]='{"sky":[20,140,300,1000],"globe":[560,700,300,1000]}'
  [Aurora_Green]='{"dark_sky":[10,200,900,1275],"lower_sky":[300,450,1000,1275]}'
  [Aurora_VioletGreen]='{"dark_sky":[10,200,900,1275],"lower_sky":[300,450,1000,1275]}'
  [StarDisc_Orange]='{"black":[560,710,500,1270],"halo":[20,160,560,720]}'
  [Diatoms_BrightField]='{"field":[200,320,300,700],"field2":[420,520,500,900]}'
)
for pair in "BrainXRay-Gold BrainXRay_Gold" "BrainXRay-Cyan BrainXRay_Cyan" "Aurora-Green Aurora_Green" \
            "Aurora-VioletGreen Aurora_VioletGreen" "StarDisc-Orange StarDisc_Orange" "Diatoms-BrightField Diatoms_BrightField" \
            "SatelliteNetwork-Blue SatelliteNetwork_Blue" "SatelliteNetwork-Close SatelliteNetwork_Close"; do
  set -- $pair
  if [ -n "${ONLY:-}" ] && [[ " $ONLY " != *" $2 "* ]]; then continue; fi
  echo "=== $2 $(date +%T)"
  scripts/render-preview.sh "$1" "$2" || { echo "RENDER FAILED $2"; continue; }
  mkdir -p out/verify
  PROBES="${PROBE[$2]}" python3 scripts/verify.py "$1" "$2" "$BUNDLE" > "out/verify/$2.log" 2>&1 || echo "VERIFY FAILED $2"
  echo "--- done $2 $(date +%T)"
done
