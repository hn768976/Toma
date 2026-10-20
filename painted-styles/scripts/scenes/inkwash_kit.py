"""Shared machinery for the Ink wash (水墨) scenes — inkwash_lake / inkwash_coast / inkwash_forest.

Built on vendor lib/inkpaint.py `Painting`:
- colourways (ink / accent / paper colours) via an overridden composite(); the ink colour follows
  its dilution (thin washes greyer/cooler, loaded strokes deep), and xuan paper fibre takes up
  more ink than the paper between fibres, so washes show the fibre;
- layer groups: each group paints into fresh D/R buffers and is merged onto the stack with an
  explicit occlusion mask, so a group's effect (ink it lays, ink it lifts or covers) stays inside
  its own footprint. A second "full" stack keeps every pre-water group even when it is not
  included, so the water can reflect mountains/pines that were skipped.
- staged snapshots written straight to disk as NNN_name.png;
- marks made the way ink makes them: layered glazes with ragged, breathing edges, tide lines
  where a wash dried, blooms, dry-brush starvation (飞白), broad side-brush strokes, texture
  strokes (皴) and moss dots (苔点) placed by the form, and trees/birds that differ every time.
"""
import os

import numpy as np
from PIL import Image, ImageDraw

import drawkit
from drawkit import save_png
from inkpaint import Painting, PAPER, INK, VERMILION, spline, curve, blur, fbm1d

STYLE = "Ink wash · 水墨"
COLOURWAYS = ("BlackInk", "Indigo")

PALETTES = {
    # Phase 1 look: carbon ink (thin washes a little warm-grey), vermilion dusk tint, warm rice paper
    "BlackInk": dict(ink=INK, thin=np.array([66, 62, 60], np.float32) / 255,
                     deep=np.array([16, 15, 15], np.float32) / 255,
                     red=VERMILION, red_k=1.0, paper=PAPER),
    # indigo: dilute indigo goes grey-teal, loaded indigo goes almost black-blue — never one flat tint
    "Indigo": dict(ink=np.array([30, 46, 92], np.float32) / 255,
                   thin=np.array([86, 106, 122], np.float32) / 255,
                   deep=np.array([16, 22, 46], np.float32) / 255,
                   red=np.array([196, 142, 78], np.float32) / 255, red_k=0.75,
                   paper=np.array([241, 238, 229], np.float32) / 255),
}

FOOT_THR = 1.0 / 4096      # density below this cannot change an 8-bit pixel


# ---------------------------------------------------------------- window-local value noise
def _vsample(g, gy, gx):
    ny, nx = g.shape
    gy = np.clip(gy, 0, ny - 2.001); gx = np.clip(gx, 0, nx - 2.001)
    iy = gy.astype(np.int32); ix = gx.astype(np.int32)
    fy = gy - iy; fx = gx - ix
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = g[iy, ix]; b = g[iy, ix + 1]; c = g[iy + 1, ix]; d = g[iy + 1, ix + 1]
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy


def vnz(rng, Y, X, sy, sx, octaves=2, gain=0.5):
    """z-scored value-noise fbm at pixel coords (Y, X) with cell size sy x sx px (anisotropic)"""
    Y = np.asarray(Y, np.float32); X = np.asarray(X, np.float32)
    y0, x0 = float(Y.min()), float(X.min())
    out = np.zeros(np.broadcast(Y, X).shape, np.float32); amp = 1.0
    for o in range(octaves):
        f = 2 ** o
        gy = (Y - y0) / max(sy, 1e-3) * f; gx = (X - x0) / max(sx, 1e-3) * f
        g = rng.random((int(gy.max()) + 4, int(gx.max()) + 4)).astype(np.float32)
        out += amp * _vsample(g, gy, gx); amp *= gain
    return (out - out.mean()) / (out.std() + 1e-6)


def smooth1d(a, sigma):
    if sigma < 0.5:
        return a.astype(np.float32)
    r = int(3 * sigma)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
    return np.convolve(np.pad(a, r, mode='edge'), k, mode='valid').astype(np.float32)


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def over(buf, a):
    np.copyto(buf, 1 - (1 - buf) * (1 - np.clip(a, 0, 1)))


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
        self.absorb = None
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

    # ------------------------------------------------------------ paper (finishing pass)
    def paper(self, fibers=None, tone=PAPER):
        """xuan paper: warm mottled ground, long curly fibres (some darker, some bleached), and an
        absorbency map — ink soaks further into fibres and fibre clumps, so washes show them."""
        H, W, rng, s = self.H, self.W, self.rng, self.s
        area = W * H / (1920 * 1080)
        p = np.ones((H, W, 3), np.float32) * np.asarray(tone, np.float32)
        p *= (0.968 + 0.045 * self.noise2d(260 * s, 5, 1))[..., None]
        p *= (1 + 0.010 * blur(rng.normal(0, 1, (H, W)).astype(np.float32), 0.6))[..., None]
        clump = self.noise2d(max(4.0, 34 * s), 4, 2)             # cloud-like fibre density of hand-made xuan
        lw = max(1, int(round(s * 1.1)))
        fib = Image.new('L', (W, H), 0); fd = ImageDraw.Draw(fib)
        lit = Image.new('L', (W, H), 0); ld = ImageDraw.Draw(lit)
        nf = int((fibers if fibers is not None else 7800) * area)
        for i in range(nf):
            x, y = rng.uniform(0, W), rng.uniform(0, H)
            ang = rng.uniform(0, np.pi)
            ln = s * (rng.uniform(8, 40) if rng.random() < 0.96 else rng.uniform(40, 90))
            curl = rng.uniform(0.03, 0.3); ph = rng.uniform(0, 6.3)
            tt = np.linspace(0, ln, 9)
            a = ang + curl * np.sin(tt / max(ln, 1) * rng.uniform(1.5, 4) + ph)
            pts = list(zip(x + np.cumsum(np.cos(a)) * ln / 9, y + np.cumsum(np.sin(a)) * ln / 9))
            vk = min(1.0, 1.3 * s)
            if rng.random() < 0.22:
                ld.line(pts, fill=int(rng.uniform(40, 110) * vk), width=lw)
            else:
                fd.line(pts, fill=int(rng.uniform(25, 120) * vk), width=lw)
        f = blur(np.asarray(fib, np.float32) / 255, 0.45 * max(s, 0.6))
        l = blur(np.asarray(lit, np.float32) / 255, 0.45 * max(s, 0.6))
        p *= (1 - 0.055 * f - 0.018 * clump)[..., None]
        p = p + (1 - p) * (0.22 * l)[..., None]
        self.paper_rgb = p
        self.absorb = ((1 + 0.25 * f - 0.35 * l) * (0.90 + 0.20 * clump)).astype(np.float32)

    # ------------------------------------------------------------ output
    def composite(self):
        D, R = self._merged()
        pal = self.pal
        if self.absorb is not None:
            # fibres show in thin washes; under a loaded stroke the ink fills them (no scratch/craquelure)
            D = np.clip(D * (1 + (self.absorb - 1) * (1 - D) ** 2), 0, 1)
            R = np.clip(R * (1 + (self.absorb - 1) * (1 - R) ** 2), 0, 1)
        k1 = np.clip((D - 0.06) / 0.55, 0, 1)[..., None]
        k2 = np.clip((D - 0.62) / 0.33, 0, 1)[..., None]
        ink = pal['thin'] + (pal['ink'] - pal['thin']) * k1
        ink = ink + (pal['deep'] - ink) * k2
        img = self.paper_rgb * (1 - D[..., None] * (1 - ink))
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
        self.paper(tone=self.pal['paper'])

    def sd(self):
        return int(self.rng.integers(1 << 30))

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

    def wet_dot(self, cx, cy, r, ink, squash=1.0, rot=0.0, buf=None, red=False, irr=1.0):
        """a wet ink dot: irregular outline, darker pooled rim where it dried, soft feathered edge"""
        rng, s = self.rng, self.s
        buf = buf if buf is not None else (self.R if red else self.D)
        H, W = buf.shape
        R_ = r * 1.6 + 2
        x0, x1 = int(max(0, cx - R_)), int(min(W, cx + R_ + 1))
        y0, y1 = int(max(0, cy - R_)), int(min(H, cy + R_ + 1))
        if x1 <= x0 or y1 <= y0:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        dx, dy = xx - cx, yy - cy
        c, sn = np.cos(rot), np.sin(rot)
        u, v = dx * c + dy * sn, (-dx * sn + dy * c) * squash
        th = np.arctan2(v, u)
        ph = rng.uniform(0, 6.3, 3)
        rr = r * (1 + irr * (0.16 * np.sin(2 * th + ph[0]) + 0.10 * np.sin(3 * th + ph[1]) + 0.06 * np.sin(5 * th + ph[2])))
        q = np.hypot(u, v) / np.maximum(rr, 0.3)
        edge = np.clip((1 - q) * r / (0.5 * s + 0.35), 0, 1)
        rim = np.exp(-((1 - q) * r / (0.9 * s + 0.4)) ** 2) * rng.uniform(0.15, 0.5)
        a = ink * edge * (0.78 + 0.22 * rng.random() + rim)
        sl = buf[y0:y1, x0:x1]
        np.copyto(sl, 1 - (1 - sl) * (1 - np.clip(a, 0, 1)))

    def band_noise(self, scale, octaves, seed):
        """noise2d with a scale given in design px"""
        return self.noise2d(max(2.0, scale * self.s), octaves, seed)


# ---------------------------------------------------------------- broad brush and washes
def broad_stroke(p, pts, width, ink, dry=0.4, taper=(0.15, 0.3), side=0.0, pool=0.35, hair=1.0,
                 rough=1.0, buf=None, red=False, grow=(1.0, 1.0), maxseg=90, swell=0.0, pv=0.10, skip=1.0):
    """a loaded broad brush (side brush / 侧锋) along `pts` (canvas px), computed in its window:
    hairs that run out (飞白) as the load is spent, a ragged edge, ink pooling at the edges,
    `side` > 0 darkens the right-hand side of the stroke (ink-heavy side of the brush).
    swell: the brush is pressed down mid-stroke (belly) and lifted at the ends; pv: the hand's
    pressure wanders along the stroke, so the two edges are never parallel; skip: the dry hairs
    break in bursts where the brush skipped over the paper, not as evenly spaced streaks."""
    rng, s = p.rng, p.s
    buf = buf if buf is not None else (p.R if red else p.D)
    H, W = buf.shape
    P = np.asarray(pts, np.float32)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)]); L = float(cum[-1])
    if L < 1:
        return
    hw = width / 2
    nseg = int(np.clip(L / max(2.0, width * 0.5), 2, maxseg))
    ss = np.linspace(0, L, nseg + 1)
    Q = np.stack([np.interp(ss, cum, P[:, 0]), np.interp(ss, cum, P[:, 1])], 1)
    pad = hw * 1.5 + 3
    x0, x1 = int(max(0, Q[:, 0].min() - pad)), int(min(W, Q[:, 0].max() + pad + 1))
    y0, y1 = int(max(0, Q[:, 1].min() - pad)), int(min(H, Q[:, 1].max() + pad + 1))
    if x1 <= x0 + 1 or y1 <= y0 + 1:
        return
    Y, X = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    best = np.full(Y.shape, np.inf, np.float32)
    U = np.zeros_like(Y); V = np.zeros_like(Y)
    for i in range(nseg):
        a0, a1 = Q[i]; ab0, ab1 = Q[i + 1] - Q[i]
        l2 = ab0 * ab0 + ab1 * ab1 + 1e-6
        t = np.clip(((X - a0) * ab0 + (Y - a1) * ab1) / l2, 0, 1)
        dx = X - (a0 + t * ab0); dy = Y - (a1 + t * ab1)
        d2 = dx * dx + dy * dy
        m = d2 < best
        best = np.where(m, d2, best)
        U = np.where(m, ss[i] + t * (ss[i + 1] - ss[i]), U)
        V = np.where(m, np.sign(ab0 * dy - ab1 * dx + 1e-6), V)
    dist = np.sqrt(best)
    near = dist < hw * 1.4 + 2
    if not near.any():
        return
    across = V * dist
    v = across / max(hw, 0.5)
    t = U / L
    press = 0.3 + 0.7 * np.clip(np.minimum(t / max(taper[0], 1e-3), (1 - t) / max(taper[1], 1e-3)), 0, 1) ** 0.6
    press = press * (grow[0] + (grow[1] - grow[0]) * t)
    if swell or pv:
        pr = 1 + swell * (np.sin(np.pi * np.clip(t, 0, 1)) ** 1.4 - 0.45)
        if pv:
            pr = pr * (1 + pv * vnz(rng, U, U * 0, max(10 * s, L / 5), 1, 2))
        press = np.clip(press * pr, 0.12, 1.3)
    ez = vnz(rng, U, V * 1000 + across * 0, max(4 * s, min(hw * 1.2, 40 * s)), 400, 2)  # each side its own ragged edge
    edge = np.clip((press - np.abs(v) + 0.10 * rough * ez * min(1.0, 6 * s / max(hw, 1e-3) + 0.3)) * hw / (0.6 * s + 0.45), 0, 1)
    nh = float(np.clip(width / (2.2 * s + 0.6), 3, 32))
    # hair noise: two hair sizes and a sideways drift of the hairs, so the white lines of a dry
    # stroke are unevenly spaced, merge and split, instead of a regular comb
    drift = vnz(rng, U, U * 0, max(20 * s, L / 3), 1, 2) * hw * 0.25
    hz = 0.75 * vnz(rng, U, across + drift, max(14 * s, width * 1.5, L / 12), max(0.9, width / nh), 3) \
        + 0.45 * vnz(rng, U, across - drift, max(8 * s, width * 0.7, L / 20), max(1.4, 2.7 * width / nh), 2)
    an = vnz(rng, U, U * 0, max(30 * s, L / 4), 1, 1)
    load = 1 - dry * t ** 1.15 * (0.8 + 0.25 * an)
    thr = -2.3 + 3.4 * (1 - load) * hair
    if skip and dry > 0.05:
        bz = vnz(rng, U, across * 0.2, max(9 * s, L / 9), max(hw, 1.0) * 1.8, 2)
        thr = thr + 1.8 * skip * dry * sstep(0.35, 1.3, bz) - 0.5 * skip * dry * sstep(0.0, -1.2, bz)
        if side:                     # the hairs run dry first on the side that carries less ink
            thr = thr + 1.2 * dry * min(1.0, abs(side)) * np.clip(-v * np.sign(side), 0, 1) ** 1.5
    alive = sstep(thr - 0.35, thr + 0.35, hz)
    sidew = np.clip(1 + side * v, 0, 2) if side else 1.0
    tone = (1 + side * v * 0.4) * (1 + pool * sidew * np.exp(-((press - np.abs(v)) * hw / (1.1 * s + 0.5)) ** 2))
    a = ink * edge * alive * tone * (0.72 + 0.28 * load)
    a *= near
    sl = buf[y0:y1, x0:x1]
    np.copyto(sl, 1 - (1 - sl) * (1 - np.clip(a, 0, 1)))


def fibre_bleed(p, y0, y1, x0, x1, reach):
    """px offset an edge gains where ink creeps along the paper's fibres (> 0 along ink-taking
    fibres and clumps, < 0 where bleached fibres repel it)"""
    if p.absorb is None:
        return 0.0
    return (p.absorb[y0:y1, x0:x1] - 1.0) * reach


def wash_field(p, y0, y1, x0, x1, f, dens, soft, pool=0.4, gran=0.05, buf=None, red=False, hard=None, ramp=None,
               body=0.18, org=(0, 0)):
    """pale wet wash over window [y0:y1, x0:x1] from a field f (px, > 0 inside). The wash is laid
    flat and stops at a ragged edge: `soft` sets how far the edge wanders (wet spreading), `ramp`
    how wide the actual fade is (a few px: a wash never fades as a smooth airbrush ramp). The
    edge creeps along paper fibres, dries to a tide line in places, and the pigment settles
    unevenly inside (`body`). Returns the alpha laid."""
    rng, s = p.rng, p.s
    buf = buf if buf is not None else (p.R if red else p.D)
    ramp = max(1.5 * s, min(soft, 0.12 * soft + 3 * s)) if ramp is None else ramp
    Y, X = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    n1 = vnz(rng, Y, X, max(6 * s, soft * 0.9), max(9 * s, soft * 1.6), 3)
    n3 = vnz(rng, Y, X, max(4 * s, soft * 0.25), max(5 * s, soft * 0.4), 2)
    n2 = vnz(rng, Y, X, 2.5 * s, 4 * s, 2)
    fq = f + n1 * soft * 0.45 + n3 * soft * 0.12 + n2 * 1.6 * s + fibre_bleed(p, y0 + org[0], y1 + org[0], x0 + org[1], x1 + org[1], 9 * s)
    a = np.clip(fq / ramp, 0, 1)
    if body:
        a = a * np.clip(1 - body + body * (0.5 + 0.5 * vnz(rng, Y, X, max(20 * s, soft * 1.2), max(30 * s, soft * 2), 2)), 0, 1.2)
    if pool:
        hd = np.clip(0.5 + 0.6 * vnz(rng, Y, X, 70 * s, 110 * s, 2), 0, 1) if hard is None else hard
        a = a * (1 + pool * hd * np.exp(-(np.clip(fq, 0, None) / (1.4 * s + 0.4)) ** 2)) * (fq > -0.5 * s)
    if gran:
        a = a * (1 + gran * vnz(rng, Y, X, 2.2 * s, 2.2 * s, 1))
    a = np.clip(a * dens, 0, 1)
    sl = buf[y0:y1, x0:x1]
    np.copyto(sl, 1 - (1 - sl) * (1 - a))
    return a


def ink_mass(p, ridge, dens=0.4, reach=200, glazes=3, soft=1.0, pool=0.45, blooms=2, dry=0.35,
             floor=None, mist=None, buf=None, fall=1.0):
    """a mountain painted as ink is painted: 2–4 overlapping glazes whose lower edges are ragged
    (dissolving where wet, a darker tide line where they dried), ink pooling unevenly along the
    crest, dry-brush streaks down the fall line, a few blooms (水渍), and an optional reserved band
    of bare paper for mist. ridge: y(x) canvas px for every column. Returns the silhouette cover
    (full-size, 0..1) for occlusion."""
    rng, s = p.rng, p.s
    H, W = p.H, p.W
    buf = p.D if buf is None else buf
    top = ridge + fbm1d(W, 7 * s, 3, p.sd()) * 1.8 * s + fbm1d(W, 30 * s, 3, p.sd()) * 2.5 * s
    ymax = float(np.max(top)) + reach * 1.9
    if floor is not None:
        ymax = min(ymax, floor + 2)
    y0 = int(max(0, np.floor(top.min()) - 8)); y1 = int(min(H, np.ceil(ymax) + 1))
    cover = np.zeros((H, W), np.float32)
    if y1 <= y0:
        return cover
    Y, X = np.mgrid[y0:y1, 0:W].astype(np.float32)
    d = Y - top[None, :]
    # breathing silhouette: crisp where the brush was drier, feathered into the fibre where wet
    sft = ((0.45 + 2.8 * np.clip(0.5 + fbm1d(W, 110 * s, 3, p.sd()), 0, 1) ** 2) * s * soft + 0.35)[None, :]
    fz = vnz(rng, Y, X, 3.0 * s, 4.0 * s, 2)
    e = np.clip((d + fz * sft * 0.45) / sft + 0.5, 0, 1)
    if floor is not None:
        e *= np.clip((floor - Y) / (1.2 * s + 0.4), 0, 1)
    a = np.zeros_like(Y)
    gn = vnz(rng, Y, X, 20 * s, 34 * s, 3)
    gm = vnz(rng, Y, X, 7 * s, 10 * s, 2)
    gh = vnz(rng, Y, X, 3 * s, 5 * s, 2)
    fb = fibre_bleed(p, y0, y1, 0, W, 8 * s)
    for k in range(glazes):
        f = k / max(1, glazes - 1)                                      # 0 broad pale ... 1 narrow dark
        rk = reach * (1.45 - 1.1 * f) * (0.62 + 0.65 * np.clip(0.5 + fbm1d(W, (190 - 70 * f) * s, 3, p.sd()), 0, 1))
        sk = s * (2.5 + 20 * soft * np.clip(0.6 + 0.9 * fbm1d(W, 150 * s, 3, p.sd()), 0, 1) ** 1.5)
        rr, skk = rk[None, :], sk[None, :]
        q = (rr - d + gn * 9 * s + gm * 3 * s + gh * 1.4 * s + fb) / skk
        g = np.clip(q, 0, 1) * (1 - 0.3 * np.clip(d / rr, 0, 1))
        hard = np.clip(1 - (sk - 2.5 * s) / (12 * s), 0, 1)[None, :]
        tide = np.exp(-((rr - d + gn * 2.5 * s + gh * 1.0 * s) / (1.3 * s + 0.4)) ** 2) * hard * (d > 0)
        dk = dens * (0.38 + 0.3 * f) * (0.85 + 0.3 * rng.random())
        a = 1 - (1 - a) * (1 - np.clip(dk * (g + pool * 0.9 * tide), 0, 1))
    crest = np.exp(-(np.clip(d, 0, None) / (2.0 * s + 0.5)) ** 1.4) * np.clip(0.35 + 0.9 * fbm1d(W, 45 * s, 3, p.sd()), 0, 1)[None, :]
    a = 1 - (1 - a) * (1 - np.clip(dens * pool * 1.3 * crest, 0, 1))
    # dry-brush streaks running down the fall line of the slope
    sl = np.gradient(smooth1d(ridge, 28 * s))
    c = (-np.sign(sl) * np.clip(np.abs(sl) * 2.2, 0.55, 1.8) * fall)[None, :]
    st = vnz(rng, d, X + c * d, 20 * s, 3.5 * s, 2) + 0.8 * vnz(rng, Y, X, 40 * s, 60 * s, 2)
    fw = sstep(0.7, 1.9, st) * dry * np.exp(-np.clip(d, 0, None) / (reach * 0.22))
    a *= 1 - fw
    a *= np.clip(1 + 0.06 * vnz(rng, Y, X, 1.7 * s, 1.7 * s, 1), 0, 2)
    # blooms: a lighter pool with a dark cauliflower rim where a wetter touch crept back
    for _ in range(blooms):
        for _try in range(12):
            bx = rng.uniform(0, W)
            xi = int(np.clip(bx, 0, W - 1))
            by = top[xi] + rng.uniform(0.12, 0.7) * reach
            if (floor is None or by < floor - 10 * s) and y0 + 4 < by < y1 - 4:
                break
        r = rng.uniform(16, 55) * s
        bx0, bx1 = int(max(0, bx - 1.5 * r)), int(min(W, bx + 1.5 * r + 1))
        by0, by1 = int(max(y0, by - 1.5 * r)), int(min(y1, by + 1.5 * r + 1))
        if bx1 <= bx0 or by1 <= by0:
            continue
        yy, xx = Y[by0 - y0:by1 - y0, bx0:bx1], X[by0 - y0:by1 - y0, bx0:bx1]
        th = np.arctan2((yy - by) * 1.5, xx - bx)
        ph = rng.uniform(0, 6.3, 4)
        rad = r * (1 + 0.14 * np.sin(3 * th + ph[0]) + 0.1 * np.sin(5 * th + ph[1]) + 0.06 * np.sin(9 * th + ph[2])
                   + 0.04 * np.sin(14 * th + ph[3]))
        q = np.hypot(xx - bx, (yy - by) * 1.5) / rad + 0.09 * vnz(rng, yy, xx, 3 * s, 3 * s, 3)
        sub = a[by0 - y0:by1 - y0, bx0:bx1]
        sub *= 1 - 0.45 * np.clip(1 - q, 0, 1) ** 0.6
        rim = np.exp(-((q - 1) / 0.035) ** 2) * np.clip(0.5 + 0.6 * vnz(rng, yy, xx, 9 * s, 9 * s, 2), 0, 1)
        np.copyto(sub, 1 - (1 - sub) * (1 - np.clip(dens * 0.25 * rim * (sub > 0.01), 0, 1)))
    if mist is not None:
        yc, hh = mist
        wob = fbm1d(W, 320 * s, 3, p.sd()) * hh * 0.9
        half = hh * (0.35 + 1.0 * np.clip(0.5 + fbm1d(W, 230 * s, 3, p.sd()), 0, 1))
        mz = vnz(rng, Y, X, 7 * s, 45 * s, 4)
        r_ = np.clip((half[None, :] - np.abs(Y - yc - wob[None, :]) + mz * hh * 0.45 + fb) / (3 * s + 1), 0, 1)
        a *= 1 - 0.97 * r_
    a *= e
    np.copyto(buf[y0:y1], 1 - (1 - buf[y0:y1]) * (1 - np.clip(a, 0, 1)))
    cover[y0:y1] = e
    return cover


# ---------------------------------------------------------------- texture strokes, moss dots, accents
def cun(p, ridge, x0, x1, n=40, shadow_x=None, reach=90, ink=0.25, floor=None, shadow_left=True, long_frac=0.25):
    """texture strokes (皴) in clusters that sit in the folds, run down the fall line of the slope,
    denser and darker on the shadow side; every stroke differs in length, weight, dryness."""
    rng, s, W = p.rng, p.s, p.W
    sl = np.gradient(smooth1d(ridge, 25 * s))
    sx = shadow_x if shadow_x is not None else (x0 + x1) / 2
    made = 0
    while made < n:
        for _ in range(40):
            cx = rng.uniform(x0, x1)
            xi = int(np.clip(cx, 0, W - 1))
            shade = (cx < sx) == shadow_left
            if rng.random() < (0.8 if shade else 0.28) * (0.25 + min(1.0, abs(sl[xi]) * 2.2)):
                break
        k = int(rng.integers(2, 8))
        dirx = -np.sign(sl[xi]) if abs(sl[xi]) > 0.04 else rng.choice([-1, 1])
        steep = np.clip(abs(sl[xi]) * 1.2, 0.2, 1.5)
        longc = rng.random() < long_frac
        base_len = (rng.uniform(55, 140) if longc else rng.uniform(14, 60)) * s
        sp = rng.uniform(2.5, 9) * s
        d0 = abs(rng.normal(0, reach * 0.3)) + 2 * s
        for j in range(k):
            x = cx + (j - k / 2) * sp * rng.uniform(0.5, 1.7)
            xj = int(np.clip(x, 0, W - 1))
            y = ridge[xj] + d0 + rng.normal(0, 4 * s) + j * rng.uniform(-1, 3) * s
            y = max(y, ridge[xj] + 1.5 * s)
            if floor is not None and y > floor - 6 * s:
                continue
            ln = base_len * rng.uniform(0.45, 1.2) * (1 - 0.45 * np.clip((y - ridge[xj]) / max(reach, 1), 0, 1))
            dv = np.array([dirx * steep * rng.uniform(0.7, 1.2), 1.0]); dv /= np.linalg.norm(dv)
            bow = rng.normal(0, 0.12) * ln
            nrm = np.array([-dv[1], dv[0]])
            pts = np.array([(x, y), (x + dv[0] * ln * 0.5 + nrm[0] * bow, y + dv[1] * ln * 0.5 + nrm[1] * bow),
                            (x + dv[0] * ln, y + dv[1] * ln)], np.float32)
            pts = spline(pts, 6)
            if floor is not None:
                pts = pts[pts[:, 1] < floor - 3 * s]
                if len(pts) < 3:
                    continue
            depthf = np.exp(-(y - ridge[xj]) / max(reach * 1.3, 1))
            ik = ink * (1.0 if (x < sx) == shadow_left else 0.5) * rng.uniform(0.55, 1.25) * depthf
            w = s * (rng.uniform(2.2, 4.5) if longc and rng.random() < 0.3 else rng.uniform(0.9, 3.2))
            p.stroke(pts, w, ik, dry=rng.uniform(0.5, 0.88), taper=(rng.uniform(0.04, 0.3), rng.uniform(0.25, 0.75)),
                     jitter=rng.uniform(0.4, 1.3))
            made += 1


def dian(p, ridge, x0, x1, clusters=6, ink=0.7, depth=12, floor=None, kinds=('round', 'tick', 'vert', 'flat')):
    """moss dots (苔点) gathered in small groups on knolls and shoulders of the crest — sizes,
    shapes, spacing and ink vary; never a scatter."""
    rng, s, W = p.rng, p.s, p.W
    r_s = smooth1d(ridge, 12 * s)
    lo, hi = int(max(1, x0)), int(min(W - 2, x1))
    cand = [x for x in range(lo, hi) if r_s[x] <= r_s[x - 1] and r_s[x] <= r_s[x + 1]]
    for c in range(clusters):
        if cand and rng.random() < 0.7:
            cx = cand[int(rng.integers(len(cand)))] + rng.normal(0, 25 * s)
        else:
            cx = rng.uniform(x0, x1)
        kind = kinds[int(rng.integers(len(kinds)))]
        k = int(rng.integers(2, 10))
        spread = rng.uniform(5, 22) * s
        big = rng.uniform(0.8, 1.5)
        for j in range(k):
            x = cx + rng.normal(0, spread)
            xi = int(np.clip(x, 0, W - 1))
            y = ridge[xi] + abs(rng.normal(0, depth * s * 0.45)) + 1.2 * s
            if floor is not None and y > floor - 3 * s:
                continue
            r = s * rng.uniform(1.1, 3.0) * big
            ik = ink * rng.uniform(0.5, 1.05)
            if kind == 'round':
                p.wet_dot(x, y, r, ik, squash=rng.uniform(0.9, 1.8), rot=rng.uniform(-0.5, 0.5))
            elif kind == 'flat':
                p.wet_dot(x, y, r * 1.3, ik, squash=rng.uniform(1.8, 3.0), rot=rng.uniform(-0.3, 0.3))
            else:
                ang = (rng.uniform(-0.5, 0.5) if kind == 'tick' else np.pi / 2 + rng.uniform(-0.35, 0.35))
                ln = r * rng.uniform(1.8, 3.5)
                ca, sa = np.cos(ang) * ln / 2, np.sin(ang) * ln / 2
                p.stroke([(x - ca, y - sa), (x + ca, y + sa)], r * rng.uniform(1.0, 1.6), ik, dry=rng.uniform(0.1, 0.5),
                         taper=(rng.uniform(0.05, 0.3), rng.uniform(0.3, 0.7)), jitter=0.4)


def ridge_accent(p, ridge, x0, x1, ink=0.3, width=2.0, offset=1.5, coverage=0.45):
    """a broken crest line: separate pulls of the brush, each with its own weight and dryness"""
    rng, s = p.rng, p.s
    x = x0 + rng.uniform(0, 60) * s
    while x < x1:
        seg = rng.uniform(25, 170) * s
        if rng.random() < coverage:
            xe = min(x1, x + seg)
            xs = np.linspace(x, xe, max(3, int((xe - x) / (5 * s)) + 2))
            ys = np.interp(xs, np.arange(len(ridge)), ridge) + offset * s + fbm1d(len(xs), 4, 2, p.sd()) * 0.8 * s
            p.stroke(np.stack([xs, ys], 1), width * s * rng.uniform(0.45, 1.6), ink * rng.uniform(0.45, 1.2),
                     dry=rng.uniform(0.35, 0.85), taper=(rng.uniform(0.05, 0.4), rng.uniform(0.2, 0.6)),
                     jitter=rng.uniform(0.3, 1.0))
        x += seg + rng.uniform(20, 160) * s


# ---------------------------------------------------------------- trees (every one different)
def conifer(p, x, top, root, ink=0.7, wind=0.0, halo=1.0, snap=None, spread=1.0, bare=None, trunk_w=None, style=None):
    """a 写意 conifer: a wavering, broken trunk stroke and irregular tiers. Tier style differs per
    tree ('brush' side-brush boughs, 'wet' boneless wet tiers, 'needle' fans of needles, 'mixed'),
    tier spacing, reach, lopsidedness and gaps all vary. Canvas px; size follows (root - top)."""
    rng, s = p.rng, p.s
    h = root - top
    style = style or (['brush', 'wet', 'mixed', 'brush', 'wet'] + (['needle'] if h > 260 * s else []))[int(rng.integers(5 + (h > 260 * s)))]
    lean = wind * h * 0.06 + rng.normal(0, h * 0.03)
    tx = top + h * 0.05
    bend = rng.normal(0, h * 0.04)
    trunk = spline([(x, root), (x + lean * 0.3 + bend, root - h * 0.45), (x + lean, tx)], 8)
    trunk = trunk + np.stack([fbm1d(len(trunk), 5, 2, p.sd()) * s * 1.3, np.zeros(len(trunk))], 1)
    tw = trunk_w if trunk_w is not None else (s * 1.1 + h * 0.011) * rng.uniform(0.7, 1.35)
    if tw > 0:
        broad_stroke(p, trunk, tw * 1.25, ink * rng.uniform(0.75, 0.92), dry=rng.uniform(0.2, 0.5), taper=(0.02, 0.4),
                     grow=(1.0, rng.uniform(0.5, 0.75)), pv=0.22, side=rng.uniform(-0.7, 0.7), pool=0.3, maxseg=16)

    def trunk_x(y):
        return float(np.interp(y, trunk[::-1, 1], trunk[::-1, 0]))

    tiers = []
    y = root - h * (rng.uniform(0.06, 0.25) if bare is None else bare * rng.uniform(0.8, 1.2))
    step0 = rng.uniform(0.04, 0.085)
    while y > top + h * 0.12:
        f = (root - y) / h
        tiers.append((y, f))
        y -= (h * step0 + s * 3) * rng.choice([rng.uniform(0.45, 0.8), rng.uniform(0.9, 1.7)]) * (1 - 0.35 * f)
    lopside = rng.choice([-1, 1]) * rng.uniform(0.05, 0.45) + wind * 0.4
    shape_pow = rng.uniform(0.7, 1.25)
    droop_t = rng.uniform(-0.1, 0.24)                  # this tree's boughs: swept up ... hanging
    needle_up = rng.random() < 0.5                      # needle touches point up or hang down
    for ti, (ty, f) in enumerate(tiers):
        if 0.2 < f < 0.85 and rng.random() < 0.16:
            continue
        cx = trunk_x(ty)
        half = (h * 0.3 * spread * (1 - f) ** shape_pow + s * 5) * rng.uniform(0.6, 1.35)
        st = style if style != 'mixed' else ['brush', 'wet'][int(rng.integers(2))]
        if halo and rng.random() < 0.5:
            p.blob(cx + lopside * half * 0.3, ty + s * 2.5, half * rng.uniform(0.4, 0.8), s * 2 + half * 0.12,
                   0.10 * ink * halo * rng.uniform(0.5, 1.3), rough=0.7)
        if st in ('wet', 'brush'):
            # each side its own bough: own height, angle, reach, number of strokes; sometimes missing
            sdy = rng.normal(0, h * 0.012 + s * 2)
            for side in (-1, 1):
                if rng.random() < 0.13:
                    continue
                reach = half * (1 + lopside * side) * rng.uniform(0.5, 1.25)
                if reach < s * 4:
                    continue
                ang = droop_t * (1.15 - 0.7 * f) + rng.normal(0, 0.16)
                ca, sa = np.cos(ang), np.sin(ang)
                yb = ty + side * sdy + rng.normal(0, s * 1.5)
                if st == 'wet':
                    reach *= rng.uniform(0.6, 0.85)
                    arch = reach * rng.uniform(-0.03, 0.1)
                    pts = spline([(cx, yb), (cx + side * reach * 0.5 * ca, yb + reach * 0.5 * sa - arch),
                                  (cx + side * reach * ca, yb + reach * sa + reach * rng.uniform(0, 0.12))], 6)
                    broad_stroke(p, pts, s * rng.uniform(4.5, 9.0) * (0.6 + 0.7 * (1 - f)), ink * rng.uniform(0.75, 1.05),
                                 dry=rng.uniform(0.05, 0.3), taper=(0.05, rng.uniform(0.5, 0.9)), pool=rng.uniform(0.05, 0.2),
                                 side=rng.uniform(-0.6, 0.6), swell=rng.uniform(0.2, 0.6), skip=0.4, maxseg=10)
                    continue
                nst = int(rng.integers(2, 6)) if f < 0.7 else int(rng.integers(1, 3))
                for k in range(nst):
                    ln = reach * rng.uniform(0.45, 1.0)
                    if ln < s * 4:
                        continue
                    y0 = yb + rng.normal(0, s * 1.8) - k * s * rng.uniform(0.3, 1.6)
                    x0 = cx + side * rng.uniform(0, s * 2)
                    a2 = ang + rng.normal(0, 0.08)
                    droop = ln * rng.uniform(-0.04, 0.3)
                    lift = ln * rng.uniform(-0.04, 0.14)
                    pts = spline([(x0, y0), (x0 + side * ln * 0.45 * np.cos(a2), y0 + ln * 0.45 * np.sin(a2) - lift),
                                  (x0 + side * ln * np.cos(a2), y0 + ln * np.sin(a2) + droop)], 7)
                    w = s * rng.uniform(1.3, 4.2) * (0.7 + 0.45 * (1 - f))
                    p.stroke(pts, w, ink * rng.uniform(0.45, 0.95), dry=rng.uniform(0.4, 0.82),
                             taper=(0.05, rng.uniform(0.55, 0.95)), jitter=rng.uniform(0.7, 1.5))
                for k in range(int(rng.integers(0, 4))):
                    tt = rng.uniform(0.3, 0.95)
                    qx = cx + side * reach * tt * ca
                    qy = yb + reach * tt * sa + rng.uniform(-s, s * 2)
                    up = -1 if needle_up else 1
                    p.stroke([(qx, qy), (qx + side * s * rng.uniform(1, 4), qy + up * s * rng.uniform(2.5, 6))],
                             s * rng.uniform(1.1, 2.3), ink * rng.uniform(0.45, 0.8), dry=0.55, taper=(0.1, 0.7))
            continue
        for side in (-1, 1):
            reach = half * (1 + lopside * side) * rng.uniform(0.6, 1.2)
            if rng.random() < 0.16:
                reach *= rng.uniform(0.25, 0.55)
            if st == 'needle':
                ex, ey = cx + side * reach * rng.uniform(0.7, 1.0), ty + reach * rng.uniform(-0.05, 0.15)
                p.stroke(curve((cx, ty), (ex, ey), rng.normal(0, reach * 0.08), 8), s * rng.uniform(1.0, 2.0),
                         ink * 0.7, dry=0.5, taper=(0.05, 0.7))
                nf = int(rng.integers(5, 13))
                a0 = rng.uniform(-2.9, -2.2) if side < 0 else rng.uniform(-0.95, -0.25)
                span = rng.uniform(1.2, 2.2)
                for a in np.linspace(a0 - span / 2, a0 + span / 2, nf) + rng.normal(0, 0.08, nf):
                    ln = reach * rng.uniform(0.18, 0.4)
                    p.stroke([(ex, ey), (ex + np.cos(a) * ln, ey + np.sin(a) * ln * 0.55)], s * rng.uniform(0.8, 1.4),
                             ink * rng.uniform(0.45, 0.8), dry=0.35, taper=(0.05, 0.6))
                continue
    lx = trunk_x(top + h * 0.14)
    p.stroke([(lx, top + h * 0.16), (x + lean + rng.normal(0, s), top)], s * rng.uniform(1.1, 1.9), ink * 0.85,
             dry=0.45, taper=(0.05, 0.9))
    for side in (-1, 1):
        if rng.random() < 0.6:
            yy = top + h * rng.uniform(0.08, 0.17)
            p.stroke([(lx, yy), (lx + side * s * rng.uniform(3, 9), yy + s * rng.uniform(0.5, 4))],
                     s * rng.uniform(1.1, 1.9), ink * 0.7, dry=0.55, taper=(0.05, 0.8))
    if snap:
        snap()


def leafy_tree(p, x, top, root, ink=0.7, lean=0.0, kind=None):
    """a dotted broadleaf tree (点叶树): a bent trunk, a few forking branches, and foliage clusters
    of one dot type per tree ('round' wet dots, 'jie' 介-strokes, 'flat' lying dots, 'mi' upright dabs)."""
    rng, s = p.rng, p.s
    h = root - top
    kind = kind or ['round', 'jie', 'flat', 'mi'][int(rng.integers(4))]
    tw = (s * 1.4 + h * 0.022) * rng.uniform(0.7, 1.3)
    lean = lean * h + rng.normal(0, h * 0.05)
    fork_y = root - h * rng.uniform(0.3, 0.55)
    trunk = spline([(x, root), (x + lean * 0.4 + rng.normal(0, h * 0.03), fork_y), (x + lean, top + h * 0.3)], 8)
    p.stroke(trunk, tw, ink * rng.uniform(0.7, 0.95), dry=rng.uniform(0.4, 0.75), taper=(0.02, 0.7), jitter=0.9)
    ends = [tuple(trunk[-1])]
    for b in range(int(rng.integers(2, 5))):
        t = rng.uniform(0.45, 0.85)
        q = trunk[int(t * (len(trunk) - 1))]
        side = rng.choice([-1, 1])
        ln = h * rng.uniform(0.18, 0.4)
        e = (q[0] + side * ln * rng.uniform(0.6, 1.0), q[1] - ln * rng.uniform(0.3, 0.9))
        p.stroke(curve(tuple(q), e, rng.normal(0, ln * 0.15), 10), tw * rng.uniform(0.35, 0.6), ink * 0.8,
                 dry=rng.uniform(0.4, 0.7), taper=(0.05, 0.7))
        ends.append(e)
    crown_r = h * rng.uniform(0.18, 0.3)
    for (ex, ey) in ends:
        nd = int(rng.integers(8, 24))
        rx, ry = crown_r * rng.uniform(0.6, 1.1), crown_r * rng.uniform(0.35, 0.65)
        p.blob(ex, ey, rx * 0.85, ry * 0.85, 0.16 * ink * rng.uniform(0.6, 1.4), rough=0.7)
        dsz = s * rng.uniform(1.6, 3.4) * (0.6 + h / (260 * s))
        for j in range(nd):
            dx, dy = rng.normal(0, rx * 0.36), rng.normal(0, ry * 0.36)
            px, py = ex + dx, ey + dy
            ik = ink * rng.uniform(0.4, 1.0) * (1.1 if dy > 0 else 0.85)
            r = dsz * rng.uniform(0.6, 1.4)
            if kind == 'round':
                p.wet_dot(px, py, r, ik, squash=rng.uniform(0.8, 1.6), rot=rng.uniform(-0.6, 0.6))
            elif kind == 'flat':
                p.wet_dot(px, py, r * 1.4, ik, squash=rng.uniform(2.0, 3.2), rot=rng.uniform(-0.25, 0.25))
            elif kind == 'mi':
                p.wet_dot(px, py, r * 1.2, ik, squash=rng.uniform(0.35, 0.55), rot=rng.uniform(-0.2, 0.2))
            else:
                a0 = -np.pi / 2 + rng.normal(0, 0.3)
                for a in (a0 - rng.uniform(0.5, 0.9), a0, a0 + rng.uniform(0.5, 0.9))[:int(rng.integers(2, 4))]:
                    ln = r * rng.uniform(2.0, 3.5)
                    p.stroke([(px, py), (px + np.cos(a) * ln, py + np.sin(a) * ln)], s * rng.uniform(0.9, 1.7), ik,
                             dry=0.35, taper=(0.1, 0.7))


def wet_tree(p, x, top, root, ink=0.4, lean=0.0):
    """a small far tree painted boneless (没骨): one to three wet dabs on a thin stem"""
    rng, s = p.rng, p.s
    h = root - top
    lean = lean * h + rng.normal(0, h * 0.04)
    p.stroke([(x, root), (x + lean, top + h * 0.35)], s * rng.uniform(0.8, 1.6), ink * 0.8, dry=0.5, taper=(0.05, 0.6))
    for k in range(int(rng.integers(1, 4))):
        cy = top + h * rng.uniform(0.05, 0.5)
        cx = x + lean * 0.8 + rng.normal(0, h * 0.06)
        ln = h * rng.uniform(0.25, 0.55)
        ang = np.pi / 2 + rng.normal(0, 0.25)
        pts = [(cx - np.cos(ang) * ln / 2, cy - np.sin(ang) * ln / 2), (cx + np.cos(ang) * ln / 2, cy + np.sin(ang) * ln / 2)]
        broad_stroke(p, pts, h * rng.uniform(0.12, 0.26), ink * rng.uniform(0.6, 1.1), dry=rng.uniform(0.2, 0.6),
                     taper=(rng.uniform(0.3, 0.6), rng.uniform(0.3, 0.6)), pool=rng.uniform(0.0, 0.25),
                     side=rng.uniform(-0.8, 0.8))


def any_tree(p, x, top, root, ink=0.7, wind=0.0, mix=(0.55, 0.3, 0.15)):
    """pick a tree type: conifer / leafy / boneless, weighted by `mix`"""
    r = p.rng.random()
    if r < mix[0]:
        conifer(p, x, top, root, ink, wind=wind, halo=p.rng.uniform(0.4, 1.2))
    elif r < mix[0] + mix[1]:
        leafy_tree(p, x, top, root, ink, lean=wind * 0.1)
    else:
        wet_tree(p, x, top, root, ink * 0.8, lean=wind * 0.1)


def bird(p, bx, by, sc, ink=0.75, width=None):
    """a flying bird in two or three strokes; pose, span, asymmetry, tilt and weight differ every time"""
    rng, s = p.rng, p.s
    pose = int(rng.integers(4))                                 # glide / wings up / wings down / banking
    tilt = rng.uniform(-0.3, 0.3) + (rng.uniform(-0.5, 0.5) if pose == 3 else 0)
    sL, sR = 15 * sc * rng.uniform(0.65, 1.25), 15 * sc * rng.uniform(0.65, 1.25)
    lift = {0: (-2, 2), 1: (-10, -4), 2: (2, 7), 3: (-6, 4)}[pose]
    lL, lR = sc * rng.uniform(*lift), sc * rng.uniform(*lift)
    bL, bR = -sc * rng.uniform(2, 9), -sc * rng.uniform(2, 9)
    c, sn = np.cos(tilt), np.sin(tilt)

    def R(px, py):
        return (bx + px * c - py * sn, by + px * sn + py * c)
    w = (width or s * 2.0) * rng.uniform(0.65, 1.35)
    ik = ink * rng.uniform(0.7, 1.1)
    body = (0, 2 * sc * rng.uniform(0.5, 1.3))
    p.stroke([R(*q) for q in curve((-sL, lL), body, bL, 8)], w * rng.uniform(0.8, 1.1), ik, dry=rng.uniform(0.1, 0.45),
             taper=(rng.uniform(0.3, 0.7), 0.2))
    p.stroke([R(*q) for q in curve(body, (sR, lR), bR, 8)], w * rng.uniform(0.8, 1.1), ik, dry=rng.uniform(0.1, 0.45),
             taper=(0.2, rng.uniform(0.3, 0.7)))
    if rng.random() < 0.45:
        p.wet_dot(*R(body[0] + sc * rng.uniform(-1, 1), body[1] + sc), sc * rng.uniform(0.9, 1.6), ik * 0.9,
                  squash=rng.uniform(1.0, 1.8))


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


def depth_mask(p, ridge, hz=None, soft=6.0):
    """occlusion for a wash under `ridge` (0..0.97 like inkpaint.wash), optionally cut at a waterline"""
    depth = p.YY - ridge[None, :]
    occ = 0.97 * np.clip((depth + 1) / soft, 0, 1)
    if hz is not None:
        occ = occ * (1 - np.clip((p.YY - hz) / max(1.0, 3 * p.s), 0, 1))
    return occ.astype(np.float32)


def water_dashes(p, y_lo, y_hi, x_lo, x_hi, clusters=9, ink=0.3, avoid=None, persp=(0.5, 1.6), red=False):
    """water marks in loose clusters (canvas px): a few strokes per cluster of differing length,
    weight, dryness and spacing — some split in two, most of the water left as bare paper.
    avoid: list of (x0, y0, x1, y1) boxes to keep clear."""
    rng, s = p.rng, p.s
    for c in range(clusters):
        for _ in range(30):
            cy = y_lo + (y_hi - y_lo) * rng.random() ** 0.8
            cx = rng.uniform(x_lo, x_hi)
            if not avoid or not any(a[0] < cx < a[2] and a[1] < cy < a[3] for a in avoid):
                break
        f = np.clip((cy - y_lo) / max(1, y_hi - y_lo), 0, 1)
        k = int(rng.integers(1, 6))
        gap = s * rng.uniform(5, 16) * (persp[0] + (persp[1] - persp[0]) * f)
        y = cy
        for j in range(k):
            ln = s * rng.uniform(18, 120) * (persp[0] + (persp[1] - persp[0]) * f) * rng.uniform(0.5, 1.2)
            x = cx + rng.normal(0, ln * 0.6)
            if avoid and any(a[0] < x < a[2] and a[1] < y < a[3] for a in avoid):
                y += gap * rng.uniform(0.6, 1.6); continue
            parts = 2 if rng.random() < 0.3 else 1
            xa = x
            for q in range(parts):
                l2 = ln * (rng.uniform(0.35, 0.6) if parts == 2 else 1)
                pts = spline([(xa, y), (xa + l2 / 2, y + rng.normal(0, s * 1.2)), (xa + l2, y + rng.normal(0, s * 0.8))], 8)
                p.stroke(pts, s * rng.uniform(0.7, 2.6) * (0.6 + 0.6 * f), ink * rng.uniform(0.4, 1.1) * (0.5 + 0.7 * f),
                         dry=rng.uniform(0.35, 0.88), taper=(rng.uniform(0.1, 0.45), rng.uniform(0.15, 0.5)),
                         jitter=rng.uniform(0.3, 0.9), red=red)
                xa += l2 + s * rng.uniform(4, 18)
            y += gap * rng.uniform(0.6, 1.6)


# ---------------------------------------------------------------- calligraphic marks
def brush(p, pts, width, ink, dry=0.3, taper=(0.1, 0.45), swell=0.45, pv=0.18, n=8, **kw):
    """a pointed brush line that presses down and lifts: thick belly, tapered ends, the width
    wandering with the hand; pts are control points (canvas px), splined."""
    P = spline(np.asarray(pts, np.float32), n) if len(pts) > 2 else np.asarray(pts, np.float32)
    broad_stroke(p, P, width, ink, dry=dry, taper=taper, swell=swell, pv=pv, maxseg=kw.pop('maxseg', 24), **kw)


def wet_disc(p, cx, cy, r, ink, red=True, buf=None, wet_dir=None):
    """a wet, pale round touch (a sun): not a geometric disc — the outline wanders, the pigment
    settles unevenly and drifts to a broken tide line, and on its wetter side it has bled a
    little into the paper fibre."""
    rng, s = p.rng, p.s
    buf = buf if buf is not None else (p.R if red else p.D)
    H, W = buf.shape
    pad = r * 0.5 + 14 * s
    x0, x1 = int(max(0, cx - r - pad)), int(min(W, cx + r + pad + 1))
    y0, y1 = int(max(0, cy - r - pad)), int(min(H, cy + r + pad + 1))
    if x1 <= x0 or y1 <= y0:
        return
    Y, X = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    th = np.arctan2(Y - cy, X - cx)
    ph = rng.uniform(0, 6.3, 4)
    rad = r * (1 + 0.045 * np.sin(2 * th + ph[0]) + 0.03 * np.sin(3 * th + ph[1]) + 0.018 * np.sin(5 * th + ph[2])
               + 0.01 * np.sin(8 * th + ph[3]))
    d = np.hypot(X - cx, (Y - cy) * rng.uniform(0.97, 1.05))
    wd = rng.uniform(0, 6.3) if wet_dir is None else wet_dir
    wet = np.clip(np.cos(th - wd), 0, 1) ** 2
    ramp = s * (1.2 + 5.0 * wet)
    tmp = np.zeros((y1 - y0, x1 - x0), np.float32)
    wash_field(p, 0, y1 - y0, 0, x1 - x0, rad - d, 1.0, max(3 * s, r * 0.08), pool=0.55, buf=tmp, ramp=ramp,
               hard=np.clip(1 - wet * 1.5, 0, 1), body=0.0, org=(y0, x0))
    # the middle dried paler where pigment ran to the edge, unevenly
    cz = vnz(rng, Y, X, r * 0.5, r * 0.6, 2)
    tmp *= 1 - 0.22 * np.clip(1 - d / (r * 0.85), 0, 1) * np.clip(0.6 + 0.5 * cz, 0, 1)
    # bleed on the wet side: a faint fringe that creeps out along the fibres
    fr = np.clip((rad + 4 * s * wet + 3 * s * vnz(rng, Y, X, 2 * s, 2 * s, 2) - d) / (3 * s), 0, 1) * wet
    fr = fr * np.clip(0.5 + fibre_bleed(p, y0, y1, x0, x1, 2.0) if p.absorb is not None else 0.5, 0, 1)
    tmp = 1 - (1 - tmp) * (1 - 0.35 * fr)
    sl = buf[y0:y1, x0:x1]
    np.copyto(sl, 1 - (1 - sl) * (1 - np.clip(tmp * ink, 0, 1)))


def cun_bold(p, ridge, x0, x1, n=12, shadow_x=None, reach=100, ink=0.35, floor=None, shadow_left=True,
             width=(4.0, 10.0), length=(40, 150)):
    """a few deliberate texture strokes (皴) laid with the side of a loaded brush: each pressed in,
    swelling, then lifted, running down the fall line from the ridge, breaking into flying white
    (飞白) as the brush dries. Fewer and bolder than a hatch; each one different."""
    rng, s, W = p.rng, p.s, p.W
    sl = np.gradient(smooth1d(ridge, 25 * s))
    sx = shadow_x if shadow_x is not None else (x0 + x1) / 2
    made = tries = 0
    while made < n and tries < n * 30:
        tries += 1
        cx = rng.uniform(x0, x1)
        xi = int(np.clip(cx, 0, W - 1))
        shade = (cx < sx) == shadow_left
        if rng.random() > (0.85 if shade else 0.3) * (0.3 + min(1.0, abs(sl[xi]) * 2.2)):
            continue
        dirx = -np.sign(sl[xi]) if abs(sl[xi]) > 0.04 else rng.choice([-1, 1])
        steep = np.clip(abs(sl[xi]) * 1.3, 0.25, 1.6)
        y = ridge[xi] + 2 * s + abs(rng.normal(0, reach * 0.22))
        ln = rng.uniform(*length) * s * (1 - 0.4 * np.clip((y - ridge[xi]) / max(reach, 1), 0, 1))
        dv = np.array([dirx * steep * rng.uniform(0.6, 1.3), 1.0]); dv /= np.linalg.norm(dv)
        nrm = np.array([-dv[1], dv[0]])
        kink = rng.normal(0, 0.1) * ln
        pts = [(cx, y), (cx + dv[0] * ln * 0.35 + nrm[0] * kink, y + dv[1] * ln * 0.35 + nrm[1] * kink),
               (cx + dv[0] * ln * 0.7 - nrm[0] * kink * 0.4, y + dv[1] * ln * 0.7 - nrm[1] * kink * 0.4),
               (cx + dv[0] * ln, y + dv[1] * ln)]
        P = spline(np.asarray(pts, np.float32), 6)
        if floor is not None:
            P = P[P[:, 1] < floor - 4 * s]
            if len(P) < 4:
                continue
        depthf = np.exp(-(y - ridge[xi]) / max(reach * 1.4, 1))
        ik = ink * (1.0 if shade else 0.55) * rng.uniform(0.6, 1.2) * (0.45 + 0.55 * depthf)
        w = s * rng.uniform(*width) * (1.0 if shade else 0.75)
        broad_stroke(p, P, w, ik, dry=rng.uniform(0.45, 0.85), taper=(rng.uniform(0.02, 0.12), rng.uniform(0.35, 0.75)),
                     side=rng.uniform(-0.9, 0.9), pool=rng.uniform(0.15, 0.45), swell=rng.uniform(0.15, 0.6), pv=0.25,
                     hair=rng.uniform(0.9, 1.3), maxseg=20)
        made += 1
        # now and then a thinner companion pulled alongside before the brush is reloaded
        if rng.random() < 0.35:
            off = nrm * w * rng.uniform(1.2, 2.5) * rng.choice([-1, 1])
            Q = P[int(len(P) * rng.uniform(0.0, 0.3)):int(len(P) * rng.uniform(0.6, 1.0))] + off
            if len(Q) > 3:
                broad_stroke(p, Q, w * rng.uniform(0.35, 0.6), ik * rng.uniform(0.6, 0.9), dry=rng.uniform(0.6, 0.9),
                             taper=(0.1, 0.5), swell=0.3, pv=0.3, maxseg=14)


def ripples(p, y_lo, y_hi, x_lo, x_hi, clusters=9, ink=0.3, avoid=None, persp=(0.5, 1.6), red=False):
    """water marks in loose clusters: each mark its own kind — a pressed dash, a long broken
    hairline, a dash with a flick, a pale wide pull — with its own length, weight and ink.
    avoid: list of (x0, y0, x1, y1) boxes to keep clear."""
    rng, s = p.rng, p.s
    for c in range(clusters):
        for _ in range(30):
            cy = y_lo + (y_hi - y_lo) * rng.random() ** 0.8
            cx = rng.uniform(x_lo, x_hi)
            if not avoid or not any(a[0] < cx < a[2] and a[1] < cy < a[3] for a in avoid):
                break
        f = np.clip((cy - y_lo) / max(1, y_hi - y_lo), 0, 1)
        pk = persp[0] + (persp[1] - persp[0]) * f
        k = int(rng.integers(1, 7))
        y = cy
        for j in range(k):
            kind = rng.choice(['dash', 'dash', 'line', 'flick', 'pale', 'pair'])
            ln = s * pk * float(np.exp(rng.normal(np.log(40), 0.6)))
            x = cx + rng.normal(0, ln * 0.8 + 20 * s)
            y += s * pk * rng.uniform(3, 18) * (1 if rng.random() < 0.8 else 2.5)
            if avoid and any(a[0] < x < a[2] and a[1] < y < a[3] for a in avoid):
                continue
            ik = ink * rng.uniform(0.35, 1.15) * (0.5 + 0.7 * f)
            yb = y + rng.normal(0, s * 0.8)
            if kind in ('dash', 'pair'):
                for q in range(2 if kind == 'pair' else 1):
                    l2 = ln * (rng.uniform(0.3, 0.6) if kind == 'pair' else rng.uniform(0.3, 0.8))
                    xa = x + q * (l2 + s * rng.uniform(3, 14))
                    brush(p, [(xa, yb), (xa + l2 * 0.5, yb + rng.normal(0, s * 0.9)), (xa + l2, yb + rng.normal(0, s * 0.7))],
                          s * pk * rng.uniform(1.4, 3.4), ik, dry=rng.uniform(0.2, 0.7), taper=(rng.uniform(0.05, 0.4), rng.uniform(0.2, 0.6)),
                          swell=rng.uniform(0.2, 0.8), red=red, pool=rng.uniform(0.1, 0.5), maxseg=8)
            elif kind == 'line':
                xa = x
                for q in range(int(rng.integers(1, 4))):
                    l2 = ln * rng.uniform(0.5, 1.6)
                    p.stroke(spline([(xa, yb), (xa + l2 / 2, yb + rng.normal(0, s * 1.0)), (xa + l2, yb + rng.normal(0, s * 0.8))], 8),
                             s * rng.uniform(0.6, 1.4) * (0.6 + 0.5 * f), ik * rng.uniform(0.5, 0.9), dry=rng.uniform(0.4, 0.85),
                             taper=(rng.uniform(0.1, 0.5), rng.uniform(0.2, 0.6)), jitter=rng.uniform(0.3, 0.9), red=red)
                    xa += l2 + s * rng.uniform(5, 30)
            elif kind == 'flick':
                sg = rng.choice([-1, 1])
                brush(p, [(x, yb), (x + ln * 0.55, yb + sg * s * rng.uniform(0.5, 2)), (x + ln * 0.8, yb - sg * s * rng.uniform(0.5, 2.5)),
                          (x + ln, yb - sg * s * rng.uniform(2, 5))], s * pk * rng.uniform(1.2, 2.6), ik, dry=rng.uniform(0.3, 0.7),
                      taper=(0.08, 0.7), swell=rng.uniform(0.3, 0.7), red=red, maxseg=10)
            else:
                brush(p, [(x, yb), (x + ln * 0.7, yb + rng.normal(0, s)), (x + ln * 1.4, yb + rng.normal(0, s))],
                      s * pk * rng.uniform(4, 9), ik * rng.uniform(0.2, 0.4), dry=rng.uniform(0.3, 0.7), taper=(0.3, 0.4),
                      swell=0.3, red=red, pool=0.4, maxseg=10, rough=1.6)


def wet_patch(p, cx, cy, rx, ry, dens, buf=None, red=False, tilt=0.0, pool=0.4):
    """a small wet wash laid as a patch (ground shadow, undergrowth): its outline wanders on every
    side — top and bottom alike — and dries to a tide line in places; no flat edge."""
    rng, s = p.rng, p.s
    H, W = p.H, p.W
    pad = max(rx, ry) * 0.9 + 8 * s
    x0, x1 = int(max(0, cx - rx - pad)), int(min(W, cx + rx + pad + 1))
    y0, y1 = int(max(0, cy - ry - pad)), int(min(H, cy + ry + pad + 1))
    if x1 <= x0 + 2 or y1 <= y0 + 2:
        return
    Y, X = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    u = (X - cx) / max(rx, 1); v = (Y - cy - tilt * (X - cx)) / max(ry, 1)
    f = (1 - np.sqrt(u * u + v * v)) * min(rx, ry)
    wash_field(p, y0, y1, x0, x1, f, dens, max(3 * s, min(rx, ry) * 0.9), pool=pool, buf=buf, red=red,
               ramp=max(1.5 * s, min(rx, ry) * 0.12))
