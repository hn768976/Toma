#!/usr/bin/env bash
# Verify loop steps 1, 5 and 6 across the eight encoded previews.
cd "$(dirname "$0")"
P=out/previews
PURE=(DataRibbon_Minimal DataRibbon_Crossing DataRibbon_CrossingGreen CableBundle_Rack)

echo "################ STEP 1 - container checks ################"
for f in "$P"/*.mp4; do python3 verify.py probe "$f"; done

echo; echo "################ STEP 1b - pure black overlays ################"
for n in "${PURE[@]}"; do python3 verify.py black "$P/$n.mp4"; done
echo "-- 1B must also be >=50% pure black --"
python3 verify.py blackfrac "$P/DataRibbon_Minimal.mp4"

echo; echo "################ STEP 5 - banding on the encoded file ################"
for f in "$P"/*.mp4; do python3 verify.py band "$f"; done

echo; echo "################ STEP 6 - motion and differing speeds ################"
for f in "$P"/*.mp4; do python3 verify.py motion "$f"; done
for f in "$P"/CableBundle_Rack.mp4 "$P"/CableBundle_Macro.mp4 "$P"/DataRibbon_Minimal.mp4; do
  python3 verify.py speeds "$f"
done

echo; echo "################ STEP 6b - colourways share geometry ################"
python3 verify.py overlay "$P/DataRibbon_Crossing.mp4" "$P/DataRibbon_CrossingGreen.mp4"
python3 verify.py overlay "$P/CableBundle_Rack.mp4" "$P/CableBundle_RackAmber.mp4"
