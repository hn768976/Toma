"""Shared helpers for the Art Deco scene scripts (artdeco_lake / _coast / _forest).

`Deco` is the vendored `ArtDeco` class with the same frisket-and-airbrush model, but
  * every frisket pass is limited to the bounding box of its mask (much faster on big boards);
  * the airbrush speckle is a field of discrete droplets: a pass of coverage d lands as a smooth film plus a
    share of single droplets whose count follows d, so dense spray is more speckled than thin spray, and a
    fade speckles across its gradient (instead of an even monochrome noise everywhere);
  * `overspray()` lays the soft fog that drifts a little under one side of a frisket edge.
Hand-cut helpers: `hand()` gives a frisket outline the tiny wobble of a knife cut; `burst()` is a sunburst cut
ray by ray (unequal rays, one hard knife edge and one soft oversprayed edge, per-ray tone); `stencil_cloud()`,
`facet_range()`, `pine()`, `dashes()` / `strip_mask()` / `stencil_water()` (water and reflections as stencilled
horizontal strips) and `haze()` (mist sprayed down from an irregular cut edge) are shared by the three scenes.
`Stager` writes draw-on snapshots straight to disk (NNN_name.png) instead of keeping them in memory."""
import os

import numpy as np

import drawkit
from artdeco import ArtDeco, ramp, _c
from core import polygon_mask, blur, shift, smoothstep


def _box(m, pad=0, shape=None):
    rows = np.flatnonzero(m.any(1))
    if rows.size == 0:
        return None
    cols = np.flatnonzero(m.any(0))
    if pad and shape is not None:
        H, W = shape
        return (slice(max(0, rows[0] - pad), min(H, rows[-1] + 1 + pad)),
                slice(max(0, cols[0] - pad), min(W, cols[-1] + 1 + pad)))
    return (slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1))


def col(c):
    return _c(c).astype(np.float32)


def mix(c0, c1, t):
    return col(c0) * (1 - t) + col(c1) * t


def vary(stops, f=1.0, warm=0.0):
    """the same ink mixed a touch lighter/darker (f) and warmer/cooler (warm) for one instance"""
    out = []
    for p, c in stops:
        v = col(c) * f + np.float32([warm, warm * 0.3, -warm])
        out.append((p, np.clip(v, 0, 1)))
    return out


def hand(pts, rng, amp=0.8, step=12.0, closed=True, bow=0.0):
    """a frisket outline as cut by hand: every edge subdivided, with a small wandering offset of the knife
    (amp, design px) and an optional slight bow; corners stay where they are"""
    pts = [np.asarray(p, np.float64) for p in pts]
    n = len(pts)
    out = []
    for i in range(n if closed else n - 1):
        p, q = pts[i], pts[(i + 1) % n]
        d = q - p
        L = float(np.hypot(*d))
        if L < 1e-6:
            continue
        nrm = np.array([-d[1], d[0]]) / L
        k = max(1, int(L / step))
        off = np.cumsum(rng.normal(0, amp * 0.7, k + 1))
        off -= np.linspace(off[0], off[-1], k + 1)          # pinned at both corners
        off = np.clip(off, -2.2 * amp, 2.2 * amp)
        b = rng.uniform(-bow, bow) if bow else 0.0
        for j in range(k):
            t = j / k
            out.append(tuple(p + d * t + nrm * (off[j] + b * np.sin(np.pi * t))))
    if not closed:
        out.append(tuple(pts[-1]))
    return out


class Deco(ArtDeco):
    def __init__(self, W, H, seed=0, grain=1.0, s=1.0):
        super().__init__(W, H, seed=seed, grain=grain)
        self.s = s
        # where the airbrush droplets land: one fixed field per board (independent of any group's rng)
        self.drop = np.random.default_rng([int(seed), 7717]).random((H, W), dtype=np.float32)

    # -- one airbrush pass, restricted to the mask's bounding box
    def _spray_in(self, sl, d, col_, grain, blend):
        d = np.clip(d, 0, 1)
        if grain:
            # a share k of the coat arrives as visible droplets: the number of droplets follows the coat
            # density (thin spray -> a few scattered droplets, dense spray -> many), mean coverage unchanged
            k = 0.07 * grain
            dots = (self.drop[sl] < d).astype(np.float32)
            d = d * (1 - k) + dots * k
        img = self.img[sl]
        if blend == 'screen':
            img = 1 - (1 - img) * (1 - d[..., None] * col_)
        elif blend == 'add':
            img = np.minimum(img + d[..., None] * col_, 1.5)
        else:
            img = img * (1 - d[..., None]) + col_ * d[..., None]
        self.img[sl] = img

    def spray(self, mask, colour, density=1.0, grain=1.0, blend='paint'):
        m = np.asarray(mask, np.float32)
        if m.ndim != 2:
            m = np.broadcast_to(m, (self.H, self.W))
        m = m * density if np.ndim(density) == 0 else m * np.asarray(density, np.float32)
        sl = _box(m > 0)
        if sl is None:
            return
        if isinstance(colour, str) or np.ndim(colour) == 1:
            c = _c(colour)
        else:
            c = np.asarray(colour, np.float32)[sl]
        self._spray_in(sl, m[sl], c, grain, blend)

    def fade(self, mask, stops, p0, p1, grain=1.0):
        """linear airbrush fade through colour stops. The fade is laid as droplets too: across the gradient
        a share of the pixels take the colour a little further along / back (speckle follows the gradient)."""
        m = np.asarray(mask, np.float32)
        if m.ndim != 2:
            m = np.broadcast_to(m, (self.H, self.W))
        sl = _box(m > 0)
        if sl is None:
            return
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        L2 = dx * dx + dy * dy + 1e-6
        t = np.clip(((self.xx[sl] - p0[0]) * dx + (self.yy[sl] - p0[1]) * dy) / L2, 0, 1)
        if grain:
            u = self.drop[sl]
            # droplets of the later colour land where the coat of it is t: (u < t) -> +, else -
            jit = np.where(u < t, 1.0, -1.0) * np.minimum(t, 1 - t) * 0.08 * grain
            t = np.clip(t + jit * (np.abs(u - 0.5) > 0.36), 0, 1)
        self._spray_in(sl, m[sl], ramp(t, stops), grain * 0.5, 'paint')

    def overspray(self, mask, colour, dx=0.0, dy=1.0, width=3.0, density=0.3, grain=1.0, blend='paint'):
        """the fog that drifts under one side of a frisket: the mask softened, pushed toward (dx, dy) and
        kept only outside the cut shape. width in canvas px."""
        m = np.asarray(mask, np.float32)
        pad = int(3 * width + abs(dx) + abs(dy)) + 3
        sl = _box(m > 0, pad, m.shape)
        if sl is None:
            return
        sub = m[sl]
        b = shift(blur(sub, width), dx, dy)
        halo = np.clip(b - sub, 0, 1) * density
        full = np.zeros_like(m)
        full[sl] = halo
        self.spray(full, colour, grain=grain, blend=blend)

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
        """a horizontal bar with round ends (anti-aliased)"""
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

    # ------------------------------------------------------------ the sunburst, cut ray by ray
    def burst(self, cx, cy, rays=36, contrast=0.12, reach=1200, colour='#ffffff', dark='#000000', glow=0.5,
              phase=0.0, bottom=None, rng=None, soft_side=1):
        """Deco sunburst laid like the artist does it: a fan of friskets cut with a knife, so the rays are a
        little unequal in width, every edge wanders a hair, each ray got its own pass of the airbrush (tone and
        reach differ ray to ray), and on one side of each light ray the spray crept under the frisket (soft
        overspray) while the other side is the hard knife edge."""
        rng = rng if rng is not None else np.random.default_rng(1)
        n = rays // 2 * 2 // 2
        y1 = self.H if bottom is None else int(min(self.H, np.ceil(bottom) + 1))
        sl = (slice(0, y1), slice(0, self.W))
        dx, dy = self.xx[sl] - cx, self.yy[sl] - cy
        r = np.hypot(dx, dy) + 1e-3
        b = np.linspace(0, 2 * np.pi, 2 * n + 1)[:-1] + np.radians(phase)
        b = b + rng.uniform(-0.16, 0.16, 2 * n) * np.pi / n
        b = np.sort(np.mod(b, 2 * np.pi))
        bb = np.concatenate([b, [b[0] + 2 * np.pi]])
        th = np.mod(np.arctan2(dy, dx) - b[0], 2 * np.pi) + b[0]
        i = np.clip(np.searchsorted(bb, th, side='right') - 1, 0, 2 * n - 1)
        # odd/even pairing: the bin starting at boundary i
        lo, hi = bb[i], bb[i + 1]
        # knife wobble of each boundary along the radius (px)
        ph1, ph2 = rng.uniform(0, 6.3, 2 * n + 1), rng.uniform(0, 6.3, 2 * n + 1)
        ph1[-1], ph2[-1] = ph1[0], ph2[0]
        amp = 0.55 * self.s + 0.0012 * r

        def wob(k):
            return amp * (np.sin(r / (37 * self.s) + ph1[k]) * 0.6 + np.sin(r / (113 * self.s) + ph2[k]) * 0.4)
        dlo = (th - lo) * r + wob(i)
        dhi = (hi - th) * r + wob(i + 1)
        ow = self.s * 1.2 + r * 0.006                              # overspray width grows away from the centre
        light = (i % 2 == 0)
        if soft_side < 0:
            dlo, dhi = dhi, dlo
        hard_in, soft_in = np.clip(dlo + 0.5, 0, 1), smoothstep(-ow, ow, dhi)
        on_light = np.minimum(hard_in, soft_in)
        on_dark = np.maximum(np.clip(0.5 - dhi, 0, 1), smoothstep(-ow, ow, -dlo))
        on = np.where(light, on_light, on_dark)
        ray = np.where(light, i // 2, (i + (1 if soft_side < 0 else -1)) // 2 % n) % n
        tone_l = rng.uniform(0.7, 1.18, n).astype(np.float32)
        tone_d = rng.uniform(0.75, 1.2, n).astype(np.float32)
        reach_k = rng.uniform(0.82, 1.18, n).astype(np.float32)
        fall = np.exp(-r / (reach * reach_k[ray])) * smoothstep(0, 60 * self.s, r)
        clip = np.ones_like(r) if bottom is None else np.clip(bottom - self.yy[sl], 0, 1)
        lm = np.zeros((self.H, self.W), np.float32)
        lm[sl] = on * fall * contrast * 2.2 * clip * tone_l[ray]
        self.spray(lm, colour, grain=0.8, blend='screen')
        dm = np.zeros((self.H, self.W), np.float32)
        dm[sl] = (1 - on) * fall * contrast * 1.4 * clip * tone_d[(i // 2) % n]
        self.spray(dm, dark, grain=0.8)
        if glow:
            cm = np.ones((self.H, self.W), np.float32)
            if bottom is not None:
                cm = np.clip(bottom - self.yy, 0, 1)
            self.glow(cx, cy, reach * 0.55, colour, strength=glow * 0.55, power=2.2, mask=cm)


# ------------------------------------------------------------ shared motifs (design coordinates)
def banded_sky(a, S, rng, bands, stage=None):
    """a period poster sky: stepped horizontal bands of flat ink, each sprayed through its own frisket (the
    knife-cut edge wanders a hair) with a short fade toward its foot. bands: [(bottom_y, top_ink, foot_ink)]"""
    y0 = S.Y0 - 10
    for k, (yb, c0, c1) in enumerate(bands):
        last = k == len(bands) - 1
        top = [(S.X0 - 20, y0), (S.X1 + 20, y0)]
        bot = [(S.X1 + 20, yb), (S.X0 - 20, yb)]
        if not last:
            bot = hand(bot, rng, amp=0.9, step=40, closed=False)
        m = a.poly(S.pts(top + bot))
        a.fade(m, [(0, c0), (1, c1)], S.pt(0, max(y0, yb - 140)), S.pt(0, yb))
        y0 = yb - 3
        if stage:
            stage()


def band_fields(a, S, bands, ray, k_lit=0.55, k_dark=0.62):
    """per-pixel ray inks for a banded sky: each band's colour mixed toward the ray colour (light rays) and
    down toward its own darker shade (dark rays)"""
    Y = (a.yy[:, 0] - S.oy) / S.s
    base = np.zeros((a.H, 1, 3), np.float32)
    lo = -1e9
    for yb, c0, c1 in bands:
        sel = (Y > lo) & (Y <= yb)
        base[sel, 0] = col(c0) * 0.5 + col(c1) * 0.5
        lo = yb
    base[Y > lo, 0] = col(bands[-1][2])
    lit = np.broadcast_to(base * (1 - k_lit) + col(ray) * k_lit, (a.H, a.W, 3))
    dark = np.broadcast_to(base * k_dark, (a.H, a.W, 3))
    return lit, dark


def bird(a, S, rng, bx, by, sz, lift, tilt, colour, under=None):
    """a bird cut from one frisket: each wing has its own lift, sweep and length; a small body bump.
    under: an optional second ink sprayed up from the belly (gulls by day)"""
    c, s_ = np.cos(tilt), np.sin(tilt)
    lw, rw = sz * rng.uniform(0.82, 1.06), sz * rng.uniform(0.82, 1.06)
    ll, rl = lift * rng.uniform(0.75, 1.25), lift * rng.uniform(0.75, 1.25)
    sweep = rng.uniform(0.05, 0.3)
    th = sz * rng.uniform(0.11, 0.17)
    up = [(-lw, -ll * sz * 0.6 - sweep * sz * 0.2), (-lw * 0.5, -ll * sz * 0.55 - th * 0.6),
          (-sz * 0.12, -th * 0.4), (0, -th * 0.8), (sz * 0.12, -th * 0.4),
          (rw * 0.5, -rl * sz * 0.55 - th * 0.6), (rw, -rl * sz * 0.6 - sweep * sz * 0.2)]
    lo = [(rw * 0.55, -rl * sz * 0.5 + th * 0.35), (sz * 0.1, th * 0.9), (0, th * 1.2),
          (-sz * 0.1, th * 0.9), (-lw * 0.55, -ll * sz * 0.5 + th * 0.35)]
    pts = [(bx + x * c - y * s_, by + x * s_ + y * c) for x, y in up + lo]
    m = a.poly(S.pts(pts))
    if under is None:
        a.spray(m, colour, grain=0.6)
    else:
        a.fade(m, [(0, colour), (0.55, colour), (1, under)], S.pt(bx, by - sz * 0.3), S.pt(bx, by + th * 1.2),
               grain=0.6)


def tier_outline(x0, x1, yb, th, lend, rend, rng, n=26):
    """one stencil lump of a Deco cloud: flat cut underside, domed top; each end either 'round' or a long
    streamlined 'tail'"""
    L = x1 - x0
    xs = np.linspace(x0, x1, n)
    u = (xs - x0) / L
    lw = min(0.45, th * (0.9 if lend == 'round' else 3.2) / L)
    rw = min(0.45, th * (0.9 if rend == 'round' else 3.2) / L)
    prof = np.ones_like(u)
    for side, w, kind in ((u, lw, lend), (1 - u, rw, rend)):
        m = side < w
        v = np.clip(side[m] / w, 0, 1)
        prof[m] = np.minimum(prof[m], np.sqrt(1 - (1 - v) ** 2) if kind == 'round' else v ** 1.6)
    crown = 1 + rng.uniform(-0.08, 0.12) * np.sin(np.pi * u * rng.uniform(0.8, 1.6) + rng.uniform(0, 3))
    top = [(x, yb - th * p * c) for x, p, c in zip(xs, prof, crown)]
    return top + [(x1, yb), (x0, yb)]


def stencil_cloud(a, S, rng, x0, x1, y, h, stops, lit_below, edge_col=None, density=0.95, stage=None):
    """a hand-cut streamlined cloud: 2-4 stacked lumps of different lengths and end shapes, the back lump
    cut first, each sprayed through its own frisket with a vertical fade (lit side toward the sun) and a soft
    overspray on the shadow side. No inner hairline."""
    L = x1 - x0
    tiers = []
    n = int(rng.integers(2, 5))
    cx0, cx1, yb = x0, x1, y
    for k in range(n):
        th = h * rng.uniform(0.75, 1.15) * (1 - 0.12 * k)
        ends = ('round', 'tail') if rng.random() < 0.5 else ('tail', 'round')
        if k == 0 and rng.random() < 0.3:
            ends = ('tail', 'tail')
        tiers.append((cx0, cx1, yb, th, ends))
        # the next lump up: shorter, shifted, sitting on this one's back
        nl = (cx1 - cx0) * rng.uniform(0.38, 0.72)
        off = rng.uniform(0.05, 0.95) * ((cx1 - cx0) - nl)
        cx0, cx1 = cx0 + off, cx0 + off + nl
        yb = yb - th * rng.uniform(0.45, 0.7)
        if nl < 3 * h:
            break
    ys = [t[2] - t[3] for t in tiers]
    ytop, ybot = min(ys), y
    for cx0, cx1, yb, th, (le, re) in tiers[::-1]:          # back lump first
        m = a.poly(S.pts(hand(tier_outline(cx0, cx1, yb, th, le, re, rng), rng, amp=0.5, step=16)))
        if lit_below:
            p0, p1 = S.pt(0, yb - th), S.pt(0, yb)
        else:
            p0, p1 = S.pt(0, yb), S.pt(0, yb - th)
        a.fade(m * density, vary(stops, rng.uniform(0.94, 1.05)), p0, p1, grain=1.0)
        if edge_col is not None:
            a.overspray(m, edge_col, dx=S(rng.uniform(-1, 1)), dy=S(2.0 if lit_below else -2.0),
                        width=S(rng.uniform(1.5, 3.0)), density=0.35)
        if stage:
            stage()
    return ytop, ybot


def facet_range(a, S, rng, ridge, base, lit, shade, light=1, mid=None, ext=None):
    """a mountain range cut as facets under ONE light (light=+1: from the right, -1: from the left).
    Every ridge vertex sends a kinked crease line down to the foot; each ridge segment is one face between two
    creases. A face turned toward the light is sprayed with the lit ink (brighter the steeper it is), a face
    turned away with the shade ink (darker the steeper); some faces get a second, smaller facet cut in, so no
    two peaks are built alike."""
    if ext is not None:
        ridge = ext(ridge)
    rj = hand(ridge, rng, amp=0.7, step=14, closed=False)
    m = a.poly(S.pts(rj) + [S.pt(ridge[-1][0], base + 2), S.pt(ridge[0][0], base + 2)])
    top = min(y for _, y in ridge)
    a.fade(m, lit, S.pt(0, top), S.pt(0, base))
    creases = []
    for i, (x, y) in enumerate(ridge):
        H = base - y
        lean = rng.uniform(-0.12, 0.22) * H * 0.6
        kink = (x + lean * 0.35 + rng.uniform(-5, 5), y + H * rng.uniform(0.28, 0.6))
        foot = (x + lean + rng.uniform(-10, 10), base + 6)
        creases.append((kink, foot))
    for i in range(len(ridge) - 1):
        A, B = ridge[i], ridge[i + 1]
        (ka, fa), (kb, fb) = creases[i], creases[i + 1]
        face = [A, B, kb, fb, fa, ka]
        fm = a.poly(S.pts(hand(face, rng, amp=0.5, step=14))) * m
        dy, dx = B[1] - A[1], abs(B[0] - A[0]) + 1e-3
        steep = min(1.6, abs(dy) / dx)
        toward = (dy > 0) if light > 0 else (dy < 0)        # a segment falling toward the light faces it
        if toward:
            stops = vary(lit, 0.94 + 0.1 * steep + rng.uniform(-0.03, 0.03))
        else:
            stops = vary(shade, 1.08 - 0.14 * steep + rng.uniform(-0.04, 0.04))
        yt = min(A[1], B[1])
        a.fade(fm, stops, S.pt(0, yt), S.pt(0, base))
        if mid is not None and rng.random() < 0.6:
            # a smaller facet cut into the face: from a point on the ridge down to a point on a crease
            t = rng.uniform(0.3, 0.7)
            C = (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t)
            k2 = kb if rng.random() < 0.5 else ka
            D = (k2[0] + (C[0] - k2[0]) * rng.uniform(0.1, 0.4), k2[1] + (base - k2[1]) * rng.uniform(0.0, 0.4))
            sub = [C, B, kb, D] if k2 is kb else [A, C, D, ka]
            sm = a.poly(S.pts(hand(sub, rng, amp=0.5, step=14))) * fm
            a.fade(sm * rng.uniform(0.35, 0.6), vary(mid if toward else shade, rng.uniform(0.85, 1.0)),
                   S.pt(0, yt), S.pt(0, base))
    if mid is not None:
        # the nose of a peak: the face turned to the viewer, cut as a lopsided wedge between two diagonal
        # creases running down from the summit; half lit, so it takes the middle ink
        for i in range(1, len(ridge) - 1):
            (x0, y0), (x1, y1), (x2, y2) = ridge[i - 1], ridge[i], ridge[i + 1]
            if not (y1 < y0 and y1 < y2) or rng.random() < 0.2:
                continue
            H = base - y1
            lx = x1 - (x1 - x0) * rng.uniform(0.2, 0.55)
            rx = x1 + (x2 - x1) * rng.uniform(0.2, 0.55)
            ly = y1 + H * rng.uniform(0.35, 0.95)
            ry = y1 + H * rng.uniform(0.35, 0.95)
            nose = [(x1, y1 + 1.5), (rx, ry), (rx + rng.uniform(-10, 25), base + 6),
                    (lx + rng.uniform(-25, 10), base + 6), (lx, ly)]
            if rng.random() < 0.4:      # a nose that ends in a point above the foot
                bx = (lx + rx) / 2 + rng.uniform(-0.2, 0.2) * (rx - lx)
                nose = [(x1, y1 + 1.5), (rx, ry), (bx, max(ly, ry) + H * rng.uniform(0.1, 0.4)), (lx, ly)]
            nm = a.poly(S.pts(hand(nose, rng, amp=0.5, step=14))) * m
            a.fade(nm * rng.uniform(0.75, 0.95), vary(mid, rng.uniform(0.92, 1.08)), S.pt(0, y1), S.pt(0, base))
            # the lit side of the nose a step lighter where it turns toward the light
            half = [(x1, y1 + 1.5), (rx, ry), ((x1 + rx) / 2 + rng.uniform(-8, 8), ry + (base - ry) * 0.3)] \
                if light > 0 else [(x1, y1 + 1.5), (lx, ly), ((x1 + lx) / 2 + rng.uniform(-8, 8), ly + (base - ly) * 0.3)]
            if rng.random() < 0.6:
                hm = a.poly(S.pts(hand(half, rng, amp=0.4, step=12))) * nm
                a.spray(hm, lit[-1][1], density=rng.uniform(0.25, 0.45), grain=1.0)
    return m


def pine(a, S, rng, x, root, h, w, body, trunk, light=1, tiers=None):
    """a Deco conifer cut by hand: 3-6 tiers at irregular spacing, each tier asymmetric with its own droop,
    the axis leaning a little, sprayed shadow -> lit across toward the light; tone varies tree to tree"""
    lean = rng.uniform(-0.035, 0.035)
    tw = max(1.0, w * rng.uniform(0.06, 0.1))
    a.spray(a.poly(S.pts([(x - tw / 2, root), (x + tw / 2, root), (x + lean * h * 0.2 + tw * 0.3, root - h * 0.25),
                          (x + lean * h * 0.2 - tw * 0.3, root - h * 0.25)])), trunk, grain=0.4)
    n = int(tiers if tiers is not None else rng.integers(3, 7))
    stops = vary(body, rng.uniform(0.82, 1.15), rng.uniform(-0.02, 0.02))
    # tier bottoms: irregular spacing from the top
    cuts = np.sort(rng.uniform(0.18, 1.0, n - 1))
    bots = np.concatenate([cuts, [1.0]]) * (h * rng.uniform(0.76, 0.86))
    top = root - h
    prev = 0.0
    for k in range(n):
        f = (k + 1) / n
        by = top + bots[k] + rng.uniform(-0.01, 0.01) * h
        ty = top + (prev * rng.uniform(0.35, 0.75) if k else 0)
        ax = x + lean * (root - ty) * 0.3
        bx = x + lean * (root - by) * 0.3
        hw = w / 2 * (0.32 + 0.68 * (bots[k] / bots[-1]) ** rng.uniform(0.8, 1.2)) * rng.uniform(0.88, 1.1)
        hl, hr = hw * rng.uniform(0.8, 1.15), hw * rng.uniform(0.8, 1.15)
        dl, dr = h * rng.uniform(0.0, 0.05), h * rng.uniform(0.0, 0.05)
        notch = h * rng.uniform(0.015, 0.05)
        pts = [(ax, ty), (bx + hr, by + dr), (bx + hr * rng.uniform(0.4, 0.65), by - notch),
               (bx, by + h * rng.uniform(0.0, 0.02)), (bx - hl * rng.uniform(0.4, 0.65), by - notch),
               (bx - hl, by + dl)]
        m = a.poly(S.pts(hand(pts, rng, amp=0.35, step=10)))
        a.fade(m, stops, S.pt(bx - hl * light, by), S.pt(bx + hr * light, ty))
        prev = bots[k]


def dashes(rng, x0, x1, y0, y1, th0, th1, len0, len1, cover0, cover1, spacing=1.6, cluster=0.5):
    """layout of stencilled horizontal ripple strips over a band of water (design px): rows get thicker,
    longer and sparser from y0 (far) to y1 (near). Strips cluster (a slow per-row noise opens gaps)."""
    out = []
    y = y0
    while y < y1:
        t = (y - y0) / max(1e-6, y1 - y0)
        th = th0 + (th1 - th0) * t
        Ln = len0 + (len1 - len0) * t
        cov = cover0 + (cover1 - cover0) * t
        x = x0 - rng.uniform(0, Ln)
        ph, fr = rng.uniform(0, 6.3), rng.uniform(0.004, 0.012)
        while x < x1:
            L = Ln * rng.lognormal(0, 0.45)
            local = cov * (1 + cluster * np.sin(x * fr + ph))
            if rng.random() < np.clip(local, 0.03, 0.97):
                out.append((x, x + L, y + rng.uniform(-0.25, 0.25) * th, th * rng.uniform(0.6, 1.25)))
            x += L * rng.uniform(1.0, 1.0 + (1 - min(cov, 0.95)) * 1.8)
        y += th * spacing * rng.uniform(0.8, 1.3)
    return out


def strip(a, S, x0, x1, y, th, rng=None, taper=None):
    """one stencilled water strip: a long lens, thickest in the middle, ends cut to a point (design px in)"""
    cx0, cx1, cy, r = S.x(x0), S.x(x1), S.y(y), max(0.35, S(th) / 2)
    out_sl = (slice(max(0, int(cy - r) - 2), min(a.H, int(cy + 1.5 * r) + 4)),
              slice(max(0, int(cx0) - 1), min(a.W, int(cx1) + 2)))
    if out_sl[0].stop <= out_sl[0].start or out_sl[1].stop <= out_sl[1].start:
        return None, None
    xx, yy = a.xx[out_sl] + 0.5, a.yy[out_sl] + 0.5
    L = max(1.0, cx1 - cx0)
    tl, tr = taper if taper is not None else (0.25, 0.25)
    u = (xx - cx0) / L
    prof = np.clip(np.minimum(u / tl, (1 - u) / tr), 0, 1) ** 0.55
    half = r * prof
    dy = yy - cy
    # the knife edge is on top; the spray crept a little under the frisket along the bottom (soft side)
    soft = max(0.6, 0.35 * r)
    top = np.clip(half + dy + 0.5, 0, 1)
    bot = np.clip((half - dy) / (2 * soft) + 0.5, 0, 1)
    cov = top * bot * np.clip(np.minimum(xx - cx0, cx1 - xx) + 0.5, 0, 1)
    return out_sl, cov.astype(np.float32)


def strip_mask(a, S, segs, rng):
    """union of strips as one canvas mask (to break a reflection into horizontal stencil strokes)"""
    out = np.zeros((a.H, a.W), np.float32)
    for x0, x1, y, th in segs:
        sl, cov = strip(a, S, x0, x1, y, th, taper=(rng.uniform(0.08, 0.35), rng.uniform(0.08, 0.35)))
        if sl is not None:
            out[sl] = np.maximum(out[sl], cov)
    return out


def stencil_water(a, S, rng, HZ, src, stops, reflect=0.75, compress=0.8, light=None, glint=None, dark=None,
                  stage=None, x_sun=None):
    """water as the poster artist cuts it: the lake sprayed with a few flat tones, then the reflection laid
    as stencilled horizontal strips (each strip one pass of the airbrush in the colour of what it mirrors,
    a gentle fade along its length), denser and finer near the shore, sparser, longer and paler toward the
    viewer; then a few light ripple dashes (a glitter path under the sun) and dark ones in the foreground.
    src: the board above the waterline (only sampled, never copied)."""
    hz = int(round(S.y(HZ)))
    H, W = a.H, a.W
    m = np.zeros((H, W), np.float32)
    m[hz:] = 1
    a.fade(m, stops, S.pt(0, HZ), S.pt(0, S.Y1))
    if stage:
        stage()
    srcs = np.stack([blur(src[:hz, :, c], max(0.8, S(3.0))) for c in range(3)], -1)           # sampling window of each strip's colour stops
    depth = S.Y1 - HZ
    segs = dashes(rng, S.X0 - 40, S.X1 + 40, HZ + 1.2, S.Y1 + 4, 2.0, 15.0, 80, 380, 0.85, 0.3, spacing=1.35)
    n = len(segs)
    for j, (x0, x1, y, th) in enumerate(segs):
        sl, cov = strip(a, S, x0, x1, y, th, taper=(rng.uniform(0.06, 0.3), rng.uniform(0.06, 0.3)))
        if sl is None:
            continue
        t = (y - HZ) / depth
        cy = S.y(y)
        row = int(np.clip(hz - 1 - (cy - hz) * compress, 0, hz - 1))
        ns = max(3, int((x1 - x0) / 28))                              # a colour stop every ~28 design px
        xs = np.clip(np.linspace(S.x(x0), S.x(x1), ns), 0, W - 1).astype(int)
        cs = srcs[row, xs]
        u = np.clip((a.xx[sl] - S.x(x0)) / max(1.0, S.x(x1) - S.x(x0)), 0, 1)
        field = ramp(u, [(k / (ns - 1), cs[k]) for k in range(ns)])
        k = reflect * (1 - 0.55 * t) * rng.uniform(0.8, 1.05)
        a._spray_in(sl, cov * k, field, 0.8, 'paint')
        if stage and j % max(1, n // 6) == n // 6 - 1:
            stage()
    if light is not None:
        segs = dashes(rng, S.X0, S.X1, HZ + 3, S.Y1, 1.2, 4.0, 40, 160, 0.03, 0.012, spacing=6.0, cluster=0.9)
        for x0, x1, y, th in segs:
            sl, cov = strip(a, S, x0, x1, y, th, taper=(0.3, 0.3))
            if sl is not None:
                a._spray_in(sl, cov * rng.uniform(0.25, 0.55), col(light), 0.8, 'paint')
    if glint is not None and x_sun is not None:
        gx, gw = x_sun
        y = HZ + 2
        while y < S.Y1:
            t = (y - HZ) / depth
            half = gw * (0.35 + 1.3 * t)
            for _ in range(int(rng.integers(1, 4))):
                c = gx + rng.normal(0, half * 0.55)
                L = rng.uniform(10, 50) * (1 + 3 * t) * np.exp(-abs(c - gx) / (half * 1.4))
                if L < 4:
                    continue
                th = 1.0 + 4.5 * t * rng.uniform(0.6, 1.2)
                sl, cov = strip(a, S, c - L / 2, c + L / 2, y, th, taper=(0.35, 0.35))
                if sl is not None:
                    a._spray_in(sl, cov * rng.uniform(0.45, 0.85) * (1 - 0.5 * t), col(glint), 0.8, 'screen')
            y += (2.0 + 13 * t) * rng.uniform(0.7, 1.4)
    if dark is not None:
        segs = dashes(rng, S.X0, S.X1, HZ + depth * 0.35, S.Y1, 2.0, 6.0, 80, 260, 0.04, 0.12, spacing=3.0)
        for x0, x1, y, th in segs:
            sl, cov = strip(a, S, x0, x1, y, th, taper=(0.2, 0.3))
            if sl is not None:
                a._spray_in(sl, cov * rng.uniform(0.25, 0.5), col(dark), 0.8, 'paint')
    if stage:
        stage()


def haze(a, S, rng, x0, x1, y_edge, depth, colour, density, xfade=None, jag=6.0, above=0.18):
    """mist laid with a cut frisket: an irregular knife-cut top edge (long gentle runs, small steps), the
    airbrush passes along it so the haze is densest at the edge and thins downward; a little overspray creeps
    above the edge. xfade(x_design) -> 0..1 thins it along its length."""
    xs, ys = [x0 - 30], [y_edge]
    x, y = x0 - 30, y_edge
    while x < x1 + 30:
        x += rng.uniform(50, 190)
        y = y_edge + np.clip(y - y_edge + rng.normal(0, jag * 0.6), -jag * 1.6, jag * 1.6)
        if rng.random() < 0.3:
            xs.append(x)
            ys.append(y)
            y += rng.choice([-1, 1]) * rng.uniform(0.4, 1.0) * jag     # a small knife step
        xs.append(x)
        ys.append(y)
    edge = hand(list(zip(xs, ys)), rng, amp=0.8, step=14, closed=False)
    ex = np.array([p[0] for p in edge])
    ey = np.array([p[1] for p in edge])
    X = (a.xx[0] - S.ox) / S.s
    ey_c = np.interp(X, ex, ey)                                       # edge per canvas column (design y)
    Y = (a.yy - S.oy) / S.s
    dd = Y - ey_c[None, :]
    below = np.exp(-np.maximum(dd, 0) / depth) * (dd >= 0)
    edge_aa = np.clip(dd * S.s + 0.5, 0, 1)
    up = np.exp(-np.maximum(-dd, 0) / (depth * 0.12)) * above * (dd < 0)
    d = below * edge_aa + up
    if xfade is not None:
        d = d * xfade(X)[None, :]
    d = (d * density).astype(np.float32)
    d[d < 0.012] = 0
    a.spray(d, colour, grain=1.2)


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
