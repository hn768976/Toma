"""Shared bits for the Linocut scenes (lake / coast / forest): the print subclass (hand-burnished pull with ink
starvation, a worn plate and an uneven colour block), the two colourways, design-space helpers, the stage
recorder and the carving helpers every scene uses so that no two marks are alike:

  gouge_rows      rows of gouge marks that follow a (curving) form, irregular spacing, length and width
  knife_edge      a silhouette re-cut by hand: short knife facets, wobble and small nicks
  ridge_line      a thin line of lino left standing: bold enough to survive, printed uneven and broken
  carved_reflection  a reflection carved as broken horizontal strokes (never a flipped copy)
  pine_polys / pine  a spruce built per instance (lean, asymmetric tiers, irregular spacing, crooked trunk)
  bird            a bird / gull of two wings, every one different
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import drawkit
from drawkit import save_png
from linocut import Linocut, _resample
from core import blur, noise2d, smoothstep, shift, spline, fbm1d

STYLE = "Linocut · 黑白麻胶版画"
COLOURWAYS = ("Vermilion", "Indigo")

# the second (spot-colour) block: how its ink looks printed on the cream sheet
INKS = {
    'Vermilion': dict(ink='#e0845a', mottle=0.25),     # Phase 1: dusk rose-orange / vermilion
    'Indigo': dict(ink='#7189b8', mottle=0.22),        # a soft cool indigo: a daytime print
}
MISREG = (7.0, -5.0)          # colour block offset in design px (one pull: the same for the whole sheet)


class Lino(Linocut):
    """Linocut pulled by hand. Phase 1's big blacks showed large grey low-pressure blotches; round 0 calmed
    them to near-perfect solids. This is the middle: a gentle baren pressure gradient across the sheet, a few
    small starved patches and brayer lanes where the paper's tooth shows through, a worn plate (pits and fine
    scratches that print white), and a colour block whose ink film is visibly thicker in places and thinner
    (speckled) in others."""
    s = 1.0                    # canvas px per design px (set by make_print)

    def _print_fields(self, blk):
        if hasattr(blk, 'film'): return
        H, W, s = self.H, self.W, self.s
        r = np.random.default_rng(blk.seed)
        film = 1 + 0.05 * (noise2d(H, W, 260 * s, 3, int(r.integers(1 << 30))) - 0.5) * 2
        yy = np.arange(H, dtype=np.float32)[:, None]
        xx = np.arange(W, dtype=np.float32)[None, :]
        for _ in range(4):                                                    # faint brayer stop-lines
            y0 = r.uniform(self.box[1], self.box[3]); wd = r.uniform(2, 6) * s
            band = np.exp(-((yy - y0) / wd) ** 2) * r.uniform(0.03, 0.07)
            fade = 0.5 + 0.5 * noise2d(1, W, 300 * s, 2, int(r.integers(1 << 30)))[0][None, :]
            film = film - band * fade
        # ink starvation: lanes along the brayer's travel where the roller carried too little ink
        for _ in range(int(r.integers(2, 4))):
            x0 = r.uniform(0, W); wd = r.uniform(40, 130) * s
            lane = np.exp(-((xx - x0) / wd) ** 4)
            along = smoothstep(0.35, 0.8, noise2d(H, 1, 220 * s, 2, int(r.integers(1 << 30))))
            film = film - lane * along * r.uniform(0.05, 0.09)
        # baren: many small circular passes (swirls), summed at quarter resolution
        h4, w4 = max(4, H // 4), max(4, W // 4)
        acc = np.zeros((h4, w4), np.float32)
        x0, y0, x1, y1 = [v / 4 for v in self.box]
        for _ in range(900):
            cx, cy, rad = r.uniform(x0, x1), r.uniform(y0, y1), r.uniform(5, 16) * s
            t = np.linspace(0, 2 * np.pi * r.uniform(0.6, 1.0), 40) + r.uniform(0, 6.3)
            xs = np.clip((cx + np.cos(t) * rad).astype(int), 0, w4 - 1); ys = np.clip((cy + np.sin(t) * rad).astype(int), 0, h4 - 1)
            np.add.at(acc, (ys, xs), 1.0)
        acc = blur(acc, 1.6 * max(s, 0.6)); acc = acc / (acc.mean() + 1e-6)
        acc = np.asarray(Image.fromarray(acc).resize((W, H), Image.BILINEAR))
        # pressure: a gradient across the sheet (the printer leant harder on one side) and a few small soft
        # patches the baren missed -- stronger than round 0, far weaker than Phase 1's blotches
        a = r.uniform(0, 2 * np.pi)
        ramp = (np.cos(a) * (xx / W - 0.5) + np.sin(a) * (yy / H - 0.5)) + 0.5
        patch = noise2d(H, W, 170 * s, 3, int(r.integers(1 << 30)))
        press = (1 + 0.035 * np.clip(acc - 1, -1.5, 1.5) - 0.035 * np.clip(ramp, 0, 1.2) ** 1.5
                 - 0.13 * smoothstep(0.7, 0.92, patch))
        blk.film, blk.press = film.astype(np.float32), press.astype(np.float32)
        blk.wear = self._wear(r)
        if blk is not self.key:
            # colour block: thick / thin ink film, low frequency, plus the pressure gradient
            th = noise2d(H, W, 330 * s, 3, int(r.integers(1 << 30)))
            blk.thick = np.clip(0.25 + 1.1 * (th - 0.5) + 0.75 - 0.45 * np.clip(ramp, 0, 1.2), 0.12, 1.0).astype(np.float32)

    def _wear(self, r):
        """the plate's own damage, printing white wherever the surface would carry ink: pits, fine storage
        scratches and dents (subtle; fixed per block so it never depends on what was carved)"""
        H, W, s = self.H, self.W, self.s
        im = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(im)
        n = int(W * H / (s * s) / 15000)
        for _ in range(n):                                                    # pits
            x, y = r.uniform(0, W), r.uniform(0, H); rr = r.uniform(0.4, 1.0) * s
            dr.ellipse([x - rr, y - rr * r.uniform(0.6, 1), x + rr, y + rr], fill=int(r.uniform(150, 255)))
        ang0 = r.uniform(-0.5, 0.5)
        for _ in range(int(n * 0.08)):                                        # scratches, mostly one way
            x, y = r.uniform(0, W), r.uniform(0, H); a = ang0 + r.normal(0, 0.25); ln = r.uniform(6, 34) * s
            pts = [(x + np.cos(a) * ln * t + r.normal(0, 0.4), y + np.sin(a) * ln * t + r.normal(0, 0.4)) for t in np.linspace(0, 1, 5)]
            dr.line(pts, fill=int(r.uniform(110, 230)), width=max(1, int(round(0.8 * s))))
        w = np.asarray(im, np.float32) / 255
        return np.clip(w * smoothstep(0.25, 0.6, self.grain + 0.2), 0, 1).astype(np.float32)

    def _coverage(self, blk):
        self._print_fields(blk)
        m = np.asarray(Image.fromarray(blk.a).resize((self.W, self.H), Image.BOX), np.float32) / 255
        m = smoothstep(0.22, 0.78, self._soft2(m) + self.crumble * 0.09)
        wear = blk.wear
        if blk.offset != (0, 0):
            m = shift(m, *blk.offset)
        contact = blk.film * blk.press
        t = smoothstep(0.45, 0.72, contact * 0.70 + self.grain * 0.36)
        edge = np.clip(m - blur(m, 1.6), 0, 1)                                # ink squeezed to the edges
        cov = m * np.maximum(t, smoothstep(0.02, 0.3, edge)) * (1 - 0.85 * wear)
        if blk is self.key:
            cov = np.maximum(cov, self.chatter * (1 - m) * t * 0.8)
        else:
            # a light ink shows every unevenness, the more so where the film is thin
            mot = getattr(blk, 'mottle', 0.0)
            th = blk.thick
            mot_e = np.clip(mot * (2.3 - 2.1 * th), 0.03, 0.8)
            cov = cov * (1 - mot_e + mot_e * smoothstep(0.75, 1.15, contact * 0.6 + self.grain * 0.5))
            # edge crumble alone must not print faint specks where the colour block was cleared, so an empty
            # colour block prints exactly like a skipped one
            a = Image.fromarray(blk.a).resize((self.W, self.H), Image.BOX).filter(ImageFilter.MaxFilter(5))
            near = np.asarray(a) > 0
            if blk.offset != (0, 0): near = shift(near.astype(np.float32), *blk.offset) > 0.5
            cov = cov * near
            # the misregistered block is bigger than the sheet: fill the strip the offset uncovered at the
            # canvas edge by mirroring the neighbouring print, instead of leaving a bare paper line
            dx, dy = (int(round(v)) for v in blk.offset)
            if dx > 0: cov[:, :dx] = cov[:, dx:2 * dx][:, ::-1]
            if dx < 0: cov[:, dx:] = cov[:, 2 * dx:dx][:, ::-1]
            if dy > 0: cov[:dy] = cov[dy:2 * dy][::-1]
            if dy < 0: cov[dy:] = cov[2 * dy:dy][::-1]
        return np.clip(cov, 0, 1), m

    @staticmethod
    def _soft2(m):
        p = np.pad(m, 1, mode='edge')
        m = (p[:, :-2] + 2 * p[:, 1:-1] + p[:, 2:]) / 4
        return (m[:-2] + 2 * m[1:-1] + m[2:]) / 4

    def pull(self, blocks=None):
        """as the lib's pull, but a colour block's ink prints deeper where its film is thick"""
        img = self.paper.copy()
        blocks = self.blocks if blocks is None else blocks
        mk = None
        for blk in blocks:
            if blk is not self.key and not blk.a.any(): continue
            cov, m = self._coverage(blk)
            ink = blk.colour[None, None, :]
            if blk is not self.key:
                ink = ink ** (0.8 + 0.45 * blk.thick[..., None])
            img *= 1 - cov[..., None] * (1 - ink)
            if blk is self.key: mk = m
        h = (1 - (mk if mk is not None else 0)) * 1.0 + self.relief
        if mk is not None or self.relief.any():
            h = blur(np.asarray(h, np.float32) * np.ones((self.H, self.W), np.float32), 1.3)
            gy, gx = np.gradient(h)
            sh = np.clip(-(gx * -0.6 + gy * -0.7) * 0.3, -0.035, 0.035)
            img *= (1 + sh)[..., None]
        return Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8))


def make_print(S, seed, colourway):
    """the sheet and its two blocks; the lino is larger than the canvas (full bleed, no rim, no margin)"""
    if colourway not in INKS:
        raise ValueError(f"colourway must be one of {COLOURWAYS}")
    pad = int(round(S(40)))
    Lino.s = S.s
    L = Lino(S.W, S.H, block=(-pad, -pad, S.W + pad, S.H + pad), seed=seed)
    c = INKS[colourway]
    col = L.colour_block(c['ink'], offset=(int(round(S(MISREG[0]))), int(round(S(MISREG[1])))), mottle=c['mottle'])
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


# ============================================================================ carving helpers (design units)
def _smooth_noise(rng, n, knots):
    k = max(2, int(knots))
    return np.interp(np.linspace(0, k - 1, n), np.arange(k), rng.uniform(-1, 1, k))


def gouge_rows(L, S, rng, region, box, angle=0.0, spacing=(10, 20), length=(40, 200), gap=(8, 60), width=(3, 6),
               density=None, cut=True, on=None, tool='v', bend=None, cluster=0.45, bow=0.35, slip=0.0, jitter=0.16,
               taper=None, end=None):
    """Rows of gouge marks across `region` (canvas polygon or mask), laid out in design units over `box`
    (x0, y0, x1, y1). Rows run along `angle` degrees; bend(x, y) -> design px pushed across the row, so rows
    curve with the form (sky arcs, rock beds, water swells). Row spacing is irregular and clustered, every mark
    has its own length, width, taper and a slight bow (the hand turns the tool), and density(x, y) -> 0..1
    decides whether a mark is cut (and scales its width). slip: chance of a short spur where the gouge slipped
    in at the start of a mark."""
    x0, y0, x1, y1 = box
    th = np.radians(angle); dv = np.array([np.cos(th), np.sin(th)]); nv = np.array([-dv[1], dv[0]])
    c = np.array([(x0 + x1) / 2, (y0 + y1) / 2])
    R = 0.5 * np.hypot(x1 - x0, y1 - y0) + 10
    sp_mean = 0.5 * (spacing[0] + spacing[1])
    ph = rng.uniform(0, 6.3); ph2 = rng.uniform(0, 6.3)
    polys = []
    v = -R + rng.uniform(0, spacing[1])
    while v < R:
        u = -R - rng.uniform(0, length[1])
        row_off = rng.normal(0, 0.12 * sp_mean)
        while u < R:
            Ld = rng.uniform(*length)
            n = max(4, int(Ld / 5))
            us = np.linspace(u, u + Ld, n)
            vv = v + row_off + rng.normal(0, 0.1 * sp_mean)
            base = c + dv * us[:, None] + nv * vv
            off = np.zeros(n)
            if bend is not None: off = off + bend(base[:, 0], base[:, 1])
            tt = np.linspace(0, 1, n)
            wb = rng.uniform(*width)
            off = off + rng.normal(0, bow) * wb * np.sin(np.pi * tt) + rng.normal(0, 0.06) * wb * (tt - 0.5) * 2
            pts = base + nv * off[:, None]
            mx, my = pts[n // 2]
            if x0 - 40 <= mx <= x1 + 40 and y0 - 40 <= my <= y1 + 40:
                dn = float(np.clip(density(mx, my), 0, 1)) if density else 1.0
                if rng.random() < dn:
                    w = wb * (0.5 + 0.5 * dn)
                    tp = taper if taper is not None else (rng.uniform(0.08, 0.45), rng.uniform(0.06, 0.5))
                    polys.append(L.stroke(S.pts(pts), S(w), tool, taper=tp, jitter=jitter,
                                          end=None if end is None else S(end * w)))
                    if slip and rng.random() < slip:
                        a = np.arctan2(pts[1, 1] - pts[0, 1], pts[1, 0] - pts[0, 0]) + rng.choice([-1, 1]) * rng.uniform(0.25, 0.7)
                        ls = w * rng.uniform(2, 5)
                        p0 = pts[0] + (pts[1] - pts[0]) * 0.3
                        polys.append(L.stroke(S.pts([p0, (p0[0] + np.cos(a) * ls, p0[1] + np.sin(a) * ls)]), S(w * 0.45), 'v',
                                              taper=(0.2, 0.6), jitter=0.2))
            u += Ld + rng.uniform(*gap)
        v += rng.uniform(*spacing) * (1 + cluster * np.sin(v / (sp_mean * 3.1) + ph) * np.cos(v / (sp_mean * 7.3) + ph2))
    L._draw(polys, cut, on, region)


def knife_edge(pts, rng, step=(12, 34), wob=1.4, nick=0.08, nick_size=(3, 9), closed=True, keep=None, side=None):
    """re-cut a silhouette (design-unit polyline/polygon) by hand: short straight knife facets of irregular
    length, a slow drift and small V nicks into the shape. keep(x, y) -> False leaves a vertex alone
    (edges that must stay exactly where they are, e.g. off-canvas closing edges)."""
    P = np.asarray(pts, np.float64)
    if closed: P = np.vstack([P, P[:1]])
    d = np.linalg.norm(np.diff(P, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(d)]); Ltot = s[-1]
    area = 0.5 * np.sum(P[:-1, 0] * P[1:, 1] - P[1:, 0] * P[:-1, 1])
    sgn = 1.0 if area > 0 else -1.0                    # inside is to the left of travel when area > 0
    if side is not None: sgn = float(side)             # open line: +1 = shape on the left of travel
    # facet vertices: keep the original corners, add irregular stops in between
    ts = list(s)
    t = rng.uniform(0, step[1])
    while t < Ltot:
        ts.append(t); t += rng.uniform(*step)
    ts = np.unique(np.round(np.array(ts), 3))
    X = np.interp(ts, s, P[:, 0]); Y = np.interp(ts, s, P[:, 1])
    drift = _smooth_noise(rng, len(ts), max(3, Ltot / 160))
    out = []
    for i in range(len(ts)):
        j0, j1 = max(0, i - 1), min(len(ts) - 1, i + 1)
        tx, ty = X[j1] - X[j0], Y[j1] - Y[j0]; nn = np.hypot(tx, ty) + 1e-9
        nx, ny = -ty / nn * sgn, tx / nn * sgn          # inward normal
        if keep is not None and not keep(X[i], Y[i]):
            out.append((X[i], Y[i])); continue
        o = wob * (0.8 * drift[i] + 0.5 * rng.normal())
        out.append((X[i] + nx * o, Y[i] + ny * o))
        if i < len(ts) - 1 and rng.random() < nick:
            seg = np.hypot(X[i + 1] - X[i], Y[i + 1] - Y[i])
            if seg > 6:
                f = rng.uniform(0.3, 0.7); dep = rng.uniform(*nick_size); half = min(seg * 0.3, dep * rng.uniform(0.4, 0.9))
                mx, my = X[i] + (X[i + 1] - X[i]) * f, Y[i] + (Y[i + 1] - Y[i]) * f
                ex, ey = (X[i + 1] - X[i]) / seg, (Y[i + 1] - Y[i]) / seg
                lean = rng.uniform(-0.6, 0.6)
                out += [(mx - ex * half, my - ey * half),
                        (mx + nx * dep + ex * dep * lean, my + ny * dep + ey * dep * lean),
                        (mx + ex * half, my + ey * half)]
    if closed: out = out[:-1]
    return out


def ridge_line(L, S, rng, pts, w, on=None, breaks=0.25, gap=(2.5, 6), seg=(18, 70), region=None, cut=False,
               smooth=True, tool='brush'):
    """a thin line of lino left standing (cut=False) -- fence post, rigging, seam, horizon: made bold enough to
    survive the cut (w >= ~2.6 design px) and printed uneven: its width swells and pinches and it breaks where a
    fragile ridge crumbled. pts: design polyline."""
    P = np.asarray(spline(pts, 8) if smooth and len(pts) > 2 else pts, np.float64)
    P = _resample(P.astype(np.float32), 1.5)[0].astype(np.float64)
    if len(P) < 2: return
    dd = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]); Lt = dd[-1]
    polys = []
    a = 0.0
    while a < Lt:
        b = min(Lt, a + rng.uniform(*seg))
        if Lt - b < seg[0] * 0.4: b = Lt
        idx = (dd >= a) & (dd <= b)
        Q = P[idx]
        if len(Q) >= 2:
            w0 = w * rng.uniform(0.8, 1.2); w1 = w * rng.uniform(0.7, 1.15)
            polys.append(L.stroke(S.pts(Q.tolist()), S(w0), tool, end=S(w1), jitter=0.3, taper=(0.04, 0.08)))
        a = b + (rng.uniform(*gap) if rng.random() < breaks else 0.0)
    L._draw(polys, cut, on, region)


def carved_reflection(L, S, rng, mask, axis, depth, squash=0.78, rows=(3.5, 6.5), dash=(14, 80), gap=(2, 16),
                      width=(0.55, 1.0), keep0=0.95, keep1=0.35, sway=(3.0, 1.5), on=None, region=None, minrun=3.0,
                      x_range=None):
    """a reflection carved in the medium: below the waterline `axis` (design y) leave broken horizontal strokes
    wherever the dark object above it (canvas mask, 1 = black) would mirror -- squashed (shorter than the
    object), the rows widening apart and breaking up more with depth, each row swayed a little sideways."""
    Hc, Wc = mask.shape
    polys = []
    dy = rng.uniform(1.5, 3.0)
    ph = rng.uniform(0, 6.3)
    while dy < depth:
        f = dy / depth
        sp = rng.uniform(*rows) * (1 + 0.9 * f)
        yc = axis + dy
        ys = S.y(axis - dy / squash)
        if ys < 0: break
        iy = int(np.clip(round(ys), 0, Hc - 1))
        row = mask[max(0, iy - 1):iy + 2].mean(0) > 0.5
        sx = S(sway[0] * np.sin(dy / 9 + ph) + sway[1] * rng.normal())
        xs = np.nonzero(np.diff(np.concatenate([[0], row.astype(np.int8), [0]])))[0]
        keep = keep0 + (keep1 - keep0) * f
        for a, b in zip(xs[::2], xs[1::2]):
            a, b = a + sx, b + sx
            if b - a < S(minrun): continue
            pos = a + rng.uniform(0, S(gap[1])) * (rng.random() < 0.5)
            while pos < b:
                dl = S(rng.uniform(*dash)) * (1 - 0.45 * f)
                e = min(b, pos + dl)
                if e - pos > S(2.5) and rng.random() < keep:
                    w = sp * rng.uniform(*width) * (1 - 0.35 * f)
                    x0, x1 = d_ux(S, pos), d_ux(S, e)
                    if x_range is None or (x_range[0] <= x0 and x1 <= x_range[1]):
                        yy = yc + rng.normal(0, 0.25 * sp)
                        tilt = rng.normal(0, 0.6)
                        q = [(x0, yy - tilt), ((x0 + x1) / 2, yy + rng.normal(0, 0.4)), (x1, yy + tilt)]
                        if rng.random() < 0.6:
                            polys.append(L.stroke(S.pts(q), S(w), 'brush', end=S(w * rng.uniform(0.35, 0.9)), jitter=0.25))
                        else:
                            polys.append(L.stroke(S.pts(q), S(w * 1.15), 'v', taper=(rng.uniform(0.05, 0.3), rng.uniform(0.1, 0.45)),
                                                  jitter=0.25))
                pos = e + S(rng.uniform(*gap)) * (1 + 1.6 * f)
        dy += sp
    L._draw(polys, False, on, region)


def d_ux(S, px):
    return (px - S.ox) / S.s


def pine_polys(rng, x, base, h, w=None, lean=None):
    """one spruce as design polygons (tiers + crooked trunk + leader); no two alike: its own lean, tier count
    and spacing, asymmetric sides, a stunted or missing branch here and there, a bent leader"""
    w = (w or h * 0.45) * rng.uniform(0.82, 1.18)
    lean = rng.normal(0, 0.035) if lean is None else lean
    k = int(np.clip(round(h / 24 * rng.uniform(0.8, 1.25)), 3, 12))
    bare = rng.uniform(0.04, 0.16)                       # trunk showing under the lowest tier
    wob = _smooth_noise(rng, 40, 4) * h * 0.012
    def tx(y):                                           # trunk centre at height y
        f = np.clip((base - y) / h, 0, 1)
        return x + lean * h * f ** 1.4 + np.interp(f, np.linspace(0, 1, 40), wob)
    wts = rng.uniform(0.6, 1.4, k) * np.linspace(0.75, 1.25, k)       # tiers get taller toward the base
    tops = base - h + np.concatenate([[0], np.cumsum(wts)[:-1]]) / wts.sum() * h * (1 - bare) * 0.93
    polys = []
    sl, sr = rng.uniform(0.85, 1.15), rng.uniform(0.85, 1.15)          # the whole tree a bit lopsided
    for i in range(k):
        yt = tops[i] + (rng.uniform(-0.04, 0.04) * h / k if i else 0)
        th = (tops[i + 1] - tops[i] if i < k - 1 else base - h * bare - tops[i]) * rng.uniform(1.35, 1.8)
        yb = yt + th
        hw = w / 2 * (0.16 + 0.84 * ((i + 1) / k) ** rng.uniform(0.8, 1.15))
        hl = hw * sl * rng.uniform(0.8, 1.15); hr = hw * sr * rng.uniform(0.8, 1.15)
        if rng.random() < 0.12: (hl, hr) = (hl * 0.5, hr) if rng.random() < 0.5 else (hl, hr * 0.5)
        droop = rng.uniform(0.0, 0.2) * th
        cx_t, cx_b = tx(yt), tx(yb)
        right, left = [], []
        for side, half, out in ((1, hr, right), (-1, hl, left)):
            tips = int(np.clip(round(half / rng.uniform(7, 11)), 1, 6))
            for j in range(tips):
                fx = (j + 1) / tips
                ty = yb + droop * fx - (1 - fx) * rng.uniform(0.0, 0.18) * th + rng.uniform(-0.06, 0.06) * th
                out.append((cx_b + side * fx * half * rng.uniform(0.92, 1.05), ty))
                if j < tips - 1:
                    out.append((cx_b + side * (fx + 0.5 / tips) * half * 0.9, ty - rng.uniform(0.12, 0.3) * th))
        sh = rng.uniform(0.45, 0.62)
        poly = ([(cx_t, yt), (cx_t + hr * sh * 0.95, yt + th * sh)] + right[::-1] + [(cx_b, yb - th * 0.12)] + left
                + [(cx_t - hl * sh * 0.95, yt + th * sh)])
        polys.append(np.array(poly, np.float32))
    # crooked trunk
    ys = np.linspace(base + 2, base - h * 0.6, 8)
    tw = w * rng.uniform(0.045, 0.07)
    tr = [(tx(y) + tw * (0.6 + 0.4 * (y - ys[-1]) / (ys[0] - ys[-1])), y) for y in ys]
    tl = [(tx(y) - tw * (0.6 + 0.4 * (y - ys[-1]) / (ys[0] - ys[-1])), y) for y in ys[::-1]]
    polys.append(np.array(tr + tl, np.float32))
    # the leader: a thin spike above the top tier, often bent
    lt = h * rng.uniform(0.04, 0.1); bend = rng.normal(0, 0.35) * lt
    x_top = tx(base - h)
    polys.append(np.array([(x_top - w * 0.03, base - h + h * 0.06), (x_top + bend, base - h - lt),
                           (x_top + w * 0.03, base - h + h * 0.06)], np.float32))
    return polys


def pine(L, S, rng, x, base, h, w=None, lean=None, halo=2.5, nicks=0.4, lit=1, region=None):
    """a black spruce left standing (halo cut round it), V nicks for needles on the lit side"""
    polys = pine_polys(rng, x, base, h, w, lean)
    m = L.mask_of([np.array(S.pts(p.tolist()), np.float32) for p in polys])
    if region is not None: m = m * region
    if halo: L.outline(m, S(halo * rng.uniform(0.85, 1.2)))
    L.leave(m)
    if nicks:
        cuts = []
        for p in polys[:-2]:
            ytop, ybot = p[:, 1].min(), p[:, 1].max()
            cxp = p[0, 0]; hw = (p[:, 0].max() - p[:, 0].min()) / 2
            for _ in range(int(rng.poisson(nicks * 4))):
                fy = rng.uniform(0.45, 0.9); yy = ytop + (ybot - ytop) * fy
                xx = cxp + lit * rng.uniform(0.1, 0.8) * hw * fy
                ln = hw * rng.uniform(0.2, 0.45)
                cuts.append(L.stroke(S.pts([(xx, yy), (xx + lit * ln, yy + ln * rng.uniform(0.25, 0.7))]),
                                     S(rng.uniform(1.8, 3.2)), 'v'))
        L._apply_mask(L.mask_of(cuts) * m, True)
    return m


def bird(L, S, rng, x, y, size, width, cut=True, on=None, kind='bird'):
    """one bird of two tapered wing strokes, built per instance: span, wing lift, elbow, asymmetry, tilt and
    stroke weight all its own (gliding, mid-beat, banking)"""
    tilt = rng.normal(0, 0.18)
    ca, sa = np.cos(tilt), np.sin(tilt)
    beat = rng.uniform(-0.3, 1.0)                       # -: wings dipped, 1: raised high
    polys = []
    for side in (-1, 1):
        span = size * rng.uniform(0.8, 1.2) * (0.85 if (side == 1) == (tilt > 0) else 1.0)
        lift = span * (0.25 + 0.35 * beat) * rng.uniform(0.8, 1.2)
        if kind == 'gull':
            pts = [(0, 0), (side * span * 0.32, -lift), (side * span * 0.62, -lift * rng.uniform(0.6, 0.9)),
                   (side * span, lift * rng.uniform(-0.1, 0.35))]
        else:
            pts = [(0, 0), (side * span * 0.45, -lift), (side * span, -lift * rng.uniform(0.1, 0.6) + span * 0.08)]
        pts = [(x + px * ca - py * sa, y + px * sa + py * ca) for px, py in pts]
        polys.append(L.stroke(S.pts(spline(pts, 6).tolist()), S(width * rng.uniform(0.8, 1.2)), 'v',
                              taper=(rng.uniform(0.05, 0.2), rng.uniform(0.35, 0.7)), jitter=0.18))
    L._draw(polys, cut, on)


def scallop_band(rng, x0, x1, ytop, ybot, r=(10, 26), amp=1.0):
    """outline (design) of a band cleared with a U-gouge: its edges are runs of overlapping round bites, not a
    smooth curve. ytop / ybot: f(x) -> y"""
    top, bot = [], []
    x = x0
    while x < x1:
        rr = rng.uniform(*r); n = 6
        for t in np.linspace(0, 1, n, endpoint=False):
            xx = x + t * rr * 1.6
            top.append((xx, ytop(xx) - amp * rr * 0.28 * np.sin(np.pi * t)))
        x += rr * 1.6 * rng.uniform(0.7, 1.0)
    x = x1
    while x > x0:
        rr = rng.uniform(*r); n = 6
        for t in np.linspace(0, 1, n, endpoint=False):
            xx = x - t * rr * 1.6
            bot.append((xx, ybot(xx) + amp * rr * 0.24 * np.sin(np.pi * t)))
        x -= rr * 1.6 * rng.uniform(0.7, 1.0)
    return top + bot


def day_sky(L, col, S, d, rng, region, box, y_top, y_hor, bands=((-1e9, 1e9),), stg=None, bend=None):
    """the Indigo (daytime) sky: the key cleared, a few bold black ridges left standing that thin out toward
    the horizon, and the blue block solid at the top, broken into streaks lower down so the sky pales to paper
    at the horizon. region: canvas-px polygon; box: design bbox; y_top / y_hor: design y of the dark top and
    of the horizon."""
    span = y_hor - y_top
    bend = bend or (lambda x, y: 9 * np.sin(x / 330 + y / 120) + 5 * np.sin(x / 140 - y / 70))
    L.clear(L.poly(region), chatter=0.3, angle=0)
    if stg: stg('sky cleared')
    for (a, b) in bands:
        gouge_rows(L, S, rng, region, box, spacing=(11, 26), length=(50, 300), gap=(16, 120), width=(2.6, 4.6), cut=False,
                   density=lambda x, y, a=a, b=b: 0.55 * np.clip(1 - (y - y_top) / (0.7 * span), 0, 1) ** 1.4 * (a <= y < b),
                   bend=bend, taper=(0.06, 0.12), tool='brush', end=0.6)
        if stg: stg('sky ridges')
    L.leave(L.poly(region), on=col)
    for (a, b) in bands:
        gouge_rows(L, S, rng, region, box, spacing=(6, 14), length=(50, 320), gap=(4, 40), width=(5, 10), cut=True, on=col,
                   density=lambda x, y, a=a, b=b: np.clip((y - y_top) / span * 1.25 - 0.1, 0, 1) ** 0.9 * (a <= y < b),
                   bend=bend)
        if stg: stg('sky blue')


def day_cloud(L, col, S, rng, cx, cy, ln, k):
    """a thin white lens of cloud cleared out of the blue block, a black line left along its underside"""
    rows = 3 + int(rng.integers(0, 3) + 2 * k)
    sag = rng.uniform(-2.5, 2.5)
    for i in range(rows):
        f = i / (rows - 1)
        half = ln / 2 * (0.35 + 0.65 * np.sin(np.pi * (0.15 + 0.7 * f))) * rng.uniform(0.8, 1.15)
        y = cy + (f - 0.5) * 40 * k + rng.uniform(-2, 2)
        a = cx - half + rng.uniform(-30, 30) + 40 * (1 - f)
        b = cx + half + rng.uniform(-30, 30) - 20 * (1 - f)
        m = (a + b) / 2 + rng.uniform(-40, 40)
        L.gouge(S.pts([(a, y + 1.5), (m, y - (1.8 + sag) * k), (b, y + 1.2)]), S((5 + 3 * f) * k * rng.uniform(0.8, 1.25) + 2),
                'v', cut=True, on=col, taper=(rng.uniform(0.15, 0.4), rng.uniform(0.15, 0.45)))
        L.clear(L.poly(S.pts([(a + 6, y - 3 * k), (b - 6, y - 3 * k), (b - 6, y + 3 * k), (a + 6, y + 3 * k)])), chatter=0)
        if i == rows - 1 or (i == rows - 3 and rng.random() < 0.7):
            L.gouge(S.pts([(a + rng.uniform(10, 40), y + 5 * k), (m, y + 3 * k), (b - rng.uniform(5, 30), y + 5.5 * k)]),
                    S(2.8 * k + 1.0), 'v', cut=False, taper=(0.2, 0.35))
