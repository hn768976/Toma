"""Shared helpers for the Art Deco scene scripts (artdeco_lake / _coast / _forest).

`Deco` is the vendored `ArtDeco` class with the same airbrush maths, but every frisket pass is limited to the
bounding box of its mask (the lib works on the whole board for every pass, which is what made the Phase 1 lake
slow). Pixels outside a mask's box get zero paint in the lib too, so the picture is the same.
`Stager` writes draw-on snapshots straight to disk (NNN_name.png) instead of keeping them in memory."""
import os

import numpy as np

import drawkit
from artdeco import ArtDeco, ramp, _c
from core import polygon_mask


def _box(m):
    rows = np.flatnonzero(m.any(1))
    if rows.size == 0:
        return None
    cols = np.flatnonzero(m.any(0))
    return (slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1))


class Deco(ArtDeco):
    def __init__(self, W, H, seed=0, grain=1.0):
        super().__init__(W, H, seed=seed, grain=grain)

    # -- same maths as ArtDeco.spray, restricted to the mask's bounding box
    def _spray_in(self, sl, d, col, grain, blend):
        d = np.clip(d, 0, 1)
        if grain:
            d = np.clip(d + self.speck[sl] * (0.2 * grain) * d * (1 - d), 0, 1)
        img = self.img[sl]
        if blend == 'screen':
            img = 1 - (1 - img) * (1 - d[..., None] * col)
        elif blend == 'add':
            img = np.minimum(img + d[..., None] * col, 1.5)
        else:
            img = img * (1 - d[..., None]) + col * d[..., None]
        self.img[sl] = img

    def spray(self, mask, colour, density=1.0, grain=1.0, blend='paint'):
        m = np.asarray(mask, np.float32)
        if m.ndim != 2:
            return super().spray(mask, colour, density, grain, blend)
        m = m * density if np.ndim(density) == 0 else m * np.asarray(density, np.float32)
        sl = _box(m > 0)
        if sl is None:
            return
        if isinstance(colour, str) or np.ndim(colour) == 1:
            col = _c(colour)
        else:
            col = np.asarray(colour, np.float32)[sl]
        self._spray_in(sl, m[sl], col, grain, blend)

    def fade(self, mask, stops, p0, p1, grain=1.0):
        m = np.asarray(mask, np.float32)
        if m.ndim != 2:
            return super().fade(mask, stops, p0, p1, grain)
        sl = _box(m > 0)
        if sl is None:
            return
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        L2 = dx * dx + dy * dy + 1e-6
        t = ((self.xx[sl] - p0[0]) * dx + (self.yy[sl] - p0[1]) * dy) / L2
        t = np.clip(t + self.speck[sl] * 0.006 * grain, 0, 1)
        self._spray_in(sl, m[sl], ramp(t, stops), grain, 'paint')

    def poly(self, pts):
        """the lib's 4x supersampled polygon frisket, rasterised only inside the polygon's box"""
        pts = [(float(x), float(y)) for x, y in pts]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0, x1 = max(0, int(np.floor(min(xs))) - 3), min(self.W, int(np.ceil(max(xs))) + 3)
        y0, y1 = max(0, int(np.floor(min(ys))) - 3), min(self.H, int(np.ceil(max(ys))) + 3)
        out = np.zeros((self.H, self.W), np.float32)
        if x1 <= x0 or y1 <= y0:
            return out
        out[y0:y1, x0:x1] = polygon_mask(y1 - y0, x1 - x0, [(x - x0, y - y0) for x, y in pts], ss=4)
        return out

    def capsule(self, x0, x1, y, r):
        """a streamlined cloud / speed-line frisket: a horizontal bar with round ends (anti-aliased)"""
        out = np.zeros((self.H, self.W), np.float32)
        bx0, bx1 = max(0, int(x0 - r) - 2), min(self.W, int(x1 + r) + 3)
        by0, by1 = max(0, int(y - r) - 2), min(self.H, int(y + r) + 3)
        if bx1 <= bx0 or by1 <= by0:
            return out
        xx, yy = self.xx[by0:by1, bx0:bx1], self.yy[by0:by1, bx0:bx1]
        dx = np.maximum(np.maximum(x0 - (xx + 0.5), (xx + 0.5) - x1), 0)
        d = np.hypot(dx, yy + 0.5 - y)
        out[by0:by1, bx0:bx1] = np.clip(r - d + 0.5, 0, 1)
        return out

    def bar(self, p0, p1, w):
        return self._bar(p0, p1, w)


class Stager:
    """draw-on snapshots: coarse ones always (when stages_dir is set), dense ones only with dense=True"""
    def __init__(self, a, stages_dir=None, dense=False):
        self.a, self.dir, self.dense, self.n = a, stages_dir, dense, 0
        if stages_dir:
            os.makedirs(stages_dir, exist_ok=True)

    def __call__(self, name, dense=False):
        if not self.dir or (dense and not self.dense):
            return
        drawkit.save_png(self.a.composite(), os.path.join(self.dir, f'{self.n:03d}_{name}.png'))
        self.n += 1

    def final(self, img):
        if self.dir:
            drawkit.save_png(img, os.path.join(self.dir, f'{self.n:03d}_final.png'))
            self.n += 1


def ext_ridge(ridge, S, pad=20):
    """stretch a ridge's end points out over the bleed so the range spans the whole canvas"""
    r = list(ridge)
    r[0] = (min(r[0][0], S.X0 - pad), r[0][1])
    r[-1] = (max(r[-1][0], S.X1 + pad), r[-1][1])
    return r


def design_xy(a, S):
    """per-pixel design coordinates of the canvas"""
    return (a.xx - S.ox) / S.s, (a.yy - S.oy) / S.s
