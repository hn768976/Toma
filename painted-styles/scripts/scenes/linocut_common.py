"""Shared bits for the Linocut scenes (lake / coast / forest): the print subclass with a calmer baren,
the two colourways, design-space helpers and the stage recorder."""
import os

import numpy as np
from PIL import Image, ImageFilter

import drawkit
from drawkit import save_png
from linocut import Linocut, _resample
from core import blur, noise2d, smoothstep, shift

STYLE = "Linocut · 黑白麻胶版画"
COLOURWAYS = ("Vermilion", "Indigo")

# the second (spot-colour) block: how its ink looks printed on the cream sheet
INKS = {
    'Vermilion': dict(ink='#e0845a', mottle=0.25),     # Phase 1: dusk rose-orange / vermilion
    'Indigo': dict(ink='#7189b8', mottle=0.22),        # a soft cool indigo: a daytime print
}


class Lino(Linocut):
    """Linocut with a gentler hand-burnished pull: Phase 1's big blacks showed large low-pressure patches
    (grainy grey blotches) that read as artefacts; here the baren's pressure varies only a little, so the
    blacks keep a fine salty ink texture without blotches."""

    def _print_fields(self, blk):
        if hasattr(blk, 'film'): return
        H, W = self.H, self.W
        r = np.random.default_rng(blk.seed)
        film = 1 + 0.045 * (noise2d(H, W, 260, 3, int(r.integers(1 << 30))) - 0.5) * 2
        yy = np.arange(H, dtype=np.float32)[:, None]
        for _ in range(4):                                                    # faint brayer stop-lines
            y0 = r.uniform(self.box[1], self.box[3]); wd = r.uniform(2, 6)
            band = np.exp(-((yy - y0) / wd) ** 2) * r.uniform(0.03, 0.06)
            fade = 0.5 + 0.5 * noise2d(1, W, 300, 2, int(r.integers(1 << 30)))[0][None, :]
            film = film - band * fade
        h4, w4 = max(4, H // 4), max(4, W // 4)
        acc = np.zeros((h4, w4), np.float32)
        x0, y0, x1, y1 = [v / 4 for v in self.box]
        for _ in range(900):
            cx, cy, rad = r.uniform(x0, x1), r.uniform(y0, y1), r.uniform(5, 16)
            t = np.linspace(0, 2 * np.pi * r.uniform(0.6, 1.0), 40) + r.uniform(0, 6.3)
            xs = np.clip((cx + np.cos(t) * rad).astype(int), 0, w4 - 1); ys = np.clip((cy + np.sin(t) * rad).astype(int), 0, h4 - 1)
            np.add.at(acc, (ys, xs), 1.0)
        acc = blur(acc, 1.6); acc = acc / (acc.mean() + 1e-6)
        acc = np.asarray(Image.fromarray(acc).resize((W, H), Image.BILINEAR))
        patch = noise2d(H, W, 380, 2, int(r.integers(1 << 30)))
        press = 1 + 0.03 * np.clip(acc - 1, -1.5, 1.5) - 0.06 * smoothstep(0.6, 0.95, patch)
        blk.film, blk.press = film.astype(np.float32), press.astype(np.float32)


    def _coverage(self, blk):
        cov, m = super()._coverage(blk)
        if blk is not self.key:
            # edge crumble alone must not print faint specks where the colour block was cleared, so an empty
            # colour block prints exactly like a skipped one
            a = Image.fromarray(blk.a).resize((self.W, self.H), Image.BOX).filter(ImageFilter.MaxFilter(5))
            near = np.asarray(a) > 0
            if blk.offset != (0, 0): near = shift(near.astype(np.float32), *blk.offset) > 0.5
            cov = cov * near
        return cov, m


def make_print(S, seed, colourway):
    """the sheet and its two blocks; the lino is larger than the canvas (full bleed, no rim, no margin)"""
    if colourway not in INKS:
        raise ValueError(f"colourway must be one of {COLOURWAYS}")
    pad = int(round(S(40)))
    L = Lino(S.W, S.H, block=(-pad, -pad, S.W + pad, S.H + pad), seed=seed)
    c = INKS[colourway]
    col = L.colour_block(c['ink'], offset=(int(round(S(4))), int(round(-S(3)))), mottle=c['mottle'])
    return L, col


class D:
    """design-space helpers on top of drawkit.Scaler (lib calls take canvas px)"""
    def __init__(self, S):
        self.S = S

    def ux(self, px):
        return (px - self.S.ox) / self.S.s

    def uy(self, py):
        return (py - self.S.oy) / self.S.s

    def fn(self, f):
        """wrap f(design_x, design_y) as a density/bend callback in canvas px"""
        return lambda x, y: f(self.ux(x), self.uy(y))

    def band(self, f, a, b, axis='y'):
        """f gated to design a <= y < b (or x): split one hatch into stages without overlap"""
        if axis == 'y':
            return lambda x, y: f(self.ux(x), self.uy(y)) * (a <= self.uy(y) < b)
        return lambda x, y: f(self.ux(x), self.uy(y)) * (a <= self.ux(x) < b)


def mstroke(L, S, pts, w, tool='brush', end=None, jitter=0.12, smooth=True, taper=None):
    """stroke polygon from design-space points"""
    return L.stroke(S.pts(pts), S(w), tool, taper=taper, end=None if end is None else S(end), jitter=jitter,
                    smooth=smooth)


class Stager:
    """records stages (dense or per group) and writes them as NNN_name.png, last one == final"""
    def __init__(self, L, stages_dir, dense):
        self.L, self.dir, self.dense, self.frames = L, stages_dir, dense, []

    def __call__(self, name, major=False):
        if self.dir and (self.dense != major):
            self.frames.append((name, self.L.pull()))

    def finish(self, img):
        if not self.dir: return
        os.makedirs(self.dir, exist_ok=True)
        fr = self.frames
        if fr and np.array_equal(np.asarray(fr[-1][1]), np.asarray(img)):
            fr = fr[:-1]
        fr = fr + [('final', img)]
        for i, (name, im) in enumerate(fr):
            save_png(im, os.path.join(self.dir, f"{i:03d}_{name.replace(' ', '_')}.png"))


def resample(P, step):
    return _resample(P, step)[0]
