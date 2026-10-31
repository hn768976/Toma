#!/usr/bin/env bash
# Re-render Composition 2 (after reviewer-driven shader redesign), once the
# Composition 1 re-render has finished.
ST=/home/user/Toma/water-compositions/render_status.txt
until grep -q "C1 REV2 DONE" "$ST"; do sleep 15; done
cd /home/user/Toma/water-compositions/ripple-surface
npx remotion render RippleSurface-V1-Reference out/Composition2_V1_Reference_1080p.mp4 --scale=0.5 --concurrency=4 > out/render_v1.log 2>&1; echo "C2V1-rev2 exit $?" >> "$ST"
npx remotion render RippleSurface-V2-LowAngleDolly out/Composition2_V2_LowAngleDolly_1080p.mp4 --scale=0.5 --concurrency=4 > out/render_v2.log 2>&1; echo "C2V2-rev2 exit $?" >> "$ST"
echo "C2 REV2 DONE" >> "$ST"
