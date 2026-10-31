#!/usr/bin/env bash
# Re-render Composition 1 (after reviewer-driven shader revision), once the
# Composition 2 renders have finished.
ST=/home/user/Toma/water-compositions/render_status.txt
until grep -q "ALL DONE" "$ST"; do sleep 15; done
cd /home/user/Toma/water-compositions/caustic-pool
npx remotion render CausticPool-V1-Reference out/Composition1_V1_Reference_1080p.mp4 --scale=0.5 --concurrency=4 > out/render_v1.log 2>&1; echo "C1V1-rev2 exit $?" >> "$ST"
npx remotion render CausticPool-V2-EmeraldLagoon out/Composition1_V2_EmeraldLagoon_1080p.mp4 --scale=0.5 --concurrency=4 > out/render_v2.log 2>&1; echo "C1V2-rev2 exit $?" >> "$ST"
echo "C1 REV2 DONE" >> "$ST"
