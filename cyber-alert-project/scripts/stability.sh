#!/usr/bin/env bash
# Renders the same frame N times cold and prints the number of distinct outputs (1 = stable).
B=$1; C=$2; F=${3:-300}; N=${4:-4}; D=out/verify/stab_$(basename $B)_$C; rm -rf $D; mkdir -p $D
for i in $(seq 1 $N); do npx remotion still $B $C $D/$i.png --frame=$F --scale=0.5 --image-format=png >/dev/null 2>&1; done
echo "$C frame $F: $(md5sum $D/*.png | cut -d' ' -f1 | sort -u | wc -l) distinct of $N"
