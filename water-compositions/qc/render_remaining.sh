#!/usr/bin/env bash
cd /home/user/Toma/water-compositions/caustic-pool
npx remotion render CausticPool-V2-EmeraldLagoon out/Composition1_V2_EmeraldLagoon_1080p.mp4 --scale=0.5 --concurrency=4 > out/render_v2.log 2>&1; echo "C1V2 exit $?" >> ../render_status.txt
cd ../ripple-surface
npx remotion render RippleSurface-V1-Reference out/Composition2_V1_Reference_1080p.mp4 --scale=0.5 --concurrency=4 > out/render_v1.log 2>&1; echo "C2V1 exit $?" >> ../render_status.txt
npx remotion render RippleSurface-V2-LowAngleDolly out/Composition2_V2_LowAngleDolly_1080p.mp4 --scale=0.5 --concurrency=4 > out/render_v2.log 2>&1; echo "C2V2 exit $?" >> ../render_status.txt
echo "ALL DONE" >> ../render_status.txt
