"""Forest path -- Art Deco (airbrush through cut friskets, 1930s travel-poster look).
Tall fluted trunks like a colonnade, a scalloped canopy, a sunburst glowing at the end of a winding path,
shafts of light, long trunk shadows across the path, a stag in the distance, ferns in the foreground.
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
from _artdeco_kit import Deco, Stager

STYLE = "Art Deco · 装饰艺术"
LIB = "artdeco"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

GY = 628           # where the forest floor meets the light (design px)
DEER = (1004, 654, 46)     # hoof line x, y, shoulder height

PAL = {
    'Dusk': dict(
        sun=(980, 470), sun_r=58,
        sky=[(0, '#241a40'), (0.35, '#5e3462'), (0.7, '#d27a66'), (0.9, '#f8b888'), (1, '#ffe0b0')],
        ray='#ffd6a0', ray_dark='#4a2850', ray_c=0.13,
        sun_stops=((0, '#fff6dc'), (0.55, '#ffd696'), (1, '#f49a62')), halo='#ffcf96',
        canopy_b=[(0, '#3a2650'), (1, '#7a4a6a')], canopy_f=[(0, '#140f22'), (1, '#3a2644')],
        far=[(0, '#a87090'), (0.4, '#e8b0a0'), (1, '#9a6488')],
        mid=[(0, '#3e2a52'), (0.35, '#d48a7a'), (0.55, '#7a4a6a'), (1, '#2e2042')],
        near=[(0, '#1e1630'), (0.3, '#8a5270'), (0.45, '#3e2a4c'), (1, '#120d1e')],
        ground=[(0, '#f0b08a'), (0.18, '#9a5a6a'), (0.55, '#3e2848'), (1, '#160f20')],
        path=[(0, '#ffe6c0'), (0.25, '#f2a684'), (0.7, '#9a5a64'), (1, '#4a2e48')],
        shadow='#24182e', shaft='#ffd6a8', shaft_s=0.2,
        deer='#2a1a30', deer_rim='#ffcf96',
        fern=[(0, '#0e0a16'), (0.6, '#3e2a44'), (1, '#c0707a')], vignette=0.14),
    'Day': dict(
        sun=(1000, 300), sun_r=48,
        sky=[(0, '#2a6a86'), (0.4, '#6eaeb0'), (0.75, '#cfe2bc'), (1, '#f6f2d0')],
        ray='#fffbe0', ray_dark='#2d6a5a', ray_c=0.11,
        sun_stops=((0, '#fffef8'), (0.6, '#fff8dc'), (1, '#f6e09a')), halo='#fff6d0',
        canopy_b=[(0, '#2a6a4a'), (1, '#6aa070')], canopy_f=[(0, '#0c2a1e'), (1, '#2a5a3c')],
        far=[(0, '#7aa294'), (0.4, '#cfe0c4'), (1, '#86a896')],
        mid=[(0, '#2e4a3a'), (0.35, '#e0d8a0'), (0.55, '#6e8a5e'), (1, '#24402e')],
        near=[(0, '#10241c'), (0.3, '#7a8a54'), (0.45, '#2a4430'), (1, '#0a1a14')],
        ground=[(0, '#eef0c0'), (0.18, '#9ec27a'), (0.55, '#3e7046'), (1, '#10281a')],
        path=[(0, '#fffbe6'), (0.25, '#f4e2aa'), (0.7, '#c49a64'), (1, '#6a4a32')],
        shadow='#1a3a26', shaft='#fffbe0', shaft_s=0.22,
        deer='#5a3420', deer_rim='#fff2c4',
        fern=[(0, '#0a2016'), (0.6, '#2e6a3e'), (1, '#c4dc84')], vignette=0.12),
}


def _path_c(y):
    """centre x and half-width of the winding path at design row y"""
    t = np.clip((y - GY) / (1080 - GY), 0, 1.4)
    cx = 975 + 130 * np.sin(t * 2.4) - 190 * t
    hw = 10 + 380 * t ** 1.45
    return cx, hw


def _trunk(a, S, x, base, w, stops, lean=0.0, flutes=0, top=None):
    """a tall trunk as a column: tapering slightly upward, sprayed as a cylinder (lit edge toward the light),
    optional flutes; a small root flare at the foot"""
    top = S.Y0 - 10 if top is None else top
    wt = w * 0.82
    xt = x + lean * (base - top)
    m = a.poly(S.pts([(x - w / 2, base), (x + w / 2, base), (xt + wt / 2, top), (xt - wt / 2, top)]))
    fl = min(w * 0.9, 34)
    flare = a.poly(S.pts([(x - w * 0.5 - fl * 0.5, base + 2), (x + w * 0.5 + fl * 0.5, base + 2),
                          (x + w * 0.5, base - fl), (x - w * 0.5, base - fl)]))
    m = np.maximum(m, flare)
    a.fade(m, stops, S.pt(x - w * 0.5 - fl * 0.5, base), S.pt(x + w * 0.5 + fl * 0.5, base), grain=0.7)
    if flutes:
        for k in range(1, flutes):
            u = k / flutes
            xb = x - w / 2 + w * u
            xtt = xt - wt / 2 + wt * u
            a.spray(a.bar(S.pt(xb, base - w * 0.3), S.pt(xtt, top), S(max(1.0, w * 0.035))) * m,
                    stops[-1][1], density=0.35, grain=0.3)


def _canopy(a, S, base, r, amp, stops, phase=0.0):
    """a scalloped ceiling of leaves: semicircular bumps hanging along an edge that rises over the path"""
    xs = np.arange(S.X0 - r * 2 + phase, S.X1 + r * 2, r * 1.7)
    pts = [(S.X0 - 20, S.Y0 - 20), (S.X1 + 20, S.Y0 - 20)]
    edge = []
    for cx in xs[::-1]:
        yb = base + amp * smoothstep(80, 760, abs(cx - 1000))
        for th in np.linspace(0, np.pi, 10):
            edge.append((cx + r * np.cos(th), yb + r * 0.85 * np.sin(th)))
    pts = pts + [(S.X1 + 20, edge[0][1])] + edge + [(S.X0 - 20, edge[-1][1])]
    m = a.poly(S.pts(pts))
    a.fade(m, stops, S.pt(0, base - 40), S.pt(0, base + amp + r))
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
    # a soft shadow pool on the ground
    a.spray(a.capsule(S.x(x0 - u * 0.75), S.x(x0 + u * 0.95), S.y(y0 - 0.5), S(2.6)), P['shadow'], density=0.45,
            grain=0.3)
    a.spray(m, P['deer'], grain=0.3)
    sh = np.zeros_like(m)
    d = max(1, int(round(S(1.6))))
    sh[d:] = m[:-d]
    a.spray(np.clip(m - sh, 0, 1) * (a.yy < S.y(y0 - 0.9 * u)), P['deer_rim'], density=0.85, grain=0.2)


def _fern(a, S, P, x, y, size, side, rng):
    """a fan of narrow blades from one root, each sprayed dark at the root to lit at the tip"""
    n = 9
    for k in range(n):
        ang = np.radians(100 + side * (-15 + 70 * k / (n - 1)) + rng.uniform(-4, 4))
        L = size * rng.uniform(0.7, 1.0) * (1 - 0.25 * abs(k - n / 2) / n)
        tx, ty = x + np.cos(ang) * L, y - np.sin(ang) * L
        nx, ny = -np.sin(ang), -np.cos(ang)
        w = size * 0.05
        mx, my = x + np.cos(ang) * L * 0.5, y - np.sin(ang) * L * 0.5
        pts = [(x - nx * w * 0.3, y - ny * w * 0.3), (mx - nx * w, my - ny * w), (tx, ty),
               (mx + nx * w, my + ny * w), (x + nx * w * 0.3, y + ny * w * 0.3)]
        a.fade(a.poly(S.pts(pts)), P['fern'], S.pt(x, y), S.pt(tx, ty), grain=0.5)


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    a = Deco(S.W, S.H, seed=seed)
    st = Stager(a, stages_dir, dense_stages)
    inc = set(GROUPS) if include is None else set(include)

    if 'all' in inc:
        rng = group_rng(seed, 'all')
        a.rng = group_rng(seed, 'all')
        sx, sy = P['sun']
        # the light behind the wood: a long fade, the sunburst and the sun
        a.sky(P['sky'], top=S.y(0), bottom=S.y(GY))
        a.burst(S.x(sx), S.y(sy), rays=36, contrast=P['ray_c'], reach=S(1100), colour=P['ray'],
                dark=P['ray_dark'], glow=0.6, phase=4.0, bottom=S.y(GY + 4))
        a.glow(S.x(sx), S.y(sy), S(190), P['halo'], strength=0.6, power=2.4)
        m = a.disc(S.x(sx), S.y(sy), S(P['sun_r']))
        a.fade(m, list(P['sun_stops']), S.pt(sx - 20, sy - 30), S.pt(sx + 40, sy + 60))
        st('sky')
        _canopy(a, S, 150, 52, 120, P['canopy_b'], phase=30)
        st('canopy_back')
        # far trunks: slender, pale, many
        xs = np.sort(rng.uniform(S.X0, S.X1, 46))
        for x in xs:
            if abs(x - 990) < 60:
                continue
            _trunk(a, S, x, GY + rng.uniform(-6, 8), rng.uniform(6, 12), P['far'], lean=rng.uniform(-0.01, 0.01))
        st('far_trunks')
        # forest floor and the winding path
        a.fade(a.rect(0, S.y(GY), a.W, a.H), P['ground'], S.pt(0, GY), S.pt(0, S.Y1))
        ys = np.linspace(GY - 2, S.Y1 + 10, 60)
        left = [(_path_c(y)[0] - _path_c(y)[1], y) for y in ys]
        right = [(_path_c(y)[0] + _path_c(y)[1], y) for y in ys[::-1]]
        pm = a.poly(S.pts(left + right))
        a.fade(pm, P['path'], S.pt(0, GY), S.pt(0, S.Y1))
        a.glow(S.x(990), S.y(GY + 8), S(260), P['halo'], strength=0.45, power=2.0,
               mask=np.clip(a.yy - S.y(GY - 2), 0, 1))
        st('ground')
        # mid trunks (sorted back to front) with long shadows thrown toward the viewer
        mids = [(120, 676, 26), (300, 702, 30), (470, 668, 20), (640, 690, 24), (790, 662, 16), (860, 672, 14),
                (1110, 664, 16), (1190, 684, 22), (1300, 668, 18), (1420, 704, 30), (1560, 676, 24),
                (1700, 712, 32), (1850, 680, 22), (-60, 690, 24), (1990, 700, 26)]
        mids.sort(key=lambda t: t[1])
        for x, base, w in mids:
            if not (S.X0 - 60 < x < S.X1 + 60):
                continue
            dx = (x - sx) * 0.9
            L = (base - GY) * 5.0
            sm = a.poly(S.pts([(x - w / 2, base), (x + w / 2, base), (x + dx + w * 1.6, base + L),
                               (x + dx - w * 0.4, base + L)]))
            a.spray(sm * np.clip(a.yy - S.y(GY), 0, 1), P['shadow'], density=0.4, grain=0.6)
        for x, base, w in mids:
            if not (S.X0 - 60 < x < S.X1 + 60):
                continue
            _trunk(a, S, x, base, w, P['mid'], lean=rng.uniform(-0.012, 0.012), flutes=3 if w > 24 else 0)
        st('mid_trunks')
        _deer(a, S, P)
        st('deer')
        # shafts of light falling from the sun through the trees
        for ang, sp, ln, k in ((228, 2.2, 1300, 0.8), (246, 3.4, 1200, 1.0), (262, 1.8, 1000, 0.7),
                               (286, 2.8, 1200, 0.9), (304, 2.0, 1300, 0.75), (318, 1.5, 1300, 0.6)):
            a.searchlight(S.x(sx), S.y(sy), ang, S(ln), spread=sp, colour=P['shaft'], strength=P['shaft_s'] * k)
        st('light_shafts')
        # near trunks: big fluted columns framing the path, and their shadows
        nears = [(-30, 1010, 150), (250, 900, 96), (430, 800, 60), (1500, 820, 66), (1690, 930, 110),
                 (1990, 1040, 170)]
        for x, base, w in nears:
            dx = (x - sx) * 0.6
            L = 700
            sm = a.poly(S.pts([(x - w / 2, base), (x + w / 2, base), (x + dx + w * 1.4, base + L),
                               (x + dx - w * 0.4, base + L)]))
            a.spray(sm * np.clip(a.yy - S.y(GY), 0, 1), P['shadow'], density=0.45, grain=0.6)
        for x, base, w in nears:
            _trunk(a, S, x, base, w, P['near'], lean=0.0, flutes=6)
        st('near_trunks')
        _canopy(a, S, 60, 74, 150, P['canopy_f'])
        st('canopy')
        for x, y, sz, side in ((70, 1090, 230, -1), (330, 1100, 170, -1), (1640, 1100, 190, 1),
                               (1880, 1090, 240, 1)):
            _fern(a, S, P, x, y, sz, side, rng)
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
