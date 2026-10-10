#!/usr/bin/env bash
# Per-frame render time: (time of an 11-frame single-tab render - time of a
# 1-frame render) / 10, so bundling and browser start-up cancel out.
# usage: time-render.sh <id> [scale]
id=$1; SCALE=${2:-0.3333333333333333}; T=out/timing/$id; rm -rf "$T"; mkdir -p "$T"
t0=$(date +%s.%N)
npx remotion render "$id" "$T/one" --sequence --image-format=png --frames=300-300 --concurrency=1 --scale=$SCALE --timeout=900000 --log=error >/dev/null 2>&1
t1=$(date +%s.%N)
npx remotion render "$id" "$T/many" --sequence --image-format=png --frames=300-310 --concurrency=1 --scale=$SCALE --timeout=900000 --log=error >/dev/null 2>&1
t2=$(date +%s.%N)
python3 -c "a=$t1-$t0; b=$t2-$t1; print(f'$id scale=$SCALE: per-frame {(b-a)/10:.2f}s  (1 frame run {a:.1f}s, 11 frame run {b:.1f}s)')"
rm -rf "$T"
