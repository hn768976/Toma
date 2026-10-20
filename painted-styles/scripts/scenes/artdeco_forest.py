"""Forest path -- Art Deco (airbrush through hand-cut friskets, a 1920s-30s travel poster).
Tall tapering trunks like a colonnade (some on stepped plinths, some with a swept root flare, each with its
own airbrushed modelling), a canopy hung with Deco fans (half-discs of stepped rings, some ribbed like a
shell), a sun with a halo of compass-cut rings and a fan of frisket rays glowing at the end of a winding
path, shafts of light each cut as a frisket (crisp on one side, an irregular overspray on the other), long
trunk shadows across the path, an elegant stag in the distance, stylised palmettes and chevron fronds in the
foreground. No lettering, no border. Colourways: Day and Dusk."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from drawkit import Scaler, seed_all, save_png, group_rng
from core import smoothstep
from artdeco import ramp
from _artdeco_kit import (Deco, Stager, hand, vary, col, mix, bez, _box, graded_sky, halo_rings, sun_disc,
                          frisket_rays, fan_angles)

STYLE = "Art Deco · 装饰艺术"
LIB = "artdeco"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

GY = 628           # where the forest floor meets the light (design px)
DEER = (1004, 654, 44)     # hoof line x, y, shoulder height

PAL = {
    'Dusk': dict(
        sun=(980, 470), sun_r=60,
        sky=[(0, '#1e2442'), (0.3, '#353e6c'), (0.55, '#8a5468'), (0.75, '#de7e4c'), (0.92, '#f2b866'),
             (1, '#f8d892')],
        rings=(96, 140, 200), ring='#ffd99a', ring_d=(0.2, 0.15, 0.11),
        ray='#ffe0aa', ray_d=0.34,
        sun_stops=((0, '#fff6dc'), (0.55, '#ffd696'), (1, '#f49a52')), halo='#ffd59a',
        canopy_b=[(0, '#2a3152'), (1, '#3c4268')], fan_b=[(0, '#4a4c78'), (1, '#2c3256')], fan_b_rim='#d88a6a',
        canopy_f=[(0, '#0e1226'), (1, '#1a2040')], fan_f=[(0, '#2a2e52'), (1, '#12162c')], fan_f_rim='#a0605a',
        far=[(0, '#9c6a62'), (0.6, '#c48262'), (1, '#f2b070')],
        mid=[(0, '#22243e'), (0.55, '#3a3d62'), (1, '#e28a52')],
        near=[(0, '#0e1024'), (0.6, '#1c1f38'), (1, '#c4683e')],
        plinth='#f2a868',
        ground=[(0, '#eaa462'), (0.18, '#8a5650'), (0.55, '#2c2c4a'), (1, '#121426')],
        path=[(0, '#ffe4ac'), (0.25, '#f2ae6c'), (0.7, '#a8604a'), (1, '#46304a')],
        shadow='#191a32', shaft='#ffd89a', shaft_d=0.2,
        deer='#1a1c32', deer_rim='#ffcf8a',
        leaf=[(0, '#c86e3e'), (0.45, '#262c48'), (1, '#0c0e1e')], leaf_sh=[(0, '#080a16'), (1, '#3a2434')],
        vignette=0.14),
    'Day': dict(
        sun=(1000, 300), sun_r=50,
        sky=[(0, '#22607c'), (0.3, '#4c90a2'), (0.6, '#a2ccb4'), (0.84, '#dceac4'), (1, '#f8f4da')],
        rings=(84, 124, 176), ring='#fffbe0', ring_d=(0.22, 0.16, 0.12),
        ray='#fffbe0', ray_d=0.3,
        sun_stops=((0, '#fffef8'), (0.6, '#fff8dc'), (1, '#f6e09a')), halo='#fff6d0',
        canopy_b=[(0, '#2a6448'), (1, '#4c8a5e')], fan_b=[(0, '#6aa070'), (1, '#3c7454')], fan_b_rim='#d8e6a0',
        canopy_f=[(0, '#0c2a1e'), (1, '#1c4a32')], fan_f=[(0, '#3a6a48'), (1, '#143a28')], fan_f_rim='#a8c47a',
        far=[(0, '#6a8a7a'), (0.6, '#8aa898'), (1, '#e2ecc8')],
        mid=[(0, '#26402e'), (0.55, '#3e5a44'), (1, '#e0d898')],
        near=[(0, '#0c1e14'), (0.6, '#17301f'), (1, '#a8b066')],
        plinth='#e8e2a8',
        ground=[(0, '#eef0c0'), (0.18, '#9ec27a'), (0.55, '#3e7046'), (1, '#10281a')],
        path=[(0, '#fffbe6'), (0.25, '#f4e2aa'), (0.7, '#c49a64'), (1, '#6a4a32')],
        shadow='#18361f', shaft='#fffbe0', shaft_d=0.2,
        deer='#5a3420', deer_rim='#fff2c4',
        leaf=[(0, '#c4dc84'), (0.45, '#2e6a3e'), (1, '#0a2016')], leaf_sh=[(0, '#06160e'), (1, '#1e4a2c')],
        vignette=0.12),
}


def _path_c(y):
    """centre x and half-width of the winding path at design row y"""
    t = np.clip((y - GY) / (1080 - GY), 0, 1.4)
    cx = 975 + 130 * np.sin(t * 2.4) - 190 * t
    hw = 10 + 380 * t ** 1.45
    return cx, hw


# ------------------------------------------------------------------ trunks
def _trunk(a, S, rng, x, base, w, stops, sun_x, top=None, plinth_col=None, lit_k=1.0):
    """a stylised trunk: one frisket with its own taper and lean, standing either on a stepped plinth (2-3
    rounded rings, each a step narrower) or on a smooth swept flare; modelled with one airbrush pass whose
    colour runs across the trunk through the trunk's own ramp (where the light side sits, how wide it is and
    how hot it gets differ trunk to trunk) and darkens a little toward the top"""
    top = S.Y0 - 10 if top is None else top
    Hh = base - top
    lean = rng.uniform(-0.012, 0.012)
    taper = rng.uniform(0.1, 0.45)
    steps = int(rng.choice([0, 0, 2, 3])) if w > 12 else 0
    plh = w * rng.uniform(0.18, 0.3)
    foot = base - (steps * plh if steps else 0)
    flare = 0 if steps else w * rng.uniform(0.15, 0.5)
    fh = w * rng.uniform(0.6, 1.4)
    ts = np.concatenate([np.linspace(0, 0.12, 8)[:-1], np.linspace(0.12, 1, 10)])
    ys = foot - (foot - top) * ts
    cx = x + lean * (foot - ys)
    hw = w / 2 * (1 - taper * ts)
    fl = flare * np.clip(1 - (foot - ys) / fh, 0, 1) ** 2.2
    left = [(c - h - f, y) for c, h, f, y in zip(cx, hw, fl, ys)]
    right = [(c + h + f, y) for c, h, f, y in zip(cx[::-1], hw[::-1], fl[::-1], ys[::-1])]
    m = a.poly(S.pts(hand(left + right + [(cx[0] - hw[0] - fl[0], foot + 2)], rng, amp=0.35, step=24)))
    side = 1 if sun_x > x else -1
    pos = rng.uniform(0.62, 0.9)                     # where the light side sits across the trunk (0..1)
    hot = rng.uniform(0.55, 1.0) * lit_k
    sharp = rng.uniform(1.5, 5.0)
    st = vary(stops, rng.uniform(0.9, 1.1))
    X0, X1 = S.x(x - w / 2), S.x(x + w / 2)
    yt, yb = S.y(top), S.y(foot)

    def colour(Xc, Yc):
        u = np.clip((Xc - X0) / max(1.0, X1 - X0), 0, 1)
        u = u if side > 0 else 1 - u
        # dark side -> body -> a lit band near `pos` -> a little reflected light at the very edge
        lit = np.exp(-((u - pos) * sharp) ** 2) * hot
        base_t = 0.15 + 0.4 * u
        t = np.clip(base_t * (1 - lit) + lit, 0, 1)
        c = ramp(t, st)
        v = np.clip((Yc - yt) / max(1.0, yb - yt), 0, 1)
        return c * (0.82 + 0.18 * v[..., None])
    a.field(m, colour, grain=0.8)
    if steps:
        for k in range(steps):
            y1 = base - k * plh
            y0 = y1 - plh * rng.uniform(0.85, 1.0)
            hw_k = w / 2 * (1.18 + 0.16 * (steps - k)) * rng.uniform(0.96, 1.04)
            r = (y1 - y0) * 0.45
            pts = [(x - hw_k, y1)] + bez((x - hw_k, y0 + r), (x - hw_k, y0), (x - hw_k + r, y0), 5) + \
                bez((x + hw_k - r, y0), (x + hw_k, y0), (x + hw_k, y0 + r), 5) + [(x + hw_k, y1)]
            pm = a.poly(S.pts(pts))
            a.field(pm, lambda Xc, Yc, hw_k=hw_k: colour(S.x(x) + (Xc - S.x(x)) * (w / 2) / hw_k, Yc), grain=0.8)
            # the top of each step catches the light
            sl = _box(pm > 0)
            if sl is not None and plinth_col is not None:
                ty = a.yy[sl] - S.y(y0)
                u = np.clip((a.xx[sl] - S.x(x - hw_k)) / S(2 * hw_k), 0, 1)
                u = u if side > 0 else 1 - u
                a._spray_in(sl, pm[sl] * np.exp(-np.maximum(ty, 0) / S(1.6)) * (0.2 + 0.6 * u) * lit_k,
                            col(plinth_col), 0.5, 'paint', None)
    return m


# ------------------------------------------------------------------ canopy
def _fan_canopy(a, S, rng, base, r, amp, ceiling, fan, rim, ribs=True):
    """a ceiling of leaves hung with Deco fans: half-discs of different sizes hanging below a line, each
    made of 2-4 stepped rings (outer ring first, each inner disc its own pass, lighter toward the rim where the
    light from below catches it), some ribbed like a shell. Fans overlap irregularly."""
    fans = []
    x = S.X1 + r
    while x > S.X0 - r * 1.5:
        rr = r * rng.uniform(0.55, 1.45)
        cy = base + amp * smoothstep(80, 760, abs(x - 1000)) + rng.uniform(-0.3, 0.3) * r
        fans.append((x, cy, rr, rng.uniform(0.75, 1.0)))
        x -= rr * rng.uniform(1.1, 1.75)
    # the ceiling: everything above the fans' hanging line
    line = sorted(fans)
    pts = [(S.X0 - 30, S.Y0 - 30), (S.X1 + 30, S.Y0 - 30), (S.X1 + 30, line[-1][1])] + \
        [(fx, fy) for fx, fy, _, _ in line[::-1]] + [(S.X0 - 30, line[0][1])]
    m = a.poly(S.pts(pts))
    a.fade(m, ceiling, S.pt(0, base - 60), S.pt(0, base + amp))
    union = m.copy()
    order = rng.permutation(len(fans))
    for i in order:
        fx, fy, rr, sq = fans[i]
        n = int(rng.integers(2, 5))
        radii = np.sort(rng.uniform(0.3, 0.85, n - 1))[::-1]
        radii = np.concatenate([[1.0], radii]) * rr
        f = rng.uniform(0.9, 1.1)
        nrib = int(rng.integers(5, 10)) if (ribs and rng.random() < 0.45) else 0
        X, Y = S.x(fx), S.y(fy)
        for k, R in enumerate(radii):
            sl = (slice(max(0, int(Y - S(R * sq)) - 2), min(a.H, int(Y + S(R * sq)) + 3)),
                  slice(max(0, int(X - S(R)) - 2), min(a.W, int(X + S(R)) + 3)))
            if sl[0].stop <= sl[0].start or sl[1].stop <= sl[1].start:
                continue
            dx, dy = a.xx[sl] + 0.5 - X, (a.yy[sl] + 0.5 - Y) / sq
            rad = np.hypot(dx, dy)
            mk = np.clip(S(R) - rad + 0.5, 0, 1) * np.clip(a.yy[sl] + 0.5 - Y + S(R) * 0.15, 0, 1)
            if not mk.any():
                continue
            full = np.zeros((a.H, a.W), np.float32)
            full[sl] = mk
            union = np.maximum(union, full)
            # radial airbrush: deeper toward the hub, the rim catching the light
            t = np.clip(rad / S(R), 0, 1)
            stops = vary(fan, f * (1.0 + 0.07 * k))
            c = ramp(1 - t, stops)
            rimw = np.clip((t - 0.72) / 0.28, 0, 1) ** 2 * rng.uniform(0.35, 0.6)
            c = c * (1 - rimw[..., None]) + col(rim) * rimw[..., None]
            a._spray_in(sl, mk, c, 1.0, 'paint', a._edge(mk))
            if nrib and k == 0:
                ang = np.arctan2(dy, dx)
                ph = rng.uniform(0, np.pi / nrib)
                rib = (np.sin(ang * nrib + ph) > rng.uniform(0.2, 0.6)).astype(np.float32)
                rib = rib * mk * smoothstep(0.15, 0.6, t) * rng.uniform(0.18, 0.3)
                a._spray_in(sl, rib, col(fan[-1][1]) * 0.8, 0.8, 'paint', None)
    return union


# ------------------------------------------------------------------ the stag
def _taper(path, w0, w1):
    """a tapered stroke along a polyline (design px)"""
    P = np.asarray(path, float)
    d = np.gradient(P, axis=0)
    d /= np.hypot(d[:, 0], d[:, 1])[:, None] + 1e-9
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    w = np.linspace(w0, w1, len(P))[:, None] / 2
    return [tuple(p) for p in P + nrm * w] + [tuple(p) for p in (P - nrm * w)[::-1]]


def _deer(a, S, P, rng):
    """an elegant stylised stag: a smooth bean of a body, a long arched neck, a small fine head, slim legs
    that taper to the hoof (the hind legs with a backward hock), lyre-shaped antlers; a dark silhouette with a
    rim of light along its top (the sun is behind it)"""
    x0, y0, u = DEER

    def T(p):
        return (x0 + p[0] * u, y0 - p[1] * u)

    def TB(*ps, n=10):
        return [T(q) for q in bez(*ps, n=n)]
    body = TB((-0.44, 1.0), (-0.52, 0.6), (-0.1, 0.58)) + TB((-0.1, 0.58), (0.28, 0.54), (0.52, 0.7))[1:] + \
        TB((0.52, 0.7), (0.7, 0.86), (0.56, 1.06))[1:] + TB((0.56, 1.06), (0.1, 1.16), (-0.3, 1.08))[1:]
    neck = TB((-0.3, 1.08), (-0.38, 1.5), (-0.58, 1.78)) + TB((-0.58, 1.78), (-0.66, 1.84), (-0.74, 1.8), n=5)[1:] + \
        TB((-0.74, 1.8), (-0.9, 1.72), (-0.98, 1.64), n=6)[1:] + TB((-0.98, 1.64), (-0.88, 1.6), (-0.72, 1.62), n=5)[1:] + \
        TB((-0.72, 1.62), (-0.6, 1.4), (-0.46, 0.96))[1:]
    ear = TB((-0.66, 1.82), (-0.56, 1.98), (-0.52, 1.92), n=5) + TB((-0.52, 1.92), (-0.56, 1.84), (-0.62, 1.79), n=5)[1:]
    m = np.maximum.reduce([a.poly(S.pts(p)) for p in (body, neck, ear)])
    legs = [((-0.36, 0.78), (-0.4, 0.38), (-0.38, 0.0)), ((-0.22, 0.72), (-0.2, 0.36), (-0.25, 0.0)),
            ((0.32, 0.72), (0.5, 0.42), (0.38, 0.0)), ((0.46, 0.78), (0.6, 0.4), (0.5, 0.0))]
    for p0, p1, p2 in legs:
        path = TB(p0, p1, p2, n=12)
        m = np.maximum(m, a.poly(S.pts(_taper(path, u * 0.11, u * 0.035))))
    # antlers: two lyre-shaped beams sweeping back and up, each with a few forward tines
    for side, dx in ((-1, 0.0), (1, 0.06)):
        beam = TB((-0.6 + dx, 1.86), (-0.4 + dx, 2.2), (-0.62 + dx * 2 + 0.05 * side, 2.62), n=14)
        m = np.maximum(m, a.poly(S.pts(_taper(beam, u * 0.06, u * 0.02))))
        for tt, ln in ((0.35, 0.22), (0.62, 0.2), (0.85, 0.14)):
            i = int(tt * (len(beam) - 1))
            bx, by = beam[i]
            tine = [(bx, by)] + bez((bx, by), (bx - ln * u * 0.6, by - ln * u * 0.2), (bx - ln * u * 0.75, by - ln * u * 0.9), 6)[1:]
            m = np.maximum(m, a.poly(S.pts(_taper(tine, u * 0.035, u * 0.012))))
    tail = TB((0.56, 0.98), (0.66, 0.96), (0.64, 0.86), n=5) + [T((0.58, 0.9))]
    m = np.maximum(m, a.poly(S.pts(tail)))
    shp = [T((0.05 + 0.85 * np.cos(t), 0.045 * np.sin(t))) for t in np.linspace(0, 2 * np.pi, 28)]
    a.spray(a.poly(S.pts(shp)), P['shadow'], density=0.4, grain=0.6)
    a.fade(m, [(0, mix(P['deer'], P['deer_rim'], 0.18)), (1, P['deer'])], S.pt(x0, y0 - 2.6 * u), S.pt(x0, y0))
    sh = np.zeros_like(m)
    d = max(1, int(round(S(1.6))))
    sh[d:] = m[:-d]
    a.spray(np.clip(m - sh, 0, 1), P['deer_rim'], density=0.85, grain=0.4, edges=False)


# ------------------------------------------------------------------ stylised plants
def _leaf(a, S, rng, x, y, ang, L, w, curl, lit, shade, light=1):
    """one lanceolate leaf along a gently curved axis, split down its midrib into a lit half and a shade
    half (two friskets, two fades: root dark -> tip lit)"""
    ux, uy = np.cos(ang), -np.sin(ang)
    nx, ny = -uy, ux
    ts = np.linspace(0, 1, 14)
    cxs = x + ux * L * ts + nx * curl * L * ts ** 2
    cys = y + uy * L * ts + ny * curl * L * ts ** 2
    hw = w * np.sin(np.pi * np.clip(ts, 0, 1)) ** 0.8 * (1 - 0.25 * ts)
    sideA = [(cx_ + nx * h, cy_ + ny * h) for cx_, cy_, h in zip(cxs, cys, hw)]
    sideB = [(cx_ - nx * h, cy_ - ny * h) for cx_, cy_, h in zip(cxs, cys, hw)]
    axis = list(zip(cxs, cys))
    A = a.poly(S.pts(sideA + axis[::-1]))
    B = a.poly(S.pts(sideB + axis[::-1]))
    litA = (nx * light) > 0
    a.fade(A, lit if litA else shade, S.pt(x, y), S.pt(cxs[-1], cys[-1]), grain=0.8)
    a.fade(B, shade if litA else lit, S.pt(x, y), S.pt(cxs[-1], cys[-1]), grain=0.8)


def _palmette(a, S, P, rng, x, y, size, lean):
    """a Deco palmette: an odd number of long leaves fanned out, the middle one longest, each its own length,
    width, curl and angle"""
    n = int(rng.choice([5, 5, 7]))
    centre = 90 + lean * 18
    spread = rng.uniform(55, 80)
    f = rng.uniform(0.9, 1.1)
    stops = [(1 - p, c) for p, c in vary(P['leaf'][::-1], f)]          # root dark -> tip lit
    shade = vary(P['leaf_sh'], f)
    order = sorted(range(n), key=lambda k: -abs(k - (n - 1) / 2))
    for k in order:
        f = (k - (n - 1) / 2) / ((n - 1) / 2)
        ang = np.radians(centre + f * spread + rng.uniform(-5, 5))
        L = size * (1 - 0.42 * abs(f) ** 1.3) * rng.uniform(0.85, 1.05)
        _leaf(a, S, rng, x, y, ang, L, size * rng.uniform(0.09, 0.13), -f * rng.uniform(0.12, 0.3), stops, shade)


def _frond(a, S, P, rng, x, y, size, lean):
    """a chevron frond: a curved stem with pairs of tapered leaflets angled up its length, shrinking to the
    tip like a stack of chevrons"""
    stops = vary([(0, P['leaf'][2][1]), (0.5, P['leaf'][1][1]), (1, P['leaf'][0][1])], rng.uniform(0.9, 1.1))
    shade = vary(P['leaf_sh'], rng.uniform(0.9, 1.1))
    bend = lean * size * rng.uniform(0.2, 0.4)
    stem = bez((x, y), (x + bend * 0.3, y - size * 0.55), (x + bend, y - size), 20)
    a.spray(a.poly(S.pts(_taper(stem, size * 0.025, size * 0.008))), P['leaf'][2][1], grain=0.5)
    n = int(rng.integers(6, 10))
    for k in range(n):
        t = 0.12 + 0.86 * k / n
        i = int(t * (len(stem) - 1))
        px, py = stem[i]
        qx, qy = stem[min(i + 1, len(stem) - 1)]
        sa = np.arctan2(-(qy - py), qx - px)
        L = size * 0.32 * (1 - 0.7 * t) * rng.uniform(0.85, 1.1)
        for side in (-1, 1):
            ang = sa + side * np.radians(rng.uniform(40, 58))
            _leaf(a, S, rng, px, py, ang, L, L * rng.uniform(0.16, 0.22), side * rng.uniform(0.05, 0.15),
                  stops, shade)


def _ground_breaks(rng):
    """rows where the forest floor rises a little: shadows thin out there (the same bumps for every shadow)"""
    ys = np.sort(rng.uniform(GY + 20, 1120, 9))
    ws = rng.uniform(4, 16, 9)
    ks = rng.uniform(0.35, 0.8, 9)
    return ys, ws, ks


def _shadow(a, S, rng, x, base, w, sx, sy, L, colour, dens, breaks):
    """a cast shadow: a cut wedge away from the sun, its own width and slight angle error, softening along its
    length, broken where the ground rises"""
    ang = np.arctan2(base - sy, x - sx) + np.radians(rng.uniform(-2.5, 2.5))
    ux, uy = np.cos(ang), np.sin(ang)
    wf = rng.uniform(0.85, 1.5)
    L = L * rng.uniform(0.8, 1.15)
    nx, ny = -uy, ux
    w0, w1 = w * 0.5, w * 0.5 * wf * rng.uniform(1.2, 2.0)
    ex, ey = x + ux * L, base + uy * L
    pts = [(x + nx * w0, base + ny * w0), (ex + nx * w1, ey + ny * w1), (ex - nx * w1, ey - ny * w1),
           (x - nx * w0, base - ny * w0)]
    m = a.poly(S.pts(hand(pts, rng, amp=0.8, step=18)))
    sl = _box(m > 0)
    if sl is None:
        return
    X, Y = (a.xx[sl] - S.ox) / S.s, (a.yy[sl] - S.oy) / S.s
    along = np.clip(((X - x) * ux + (Y - base) * uy) / L, 0, 1)
    d = m[sl] * (1 - 0.65 * along) * np.clip(a.yy[sl] - S.y(GY), 0, 1)
    ys, ws, ks = breaks
    for yb, wb, kb in zip(ys, ws, ks):
        d = d * (1 - kb * np.clip(1 - np.abs(Y - yb) / wb, 0, 1) ** 0.5)
    out = np.zeros_like(m)
    out[sl] = d * dens
    a.spray(out, colour, grain=1.0)


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    a = Deco(S.W, S.H, seed=seed, s=S.s)
    st = Stager(a, stages_dir, dense_stages)
    inc = set(GROUPS) if include is None else set(include)

    if 'all' in inc:
        rng = group_rng(seed, 'all')
        a.rng = group_rng(seed, 'all')
        sx, sy = P['sun']
        # the light behind the wood: one long fade, the stepped halo, the rays and the sun
        graded_sky(a, S, P['sky'], S.Y0, GY + 4)
        halo_rings(a, S, rng, sx, sy, P['rings'], P['ring'], P['ring_d'], bottom=GY + 4)
        angs = fan_angles(rng, -175, 175, 23, 1.2, 3.0)
        frisket_rays(a, S, rng, sx, sy, angs[::2], P['sun_r'] * 1.25, 1000, P['ray'], P['ray_d'], bottom=GY + 4)
        frisket_rays(a, S, rng, sx, sy, angs[1::2], P['sun_r'] * 1.25, 1000, P['ray'], P['ray_d'], bottom=GY + 4,
                     soft_side=-1)
        sun_disc(a, S, sx, sy, P['sun_r'], P['sun_stops'], bottom=GY + 4)
        st('sky')
        _fan_canopy(a, S, rng, 140, 56, 120, P['canopy_b'], P['fan_b'], P['fan_b_rim'])
        st('canopy_back')
        # far trunks: slender, pale, many, irregularly clustered
        xs = np.sort(np.concatenate([rng.normal(c, 90, 9) for c in rng.uniform(S.X0, S.X1, 5)]))
        for x in xs:
            if abs(x - 990) < 60:
                continue
            _trunk(a, S, rng, x, GY + rng.uniform(-6, 8), rng.uniform(5, 13), P['far'], sx, lit_k=0.8)
        st('far_trunks')
        # forest floor and the winding path (edges cut by hand)
        a.fade(a.rect(0, S.y(GY), a.W, a.H), P['ground'], S.pt(0, GY), S.pt(0, S.Y1))
        ys = np.linspace(GY - 2, S.Y1 + 10, 60)
        left = [(_path_c(y)[0] - _path_c(y)[1], y) for y in ys]
        right = [(_path_c(y)[0] + _path_c(y)[1], y) for y in ys[::-1]]
        pm = a.poly(S.pts(hand(left + right, rng, amp=1.0, step=14)))
        a.fade(pm, P['path'], S.pt(0, GY), S.pt(0, S.Y1))
        a.glow(S.x(990), S.y(GY + 8), S(260), P['halo'], strength=0.4, power=2.0,
               mask=np.clip(a.yy - S.y(GY - 2), 0, 1))
        st('ground')
        breaks = _ground_breaks(rng)
        mids = [(120, 676, 26), (300, 702, 30), (470, 668, 20), (640, 690, 24), (790, 662, 16), (860, 672, 14),
                (1110, 664, 16), (1190, 684, 22), (1300, 668, 18), (1420, 704, 30), (1560, 676, 24),
                (1700, 712, 32), (1850, 680, 22), (-60, 690, 24), (1990, 700, 26)]
        mids = [(x + rng.uniform(-20, 20), b + rng.uniform(-6, 6), w * rng.uniform(0.75, 1.35)) for x, b, w in mids]
        mids.sort(key=lambda t: t[1])
        for x, base, w in mids:
            if S.X0 - 60 < x < S.X1 + 60:
                _shadow(a, S, rng, x, base, w, sx, sy, (base - GY) * 5.0 + 120, P['shadow'], 0.42, breaks)
        for x, base, w in mids:
            if S.X0 - 60 < x < S.X1 + 60:
                _trunk(a, S, rng, x, base, w, P['mid'], sx, plinth_col=P['plinth'])
        st('mid_trunks')
        _deer(a, S, P, rng)
        st('deer')
        # shafts of light falling from the sun through the trees: each cut as a frisket and sprayed alone
        shafts = [(228, 2.0, 1300, 0.8), (247, 3.0, 1200, 1.0), (263, 1.5, 1000, 0.65), (287, 2.5, 1200, 0.9),
                  (303, 1.8, 1300, 0.7), (317, 1.3, 1300, 0.55)]
        for k, (ang, sp, ln, kk) in enumerate(shafts):
            frisket_rays(a, S, rng, sx, sy, [(ang + rng.uniform(-1.5, 1.5), sp * rng.uniform(0.8, 1.2))], 80,
                         ln * rng.uniform(0.85, 1.1), P['shaft'], P['shaft_d'] * kk, soft_side=1 if k % 2 else -1)
        st('light_shafts')
        nears = [(-30, 1010, 150), (250, 900, 96), (430, 800, 60), (1500, 820, 66), (1690, 930, 110),
                 (1990, 1040, 170)]
        nears = [(x + rng.uniform(-15, 15), b, w * rng.uniform(0.85, 1.15)) for x, b, w in nears]
        for x, base, w in nears:
            _shadow(a, S, rng, x, base, w, sx, sy, 700, P['shadow'], 0.45, breaks)
        for x, base, w in nears:
            _trunk(a, S, rng, x, base, w, P['near'], sx, plinth_col=P['plinth'], lit_k=0.8)
        st('near_trunks')
        _fan_canopy(a, S, rng, 46, 82, 150, P['canopy_f'], P['fan_f'], P['fan_f_rim'])
        st('canopy')
        for x, y, sz, lean, kind in ((70, 1095, 330, 0.6, 'p'), (330, 1100, 230, -0.3, 'f'),
                                     (1640, 1100, 250, 0.4, 'f'), (1880, 1095, 340, -0.8, 'p'),
                                     (205, 1110, 170, 0.2, 'p')):
            (_palmette if kind == 'p' else _frond)(a, S, P, rng, x, y, sz, lean)
        st('plants')

    a.rng = group_rng(seed, 'finish')
    a.finish(vignette=P['vignette'])
    img = a.composite()
    st.final(img)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'artdeco_forest.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    save_png(paint(W, H, colourway=cw), out)
