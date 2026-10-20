"""Forest path -- Art Deco (airbrush through hand-cut friskets, 1930s travel-poster look).
Tall trunks like a colonnade, a scalloped canopy, a sunburst glowing at the end of a winding path, cut wedges
of light, long trunk shadows across the path, a stag in the distance, spiky plants in the foreground.
Every trunk, scallop, shadow and leaf blade is cut on its own: no two alike. The trunks are flat ink with a
separately cut strip of light on the side toward the sun (no cylinder shading).
No lettering, no border. Colourways: Day and Dusk."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import drawkit
from drawkit import Scaler, seed_all, save_png, group_rng
from core import smoothstep
from artdeco import ramp
from _artdeco_kit import Deco, Stager, hand, vary, col, mix, banded_sky, band_fields, _box

STYLE = "Art Deco · 装饰艺术"
LIB = "artdeco"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

GY = 628           # where the forest floor meets the light (design px)
DEER = (1004, 654, 46)     # hoof line x, y, shoulder height

PAL = {
    'Dusk': dict(
        sun=(980, 470), sun_r=58,
        bands=[(150, '#262c4c', '#2e3556'), (298, '#3a4270', '#444c78'), (408, '#c0643e', '#cc7044'),
               (520, '#e3904e', '#e89c58'), (GY + 4, '#f2bc68', '#f8d892')],
        ray='#ffe2b0', ray_c=0.17,
        sun_stops=((0, '#fff6dc'), (0.55, '#ffd696'), (1, '#f49a52')), halo='#ffd59a',
        canopy_b=[(0, '#2a3152'), (1, '#3c4268')], canopy_f=[(0, '#11152a'), (1, '#1e2442')],
        far='#c48262', far_lit='#f2b070',
        mid='#3a3d62', mid_lit='#e28a52',
        near='#191c34', near_lit='#c4683e',
        ground=[(0, '#eaa462'), (0.18, '#8a5650'), (0.55, '#2c2c4a'), (1, '#121426')],
        path=[(0, '#ffe4ac'), (0.25, '#f2ae6c'), (0.7, '#a8604a'), (1, '#46304a')],
        shadow='#191a32', shaft='#ffd89a', shaft_s=0.2,
        deer='#1a1c32', deer_rim='#ffcf8a',
        fern=[(0, '#0c0e1e'), (0.6, '#262c48'), (1, '#c86e3e')], vignette=0.14),
    'Day': dict(
        sun=(1000, 300), sun_r=48,
        bands=[(150, '#2a6680', '#30708a'), (292, '#5d9ea6', '#68a8ac'), (420, '#a8d0b6', '#b4d8bc'),
               (530, '#dceac4', '#e4eecc'), (GY + 4, '#f0f0cc', '#f8f4da')],
        ray='#fffbe0', ray_c=0.14,
        sun_stops=((0, '#fffef8'), (0.6, '#fff8dc'), (1, '#f6e09a')), halo='#fff6d0',
        canopy_b=[(0, '#2a6448'), (1, '#4c8a5e')], canopy_f=[(0, '#0c2a1e'), (1, '#24563a')],
        far='#8aa898', far_lit='#e2ecc8',
        mid='#3e5a44', mid_lit='#e0d898',
        near='#17301f', near_lit='#a8b066',
        ground=[(0, '#eef0c0'), (0.18, '#9ec27a'), (0.55, '#3e7046'), (1, '#10281a')],
        path=[(0, '#fffbe6'), (0.25, '#f4e2aa'), (0.7, '#c49a64'), (1, '#6a4a32')],
        shadow='#18361f', shaft='#fffbe0', shaft_s=0.2,
        deer='#5a3420', deer_rim='#fff2c4',
        fern=[(0, '#0a2016'), (0.6, '#2e6a3e'), (1, '#c4dc84')], vignette=0.12),
}


def _path_c(y):
    """centre x and half-width of the winding path at design row y"""
    t = np.clip((y - GY) / (1080 - GY), 0, 1.4)
    cx = 975 + 130 * np.sin(t * 2.4) - 190 * t
    hw = 10 + 380 * t ** 1.45
    return cx, hw


def _trunk(a, S, rng, x, base, w, body, lit, sun_x, top=None, stubs=0, lit_k=1.0):
    """a trunk cut as one frisket: its own taper, lean and slight bow, an asymmetric root flare, flat ink
    (darkening a touch toward the top), then a strip of light cut along the side toward the sun -- hard on
    the bark edge, oversprayed soft where it fades into the trunk; a few branch stubs on some"""
    top = S.Y0 - 10 if top is None else top
    Hh = base - top
    lean = rng.uniform(-0.014, 0.014)
    bow = rng.uniform(-0.25, 0.25) * w
    taper = rng.uniform(0.08, 0.3)
    fl_l, fl_r = w * rng.uniform(0.12, 0.45), w * rng.uniform(0.12, 0.45)
    fh = w * rng.uniform(0.5, 1.1)
    f0 = min(0.5, fh / Hh)
    ts = np.concatenate([np.linspace(0, f0, 7)[:-1], np.linspace(f0, 1, 12)])      # dense where the root flares
    cx = x + lean * Hh * ts + bow * np.sin(np.pi * ts)
    hw = w / 2 * (1 - taper * ts) * (1 + 0.04 * np.sin(ts * rng.uniform(5, 11) + rng.uniform(0, 6)))
    ys = base - Hh * ts
    left = [(cx[0] - hw[0] - fl_l, base + 3)] + [(c - h - (fl_l * max(0, 1 - (base - y) / fh) ** 2.2), y)
                                                 for c, h, y in zip(cx, hw, ys)]
    right = [(c + h + (fl_r * max(0, 1 - (base - y) / fh) ** 2.2), y) for c, h, y in zip(cx, hw, ys)][::-1] + \
        [(cx[0] + hw[0] + fl_r, base + 3)]
    outline = hand(left + right, rng, amp=0.5, step=16)
    m = a.poly(S.pts(outline))
    b0 = col(body) * rng.uniform(0.88, 1.12)
    a.fade(m, [(0, np.clip(b0 * 1.04, 0, 1)), (1, np.clip(b0 * 0.9, 0, 1))], S.pt(0, base), S.pt(0, top))
    # the strip of light on the side toward the sun
    side = 1 if sun_x > x else -1
    f = rng.uniform(0.18, 0.42)
    edge = [(c + side * (h + 0.5), y) for c, h, y in zip(cx, hw, ys)]
    inner = [(c + side * h * (1 - 2 * f), y) for c, h, y in zip(cx[::-1], hw[::-1], ys[::-1])]
    sm = a.poly(S.pts(hand(edge + inner, rng, amp=0.5, step=16))) * m
    k = rng.uniform(0.45, 0.85) * lit_k
    a.fade(sm * k, [(0, lit), (0.55, mix(lit, body, 0.25)), (1, mix(lit, body, 0.7))], S.pt(0, base), S.pt(0, top))
    a.overspray(sm, lit, dx=-side * S(min(6, w * f * 0.3)), dy=0, width=S(max(1.5, min(5, w * f * 0.25))),
                density=0.3 * k)
    for _ in range(stubs):
        i = int(rng.integers(8, len(ts) - 3))
        sd = rng.choice([-1, 1])
        L = min(w * rng.uniform(0.6, 1.3), 22)
        y0 = ys[i]
        bx = cx[i] + sd * hw[i]
        stub = [(bx - sd * 2, y0 + w * 0.12), (bx + sd * L, y0 - L * rng.uniform(0.3, 0.8)),
                (bx + sd * L * 0.9, y0 - L * rng.uniform(0.3, 0.8) - w * 0.08), (bx - sd * 2, y0 - w * 0.1)]
        a.spray(a.poly(S.pts(stub)), np.clip(b0 * 0.95, 0, 1), grain=0.6)


def _canopy(a, S, rng, base, r, amp, stops):
    """a ceiling of leaves hanging in scallops of different sizes, spacing and depth"""
    edge = []
    x = S.X1 + r * 2
    while x > S.X0 - r * 2:
        rr = r * rng.uniform(0.6, 1.4)
        ry = rr * rng.uniform(0.6, 0.98)
        cx = x - rr
        yb = base + amp * smoothstep(80, 760, abs(cx - 1000)) + rng.uniform(-0.25, 0.35) * r
        tilt = rng.uniform(-0.25, 0.25)
        for th in np.linspace(0, np.pi, 11):
            edge.append((cx + rr * np.cos(th), yb + ry * np.sin(th) + tilt * rr * np.cos(th)))
        x -= rr * rng.uniform(1.55, 2.0)
    pts = [(S.X0 - 20, S.Y0 - 20), (S.X1 + 20, S.Y0 - 20), (S.X1 + 20, edge[0][1])] + edge + \
          [(S.X0 - 20, edge[-1][1])]
    m = a.poly(S.pts(hand(pts, rng, amp=0.6, step=14)))
    a.fade(m, stops, S.pt(0, base - 40), S.pt(0, base + amp + r))
    a.overspray(m, stops[-1][1], dx=0, dy=S(3), width=S(3), density=0.3)
    return m


def _deer(a, S, P):
    """a stag standing broadside on the path, backlit: dark silhouette with a hairline of light on top"""
    x0, y0, u = DEER

    def T(p):
        return (x0 + p[0] * u, y0 - p[1] * u)
    body = [(0.6, 1.0), (0.2, 1.02), (-0.3, 1.08), (-0.4, 1.2), (-0.47, 1.47), (-0.46, 1.55), (-0.34, 1.64),
            (-0.42, 1.52), (-0.5, 1.56), (-0.58, 1.55), (-0.78, 1.42), (-0.8, 1.36), (-0.72, 1.31), (-0.58, 1.33),
            (-0.52, 1.2), (-0.52, 1.0), (-0.52, 0.82), (-0.42, 0.66), (0.0, 0.6), (0.32, 0.63), (0.55, 0.66),
            (0.67, 0.82), (0.7, 0.95)]
    m = a.poly(S.pts([T(p) for p in body]))
    bars = [((-0.43, 0.75), (-0.45, -0.02)), ((-0.3, 0.7), (-0.26, -0.02)), ((0.5, 0.75), (0.58, 0.36)),
            ((0.58, 0.36), (0.5, -0.02)), ((0.36, 0.7), (0.42, 0.34)), ((0.42, 0.34), (0.38, -0.02)),
            ((-0.55, 1.55), (-0.45, 1.82)), ((-0.45, 1.82), (-0.52, 2.04)), ((-0.47, 1.76), (-0.64, 1.88)),
            ((-0.6, 1.55), (-0.7, 1.8)), ((-0.7, 1.8), (-0.64, 1.98)), ((-0.68, 1.74), (-0.84, 1.8)),
            ((-0.49, 1.92), (-0.4, 2.0))]
    for p0, p1 in bars:
        m = np.maximum(m, a.bar(S.pt(*T(p0)), S.pt(*T(p1)), S(u * (0.075 if p0[1] < 1 else 0.055))))
    a.spray(a.capsule(S.x(x0 - u * 0.75), S.x(x0 + u * 0.95), S.y(y0 - 0.5), S(2.6)), P['shadow'], density=0.45,
            grain=0.6)
    a.spray(m, P['deer'], grain=0.6)
    sh = np.zeros_like(m)
    d = max(1, int(round(S(1.6))))
    sh[d:] = m[:-d]
    a.spray(np.clip(m - sh, 0, 1) * (a.yy < S.y(y0 - 0.9 * u)), P['deer_rim'], density=0.85, grain=0.4)


def _plant(a, S, P, rng, x, y, size, lean):
    """a spiky clump: its own number of blades, a lopsided fan of irregular angles, each blade its own
    length, width and curl, sprayed dark at the root to lit at the tip"""
    n = int(rng.integers(6, 13))
    centre = 90 + lean * rng.uniform(10, 30)
    spread = rng.uniform(32, 58)
    angs = np.sort(centre + rng.uniform(-spread, spread, n))
    stops = vary(P['fern'], rng.uniform(0.85, 1.15))
    order = rng.permutation(n)
    for k in order:
        ang = np.radians(angs[k])
        L = size * rng.uniform(0.45, 1.0) * (1 - 0.35 * abs(angs[k] - centre) / spread)
        w = size * rng.uniform(0.035, 0.07)
        curl = rng.uniform(-0.25, 0.25) * L + np.cos(ang) * L * 0.15
        ts = np.linspace(0, 1, 10)
        ux, uy = np.cos(ang), -np.sin(ang)
        nx, ny = -uy, ux
        cxs = x + ux * L * ts + nx * curl * ts ** 2
        cys = y + uy * L * ts + ny * curl * ts ** 2 + L * 0.12 * ts ** 2 * abs(ux)      # tips droop
        hw = w * np.sin(np.pi * np.clip(ts * 0.85 + 0.15, 0, 1)) * (1 - ts) ** 0.3
        pts = [(cx_ + nx * h, cy_ + ny * h) for cx_, cy_, h in zip(cxs, cys, hw)] + \
              [(cx_ - nx * h, cy_ - ny * h) for cx_, cy_, h in zip(cxs[::-1], cys[::-1], hw[::-1])]
        a.fade(a.poly(S.pts(pts)), stops, S.pt(x, y), S.pt(cxs[-1], cys[-1]), grain=0.8)


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


def _shaft(a, S, rng, sx, sy, ang, spread, length, colour, strength):
    """a wedge of light cut with a knife from the sun outward: one hard edge, one oversprayed edge, sprayed
    strongest near the sun and fading along its length"""
    a0, a1 = np.radians(ang - spread), np.radians(ang + spread)
    L = length
    pts = [(sx, sy), (sx + np.cos(a0) * L, sy - np.sin(a0) * L), (sx + np.cos(a1) * L, sy - np.sin(a1) * L)]
    m = a.poly(S.pts(hand(pts, rng, amp=1.0, step=30)))
    X, Y = (a.xx - S.ox) / S.s, (a.yy - S.oy) / S.s
    r = np.hypot(X - sx, Y - sy)
    fall = np.clip(1 - r / L, 0, 1) ** 1.3 * smoothstep(20, 120, r)
    a.spray(m * fall * strength, colour, grain=1.2, blend='screen')
    a.overspray(m * fall, colour, dx=S(np.sin(np.radians(ang)) * 3), dy=S(np.cos(np.radians(ang)) * 3),
                width=S(5), density=strength * 0.8, blend='screen')


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
        # the light behind the wood: stepped bands, the hand-cut sunburst and the sun
        banded_sky(a, S, rng, P['bands'])
        lit_f, dark_f = band_fields(a, S, P['bands'], P['ray'])
        a.burst(S.x(sx), S.y(sy), rays=36, contrast=P['ray_c'], reach=S(1100), colour=lit_f, dark=dark_f,
                glow=0.5, phase=4.0, bottom=S.y(GY + 4), rng=rng)
        a.glow(S.x(sx), S.y(sy), S(190), P['halo'], strength=0.55, power=2.4)
        m = a.disc(S.x(sx), S.y(sy), S(P['sun_r']))
        a.fade(m, list(P['sun_stops']), S.pt(sx - 20, sy - 30), S.pt(sx + 40, sy + 60))
        st('sky')
        _canopy(a, S, rng, 150, 52, 120, P['canopy_b'])
        st('canopy_back')
        # far trunks: slender, pale, many, irregularly clustered
        xs = np.sort(np.concatenate([rng.normal(c, 90, 9) for c in rng.uniform(S.X0, S.X1, 5)]))
        for x in xs:
            if abs(x - 990) < 60:
                continue
            _trunk(a, S, rng, x, GY + rng.uniform(-6, 8), rng.uniform(5, 13), P['far'], P['far_lit'], sx,
                   lit_k=0.8)
        st('far_trunks')
        # forest floor and the winding path (edges cut by hand)
        a.fade(a.rect(0, S.y(GY), a.W, a.H), P['ground'], S.pt(0, GY), S.pt(0, S.Y1))
        ys = np.linspace(GY - 2, S.Y1 + 10, 60)
        left = [(_path_c(y)[0] - _path_c(y)[1], y) for y in ys]
        right = [(_path_c(y)[0] + _path_c(y)[1], y) for y in ys[::-1]]
        pm = a.poly(S.pts(hand(left + right, rng, amp=1.2, step=14)))
        a.fade(pm, P['path'], S.pt(0, GY), S.pt(0, S.Y1))
        a.glow(S.x(990), S.y(GY + 8), S(260), P['halo'], strength=0.4, power=2.0,
               mask=np.clip(a.yy - S.y(GY - 2), 0, 1))
        st('ground')
        breaks = _ground_breaks(rng)
        # mid trunks (sorted back to front) with long shadows thrown toward the viewer
        mids = [(120, 676, 26), (300, 702, 30), (470, 668, 20), (640, 690, 24), (790, 662, 16), (860, 672, 14),
                (1110, 664, 16), (1190, 684, 22), (1300, 668, 18), (1420, 704, 30), (1560, 676, 24),
                (1700, 712, 32), (1850, 680, 22), (-60, 690, 24), (1990, 700, 26)]
        mids = [(x + rng.uniform(-20, 20), b + rng.uniform(-6, 6), w * rng.uniform(0.75, 1.3)) for x, b, w in mids]
        mids.sort(key=lambda t: t[1])
        for x, base, w in mids:
            if S.X0 - 60 < x < S.X1 + 60:
                _shadow(a, S, rng, x, base, w, sx, sy, (base - GY) * 5.0 + 120, P['shadow'], 0.42, breaks)
        for x, base, w in mids:
            if S.X0 - 60 < x < S.X1 + 60:
                _trunk(a, S, rng, x, base, w, P['mid'], P['mid_lit'], sx, stubs=int(rng.integers(0, 3)))
        st('mid_trunks')
        _deer(a, S, P)
        st('deer')
        # wedges of light falling from the sun through the trees, each cut and sprayed on its own
        for ang, sp, ln, k in ((228, 2.0, 1300, 0.8), (247, 3.2, 1200, 1.0), (263, 1.6, 1000, 0.65),
                               (287, 2.6, 1200, 0.9), (303, 1.9, 1300, 0.7), (317, 1.4, 1300, 0.55)):
            _shaft(a, S, rng, sx, sy, ang + rng.uniform(-1.5, 1.5), sp * rng.uniform(0.8, 1.2),
                   ln * rng.uniform(0.85, 1.1), P['shaft'], P['shaft_s'] * k)
        st('light_shafts')
        # near trunks: big columns framing the path, and their shadows
        nears = [(-30, 1010, 150), (250, 900, 96), (430, 800, 60), (1500, 820, 66), (1690, 930, 110),
                 (1990, 1040, 170)]
        nears = [(x + rng.uniform(-15, 15), b, w * rng.uniform(0.85, 1.15)) for x, b, w in nears]
        for x, base, w in nears:
            _shadow(a, S, rng, x, base, w, sx, sy, 700, P['shadow'], 0.45, breaks)
        for x, base, w in nears:
            _trunk(a, S, rng, x, base, w, P['near'], P['near_lit'], sx, lit_k=0.75)
        st('near_trunks')
        _canopy(a, S, rng, 60, 74, 150, P['canopy_f'])
        st('canopy')
        for x, y, sz, lean in ((70, 1095, 330, 0.6), (330, 1100, 230, -0.3), (1640, 1100, 260, 0.4),
                               (1880, 1095, 340, -0.8)):
            _plant(a, S, P, rng, x, y, sz, lean)
        st('ferns')

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
