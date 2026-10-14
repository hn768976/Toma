"""Contrast-stretch gradient areas of frames decoded from the encoded mp4s (×6 gain
about the local mean) so any 8-bit staircase becomes obvious; also report, per row,
the longest run of identical *luminance-dominant channel* values in a heavily
smoothed-free raw row and the staircase score (fraction of the 9-row mean profile's
steps that are exactly quantised plateaus)."""
import sys, numpy as np
from PIL import Image
name, frame = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(f"out/verify/{name}_band_frame{frame}.png").convert("RGB")).astype(float)
H, W, _ = im.shape
# dominant channel = largest variance
ch = int(np.argmax(im.reshape(-1, 3).std(0)))
v = im[..., ch]
lo, hi = np.percentile(v, 2), np.percentile(v, 98)
blur = np.asarray(Image.fromarray(v.astype(np.uint8)).resize((W // 16, H // 16), Image.BILINEAR).resize((W, H), Image.BILINEAR)).astype(float)
st = np.clip(128 + (v - blur) * 12, 0, 255).astype(np.uint8)
Image.fromarray(st).save(f"out/verify/{name}_band_stretch.png")
print(name, "channel", "RGB"[ch], "stretched →", f"out/verify/{name}_band_stretch.png")
