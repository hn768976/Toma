"""Shared machinery for the Ink wash (水墨) scenes — inkwash_lake / inkwash_coast / inkwash_forest.

Built on vendor lib/inkpaint.py `Painting`:
- colourways (ink / accent / paper colours) via an overridden composite();
- layer groups: each group paints into fresh D/R buffers and is merged onto the stack with an
  explicit occlusion mask, so a group's effect (ink it lays, ink it lifts or covers) stays inside
  its own footprint. A second "full" stack keeps every pre-water group even when it is not
  included, so the water can reflect mountains/pines that were skipped.
- staged snapshots written straight to disk as NNN_name.png;
- a brushy sumi-e conifer (irregular, broken, dry-brush tiers) and small local wash blobs.
"""
import os

import numpy as np
from PIL import Image, ImageDraw

import drawkit
from drawkit import save_png
from inkpaint import Painting, PAPER, INK, VERMILION, spline, curve, blur

STYLE = "Ink wash · 水墨"
COLOURWAYS = ("BlackInk", "Indigo")

PALETTES = {
    # Phase 1 look: carbon ink, vermilion dusk tint, warm rice paper
    "BlackInk": dict(ink=INK, red=VERMILION, red_k=1.0, paper=PAPER),
    # indigo ink on a slightly cooler, whiter paper; the accent buffer becomes a pale ochre dawn
    "Indigo": dict(ink=np.array([30, 46, 92], np.float32) / 255,
                   red=np.array([196, 142, 78], np.float32) / 255, red_k=0.75,
                   paper=np.array([241, 238, 229], np.float32) / 255),
}

FOOT_THR = 1.0 / 512       # density below this cannot change an 8-bit pixel


class Ink(Painting):
    def __init__(self, S, seed=1, colourway="BlackInk", stages_dir=None, dense=False, track_full=False):
        if colourway not in PALETTES:
            raise ValueError(f"colourway must be one of {COLOURWAYS}")
        super().__init__(S.W, S.H, seed=seed)
        self.S, self.s, self.seed0 = S, S.s, seed
        self.pal = PALETTES[colourway]
        self.stages_dir, self.dense = stages_dir, dense
        self.nstage = 0
        self.layer = None
        self.footprints = {}
        self.track_full = track_full
        if track_full:
            self.FD = np.zeros_like(self.D); self.FR = np.zeros_like(self.R)
        # design-space coordinate grids (handy for anything that must ignore the bleed offset)
        self.YD = (self.YY - S.oy) / S.s
        self.XD = (self.XX - S.ox) / S.s
        if stages_dir:
            os.makedirs(stages_dir, exist_ok=True)

    # ------------------------------------------------------------ groups / layers
    def group_rng(self, name):
        self.rng = drawkit.group_rng(self.seed0, name)
        return self.rng

    def begin(self, name, live=True):
        """start painting group `name` into fresh buffers; live=False paints it only for the
        reflection stack (group skipped by `include`)"""
        self.layer = dict(name=name, D0=self.D, R0=self.R, occD=None, occR=None, live=live)
        self.D = np.zeros_like(self.D); self.R = np.zeros_like(self.R)
        return self.group_rng(name)

    def occlude(self, occD=None, occR=None):
        """this group covers/lifts what lies behind it: behind *= (1 - occ)"""
        L = self.layer
        for key, o in (('occD', occD), ('occR', occR)):
            if o is None:
                continue
            o = np.clip(o, 0, 1).astype(np.float32)
            L[key] = o if L[key] is None else 1 - (1 - L[key]) * (1 - o)

    @staticmethod
    def _merge(base, occ, lay):
        out = base * (1 - occ) if occ is not None else base.copy()
        return 1 - (1 - out) * (1 - np.clip(lay, 0, 1))

    def _merged(self):
        L = self.layer
        if L is None:
            return self.D, self.R
        if not L['live']:
            return L['D0'], L['R0']
        return self._merge(L['D0'], L['occD'], self.D), self._merge(L['R0'], L['occR'], self.R)

    def end(self):
        L = self.layer
        fp = (self.D > FOOT_THR) | (self.R > FOOT_THR)
        for key in ('occD', 'occR'):
            if L[key] is not None:
                fp |= L[key] > FOOT_THR
        self.footprints[L['name']] = fp
        if self.track_full:
            self.FD = self._merge(self.FD, L['occD'], self.D)
            self.FR = self._merge(self.FR, L['occR'], self.R)
        D, R = self._merged()
        self.layer = None
        self.D, self.R = D, R

    # ------------------------------------------------------------ output
    def composite(self):
        D, R = self._merged()
        pal = self.pal
        img = self.paper_rgb * (1 - D[..., None] * (1 - pal['ink']))
        img = img * (1 - pal['red_k'] * R[..., None] * (1 - pal['red'] / np.maximum(self.paper_rgb, 1e-3)).clip(0, 1))
        return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))

    def snap(self, name, dense=True):
        """stage snapshot; dense=True ones only in dense mode. Skipped for non-live groups."""
        if not self.stages_dir or (dense and not self.dense):
            return
        if self.layer is not None and not self.layer['live']:
            return
        save_png(self.composite(), os.path.join(self.stages_dir, f"{self.nstage:03d}_{name.replace(' ', '_')}.png"))
        self.nstage += 1

    def finish(self):
        img = self.composite()
        if self.stages_dir:
            save_png(img, os.path.join(self.stages_dir, f"{self.nstage:03d}_final.png"))
            self.nstage += 1
        return img.convert('RGB')

    def setup_paper(self):
        """finishing pass (always runs): rice paper, re-seeded on its own generator"""
        self.group_rng('finish')
        self.paper(fibers=int(2600 * self.S.W * self.S.H / (1920 * 1080)), tone=self.pal['paper'])

    # ------------------------------------------------------------ local marks
    def blob(self, cx, cy, rx, ry, ink, buf=None, rough=0.35, red=False):
        """soft wash blob computed only in its window (cheap); rough = noise modulation"""
        buf = buf if buf is not None else (self.R if red else self.D)
        H, W = buf.shape
        x0, x1 = int(max(0, cx - 2.6 * rx)), int(min(W, cx + 2.6 * rx + 1))
        y0, y1 = int(max(0, cy - 2.6 * ry)), int(min(H, cy + 2.6 * ry + 1))
        if x1 <= x0 or y1 <= y0:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        a = np.exp(-(((xx - cx) / max(rx, 0.5)) ** 2 + ((yy - cy) / max(ry, 0.5)) ** 2))
        if rough:
            g = self.rng.random((4, 6)).astype(np.float32)
            n = np.asarray(Image.fromarray(g).resize((x1 - x0, y1 - y0), Image.BICUBIC), np.float32)
            a *= np.clip(1 - rough + rough * 2 * n, 0, 1.4)
        sl = buf[y0:y1, x0:x1]
        np.copyto(sl, 1 - (1 - sl) * (1 - np.clip(a * ink, 0, 1)))

    def band_noise(self, scale, octaves, seed):
        """noise2d with a scale given in design px"""
        return self.noise2d(max(2.0, scale * self.s), octaves, seed)


def fill_poly(p, pts, ink, buf=None, soft=0.8, rough=0.25):
    """soft-edged ink fill of a polygon (canvas px), computed in its bounding window"""
    buf = p.D if buf is None else buf
    H, W = buf.shape
    P = np.asarray(pts, np.float32)
    pad = 6
    x0, y0 = int(max(0, P[:, 0].min() - pad)), int(max(0, P[:, 1].min() - pad))
    x1, y1 = int(min(W, P[:, 0].max() + pad + 1)), int(min(H, P[:, 1].max() + pad + 1))
    if x1 <= x0 or y1 <= y0:
        return None
    ss = 2
    im = Image.new('L', ((x1 - x0) * ss, (y1 - y0) * ss), 0)
    ImageDraw.Draw(im).polygon([((x - x0) * ss, (y - y0) * ss) for x, y in P], fill=255)
    m = np.asarray(im.resize((x1 - x0, y1 - y0), Image.BOX), np.float32) / 255
    m = blur(m, soft)
    if rough:
        g = p.rng.random((5, 7)).astype(np.float32)
        n = np.asarray(Image.fromarray(g).resize((x1 - x0, y1 - y0), Image.BICUBIC), np.float32)
        m *= np.clip(1 - rough + rough * 2 * n, 0, 1.3)
    sl = buf[y0:y1, x0:x1]
    if ink < 0:                      # negative ink lifts (paper shows through)
        np.multiply(sl, 1 - np.clip(m * -ink, 0, 1), out=sl)
    else:
        np.copyto(sl, 1 - (1 - sl) * (1 - np.clip(m * ink, 0, 1)))
    return m


# ---------------------------------------------------------------- sumi-e conifer
def conifer(p, x, top, root, ink=0.7, wind=0.0, halo=1.0, snap=None, spread=1.0, bare=None, trunk_w=None):
    """a 写意 conifer: one wavering, broken trunk stroke and irregular tiers of side-brush
    branch strokes (dry, flying-white, uneven lengths, the odd tier missing or lopsided), each
    sitting on a pale wet halo. Coordinates are canvas px; size follows (root - top)."""
    rng, s = p.rng, p.s
    h = root - top
    lean = wind * h * 0.06 + rng.normal(0, h * 0.015)
    tx = top + h * 0.05
    trunk = curve((x, root), (x + lean, tx), rng.normal(0, h * 0.025), 18, wig=s * 1.2,
                  seed=int(rng.integers(1 << 30)))
    tw = trunk_w if trunk_w is not None else s * 1.3 + h * 0.011
    p.stroke(trunk, tw, ink * 0.8, dry=0.55, taper=(0.02, 0.75), jitter=0.8)

    def trunk_x(y):
        return float(np.interp(y, trunk[::-1, 1], trunk[::-1, 0]))

    # irregular tier heights: denser and smaller toward the top
    tiers = []
    y = root - h * (rng.uniform(0.08, 0.16) if bare is None else bare * rng.uniform(0.9, 1.1))
    while y > top + h * 0.12:
        f = (root - y) / h
        tiers.append((y, f))
        y -= (h * 0.075 + s * 3) * rng.uniform(0.6, 1.4) * (1 - 0.4 * f)
    lopside = rng.choice([-1, 1]) * rng.uniform(0.1, 0.35) + wind * 0.4
    for (ty, f) in tiers:
        if 0.25 < f < 0.85 and rng.random() < 0.12:
            continue                                         # a gap where the trunk shows
        cx = trunk_x(ty)
        half = (h * 0.36 * spread * (1 - f) ** 0.95 + s * 5) * rng.uniform(0.75, 1.2)
        if halo:
            p.blob(cx + lopside * half * 0.3, ty + s * 2.5, half * 0.9, s * 3.5 + half * 0.14,
                   0.12 * ink * halo, rough=0.5)
        for side in (-1, 1):
            reach = half * (1 + lopside * side) * rng.uniform(0.65, 1.15)
            if rng.random() < 0.14:
                reach *= rng.uniform(0.3, 0.55)              # broken / missing bough
            nst = int(rng.integers(2, 5)) if f < 0.7 else int(rng.integers(1, 3))
            for k in range(nst):
                ln = reach * rng.uniform(0.55, 1.0)
                if ln < s * 4:
                    continue
                y0 = ty + rng.normal(0, s * 1.5) - k * s * 0.8
                x0 = cx + side * rng.uniform(0, s * 2)
                droop = ln * rng.uniform(0.08, 0.38)
                lift = ln * rng.uniform(-0.02, 0.12)
                pts = spline([(x0, y0), (x0 + side * ln * 0.45, y0 - lift + rng.normal(0, s * 0.8)),
                              (x0 + side * ln, y0 + droop)], 7)
                w = s * rng.uniform(1.8, 3.6) * (0.7 + 0.45 * (1 - f))
                p.stroke(pts, w, ink * rng.uniform(0.5, 0.92), dry=rng.uniform(0.5, 0.78),
                         taper=(0.05, rng.uniform(0.7, 0.95)), jitter=1.1)
            # needle flicks hanging under the bough
            for k in range(int(rng.integers(1, 4))):
                t = rng.uniform(0.3, 0.95)
                qx, qy = cx + side * reach * t, ty + reach * t * 0.15 + rng.uniform(-s, s * 2)
                p.stroke([(qx, qy - s), (qx + side * s * rng.uniform(1, 4), qy + s * rng.uniform(2.5, 6))],
                         s * rng.uniform(1.4, 2.4), ink * rng.uniform(0.5, 0.8), dry=0.55, taper=(0.1, 0.7))
    # leader: a thin tapering tick with one or two short shoots below the tip
    lx = trunk_x(top + h * 0.14)
    p.stroke([(lx, top + h * 0.16), (x + lean + rng.normal(0, s), top)], s * 1.5, ink * 0.85, dry=0.45, taper=(0.05, 0.9))
    for side in (-1, 1):
        if rng.random() < 0.7:
            yy = top + h * rng.uniform(0.09, 0.15)
            p.stroke([(lx, yy), (lx + side * s * rng.uniform(4, 8), yy + s * rng.uniform(1, 3.5))],
                     s * 1.6, ink * 0.7, dry=0.55, taper=(0.05, 0.8))
    if snap:
        snap()


def bird(p, bx, by, sc, ink=0.75, width=None):
    """two-stroke flying bird (canvas px, sc = size multiplier incl. scale)"""
    w = width or p.s * 2.0
    p.stroke(curve((bx - 15 * sc, by), (bx, by + 2 * sc), -7 * sc, 8), w, ink, dry=0.2)
    p.stroke(curve((bx, by + 2 * sc), (bx + 15 * sc, by - 2 * sc), -7 * sc, 8), w, ink, dry=0.2)


def depth_mask(p, ridge, hz=None, soft=6.0):
    """occlusion for a wash under `ridge` (0..0.97 like inkpaint.wash), optionally cut at a waterline"""
    depth = p.YY - ridge[None, :]
    occ = 0.97 * np.clip((depth + 1) / soft, 0, 1)
    if hz is not None:
        occ = occ * (1 - np.clip((p.YY - hz) / max(1.0, 3 * p.s), 0, 1))
    return occ.astype(np.float32)
