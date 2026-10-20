"""Recomposite a style's extracted layers at rest and compare with the full painting.
Writes an error heat map and per-layer error attribution."""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else None
d = os.path.join(ROOT, 'remotion', 'public', 'layers', key)
meta = json.load(open(os.path.join(d, 'layers.json')))
pref = sorted(os.listdir(os.path.join(ROOT, 'build', 'prefix', key)))
full = np.asarray(Image.open(os.path.join(ROOT, 'build', 'prefix', key, pref[-1])).convert('RGB'), np.float32) / 255
acc = np.zeros_like(full)
for g, f in meta['layers']:
    L = np.asarray(Image.open(os.path.join(d, f)), np.float32) / 255
    acc = acc * (1 - L[..., 3:]) + L[..., :3] * L[..., 3:]
err = np.abs(acc - full).max(-1)
bx, by = meta['bleed']
vis = err[by:by + 2160, bx:bx + 3840]
print(key, 'VISIBLE FRAME: mean', round(float(vis.mean() * 255), 2), 'p99', round(float(np.quantile(vis, .99) * 255), 1),
      'p999', round(float(np.quantile(vis, .999) * 255), 1), 'max', round(float(vis.max() * 255), 1),
      'px>16/255:', int((vis > 16 / 255).sum()))
print(key, 'mean', round(float(err.mean() * 255), 2), 'p99', round(float(np.quantile(err, .99) * 255), 1),
      'p999', round(float(np.quantile(err, .999) * 255), 1), 'px>16/255:', int((err > 16 / 255).sum()))
ys, xs = np.nonzero(err > 16 / 255)
if len(ys):
    print(' bad bbox', xs.min(), ys.min(), xs.max(), ys.max())
    h, _ = np.histogram(ys, bins=12, range=(0, err.shape[0])); print(' rows hist', h.tolist())
if out:
    Image.fromarray((np.clip(err * 4, 0, 1) * 255).astype(np.uint8)).resize((1152, 648), Image.BOX).save(out)
