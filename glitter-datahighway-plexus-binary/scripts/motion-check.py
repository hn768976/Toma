#!/usr/bin/env python3
"""Motion smoothness check (Step 6): decodes 2 s around frame 300 of each preview.
Reports
  * global flicker: frame-to-frame change of mean luminance; a strobe shows up as
    an alternating (+,-,+,-) pattern. We report max |second difference|, the
    mean |first difference| and the lag-1 autocorrelation of the first differences.
    Smooth motion gives autocorr > -0.5.
  * crawl: mean |frame diff| in the distant band vs. the whole frame.
"""
import os, subprocess, sys
import numpy as np
NAMES = ["GlitterVortex_Gold", "GlitterVortex_Silver", "DataHighway_Multicolour", "PlexusLandscape_BlueAmber",
         "LowPolyPlexus_Blue", "LowPolyPlexus_Violet", "BinaryPlane_Blue", "BinaryPlane_Green"]
FAR = {"DataHighway_Multicolour": (0.44, 0.56), "BinaryPlane_Blue": (0.0, 0.25), "BinaryPlane_Green": (0.0, 0.25),
       "PlexusLandscape_BlueAmber": (0.3, 0.45)}
d = sys.argv[1] if len(sys.argv) > 1 else "out/previews"
for n in NAMES:
    p = os.path.join(d, n + ".mp4")
    if not os.path.exists(p):
        continue
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", "9", "-i", p, "-frames:v", "60", "-f", "rawvideo",
                          "-pix_fmt", "gray", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, 720, 1280).astype(float)
    m = a.mean(axis=(1, 2)); d1 = np.diff(m)
    ac = np.corrcoef(d1[:-1], d1[1:])[0, 1] if d1.std() > 1e-6 else 1.0
    line = f"{n:27s} mean lum {m.mean():6.1f}  |dmean| {np.abs(d1).mean():.3f}  lag-1 autocorr {ac:+.2f}  {'ok' if ac > -0.5 else 'STROBE?'}"
    if n in FAR:
        y0, y1 = FAR[n]
        far = a[:, int(y0 * 720):int(y1 * 720)]
        line += f"  | far-band |diff| {np.abs(np.diff(far, axis=0)).mean():.2f} vs frame {np.abs(np.diff(a, axis=0)).mean():.2f}"
    print(line)
