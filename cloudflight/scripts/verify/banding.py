# Step 4: read pixel values down three vertical lines of a frame decoded from
# the encoded mp4 and report the largest jump between neighbouring pixels and
# the number of flat runs (a long run of identical values followed by a step
# is a band).
import subprocess, sys
import numpy as np
mp4, t = sys.argv[1], sys.argv[2]
raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", t, "-i", mp4, "-frames:v", "1", "-f", "rawvideo",
                      "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
img = np.frombuffer(raw, np.uint8).reshape(720, 1280, 3).astype(int)
for x in (200, 640, 1080):
    col = img[:, x, :].sum(axis=1) / 3.0
    sm = np.convolve(col, np.ones(9) / 9, mode="valid")  # remove grain/dither
    steps = np.abs(np.diff(sm))
    print(f"  x={x}: min {col.min():.0f} max {col.max():.0f}  max step (9px mean) {steps.max():.2f}  mean step {steps.mean():.3f}")
