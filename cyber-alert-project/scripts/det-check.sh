#!/usr/bin/env bash
# Determinism probe: cold still vs multi-thread sequence, frame $3, bundle $1, comp $2.
B=$1; C=$2; F=${3:-300}; D=out/verify/det_$(basename $B)_$C; rm -rf $D; mkdir -p $D/seq
npx remotion still $B $C $D/cold.png --frame=$F --scale=0.5 --image-format=png >/dev/null 2>&1
npx remotion render $B $C $D/seq --sequence --image-format=png --scale=0.5 --frames=$((F-10))-$((F+10)) --concurrency=4 >/dev/null 2>&1
python3 -c "
import numpy as np,glob; from PIL import Image
a=np.asarray(Image.open('$D/cold.png').convert('RGB')).astype(int); b=np.asarray(Image.open(sorted(glob.glob('$D/seq/*$F.png'))[0]).convert('RGB')).astype(int)
d=np.abs(a-b).max(axis=2); print('$C', 'differing px', int((d>0).sum()), 'max', int(d.max()))"
