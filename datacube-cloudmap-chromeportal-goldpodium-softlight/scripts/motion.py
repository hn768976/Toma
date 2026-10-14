"""Step 6: decode a window of the encoded preview and measure smoothness.
- frame-to-frame mean abs difference: spikes (max/median) mean a jump or stutter
- flicker: share of pixels whose value moves up then down (or down then up) by
  >24 levels over three consecutive frames (shimmer / moiré signature)"""
import sys, subprocess, numpy as np
name, start, count = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
cmd = ["ffmpeg", "-v", "error", "-i", f"out/previews/{name}.mp4", "-vf", f"select=between(n\\,{start}\\,{start+count-1})",
       "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
raw = subprocess.run(cmd, capture_output=True, check=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, 720, 1280).astype(np.int16)
d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
a = f[1:-1] - f[:-2]; b = f[2:] - f[1:-1]
flick = ((a * b < 0) & (np.abs(a) > 24) & (np.abs(b) > 24)).mean(axis=(1, 2)) * 100
print(f"{name} frames {start}-{start+len(f)-1}: mean|Δ| median={np.median(d):.2f} max={d.max():.2f} "
      f"spike-ratio={d.max()/max(np.median(d),1e-6):.2f}  flicker% median={np.median(flick):.4f} max={flick.max():.4f}")
