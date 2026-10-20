"""Shared helpers for the Art Deco scene scripts (artdeco_lake / _coast / _forest).

The look is the 1920s-30s travel poster: airbrush through hand-cut friskets. Every shape is a cut mask and
inside a mask the tone always flows (one airbrush pass = one smooth gradient); the only hard steps are the
frisket edges, which are deliberate design lines (stepped terraces, rings round the sun, stacked cloud bands).

`Deco` is the vendored `ArtDeco` class with the same frisket-and-airbrush model, but
  * every frisket pass is limited to the bounding box of its mask (much faster on big boards);
  * the droplets (spatter) are not an even noise: a pass lands as a smooth film plus a share of discrete
    droplets whose number follows the coat, and that share builds up along the frisket edge (the paint piles
    against the film) and with the "pressure" of the pass (a slow per-pass field), so a gradient speckles
    more toward its cut edges and in some passes than in others;
  * `overspray()` lays the soft fog that drifts under one side of a frisket, mostly as coarse droplets.
Motifs: `graded_sky()` (one smooth fade, plus optional stepped halo rings round the sun as design lines),
`frisket_rays()` (a fan of rays each cut as a frisket: opaque paint through the cut, crisp on the knife side,
irregular overspray on the other), `sun_disc()`, `streamline_cloud()` (stacked parallel bands with round heads
and tapered tails), `terraced_range()` (ziggurat-like stepped mountains with rounded, streamlined ledges, each
tier an airbrushed gradient, light side / shade side), `deco_pine()` / `cypress()` (stacked streamlined
tiers, split light/shade), `deco_water()` (graded water, a reflection laid as stepped stencil bands, long
tapered speed lines, a stacked sun path), `chevrons()` (stepped V ripples), `deco_bird()` (two smooth
crescent wings), `haze()`, and `Stager` (draw-on snapshots written straight to disk)."""
import os

import numpy as np

import drawkit
from artdeco import ArtDeco, ramp, _c
from core import polygon_mask, blur, shift, smoothstep, noise2d


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


def bez(p0, p1, p2, n=12):
    """quadratic Bezier p0 -> p2 pulled toward p1 (list of points)"""
    t = np.linspace(0, 1, n)[:, None]
    P = (1 - t) ** 2 * np.asarray(p0, float) + 2 * (1 - t) * t * np.asarray(p1, float) + t ** 2 * np.asarray(p2, float)
    return [tuple(p) for p in P]


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
        r = np.random.default_rng([int(seed), 7717])
        # where the airbrush droplets land: fixed fields per board (independent of any group's rng)
        self.drop = r.random((H, W), dtype=np.float32)
        b = max(1, int(round(2 * s)))                       # coarse droplets (overspray, edge build-up)
        c = r.random(((H + b - 1) // b, (W + b - 1) // b), dtype=np.float32)
        self.drop2 = np.repeat(np.repeat(c, b, 0), b, 1)[:H, :W]
        # airbrush pressure: a slow field, read at a different place for every pass (offset by where the
        # frisket is), so one pass is a little heavier with droplets than the next
        self.press = (0.45 + 1.1 * noise2d(H, W, max(40.0, 260 * s), 3, int(seed) * 31 + 5)).astype(np.float32)
        self.edge_r = max(1.0, 3.5 * s)

    def _press_at(self, sl):
        oy = (sl[0].start * 7919 + sl[1].start * 104729) % self.H
        ox = (sl[1].start * 7907 + sl[0].start * 1009) % self.W
        rows = (np.arange(sl[0].start, sl[0].stop) + oy) % self.H
        cols = (np.arange(sl[1].start, sl[1].stop) + ox) % self.W
        return self.press[np.ix_(rows, cols)]

    def _edge(self, mbox):
        """1 along the cut edge of a frisket, 0 well inside / outside (where the droplets pile up)"""
        b = blur((mbox > 0.5).astype(np.float32), self.edge_r)
        return np.clip(1 - np.abs(2 * b - 1), 0, 1) ** 0.8

    # -- one airbrush pass, restricted to the mask's bounding box
    def _spray_in(self, sl, d, col_, grain, blend, edge=None):
        d = np.clip(d, 0, 1)
        if grain:
            # a share of the coat arrives as visible droplets: the number follows the coat density, the share
            # follows the pressure of this pass and builds up along the frisket edge
            pr = self._press_at(sl)
            e = 0.3 if edge is None else edge
            k = np.clip(0.06 * grain * pr * (0.35 + 1.3 * e), 0, 0.3)
            fine = (self.drop[sl] < d).astype(np.float32)
            if edge is not None:
                coarse = (self.drop2[sl] < d).astype(np.float32)
                fine = np.where(edge > 0.6, coarse, fine)
            d = d * (1 - k) + fine * k
        img = self.img[sl]
        if blend == 'screen':
            img = 1 - (1 - img) * (1 - d[..., None] * col_)
        elif blend == 'add':
            img = np.minimum(img + d[..., None] * col_, 1.5)
        else:
            img = img * (1 - d[..., None]) + col_ * d[..., None]
        self.img[sl] = img

    def spray(self, mask, colour, density=1.0, grain=1.0, blend='paint', edges=True):
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
        e = self._edge(np.asarray(mask, np.float32)[sl] if np.ndim(mask) == 2 else m[sl]) if (grain and edges) else None
        self._spray_in(sl, m[sl], c, grain, blend, e)

    def fade(self, mask, stops, p0, p1, grain=1.0):
        """linear airbrush fade through colour stops. The fade is laid as droplets too: across the gradient
        a share of the pixels take the colour a little further along / back, more of them near the cut edge
        and where this pass's pressure is high."""
        m = np.asarray(mask, np.float32)
        if m.ndim != 2:
            m = np.broadcast_to(m, (self.H, self.W))
        sl = _box(m > 0)
        if sl is None:
            return
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        L2 = dx * dx + dy * dy + 1e-6
        t = np.clip(((self.xx[sl] - p0[0]) * dx + (self.yy[sl] - p0[1]) * dy) / L2, 0, 1)
        e = self._edge(m[sl]) if grain else None
        if grain:
            u = self.drop[sl]
            pr = self._press_at(sl)
            amp = 0.05 * grain * pr * (0.5 + 2.0 * e)
            jit = np.where(u < t, 1.0, -1.0) * np.minimum(t, 1 - t) * amp
            t = np.clip(t + jit * (np.abs(u - 0.5) > 0.3), 0, 1)
        self._spray_in(sl, m[sl], ramp(t, stops), grain * 0.5, 'paint', e)

    def field(self, mask, colour_fn, grain=1.0, density=1.0):
        """a pass whose colour is any smooth function of design-independent canvas coords inside the mask's
        box: colour_fn(xx, yy) -> (h, w, 3). Used for gradients that are not linear (two-way modelling)."""
        m = np.asarray(mask, np.float32)
        sl = _box(m > 0)
        if sl is None:
            return
        c = colour_fn(self.xx[sl], self.yy[sl])
        e = self._edge(m[sl]) if grain else None
        d = m[sl] * density if np.ndim(density) == 0 else m[sl] * np.asarray(density, np.float32)[sl]
        self._spray_in(sl, d, c, grain, 'paint', e)

    def overspray(self, mask, colour, dx=0.0, dy=1.0, width=3.0, density=0.3, grain=1.0, blend='paint'):
        """the fog that drifts under one side of a frisket: the mask softened, pushed toward (dx, dy) and
        kept only outside the cut shape; it lands mostly as coarse droplets. width in canvas px."""
        m = np.asarray(mask, np.float32)
        pad = int(3 * width + abs(dx) + abs(dy)) + 3
        sl = _box(m > 0, pad, m.shape)
        if sl is None:
            return
        sub = m[sl]
        b = shift(blur(sub, width), dx, dy)
        halo = np.clip(b - sub, 0, 1) * density
        dots = (self.drop2[sl] < halo * 1.4).astype(np.float32)
        d = halo * 0.7 + dots * np.minimum(halo * 1.4, 0.3) * grain
        full = np.zeros_like(m)
        full[sl] = d
        self.spray(full, colour, grain=0, blend=blend)

    def finish(self, paper='#efe4cc', tooth=0.022, warm=0.04, vignette=0.12):
        """the lithographic print on smooth illustration board: a fine, even tooth (no stretched paper fibres,
        which read as brush streaks), a faint warm cast, a slight edge vignette"""
        H, W = self.H, self.W
        n = noise2d(H, W, 2.5, 2, self._seed()) - 0.5
        img = self.img * (1 + tooth * n)[..., None]
        img = img * (1 - warm) + warm * _c(paper) * (0.35 + 0.65 * img)
        r = np.hypot((self.xx - W / 2) / (W / 2), (self.yy - H / 2) / (H / 2))
        self.img = img * (1 - vignette * smoothstep(0.65, 1.45, r))[..., None]

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

    def disc(self, cx, cy, r):
        out = np.zeros((self.H, self.W), np.float32)
        y0, y1 = max(0, int(cy - r) - 2), min(self.H, int(cy + r) + 3)
        x0, x1 = max(0, int(cx - r) - 2), min(self.W, int(cx + r) + 3)
        if y1 > y0 and x1 > x0:
            out[y0:y1, x0:x1] = np.clip(r - np.hypot(self.xx[y0:y1, x0:x1] + 0.5 - cx,
                                                     self.yy[y0:y1, x0:x1] + 0.5 - cy) + 0.5, 0, 1)
        return out

    def bar(self, p0, p1, w):
        return self._bar(p0, p1, w)


# ------------------------------------------------------------ sky, sun, rays
def graded_sky(a, S, stops, y_top, y_bot):
    """the sky as ONE airbrush pass: a long smooth fade through the colour stops (design y_top..y_bot); the
    whole design range is covered so the bleed is painted"""
    m = np.zeros((a.H, a.W), np.float32)
    m[:int(np.ceil(S.y(y_bot))) + 2] = 1
    a.fade(m, stops, S.pt(0, y_top), S.pt(0, y_bot), grain=1.0)


def halo_rings(a, S, rng, cx, cy, radii, colour, dens, bottom=None):
    """stepped halo round the sun: discs cut with a compass, largest first, each sprayed with a radial fade
    (heavier toward the centre). Within a disc the tone flows; the disc edges are the design lines."""
    for k, R in enumerate(sorted(radii, reverse=True)):
        R = R * rng.uniform(0.97, 1.03)
        m = a.disc(S.x(cx), S.y(cy), S(R))
        if bottom is not None:
            m = m * np.clip(S.y(bottom) - a.yy, 0, 1)
        sl = _box(m > 0)
        if sl is None:
            continue
        r = np.hypot(a.xx[sl] - S.x(cx), a.yy[sl] - S.y(cy)) / S(R)
        d = np.zeros_like(m)
        dk = dens[k] if np.ndim(dens) else dens
        d[sl] = m[sl] * (0.45 + 0.55 * np.clip(1 - r, 0, 1) ** 1.5) * dk
        a.spray(d, colour, grain=1.0)


def sun_disc(a, S, cx, cy, r, stops, bottom=None, light=(-0.3, -0.35)):
    """the sun: a disc frisket with one off-centre radial fade (hot core, warmer limb)"""
    m = a.disc(S.x(cx), S.y(cy), S(r))
    if bottom is not None:
        m = m * np.clip(S.y(bottom) - a.yy, 0, 1)
    lx, ly = S.x(cx + light[0] * r), S.y(cy + light[1] * r)
    a.field(m, lambda X, Y: ramp(np.clip(np.hypot(X - lx, Y - ly) / S(r * 1.7), 0, 1), stops), grain=0.6)


def _wob1(rng, n=4):
    """a smooth random 1D wobble function of r (sum of a few sines)"""
    f = rng.uniform(1 / 160, 1 / 25, n)
    ph = rng.uniform(0, 6.3, n)
    w = rng.uniform(0.3, 1.0, n)
    w /= w.sum()
    return lambda r: sum(wk * np.sin(r * fk + pk) for wk, fk, pk in zip(w, f, ph))


def frisket_rays(a, S, rng, cx, cy, angles, r0, reach, colour, dens, bottom=None, soft_side=1, blend='paint'):
    """a fan of sun rays, each one a frisket cut with a knife and sprayed separately with opaque paint:
    heavy near the sun, fading along its length. The knife side is crisp; on the other side the spray crept
    under the film -- an overspray whose width wanders irregularly along the ray, landing partly as droplets.
    angles: [(centre_deg, half_width_deg)], degrees counter-clockwise from 3 o'clock (design coords)."""
    X, Y = S.x(cx), S.y(cy)
    for k, (ang, hw) in enumerate(angles):
        c0, c1 = np.radians(ang - hw), np.radians(ang + hw)
        L = S(reach) * rng.uniform(0.82, 1.15)
        # wedge box
        pts = [(X, Y)] + [(X + np.cos(t) * L, Y - np.sin(t) * L) for t in np.linspace(c0, c1, 5)]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        pad = S(14)
        y0, y1 = max(0, int(min(ys) - pad)), min(a.H, int(max(ys) + pad) + 1)
        if bottom is not None:
            y1 = min(y1, int(np.ceil(S.y(bottom))) + 1)
        x0, x1 = max(0, int(min(xs) - pad)), min(a.W, int(max(xs) + pad) + 1)
        if y1 <= y0 or x1 <= x0:
            continue
        sl = (slice(y0, y1), slice(x0, x1))
        dx, dy = a.xx[sl] + 0.5 - X, -(a.yy[sl] + 0.5 - Y)
        r = np.hypot(dx, dy) + 1e-3
        th = np.arctan2(dy, dx)
        mid = (c0 + c1) / 2
        front = np.cos(th - mid) > 0
        wl, wh = _wob1(rng), _wob1(rng)
        amp = S(0.7) + r * 0.0015
        dlo = r * np.sin(th - c0) + amp * wl(r / a.s)                      # px inside the lower edge
        dhi = r * np.sin(c1 - th) + amp * wh(r / a.s)                      # px inside the upper edge
        if soft_side < 0:
            dlo, dhi = dhi, dlo
        ws = _wob1(rng, 3)
        ow = (S(2.0) + r * 0.012) * (0.55 + 0.45 * (1 + ws(r / a.s)))      # overspray width wanders
        hard = np.clip(dlo + 0.5, 0, 1)
        soft = smoothstep(-ow, ow * 0.6, dhi)
        on = hard * soft * front
        rs = r / L
        fall = (1 - smoothstep(0.05, 1.0, rs)) ** 1.15 * smoothstep(S(r0) * 0.9, S(r0) * 1.15 + S(10), r)
        d = on * fall * dens * rng.uniform(0.82, 1.1)
        if bottom is not None:
            d = d * np.clip(S.y(bottom) - a.yy[sl], 0, 1)
        # the overspray outside the soft edge lands partly as coarse droplets
        out = (dhi < 0) & front
        spat = (a.drop2[sl] < d * 1.2) & out
        d = np.where(out, d * 0.65 + spat * np.minimum(d * 1.2, 0.35), d)
        full = np.zeros((a.H, a.W), np.float32)
        full[sl] = d
        a.spray(full, colour, grain=0.3, blend=blend, edges=False)


def fan_angles(rng, a0, a1, n, w0=1.4, w1=3.6):
    """n ray directions between a0 and a1 degrees: unequal spacing and widths (cut by eye, not by protractor)"""
    base = np.linspace(a0, a1, n)
    step = (a1 - a0) / max(1, n - 1)
    out = []
    for b in base:
        out.append((b + rng.uniform(-0.18, 0.18) * step, rng.uniform(w0, w1)))
    return out


# ------------------------------------------------------------ clouds
def _band_outline(x0, x1, yc, th, head, tail, n=28):
    """one streamlined cloud band: a round head on one end and a long tapering tail on the other
    (head='L' or 'R'); slightly fuller on top than below"""
    L = x1 - x0
    u = np.linspace(0, 1, n)
    hl = min(0.45, th * 0.9 / L)
    tl = min(0.8, th * tail / L)
    if head == 'L':
        a_ = np.where(u < hl, np.sqrt(np.clip(1 - ((hl - u) / hl) ** 2, 0, 1)), 1.0)
        b_ = np.where(u > 1 - tl, np.clip((1 - u) / tl, 0, 1) ** 1.3, 1.0)
    else:
        a_ = np.where(u > 1 - hl, np.sqrt(np.clip(1 - ((u - (1 - hl)) / hl) ** 2, 0, 1)), 1.0)
        b_ = np.where(u < tl, np.clip(u / tl, 0, 1) ** 1.3, 1.0)
    prof = a_ * b_
    xs = x0 + u * L
    top = [(x, yc - th * 0.55 * p) for x, p in zip(xs, prof)]
    bot = [(x, yc + th * 0.45 * p) for x, p in zip(xs[::-1], prof[::-1])]
    return top + bot


def streamline_cloud(a, S, rng, x0, x1, y, h, stops, lit_below, edge_col=None, head=None, stage=None):
    """a Deco cloud: 2-4 long parallel bands stacked with thin gaps of sky between, each with its own length,
    offset, round head and tapered tail; each band one airbrush pass with a vertical fade (lit toward the
    sun) and a little overspray on its shade side"""
    n = int(rng.integers(2, 5))
    head = head or ('L' if rng.random() < 0.5 else 'R')
    L = x1 - x0
    bands = []
    yc = y
    for k in range(n):
        th = h * rng.uniform(0.55, 0.95) * (1 - 0.1 * k)
        ln = L * (rng.uniform(0.75, 1.0) if k == 0 else rng.uniform(0.35, 0.85))
        if head == 'L':
            bx0 = x0 + rng.uniform(0, 0.35) * (L - ln) + k * h * rng.uniform(0.2, 1.4)
        else:
            bx0 = x1 - ln - rng.uniform(0, 0.35) * (L - ln) - k * h * rng.uniform(0.2, 1.4)
        bands.append((bx0, bx0 + ln, yc, th))
        yc -= th * rng.uniform(1.15, 1.45)
    for bx0, bx1, yc, th in bands[::-1]:
        pts = _band_outline(bx0, bx1, yc, th, head, rng.uniform(4, 9))
        m = a.poly(S.pts(hand(pts, rng, amp=0.35, step=18)))
        p0, p1 = (S.pt(0, yc - th * 0.6), S.pt(0, yc + th * 0.5)) if lit_below else \
            (S.pt(0, yc + th * 0.5), S.pt(0, yc - th * 0.6))
        a.fade(m, vary(stops, rng.uniform(0.95, 1.04)), p0, p1)
        if edge_col is not None:
            a.overspray(m, edge_col, dx=0, dy=S(1.5 if lit_below else -1.5), width=S(rng.uniform(1.5, 2.6)),
                        density=0.18)
        if stage:
            stage()
    return bands


# ------------------------------------------------------------ stepped, streamlined mountains
def _bell(cx, base, H, wl, wr, pa, pb, n=56):
    """a smooth asymmetric bell (design px): y = base - H * (1 - |u|^pa)^pb, u in -1..1"""
    u = np.concatenate([-(1 - np.linspace(0, 1, n // 2, endpoint=False)) ** 0.85, np.linspace(0, 1, n // 2 + 1) ** 1.18])
    u = np.sort(np.unique(np.round(u, 6)))
    xs = np.where(u < 0, cx + u * wl, cx + u * wr)
    ys = base - H * np.clip(1 - np.abs(u) ** pa, 0, 1) ** pb
    return xs, ys


def terraced_mountain(rng, cx, base, H, wl, wr, n, peak='dome'):
    """geometry of one stepped mountain (design px): n streamlined layers stacked like terraces. The lowest
    is wide and low, each next one narrower and taller, its summit drifting a little, so the silhouette
    climbs in rounded steps (smooth curves, a shoulder at each step) up to a domed or pointed top.
    Returns [(xs, ys, base, H_layer)] bottom -> top (the top curve of every layer)."""
    out = []
    drift = 0.0
    hs = np.sort(rng.uniform(0.38, 0.86, n - 1)) if n > 1 else np.array([])
    hs = np.concatenate([hs, [1.0]])
    for k in range(n):
        t = k / max(1, n - 1)
        Hk = H * hs[k]
        shrink = 1 - (0.62 if peak == 'point' else 0.5) * t ** rng.uniform(0.8, 1.2)
        wlk = wl * shrink * rng.uniform(0.9, 1.08)
        wrk = wr * shrink * rng.uniform(0.9, 1.08)
        drift += rng.normal(0, 0.04) * (wl + wr) * 0.5 * (k > 0)
        top = k == n - 1
        if top and peak == 'point':
            pa, pb = rng.uniform(1.2, 1.5), rng.uniform(1.0, 1.25)
        elif top:
            pa, pb = rng.uniform(1.6, 2.2), rng.uniform(0.9, 1.3)
        else:
            pa, pb = rng.uniform(1.8, 2.8), rng.uniform(0.7, 1.1)        # broad rounded shoulders
        xs, ys = _bell(cx + drift, base, Hk, wlk, wrk, pa, pb)
        out.append((xs, ys, base, Hk))
    return out


def slab_masks(a, S, slabs, rng=None):
    out = []
    for xs, ys, base, Hk in slabs:
        pts = list(zip(xs, ys)) + [(xs[-1], base + 3), (xs[0], base + 3)]
        out.append(a.poly(S.pts(pts)))
    return out


def paint_terraces(a, S, rng, slabs, body, shade, rim, light=1, rim_k=0.6, shade_k=0.8, stage=None,
                   masks=None):
    """lay a stepped mountain layer by layer, bottom up. Each layer is one frisket and gets: a vertical fade
    (body stops, its crest to its foot), the shade side sprayed across it from its far edge toward a spine
    (a smooth horizontal gradient, no cut), and a streak of light sprayed down from its crest curve, strongest
    on the lit side -- so every step of the terrace reads by its lit rounded edge."""
    masks = masks or slab_masks(a, S, slabs)
    n = len(slabs)
    for k, ((xs, ys, base, Hk), m) in enumerate(zip(slabs, masks)):
        sl = _box(m > 0)
        if sl is None:
            continue
        yt = float(ys.min())
        # the terraces step up in value: lower ones a shade deeper, the summit layer the lightest
        f = 0.86 + 0.2 * k / max(1, n - 1)
        stops = vary(body, f * rng.uniform(0.97, 1.03), rng.uniform(-0.01, 0.01))
        a.fade(m, stops, S.pt(0, yt), S.pt(0, base))
        xl, xr = float(xs.min()), float(xs.max())
        cxp = float(xs[np.argmin(ys)])
        spine = cxp + (xr - cxp if light > 0 else xl - cxp) * rng.uniform(0.1, 0.3)
        far_x = xl if light > 0 else xr
        sx0, sx1 = S.x(spine), S.x(far_x)
        e = a._edge(m[sl])
        t = np.clip((a.xx[sl] - sx0) / (sx1 - sx0 + 1e-6), 0, 1)
        d = m[sl] * smoothstep(0, 1, t) ** 1.1 * shade_k * rng.uniform(0.85, 1.1)
        sh = ramp(np.clip((a.yy[sl] - S.y(yt)) / max(1.0, S.y(base) - S.y(yt)), 0, 1), shade)
        a._spray_in(sl, d, sh, 1.0, 'paint', e)
        # the light along the crest curve
        Xd = (a.xx[sl][0] + 0.5 - S.ox) / S.s
        crest = S.y(np.interp(Xd, xs, ys))[None, :]
        rw = S(max(2.5, Hk * rng.uniform(0.03, 0.055)))
        below = np.maximum(a.yy[sl] + 0.5 - crest, 0)
        dr = m[sl] * np.exp(-below / rw) * (0.2 + 0.8 * (1 - t) ** 1.5) * rim_k * rng.uniform(0.8, 1.1)
        a._spray_in(sl, dr, col(rim), 0.6, 'paint', None)
        if stage:
            stage()
    return masks


def terraced_range(a, S, rng, peaks, base, body, shade, rim, light=1, rim_k=0.6, shade_k=0.8, stage=None):
    """stepped mountains (in the given order). peaks: [(cx, height, half_width_left, half_width_right,
    layers, 'dome'|'point')]. Returns the union of their friskets."""
    union = np.zeros((a.H, a.W), np.float32)
    for cx, Hh, wl, wr, n, peak in peaks:
        slabs = terraced_mountain(rng, cx, base, Hh, wl, wr, n, peak)
        ms = paint_terraces(a, S, rng, slabs, body, shade, rim, light, rim_k, shade_k)
        for mm in ms:
            union = np.maximum(union, mm)
        if stage:
            stage()
    return union


# ------------------------------------------------------------ trees
def deco_pine(a, S, rng, x, root, h, w, lit, shade, trunk, light=1, tiers=None):
    """a stylised Deco conifer: a stack of streamlined tiers, each with concave swept sides ending in a
    slightly lifted tip and a gently bowed underside; each tier split down its axis into a lit half and a
    shade half (two friskets, two fades). Tier count, spacing, widths, lean and tone differ tree to tree."""
    lean = rng.uniform(-0.03, 0.03)
    tw = max(1.2, w * rng.uniform(0.07, 0.11))
    tm = a.poly(S.pts([(x - tw / 2, root + 1), (x + tw / 2, root + 1), (x + tw * 0.3, root - h * 0.22),
                       (x - tw * 0.3, root - h * 0.22)]))
    a.spray(tm, trunk, grain=0.4)
    union = tm
    n = int(tiers if tiers is not None else rng.integers(3, 6))
    f = rng.uniform(0.86, 1.12)
    ls, ss = vary(lit, f), vary(shade, f)
    body_h = h * rng.uniform(0.8, 0.88)
    cuts = np.sort(rng.uniform(0.22, 1.0, n - 1))
    bots = np.concatenate([cuts, [1.0]]) * body_h
    top = root - h
    prev = 0.0
    pw = rng.uniform(1.3, 2.2)
    for k in range(n):
        by = top + bots[k]
        ty = top + (prev * rng.uniform(0.45, 0.8) if k else 0)
        ax = x + lean * (root - ty)
        bx = x + lean * (root - by)
        hw = w / 2 * (0.3 + 0.7 * (bots[k] / bots[-1]) ** rng.uniform(0.8, 1.2)) * rng.uniform(0.9, 1.08)
        hl, hr = hw * rng.uniform(0.85, 1.12), hw * rng.uniform(0.85, 1.12)
        lift = (by - ty) * rng.uniform(0.0, 0.12)
        sag = (by - ty) * rng.uniform(0.04, 0.14)
        ts = np.linspace(0, 1, 9)
        right = [(ax + (bx + hr - ax) * t ** pw, ty + (by - lift - ty) * t) for t in ts]
        left = [(ax + (bx - hl - ax) * t ** pw, ty + (by - lift - ty) * t) for t in ts]
        under_r = bez((bx + hr, by - lift), (bx + hr * 0.4, by + sag * 0.3), (bx, by + sag), 6)
        under_l = bez((bx, by + sag), (bx - hl * 0.4, by + sag * 0.3), (bx - hl, by - lift), 6)
        if light > 0:
            lit_pts = right + under_r + [(ax, ty)]
            sh_pts = [(ax, ty), (bx, by + sag)] + under_l + left[::-1]
        else:
            lit_pts = [(ax, ty), (bx, by + sag)] + under_l + left[::-1]
            sh_pts = right + under_r + [(ax, ty)]
        ms = a.poly(S.pts(hand(sh_pts, rng, amp=0.25, step=10)))
        ml = a.poly(S.pts(hand(lit_pts, rng, amp=0.25, step=10)))
        a.fade(ms, ss, S.pt(0, ty), S.pt(0, by + sag))
        a.fade(ml, ls, S.pt(0, ty), S.pt(0, by + sag))
        union = np.maximum(union, np.maximum(ms, ml))
        prev = bots[k]
    return union


def cypress(a, S, rng, x, base, h, lit, shade, light=1, steps=None):
    """a streamlined cypress: a tall ogive (pointed top, fullest low down) built of 2-4 stacked forms, each
    set a hair narrower than the one below with a small notch between; split light/shade down the axis"""
    w = h * rng.uniform(0.11, 0.17)
    n = int(steps if steps is not None else rng.integers(2, 5))
    lean = rng.uniform(-0.04, 0.04) * h
    belly = rng.uniform(0.25, 0.4)
    cuts = np.sort(rng.uniform(0.25, 0.8, n - 1))
    edges = np.concatenate([[0.0], cuts, [1.0]])
    f = rng.uniform(0.88, 1.12)
    for k in range(n):
        t0, t1 = edges[k], edges[k + 1]
        ts = np.linspace(t0, t1, 10)

        def hw(t):
            return w * np.where(t < belly, 0.62 + 0.38 * np.sin(np.pi / 2 * t / belly),
                                np.clip(np.cos(np.pi / 2 * (t - belly) / (1 - belly)), 0, 1) ** 0.75)
        inset = 0.0 if k == 0 else 0.06
        notch = (t1 - t0) * h * 0.06 if k < n - 1 else 0
        cxs = x + lean * ts
        ys = base - h * ts
        hws = hw(ts) * (1 - inset)
        # each form tucks in under the one above: the top of a lower form tapers a little (the notch)
        hws[-1] = hws[-1] * (0.75 if k < n - 1 else 0.0)
        right = [(c + q, y) for c, q, y in zip(cxs, hws, ys)]
        left = [(c - q, y) for c, q, y in zip(cxs[::-1], hws[::-1], ys[::-1])]
        axis = [(c, y) for c, y in zip(cxs[::-1], ys[::-1])]
        lit_side = right if light > 0 else left[::-1]
        sh_side = left[::-1] if light > 0 else right
        ml = a.poly(S.pts(lit_side + axis))
        ms = a.poly(S.pts(sh_side + axis))
        a.fade(ms, vary(shade, f), S.pt(0, base - h * t1), S.pt(0, base - h * t0 + notch))
        a.fade(ml, vary(lit, f), S.pt(0, base - h * t1), S.pt(0, base - h * t0 + notch))


# ------------------------------------------------------------ water
def strip(a, S, x0, x1, y, th, taper=None, point=0.6):
    """one stencilled water strip: a long lens, thickest toward its head, ends cut to a point (design px in);
    the knife edge is on top, the spray crept a little under the frisket along the bottom"""
    cx0, cx1, cy, r = S.x(x0), S.x(x1), S.y(y), max(0.35, S(th) / 2)
    out_sl = (slice(max(0, int(cy - r) - 2), min(a.H, int(cy + 1.5 * r) + 4)),
              slice(max(0, int(cx0) - 1), min(a.W, int(cx1) + 2)))
    if out_sl[0].stop <= out_sl[0].start or out_sl[1].stop <= out_sl[1].start:
        return None, None
    xx, yy = a.xx[out_sl] + 0.5, a.yy[out_sl] + 0.5
    L = max(1.0, cx1 - cx0)
    tl, tr = taper if taper is not None else (0.25, 0.25)
    u = (xx - cx0) / L
    prof = np.clip(np.minimum(u / tl, (1 - u) / tr), 0, 1) ** point
    half = r * prof
    dy = yy - cy
    soft = max(0.6, 0.35 * r)
    top = np.clip(half + dy + 0.5, 0, 1)
    bot = np.clip((half - dy) / (2 * soft) + 0.5, 0, 1)
    cov = top * bot * np.clip(np.minimum(xx - cx0, cx1 - xx) + 0.5, 0, 1)
    return out_sl, cov.astype(np.float32)


def speed_lines(rng, x0, x1, y0, y1, th0, th1, len0, len1, n_rows, cover=0.35, x_pref=None):
    """layout of Deco water speed lines: rows from y0 (far) to y1 (near), spacing and thickness growing
    toward the viewer; in each row a few long tapered lines of very different lengths, clustered
    (x_pref(x) -> weight). Returns [(x0, x1, y, th, head)]"""
    out = []
    ys = y0 + (y1 - y0) * np.sort(rng.uniform(0, 1, n_rows)) ** 1.35
    for y in ys:
        t = (y - y0) / max(1e-6, y1 - y0)
        th = (th0 + (th1 - th0) * t) * rng.uniform(0.6, 1.3)
        Ln = len0 + (len1 - len0) * t
        x = x0 - rng.uniform(0, Ln)
        while x < x1:
            L = Ln * rng.lognormal(0, 0.75)
            w = 1.0 if x_pref is None else x_pref(x + L / 2)
            if rng.random() < cover * w:
                out.append((x, x + L, y + rng.uniform(-0.3, 0.3) * th, th, 'L' if rng.random() < 0.5 else 'R'))
            x += L * rng.uniform(1.1, 2.6)
    return out


def lay_lines(a, S, rng, segs, colour, dens, blend='paint'):
    for x0, x1, y, th, head in segs:
        tl, tr = (rng.uniform(0.03, 0.1), rng.uniform(0.35, 0.7)) if head == 'L' else \
            (rng.uniform(0.35, 0.7), rng.uniform(0.03, 0.1))
        sl, cov = strip(a, S, x0, x1, y, th, taper=(tl, tr), point=0.9)
        if sl is None:
            continue
        # sprayed heavier at the head, thinning toward the tail
        u = np.clip((a.xx[sl] - S.x(x0)) / max(1.0, S.x(x1) - S.x(x0)), 0, 1)
        g = (1 - 0.6 * u) if head == 'L' else (0.4 + 0.6 * u)
        c = col(colour) if isinstance(colour, str) else colour(y)
        a._spray_in(sl, cov * g * dens * rng.uniform(0.7, 1.1), c, 1.0, blend, None)


def reflect_bands(a, S, rng, mask, HZ, depth, stops, dens, compress=0.75, th0=3.0, th1=14.0, gap0=1.6, gap1=7.0,
                  shear=1.0, cuts=0.25, x_clip=None):
    """a reflection laid as stepped stencil bands: the silhouette above the waterline is read upside down
    (shortened), and only horizontal bands of it are cut, each band shifted a little sideways and now and
    then cut through; bands thicken and the gaps widen toward the viewer, the paint thins out with depth.
    The colour of each band is a vertical fade through `stops` (near the shore -> far out)."""
    hz = int(round(S.y(HZ)))
    H, W = a.H, a.W
    yd = HZ + gap0 * 0.6
    while yd < HZ + depth:
        t = (yd - HZ) / depth
        th = (th0 + (th1 - th0) * t) * rng.uniform(0.7, 1.25)
        y0c, y1c = S.y(yd), S.y(yd + th)
        r0, r1 = max(hz, int(np.floor(y0c))), min(H, int(np.ceil(y1c)) + 2)
        if r1 <= r0:
            yd += th + gap0
            continue
        rows = np.arange(r0, r1)
        src = np.clip(np.round(hz - 1 - (rows + 0.5 - hz) / compress).astype(int), 0, hz - 1)
        band = mask[src].copy()
        dx = int(round(S(rng.normal(0, 1.5 + 6 * t) * shear)))
        if dx:
            band = np.roll(band, dx, 1)
            if dx > 0:
                band[:, :dx] = 0
            else:
                band[:, dx:] = 0
        yy = rows[:, None] + 0.5
        cov = np.clip(yy - y0c + 0.5, 0, 1) * np.clip((y1c - yy) / max(0.8, S(th) * 0.35) + 0.5, 0, 1)
        band = band * cov
        if cuts and rng.random() < cuts * 2:
            for _ in range(int(rng.integers(1, 4))):
                cx = rng.uniform(0, W)
                cw = S(rng.uniform(6, 40)) * (0.5 + t)
                xs = a.xx[0]
                band = band * (1 - np.clip(1 - np.abs(xs - cx) / cw, 0, 1) ** 0.2 * (np.abs(xs - cx) < cw))[None, :]
        if x_clip is not None:
            band = band * x_clip[None, :]
        full = np.zeros((H, W), np.float32)
        full[r0:r1] = band
        c = ramp(np.full((1, 1), t, np.float32), stops)[0, 0]
        a.spray(full, c, density=dens * (1 - 0.55 * t) * rng.uniform(0.85, 1.05), grain=1.0)
        yd += th + (gap0 + (gap1 - gap0) * t) * rng.uniform(0.6, 1.5)


def sun_path(a, S, rng, sx, HZ, y_end, w0, w1, colour, dens):
    """the sun's path on the water as stacked speed lines: knife-pointed bars, short and close near the
    horizon, longer and further apart toward the viewer; each its own length, offset and lopsided taper, and
    now and then a bar is cut in two"""
    y = HZ + 2
    while y < y_end:
        t = (y - HZ) / (y_end - HZ)
        L = (w0 + (w1 - w0) * t) * rng.uniform(0.35, 1.2)
        c = sx + rng.normal(0, 0.14) * (w0 + (w1 - w0) * t)
        th = 1.4 + 5.5 * t * rng.uniform(0.6, 1.25)
        pieces = [(c - L / 2, c + L / 2)]
        if L > 60 and rng.random() < 0.35:
            g = rng.uniform(0.3, 0.7)
            gw = L * rng.uniform(0.04, 0.12)
            pieces = [(c - L / 2, c - L / 2 + L * g - gw / 2), (c - L / 2 + L * g + gw / 2, c + L / 2)]
        for p0, p1 in pieces:
            tl, tr = (rng.uniform(0.08, 0.2), rng.uniform(0.3, 0.6)) if rng.random() < 0.5 else \
                (rng.uniform(0.3, 0.6), rng.uniform(0.08, 0.2))
            sl, cov = strip(a, S, p0, p1, y, th, taper=(tl, tr), point=1.0)
            if sl is not None:
                a._spray_in(sl, cov * dens * (1 - 0.5 * t) * rng.uniform(0.7, 1.0), col(colour), 1.0, 'paint', None)
        y += th + (2.5 + 18 * t) * rng.uniform(0.6, 1.4)


def chevrons(a, S, rng, x, y, n, span, depth, th, colour, dens, flip=1, gap=None):
    """stepped chevron ripples: n nested shallow V's, each a pair of tapered bars meeting at a blunt point,
    every step a little longer and thinner than the last (flip=-1 opens to the left)"""
    gap = gap or th * 2.6
    for k in range(n):
        L = span * (0.55 + 0.45 * (k + 1) / n) * rng.uniform(0.85, 1.12)
        tip = (x + flip * k * gap * 1.2, y)
        for side in (-1, 1):
            ex, ey = tip[0] + flip * L, tip[1] + side * depth * (0.6 + 0.4 * (k + 1) / n) * rng.uniform(0.85, 1.15)
            ang = np.arctan2(ey - tip[1], ex - tip[0])
            ln = np.hypot(ex - tip[0], ey - tip[1])
            w = th * (1 - 0.35 * k / max(1, n)) * rng.uniform(0.8, 1.1)
            nx, ny = -np.sin(ang), np.cos(ang)
            ts = np.linspace(0, 1, 10)
            prof = w * (1 - ts) ** 0.8 * np.clip(ts * 6, 0.35, 1)
            cxs, cys = tip[0] + (ex - tip[0]) * ts, tip[1] + (ey - tip[1]) * ts
            pts = [(cx_ + nx * p / 2, cy_ + ny * p / 2) for cx_, cy_, p in zip(cxs, cys, prof)] + \
                  [(cx_ - nx * p / 2, cy_ - ny * p / 2) for cx_, cy_, p in zip(cxs[::-1], cys[::-1], prof[::-1])]
            m = a.poly(S.pts(pts))
            a.spray(m, colour, density=dens * rng.uniform(0.75, 1.05) * (1 - 0.3 * k / max(1, n)), grain=1.0)


# ------------------------------------------------------------ birds
def deco_bird(a, S, rng, bx, by, sz, lift, tilt, colour, under=None):
    """a streamlined Deco bird: a slim spindle body and two long thin crescent wings (a gentle gull 'M'),
    the leading edge an arch, the trailing edge following it a little lower and meeting it at a fine point;
    each wing its own lift, length, sweep and thickness; sprayed with a short fade from the back down"""
    c, s_ = np.cos(tilt), np.sin(tilt)
    wings = []
    for side in (-1, 1):
        L = sz * rng.uniform(0.88, 1.08)
        up = lift * rng.uniform(0.75, 1.25)
        elbow = (side * L * rng.uniform(0.32, 0.42), -up * sz * 0.42 - sz * 0.06)
        tip = (side * L, -up * sz * 0.18 + sz * rng.uniform(0.04, 0.14))
        w = sz * rng.uniform(0.07, 0.11)                     # wing chord at the elbow
        lead = bez((side * sz * 0.05, -sz * 0.035), (elbow[0] * 0.6, elbow[1] - w * 0.2), elbow, 8) + \
            bez(elbow, ((elbow[0] + tip[0]) / 2, elbow[1] - sz * 0.02), tip, 8)[1:]
        trail = bez(tip, ((elbow[0] + tip[0]) / 2 + side * w * 0.3, elbow[1] + w * 1.2), (elbow[0], elbow[1] + w), 8) + \
            bez((elbow[0], elbow[1] + w), (elbow[0] * 0.5, elbow[1] * 0.4 + w * 1.4), (side * sz * 0.07, sz * 0.05), 8)[1:]
        wings.append((lead, trail))
    (ll, lt), (rl, rt) = wings
    body = [(-sz * 0.03, sz * 0.02), (0, -sz * 0.06), (sz * 0.03, sz * 0.02)]
    tail = [(sz * 0.035, sz * 0.09), (0, sz * 0.16), (-sz * 0.035, sz * 0.09)]
    # outline: head -> right leading edge -> right trailing edge -> tail -> left trailing edge (body -> tip)
    # -> left leading edge (tip -> body)
    poly_ = [body[1]] + rl + rt + tail + lt[::-1] + ll[::-1]
    P = [(bx + x * c - y * s_, by + x * s_ + y * c) for x, y in poly_]
    m = a.poly(S.pts(P))
    if under is None:
        a.fade(m, [(0, vary([(0, colour)], 1.3)[0][1]), (1, colour)], S.pt(bx, by - sz * 0.4), S.pt(bx, by + sz * 0.1),
               grain=0.6)
    else:
        a.fade(m, [(0, colour), (0.5, colour), (1, under)], S.pt(bx, by - sz * 0.3), S.pt(bx, by + sz * 0.15),
               grain=0.6)


# ------------------------------------------------------------ mist
def haze(a, S, rng, x0, x1, y_edge, depth, colour, density, xfade=None, jag=6.0, above=0.18):
    """mist laid with a cut frisket: a long straight-ish knife edge with a few small steps, the airbrush
    passes along it so the haze is densest at the edge and thins downward (smoothly); a little overspray
    creeps above the edge. xfade(x_design) -> 0..1 thins it along its length."""
    xs, ys = [x0 - 30], [y_edge]
    x, y = x0 - 30, y_edge
    while x < x1 + 30:
        x += rng.uniform(120, 380)
        if rng.random() < 0.45:
            xs.append(x)
            ys.append(y)
            y = y_edge + np.clip(y - y_edge + rng.choice([-1, 1]) * rng.uniform(0.5, 1.0) * jag, -jag * 1.6, jag * 1.6)
        xs.append(x)
        ys.append(y)
    ex, ey = np.array(xs), np.array(ys)
    X = (a.xx[0] - S.ox) / S.s
    ey_c = np.interp(X, ex, ey)
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
    a.spray(d, colour, grain=1.0, edges=False)


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


def design_xy(a, S):
    """per-pixel design coordinates of the canvas"""
    return (a.xx - S.ox) / S.s, (a.yy - S.oy) / S.s
