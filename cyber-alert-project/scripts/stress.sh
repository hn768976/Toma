#!/usr/bin/env bash
# Determinism stress: N rounds of (cold still || multi-thread sequence) in parallel; prints distinct outputs for frame $3.
B=$1; C=$2; F=${3:-300}; N=${4:-3}; D=out/verify/stress_$(basename $B)_$C; rm -rf $D; mkdir -p $D
for i in $(seq 1 $N); do
  npx remotion still $B $C $D/cold$i.png --frame=$F --scale=0.5 --image-format=png >/dev/null 2>&1 &
  (mkdir -p $D/seq$i; npx remotion render $B $C $D/seq$i --sequence --image-format=png --scale=0.5 --frames=$((F-10))-$((F+10)) --concurrency=4 $GLFLAG >/dev/null 2>&1) &
  wait
done
echo "$C ($B): $(md5sum $D/cold*.png $D/seq*/*$F.png | cut -d' ' -f1 | sort -u | wc -l) distinct of $((2*N))"
