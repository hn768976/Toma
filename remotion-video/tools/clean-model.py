#!/usr/bin/env python3
"""Clean the Meshy "Ocean Gaze" GLB for the Cyber Eye composition.

- drops the thousands of tiny disconnected shells Meshy leaves behind
  (anything under MIN_FACES triangles),
- finds the pupil hole and re-centres the model on it so the HUD ring
  system can sit at the origin,
- writes a plain GLB that `npm run model:optimize` then welds/simplifies.

Usage: python3 tools/clean-model.py <input.glb> <output.glb>
Requires: pip install trimesh numpy scipy networkx
"""
import sys

import numpy as np
import trimesh
from scipy import ndimage

MIN_FACES = 40
# Small detached pieces that sit entirely below the lower lid (stray lash
# clumps Meshy left floating in space) are dropped too.
STRAY_MAX_FACES = 700
STRAY_BELOW_Y = -0.22


def find_pupil(vertices):
    """Return (cx, cy, radius) of the largest enclosed hole near the centre."""
    xs = np.linspace(-0.5, 0.5, 251)
    ys = np.linspace(-0.3, 0.3, 151)
    hist, xe, ye = np.histogram2d(vertices[:, 0], vertices[:, 1], bins=[xs, ys])
    empty = hist.T == 0
    labels, n = ndimage.label(empty)
    best = None
    for i in range(1, n + 1):
        sel = labels == i
        if sel[0, :].any() or sel[-1, :].any() or sel[:, 0].any() or sel[:, -1].any():
            continue  # touches the border: outside the silhouette, not a hole
        count = sel.sum()
        if best is None or count > best[0]:
            yy, xx = np.nonzero(sel)
            cx = (xe[xx] + xe[xx + 1]).mean() / 2
            cy = (ye[yy] + ye[yy + 1]).mean() / 2
            r = ((xe[xx.max() + 1] - xe[xx.min()]) + (ye[yy.max() + 1] - ye[yy.min()])) / 4
            best = (count, cx, cy, r)
    if best is None:
        raise SystemExit("could not locate the pupil hole")
    return best[1], best[2], best[3]


def main(src, dst):
    mesh = trimesh.load(src, force="mesh")
    parts = mesh.split(only_watertight=False)
    kept = [
        p
        for p in parts
        if len(p.faces) >= MIN_FACES
        and not (len(p.faces) < STRAY_MAX_FACES and p.bounds[1][1] < STRAY_BELOW_Y)
    ]
    print(f"components: {len(parts)} -> kept {len(kept)}")
    clean = trimesh.util.concatenate(kept)
    cx, cy, r = find_pupil(clean.vertices)
    print(f"pupil centre=({cx:.4f}, {cy:.4f}) radius={r:.4f}")
    clean.apply_translation([-cx, -cy, 0.0])
    clean.export(dst)
    print(f"wrote {dst}: {len(clean.vertices)} vertices, {len(clean.faces)} faces")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
