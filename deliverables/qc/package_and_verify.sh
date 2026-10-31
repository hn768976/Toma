#!/bin/bash
# Package each Remotion project (without node_modules / renders) and verify the
# zip from a clean extraction: integrity, contents, `npm ci`, lint/typecheck,
# a short render with the documented command, and a native 4K still.
set -euo pipefail
ROOT=/home/user/Toma
DEL=$ROOT/deliverables
WORK=${WORK:-/tmp/zipverify}
export REMOTION_GL=${REMOTION_GL:-swangle}
rm -rf "$WORK"; mkdir -p "$WORK"

pack() { # project zipname
  local P=$1 Z=$2
  rm -f "$DEL/$Z"
  (cd "$ROOT" && zip -X -r -9 "$DEL/$Z" "$P" -x "$P/node_modules/*" "$P/out/*" "$P/dist/*" "$P/.remotion/*" >/dev/null)
  echo "== $Z: $(du -h "$DEL/$Z" | cut -f1)"
}

verify() { # zipname project comp1 comp2 render-script
  local Z=$1 P=$2 C1=$3 C2=$4
  echo "== verifying $Z"
  unzip -tq "$DEL/$Z"
  mkdir -p "$WORK/$P.x" && unzip -q "$DEL/$Z" -d "$WORK/$P.x"
  cd "$WORK/$P.x/$P"
  for f in package.json package-lock.json remotion.config.ts tsconfig.json README.md src/Root.tsx src/index.ts scripts/build_assets.py; do
    test -f "$f" || { echo "MISSING $f"; exit 1; }
  done
  ls public/textures public/data
  npm ci --no-audit --no-fund >/dev/null 2>&1 && echo "npm ci: ok"
  npm run lint >/dev/null 2>&1 && echo "lint + tsc: ok"
  npx remotion compositions 2>/dev/null | grep -E "$C1|$C2"
  npm run render:v1 -- --frames=0-29 --concurrency=3 >/dev/null 2>&1 && echo "render:v1 (frames 0-29): ok"
  npm run render:v2 -- --frames=0-29 --concurrency=3 >/dev/null 2>&1 && echo "render:v2 (frames 0-29): ok"
  for f in out/*.mp4; do ffprobe -v error -select_streams v -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -of csv=p=0 "$f" | sed "s#^#$f: #"; done
  npx remotion still "$C1" out/still_4k_v1.png --frame=450 >/dev/null 2>&1
  npx remotion still "$C2" out/still_4k_v2.png --frame=450 >/dev/null 2>&1
  python3 -c "from PIL import Image; import sys; [print(p, Image.open(p).size) for p in sys.argv[1:]]" out/still_4k_v1.png out/still_4k_v2.png
  cd "$ROOT"
}

pack globe-network-comp1 Comp1_GlobalNetworkMap_4K_RemotionProject.zip
pack globe-network-comp2 Comp2_EarthNetwork_4K_RemotionProject.zip
verify Comp1_GlobalNetworkMap_4K_RemotionProject.zip globe-network-comp1 NetworkMap-V1-Reference NetworkMap-V2-AmberPalette
verify Comp2_EarthNetwork_4K_RemotionProject.zip globe-network-comp2 EarthNetwork-V1-Reference EarthNetwork-V2-OrbitalPullback
echo ALL_ZIP_CHECKS_PASSED
