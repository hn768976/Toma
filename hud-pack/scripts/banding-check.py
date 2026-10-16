"""Banding check on the ENCODED mp4 (not the preview).
For each file: decode one frame with ffmpeg, find the brightest glow, sample lines
through it (horizontal + vertical), and report
  * the luminance profile (every 8th px) so the gradient can be read,
  * the longest run of identical 8-bit luma values inside smooth dark gradients
    (luma 4..90, where banding shows); long flat plateaus followed by 1-level jumps = bands,
  * the largest jump between neighbouring 3-px-averaged samples (a step).
usage: python3 -I scripts/banding-check.py renders/previews/*.mp4"""
import subprocess, sys
import numpy as np
from PIL import Image
import io

def frame(path, t):
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    return np.asarray(Image.open(io.BytesIO(png)).convert("RGB")).astype(np.float64)

for path in sys.argv[1:]:
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout)
    img = frame(path, dur * 0.37)
    Y = 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]
    # brightest region (blurred) = centre of a glow
    k = 31
    pad = np.pad(Y, k, mode="edge")
    cs = pad.cumsum(0).cumsum(1)
    box = (cs[2*k:, 2*k:] - cs[:-2*k, 2*k:] - cs[2*k:, :-2*k] + cs[:-2*k, :-2*k])[:Y.shape[0], :Y.shape[1]]
    cy, cx = np.unravel_index(np.argmax(box), box.shape)
    lines = {"row": Y[cy, :], "col": Y[:, cx]}
    print(f"\n{path}  frame@{dur*0.37:.2f}s  glow centre=({cx},{cy})")
    worst_plateau = 0
    worst_jump = 0
    for name, ln in lines.items():
        sm = np.convolve(ln, np.ones(3) / 3, mode="valid")
        jumps = np.abs(np.diff(sm))
        # plateau length in dark gradient zones
        q = np.round(ln).astype(int)
        run, best = 1, 1
        for i in range(1, len(q)):
            if q[i] == q[i - 1] and 4 <= q[i] <= 90:
                run += 1
                best = max(best, run)
            else:
                run = 1
        worst_plateau = max(worst_plateau, best)
        worst_jump = max(worst_jump, jumps.max())
        prof = " ".join(f"{v:.0f}" for v in ln[::8])
        print(f"  {name}: longest flat run in luma 4-90 = {best}px, max neighbour step (3px avg) = {jumps.max():.1f}")
        print(f"    profile/8px: {prof}")
    print(f"  SUMMARY {path.split('/')[-1]}: longest plateau {worst_plateau}px, max step {worst_jump:.1f}")
