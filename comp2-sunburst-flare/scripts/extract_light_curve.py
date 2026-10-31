#!/usr/bin/env python3
"""Regenerates src/*/lightCurve.ts from a reference clip (requires ffmpeg + numpy).
Usage: python3 scripts/extract_light_curve.py <reference.mp4> <frames> <out.ts> LIGHT_CURVE
The reference clip itself is not shipped with the project; the curve is."""
import sys, subprocess, numpy as np
f, n, out, name = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
raw=subprocess.run(['ffmpeg','-v','error','-i',f,'-vf','fps=30,scale=192:108','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
g=np.frombuffer(raw,np.uint8).reshape(-1,108,192).astype(np.float64)
lum=g.mean((1,2))
lum=np.concatenate([lum, np.repeat(lum[-1:], max(0,n-len(lum)))])[:n]
k=np.array([1,2,1],float); k/=k.sum()
pad=np.pad(lum,1,mode="edge"); sm=np.convolve(pad,k,'valid')
ref=np.percentile(sm,75)
m=np.clip(sm/ref,0.5,1.2)
vals=', '.join(f'{v:.4f}' for v in m)
open(out,'w').write(f'''// Global light-intensity curve, one value per output frame at 30 fps.
// Measured from the reference clip's mean luminance (resampled to 30 fps,
// 3-tap smoothed, normalised to its 75th percentile), so the composition
// reproduces the reference's timing of sunlight dips as leaves pass in front
// of the sun. Values are multiplied onto the final image.
export const {name}: readonly number[] = [{vals}];
''')
print(len(m), m.min().round(3), m.max().round(3), np.median(m).round(3))
