"""Mountain lake — Stained glass (彩色玻璃花窗): one full-bleed leaded panel (pot-metal, streaky, seedy and
opalescent glass, grisaille, silver stain), built on vendor lib/stainedglass.py `StainedGlass` via
scenes/_stainedglass_kit.Panel.

The cut lines are designed like a glazier's cartoon: the sky in long calm rows whose cross cuts radiate from the
sun; each mountain face cut in strata parallel to its ridge with a lead running down every spur (lit face and
shadow face in different glass); the water in perspective rows with the reflections, glitter path and boat
reflection built of water-row pieces of other glass; clouds, pines, boat, rower, mist and reeds cut as glass.
Grisaille only for fine detail (needles, face, oars, planks, wavelets, reed veins).

Phase 2: bleed-aware, layer groups with per-group RNG, two colourways (Day / Dusk), dense draw-on stages in
workshop order (cartoon, cut glass laid on it, painting, leading, soldering, finished panel).

python scripts/scenes/stainedglass_lake.py out.png [W H] [colourway] [bleed]
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drawkit  # noqa: E402  (sets sys.path to the skill lib)
from drawkit import Scaler, seed_all, save_png  # noqa: E402

import numpy as np  # noqa: E402
from _stainedglass_kit import (Panel, Stager, hband, design_xy, const, polyfn, shade,  # noqa: E402
                               bird_pieces, lay_cloud)

STYLE = "Stained glass · 彩色玻璃花窗"
LIB = "stainedglass"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")

HORIZON = 640.0

PAL = {
    "Dusk": dict(
        bands=[['#1d2a6e', '#243380', '#1a2766'], ['#3a3488', '#4a3a8a', '#33307a'], ['#7a2c5c', '#8a3466', '#6e2a5a'],
               ['#c0405a', '#b3182c', '#cc5a5a'], ['#d0601e', '#e0922a', '#d8702a'], ['#f2c230', '#e8a830', '#f4d060']],
        arch=(0, 0, 10, 22, 34, 40), glow=(1240.0, 430.0), sun=None,
        cloud=[['#c27a9c', '#b86e96', '#c886a2'], ['#eaa0aa', '#f0b4b0', '#e094a4', '#f4c0b0']], cloud_lit='below',
        far_lit=['#9580b4', '#8a74aa', '#9a86b8'], far_sh=['#7c6aa0', '#6e5e96', '#74649c'],
        near_lit=['#46337a', '#4a3a80', '#3c2f6e'], near_sh=['#33296a', '#2c2462', '#30285f'],
        pine_lit=['#2a6a40', '#2f7044', '#245e3a'], pine_sh=['#18492f', '#1f5a3a', '#143f2a'],
        water=[['#b04a5a', '#9a3a6a', '#c0605a'], ['#4a3a86', '#3a3480', '#55408a'], ['#1d2a6e', '#172560', '#22306f']],
        nref=['#2c2766', '#352a6c', '#282460'], pref=['#173a34', '#1c4438', '#143030'],
        glit=['#f2c230', '#e0922a', '#f4d060'], glit_x=1240.0,
        mist=['#b8a0cc', '#c6aed0', '#ad98c4'], mist_stain=0.6,
        hull=['#7a4e2c', '#6e4526'], hull_dk=['#5a3820', '#4e321c'], hull_ref=['#2a1a30', '#30203a'], body='#173c8f',
        body_ref='#1a2450', head='#e9c9a8', hair='#3a2418', bird=['#1c1a40', '#221e48'],
        reed=['#2a4a30', '#33502e', '#26402c'], cattail=['#4a2a1c', '#5a3422'], trunk=['#3a2430', '#44283a'],
        oar=['#b08850', '#a07a48'], hat=['#3a2418', '#4a2c1c'], sky=('#ffffff', '#f6f3ec')),
    "Day": dict(
        bands=[['#1f4fa8', '#2456b0', '#1d4a9e'], ['#3368b8', '#3d74c2', '#2f60b0'], ['#5d8fd0', '#6a9ad6', '#5588cc'],
               ['#86b0de', '#93bae2', '#7ca8da'], ['#aecde8', '#bcd6ec', '#a4c6e4'], ['#dfe8e0', '#e8ecdc', '#d7e2ea']],
        arch=(0, 0, 0, 0, 0, 0), glow=None, sun=(640.0, 138.0, 44.0),
        corona=['#f4e6a0', '#f0dc8c', '#f6eab4'],
        cloud=[['#c8d4e2', '#d0dae6', '#bccce0'], ['#f4f1e6', '#eeeadb', '#f6f4ec']], cloud_lit='above',
        far_lit=['#aca8c8', '#a39ec0', '#b4b0cc'], far_sh=['#968fb8', '#8c86b0', '#9a94bc'],
        near_lit=['#4a7a70', '#4f8074', '#457468'], near_sh=['#365f5a', '#3f6f68', '#325852'],
        pine_lit=['#3a7a3a', '#2f8a3c', '#3f823e'], pine_sh=['#1f5a3a', '#2a6a40', '#1b5034'],
        water=[['#a4c6e4', '#93bae2', '#b4d0ea'], ['#4a7cc8', '#3d70bf', '#5588cc'], ['#1f4fa8', '#1d4a9e', '#24539e']],
        nref=['#2f5a62', '#36606a', '#2a5058'], pref=['#1f4a38', '#244e3c', '#1a4030'],
        glit=['#eeeadb', '#f6f2e0', '#e8ecdc'], glit_x=640.0,
        mist=['#e4e9f0', '#eeeadb', '#d7e2ea'], mist_stain=0.25,
        hull=['#7a4e2c', '#6e4526'], hull_dk=['#5a3820', '#4e321c'], hull_ref=['#1a3060', '#22386a'], body='#b3182c',
        body_ref='#3a3a70', head='#e9c9a8', hair='#4a2c1c', bird=['#22223a', '#2a2a44'],
        reed=['#3a6a30', '#4a7a34', '#2f5a2c'], cattail=['#5a3422', '#6a4028'], trunk=['#4a3020', '#5a3a24'],
        oar=['#c8a060', '#b8925a'], hat=['#4a2c1c', '#5a3422'], sky=('#ffffff', '#f6f3ec')),
}

CLOUDS = [(260, 102, 400, 48), (900, 172, 330, 40), (1480, 86, 460, 52), (1160, 250, 250, 36)]
BIRDS = [(1420, 210, 1.0, 1), (1500, 250, 0.8, 0.5), (1575, 190, 1.1, 0.9), (1640, 272, 0.7, 0.7), (1365, 285, 0.75, 1)]
PINES = [(85, 470, 52, 652), (170, 422, 66, 656), (255, 495, 50, 652), (330, 440, 62, 656),
         (410, 515, 46, 651), (470, 478, 52, 654), (520, 552, 36, 650),
         (1530, 578, 28, 646), (1592, 552, 34, 647), (1652, 590, 24, 645), (1765, 566, 30, 646)]
FAR_PEAKS = [(260, 110), (760, -100), (1250, 130), (1700, -110)]          # summit x, spur drift
NEAR_PEAKS = [(400, -120), (980, 90), (1760, 80)]
BOAT_C = (1170.0, 790.0)
BOAT_K = 1.2


def far_ridge(x):
    return (420 - 118 * np.exp(-((x - 1250) / 230) ** 2) - 70 * np.exp(-((x - 760) / 190) ** 2)
            - 55 * np.exp(-((x - 260) / 200) ** 2) - 62 * np.exp(-((x - 1700) / 170) ** 2)
            + 6 * np.sin(x / 47.0) + 3 * np.sin(x / 19.0 + 1.3))


def near_ridge(x):
    return (612 - 160 * np.exp(-((x - 400) / 430) ** 2) - 62 * np.exp(-((x - 980) / 170) ** 2)
            - 52 * np.exp(-((x - 1760) / 190) ** 2) + 7 * np.sin(x / 33.0) + 4 * np.sin(x / 14.0 + 0.7))


def far_bottom(x):
    return np.minimum(near_ridge(x) + 34, HORIZON + 2)


def pine_shapes(seed):
    """every pine its own, drawn as a glazier would cut it: a few tiers, each tier one piece (split lit / shade
    down the stem on the big ones), each tier a little narrower at its top than the bough under it so the
    outline steps in only gently (no serrations to cut), a drooping lower edge, a short trunk -- from a
    geometry generator that does not belong to any group (the water group needs the shapes for reflections)"""
    r = drawkit.group_rng(seed, 'pine-geometry')
    out = []
    for (cx, top, hw, root) in PINES:
        h = root - top
        nt = int(r.integers(3, 5)) if h > 150 else int(r.integers(2, 4))
        lean = r.uniform(-0.04, 0.04)
        ax = lambda y, cx=cx, lean=lean, root=root: cx + lean * (root - y)
        gaps = r.uniform(0.8, 1.25, nt)
        ybs = top + h * r.uniform(0.86, 0.93) * np.cumsum(gaps) / gaps.sum()
        tiers = []
        prev_b, prev_w = top, 0.0
        for t in range(nt):
            yb = float(ybs[t])
            f = ((t + 1) / nt) ** r.uniform(0.55, 0.8)
            wl, wr = hw * f * r.uniform(0.88, 1.08), hw * f * r.uniform(0.88, 1.08)
            if t == 0:
                yt, wt = top, 0.0
            else:
                yt = prev_b - (prev_b - tiers[-1]['yt']) * r.uniform(0.3, 0.42)
                wt = prev_w * r.uniform(0.32, 0.45)
            lift = r.uniform(0.08, 0.16) * (yb - yt)            # the bough's lower edge droops at its ends
            n_ = 9
            xsb = np.linspace(-1, 1, n_)
            bot = [(ax(yb) + x * (wr if x > 0 else wl), yb - lift * (1 - x * x)) for x in xsb[::-1]]
            sides_r = [(ax(yt) + wt + (wr - wt) * k, yt + (yb - yt) * k + 0.0) for k in (0.0, 0.55)]
            sides_l = [(ax(yt) - wt - (wl - wt) * k, yt + (yb - yt) * k) for k in (0.55, 0.0)]
            if t == 0:
                pts = [(ax(top), top - 3)] + [sides_r[1]] + bot + [sides_l[0]]
            else:
                pts = sides_r + bot + sides_l
            tiers.append(dict(pts=pts, yt=yt, yb=yb, wl=wl, wr=wr))
            prev_b, prev_w = yb, min(wl, wr)
        tw = max(6, hw * 0.13)
        yl = tiers[-1]['yb']
        trunk = [(ax(yl - 10) - tw, yl - 10), (ax(yl - 10) + tw, yl - 10), (cx + tw * 1.1, root + 4), (cx - tw * 1.1, root + 4)]
        out.append(dict(tiers=tiers, trunk=trunk, cx=cx, top=top, root=root, hw=hw, ax=ax,
                        tips=[tt['yb'] for tt in tiers], lean=lean))
    return out


def flip(pts, squash=0.85):
    return [(x, HORIZON + (HORIZON - y) * squash) for x, y in pts]


def ridge_pts(S, fn, n=140, flip_=False, squash=1.0, bottom=None):
    x0, x1 = S.X0 - 30, S.X1 + 30
    xs = np.linspace(x0, x1, n)
    ys = fn(xs)
    if flip_:
        ys = HORIZON + (HORIZON - ys) * squash
        return [(x0, HORIZON - 2)] + list(zip(xs, ys)) + [(x1, HORIZON - 2)]
    if bottom is not None:
        return list(zip(xs, ys)) + list(zip(xs[::-1], bottom(xs[::-1])))
    return [(x0, HORIZON + 2)] + list(zip(xs, ys)) + [(x1, HORIZON + 2)]


def fall(fn, k=1.1):
    """tilt of a cut running down the fall line under the ridge fn"""
    return lambda a, c: float(np.clip(k * np.arctan(-(fn(np.array([a + 6.0])) - fn(np.array([a - 6.0])))[0] / 12.0 * 2.2), -0.75, 0.75))


def spurs(fn, peaks, bottom, r):
    """a lead down every spur: from the summit down the fall line, drifting a little"""
    cols, xs = [], []
    for (x, drift) in peaks:
        xx = np.linspace(x - 60, x + 60, 121)
        sx = float(xx[np.argmin(fn(xx))])
        sy = float(fn(np.array([sx]))[0])
        yb = float(bottom(np.array([sx]))[0]) + 60
        pts = [(sx, sy - 40), (sx, sy), (sx + drift * 0.3 + r.uniform(-6, 6), sy + (yb - sy) * 0.3),
               (sx + drift * 0.75 + r.uniform(-10, 10), sy + (yb - sy) * 0.7), (sx + drift + r.uniform(-8, 8), yb),
               (sx + drift * 1.3, yb + 200)]
        cols.append(polyfn(pts))
        xs.append(sx)
    return cols, xs


def boat_pts(pts):
    cx, cy = BOAT_C
    return [(cx + (x - cx) * BOAT_K, cy + (y - cy) * BOAT_K) for x, y in pts]


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None, dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    s = S.s
    inc = set(GROUPS) if include is None else set(include)
    g = Panel(S, seed, ambient=0.08, sky=P['sky'])
    st = Stager(g, stages_dir, dense_stages)
    xx, yy = design_xy(g)
    X0, X1, Y0, Y1 = S.X0 - 30, S.X1 + 30, S.Y0 - 30, S.Y1 + 30

    # geometry every group may need (cheap masks / shapes, made whatever is included)
    PS = pine_shapes(seed)
    pine_ms = [np.clip(sum(g.poly(S.pts(t['pts'])) for t in p['tiers']) + g.poly(S.pts(p['trunk'])), 0, 1) for p in PS]
    pines_m = np.clip(sum(pine_ms), 0, 1)
    pref_id = np.zeros_like(pines_m)                  # which pine each reflection pixel belongs to (1-based)
    for i, p in enumerate(PS):
        for t in p['tiers']:
            pm_ = g.poly(S.pts(flip([(p['cx'] + (x - p['cx']) * 0.7, y) for x, y in t['pts']], 0.8)))
            pref_id = np.where(pm_ > 0.5, i + 1, pref_id)
    glow = P['glow'] or P['sun'][:2]

    # ================================================================ sky: rows of glass, cuts radiate from the sun
    if 'sky' in inc:
        rng = g.group('sky')
        edges = [Y0, 115, 195, 272, 330, 385, 700]
        gx_, gy_ = glow

        def curve(k):
            if k in (0, len(edges) - 1):
                return const(edges[k])
            return lambda xs, k=k: (edges[k] + 9 * np.sin(np.asarray(xs) / 140.0 + 0.9 * k)
                                    - P['arch'][k] * np.exp(-((np.asarray(xs) - gx_) / 520.0) ** 2))
        to_sun = lambda a, c: float(np.arctan2(-(a - gx_), -(c - gy_) + 1e-3)) * 0.8
        size = lambda a, c: 0.5 + 0.6 * np.clip(np.hypot(a - gx_, (c - gy_) * 1.6) / 900.0, 0, 1)
        for k, cols in enumerate(P['bands']):
            m = g.poly(S.pts(hband(S, curve(k), curve(k + 1))))
            if P['sun']:
                m = m * (g.circle(*S.pt(*P['sun'][:2]), (P['sun'][2] + 40) * s) <= 0.5)
            g.band(m, cols, curve(k), curve(k + 1), row_h=72, length=(190, 380), cut_dir=to_sun, size=size,
                   tilt=0.08, bend=0.3, flow=0.05)
            st('sky band %d' % k)
        if P['sun']:
            sx, sy, sr = P['sun']
            disc = (g.circle(*S.pt(sx, sy), sr * s) > 0.5).astype(np.float32)
            ring = (g.circle(*S.pt(sx, sy), (sr + 40) * s) > 0.5) * (1 - disc)
            g.radial(ring, P['corona'], (sx, sy), [sr + 0.5], length=(44, 60), tilt=0.05, flow=None,
                     mix=dict(streaky=0.5, cathedral=0.5))
            g.glass(disc, ['#f2c230', '#f4d060'], mix=dict(cathedral=0.6, reamy=0.4))
            g.stain(g.circle(*S.pt(sx, sy), (sr - 4) * s), 0.7)
            st('sun')

    # ================================================================ clouds: lobes of opalescent glass
    if 'clouds' in inc:
        rng = g.group('clouds')
        for i, (cx, cy, L, h) in enumerate(CLOUDS):
            lay_cloud(g, S, cx, cy, L, h, P['cloud'], P['cloud_lit'], rng)
            st('cloud %d' % i)

    # ================================================================ far range: strata along the ridge, spur leads
    if 'far' in inc:
        rng = g.group('far')
        far_m = g.poly(S.pts(ridge_pts(S, far_ridge, bottom=far_bottom)))
        cols, sxs = spurs(far_ridge, FAR_PEAKS, far_bottom, rng)

        def side(cx, cy, pal, cols=cols, sxs=sxs):
            j = int(np.argmin([abs(cx - v) for v in sxs]))
            return P['far_lit'] if cx < float(cols[j](cy)) else P['far_sh']
        g.band(far_m, P['far_lit'], far_ridge, far_bottom, row_h=80, columns=cols, length=(170, 320),
               colour_fn=side, cut_dir=fall(far_ridge), tilt=0.18,
               flow=lambda cx, cy: 0.55 * np.sign(np.sin(cx / 230.0)), mix=dict(cathedral=0.4, reamy=0.25, streaky=0.2, opal=0.15))
        st('far glass')

    # ================================================================ near range, pines
    if 'near' in inc:
        rng = g.group('near')
        near_m = g.poly(S.pts(ridge_pts(S, near_ridge)))
        cols, sxs = spurs(near_ridge, NEAR_PEAKS, const(HORIZON + 2), rng)

        def side(cx, cy, pal, cols=cols, sxs=sxs):
            j = int(np.argmin([abs(cx - v) for v in sxs]))
            return P['near_lit'] if cx < float(cols[j](cy)) else P['near_sh']
        g.band(near_m, P['near_lit'], near_ridge, const(HORIZON + 2), row_h=70, columns=cols, length=(170, 330),
               colour_fn=side, cut_dir=fall(near_ridge), tilt=0.18, flow=0.3,
               mix=dict(cathedral=0.45, reamy=0.25, streaky=0.3))
        st('near glass')
        for i, (p, pm) in enumerate(zip(PS, pine_ms)):
            ax = p['ax']
            g.glass(g.poly(S.pts(p['trunk'])), P['trunk'], flow=np.pi / 2, mix=dict(cathedral=0.6, streaky=0.4), amin=200, tmin=7)
            for t_, tier in enumerate(p['tiers'][::-1]):             # the lower boughs first, the upper laid over them
                tm = g.poly(S.pts(tier['pts']))
                k_ = rng.uniform(0.88, 1.12)
                if p['hw'] >= 44:
                    g.glass(tm, None, cuts=[('v', lambda y, ax=ax: ax(y) + rng.uniform(-3, 3))],
                            colour_fn=lambda cx, cy, ax=ax, k_=k_: shade(P['pine_lit'] if cx < ax(cy) else P['pine_sh'], k_),
                            flow=np.pi / 2, flow_jit=0.4, mix=dict(cathedral=0.4, reamy=0.3, streaky=0.3), amin=300, tmin=8)
                else:
                    g.glass(tm, shade(P['pine_lit'] if rng.random() < 0.5 else P['pine_sh'], k_), flow=np.pi / 2,
                            flow_jit=0.4, mix=dict(cathedral=0.4, reamy=0.3, streaky=0.3), amin=200, tmin=7)
                g.shade(tm, offset=(-p['hw'] * 0.35 * s, -4 * s), strength=0.28, soft=3 * s)
            # needles: a few short drooping brush strokes along each bough edge, every one different
            for tier in p['tiers']:
                w = (tier['wl'] + tier['wr']) / 2 * 0.8
                for sgn in (-1, 1):
                    for j in range(int(rng.integers(1, 4))):
                        x0_ = ax(tier['yb']) + sgn * w * rng.uniform(0.15, 0.8)
                        y0_ = tier['yb'] - rng.uniform(6, 14)
                        g.trace(S.pts([(x0_, y0_), (x0_ + sgn * rng.uniform(4, 10), y0_ + rng.uniform(2, 6))]),
                                rng.uniform(1.0, 1.6) * s, taper=(0.2, 0.8), smooth=False, clip=pm, opacity=0.7)
            st('pine %d' % i)

    # ================================================================ water: perspective rows; reflections in glass
    if 'water' in inc:
        rng = g.group('water')
        gx = P['glit_x']
        wob = rng.uniform(0, 6.3, 3)
        depth = lambda y: float(np.clip((y - HORIZON) / 440.0, 0, 1))

        def feature(a, c):
            a = np.asarray(a, float); c = np.asarray(c, float)
            f = np.zeros(len(a), np.int64)
            nr = HORIZON + (HORIZON - near_ridge(a)) * 0.8
            f[c < nr] = 1
            iy = np.clip(np.round(S.y(c)).astype(int), 0, g.H - 1)
            ix = np.clip(np.round(S.x(a)).astype(int), 0, g.W - 1)
            pid = pref_id[iy, ix].astype(np.int64)
            f[pid > 0] = 10 + pid[pid > 0]
            dp = (c - HORIZON) / 440.0
            gw = 50 + 210 * dp
            off = 14 * np.sin(c / 37.0 + wob[0]) + 9 * np.sin(c / 13.0 + wob[1])
            f[(np.abs(a - gx - 40 * dp - off) < gw / 2) & (c < 960)] = 3
            return f

        def colour(cx, cy, fid, row):
            dp = depth(cy)
            k = 0 if cy < 745 + rng.uniform(-25, 25) else (1 if cy < 880 + rng.uniform(-30, 30) else 2)
            water = P['water'][k]
            if fid == 3:                                     # the glitter path: broken, thinning toward us
                return P['glit'] if rng.random() < 0.78 - 0.35 * dp else water
            if fid == 1:                                     # the far shore's reflection, breaking up with depth
                return P['nref'] if rng.random() < 0.92 - 0.6 * dp else water
            if fid > 10:                                     # pines: dark broken streaks, paler and fewer deeper down
                return P['pref'] if rng.random() < 0.9 - 0.7 * dp else P['nref']
            return water
        wm = g.poly(S.pts(hband(S, HORIZON, Y1)))
        near_glit = lambda a, c: 0.45 if abs(a - gx) < 80 + 0.5 * (c - HORIZON) else 1.0
        g.waves(wm, HORIZON, lambda y: 20 + (y - HORIZON) * 0.13, colour, run=(4.5, 10.0), feature=feature,
                depth=depth, size=near_glit, wl=(260.0, 600.0), pinch=0.5, vary=1.3, amin=380, tmin=10,
                flow=0.0, flow_jit=0.3, mix=dict(streaky=0.35, cathedral=0.25, reamy=0.25, seedy=0.15), matting=0.12)
        st('water glass')
        # wavelets: a few fine painted marks, clustered, never the same twice
        for k in range(18):
            yv = HORIZON + 60 + (k / 18) ** 1.3 * 380 + rng.uniform(-8, 8)
            x0_ = rng.uniform(S.X0 + 20, S.X1 - 80)
            if abs(x0_ - gx) < 160 and yv < 900:
                continue
            L = rng.uniform(18, 60) * (0.6 + (yv - HORIZON) / 440)
            for j in range(int(rng.integers(1, 3))):
                xa = x0_ + j * L * rng.uniform(0.6, 1.1)
                ya = yv + rng.uniform(-3, 3)
                g.trace(S.pts([(xa, ya), (xa + L * 0.45, ya - rng.uniform(1, 3)), (xa + L, ya + rng.uniform(-1, 1))]),
                        rng.uniform(1.0, 1.6) * s, taper=(0.3, 0.5), opacity=0.45, wobble=0.3 * s)
        st('water done')

    # ================================================================ mist: one long row of opalescent glass
    if 'mist' in inc:
        rng = g.group('mist')
        xs = np.linspace(X0, X1, 120)
        thick = 64 - 30 * np.clip(xs, 0, 1920) / 1920 + 6 * np.sin(xs / 85.0)
        top_ = 630 - thick * 0.5 + 5 * np.sin(xs / 51.0) + 3 * np.sin(xs / 17.0)
        bot_ = 640 + thick * 0.55 + 4 * np.sin(xs / 37.0 + 1) + 2 * np.sin(xs / 11.0)
        mist = g.poly(S.pts(list(zip(xs, top_)) + list(zip(xs[::-1], bot_[::-1]))))
        mist = mist * (1 - pines_m * (yy < 600))
        top = lambda a: np.interp(a, xs, top_)
        bot = lambda a: np.interp(a, xs, bot_)
        g.band(mist, P['mist'], top, bot, rows=1, length=(200, 380), tilt=0.3, flow=0.0, flow_jit=0.1,
               mix=dict(opal=0.7, seedy=0.3), opal=0.35)
        st('mist glass')
        g.stain(mist * np.clip((xx - 700) / 900, 0, 1) * 0.5, P['mist_stain'])      # the mist catches the sun
        st('mist stain')

    # ================================================================ boat, rower, reflection: cut glass
    if 'boat' in inc:
        rng = g.group('boat')
        cx_, cy_ = BOAT_C
        K = BOAT_K
        j = lambda pts, a=1.0: [(x + rng.uniform(-a, a), y + rng.uniform(-a, a)) for x, y in pts]
        Q = lambda pts: S.pts(boat_pts(pts))
        BX = lambda x: cx_ + (x - cx_) * K
        BY = lambda y: cy_ + (y - cy_) * K
        IX = lambda x: cx_ + (np.asarray(x) - cx_) / K

        def lens(xa, xb, y0, t, bow=0.15):
            u = np.linspace(0, 1, 16)
            xs_ = xa + (xb - xa) * u
            top = y0 - t * bow * np.sin(np.pi * u)
            bot = y0 + t * np.sin(np.pi * u) ** 0.8
            return list(zip(xs_, top)) + list(zip(xs_[::-1], bot[::-1]))
        # the reflection: a few wave-shaped pieces of darker glass lying on the water under the hull
        for (xa, xb, y0, t, col) in [(1088, 1160, 812, 15, P['hull_ref']), (1171, 1240, 814, 12, P['hull_ref']),
                                     (1148, 1186, 834, 9, P['body_ref'])]:
            g.glass(g.poly(Q(j(lens(xa + rng.uniform(-4, 4), xb + rng.uniform(-4, 4), y0, t)))), col, flow=0.0,
                    flow_jit=0.2, mix=dict(streaky=0.6, cathedral=0.4), amin=200, tmin=7)
        st('boat reflection')
        # the hull: two strakes, each cut at midships -- four pieces of wood-brown glass
        hull = g.poly(Q(j([(1072, 776), (1120, 784), (1170, 787), (1220, 784), (1266, 770), (1250, 790), (1236, 799),
                           (1200, 808), (1130, 808), (1100, 800), (1088, 790)])))
        strake = lambda x: np.interp(IX(x), [1060, 1100, 1170, 1240, 1280], [790, 793, 797, 791, 784])
        mid = lambda x: BY(strake(x))
        bc = BX(1176)
        g.glass(hull, None, cuts=[('h', mid), ('line', (bc - 5, BY(760), bc + 7, BY(820)))],
                colour_fn=lambda cx, cy: shade(P['hull'] if cy < mid(np.array([cx]))[0] else P['hull_dk'],
                                               1.0 if cx < bc else 0.86),
                flow=0.03, flow_jit=0.2, mix=dict(streaky=0.7, reamy=0.3), amin=200, tmin=7, matting=0.0)
        st('hull')
        # the rower: torso (lit and shaded halves), sleeves, oars, face and hair -- each a piece of glass
        body = g.poly(Q(j([(1150, 781), (1188, 781), (1186, 762), (1180, 748), (1170, 742), (1158, 744), (1150, 754),
                           (1147, 768)], 0.8)))
        g.glass(body, None, cuts=[('line', (BX(1169), BY(740), BX(1171), BY(785)))],
                colour_fn=lambda cx, cy: shade([P['body']], 1.0 if cx < BX(1170) else 0.78),
                flow=np.pi / 2, mix=dict(cathedral=0.6, streaky=0.4), amin=150, tmin=6, matting=0.0)
        for (a, b_) in [((1140, 822), (1157, 773)), ((1236, 824), (1185, 773))]:      # oars, blade to hand
            oar = g.branch(Q([a, b_]), 7.5 * K * s, 6.5 * K * s)
            g.glass(oar, P['oar'], flow=float(np.arctan2(b_[1] - a[1], b_[0] - a[0])), flow_jit=0.1,
                    mix=dict(streaky=0.7, cathedral=0.3), amin=100, tmin=5, matting=0.0)
        for (a, b_) in [((1157, 751), (1154, 772)), ((1182, 751), (1186, 772))]:      # sleeves
            g.glass(g.branch(Q([a, b_]), 8.5 * K * s, 7 * K * s), shade([P['body']], 0.66), flow=np.pi / 2,
                    mix=dict(cathedral=1.0), amin=100, tmin=5, matting=0.0)
        hx, hy = boat_pts([(1170, 727)])[0]
        head = g.ellipse(*S.pt(hx, hy), 12.5 * K * s, 14 * K * s, 0.12)
        hl = (BX(1150), BY(713), BX(1188), BY(737))
        g.glass(head, None, cuts=[('line', hl)],
                colour_fn=lambda cx, cy: P['hair'] if (cx - hl[0]) * (hl[3] - hl[1]) - (cy - hl[1]) * (hl[2] - hl[0]) > 0
                else P['head'], mix=dict(cathedral=1.0), streak=0.4, amin=100, tmin=5, matting=0.0)
        st('rower')
        # grisaille, with a brush: plank lines, the face (eye, brow, nose, mouth, ear), hair, folds; matt modelling
        g.trace(Q([(1092, 795), (1170, 802), (1246, 789)]), 1.2 * s, taper=(0.3, 0.3), clip=hull, opacity=0.55)
        g.trace(Q([(1100, 803), (1170, 806), (1236, 798)]), 1.0 * s, taper=(0.3, 0.3), clip=hull, opacity=0.45)
        g.shade(hull, offset=(0, -5 * s), strength=0.3, soft=3 * s)
        g.scratch(Q([(1090, 780), (1160, 788), (1230, 783)]), 1.3 * s)
        g.shade(body, offset=(-5 * s, -3 * s), strength=0.3, soft=2.5 * s)
        g.trace(Q([(1159, 756), (1156, 766), (1160, 777)]), 1.1 * s, taper=(0.3, 0.5), clip=body, opacity=0.55)
        g.trace(Q([(1176, 754), (1179, 765), (1176, 776)]), 1.0 * s, taper=(0.3, 0.5), clip=body, opacity=0.5)
        g.shade(head, offset=(-4 * s, -3 * s), strength=0.32, soft=2.2 * s)               # the cheek turned away
        g.matt(head, 0.07, soft=1.5 * s)
        g.trace(Q([(1162.2, 727.6), (1164.2, 727.9)]), 1.5 * s, taper=(0.3, 0.3), smooth=False, opacity=0.7)   # eye
        g.trace(Q([(1159.5, 724.2), (1162.5, 723.4), (1165.8, 723.9)]), 1.0 * s, taper=(0.4, 0.5), opacity=0.45)  # brow
        g.trace(Q([(1158.6, 727.5), (1157.0, 731.4), (1159.4, 732.4)]), 1.0 * s, taper=(0.3, 0.5), opacity=0.55)  # nose
        g.trace(Q([(1160.5, 735.6), (1163.0, 736.0), (1165.2, 735.5)]), 0.9 * s, taper=(0.4, 0.4), opacity=0.5)  # mouth
        g.trace(Q([(1176.5, 726.0), (1178.6, 728.6), (1176.8, 731.2)]), 1.0 * s, taper=(0.3, 0.3), opacity=0.5)   # ear
        for k in range(3):                                                                # hair strands
            y_ = 716 + k * 5
            g.trace(Q([(1166 + k * 3, y_), (1175 + k * 2, y_ + 3), (1182, y_ + 7)]), 0.9 * s, taper=(0.3, 0.6),
                    opacity=0.5, clip=head)
        st('boat paint')

    # ================================================================ birds: gulls, three pieces of dark glass each
    if 'birds' in inc:
        rng = g.group('birds')
        for i, (bx, by, sc, fl) in enumerate(BIRDS):
            for pc in bird_pieces(bx, by, sc, fl, rng):
                g.glass(g.poly(S.pts(pc)), P['bird'], mix=dict(cathedral=1.0), seeds=0.2, amin=60, tmin=4,
                        fix_old=False, matting=0.0)
            st('bird %d' % i)

    # ================================================================ reeds: clumps of cut glass, painted veins
    if 'reeds' in inc:
        rng = g.group('reeds')
        yb = S.Y1 + 25
        for ci_, (cx, h, n) in enumerate([(40, 250, 4), (166, 205, 3), (280, 165, 3)]):
            blades, angs = [], []
            for k in range(n):
                a = -np.pi / 2 + (k - (n - 1) / 2) * rng.uniform(0.22, 0.3) + rng.normal(0, 0.04)
                L = h * rng.uniform(0.75, 1.15)
                bw = rng.uniform(20, 26)
                curl = rng.uniform(0.05, 0.2) * np.sign(np.cos(a) + 1e-3)       # leaves bend outward
                b0 = (cx + (k - n / 2) * 6, yb)
                p1 = (cx + np.cos(a) * (L * 0.5 + yb - 1080), yb + np.sin(a) * (L * 0.5 + yb - 1080))
                a2 = a + curl
                tip = (p1[0] + np.cos(a2) * L * 0.5, p1[1] + np.sin(a2) * L * 0.5)
                blades.append(g.branch(S.pts([b0, p1, tip]), bw * s, 6 * s))
                angs.append(a)
            m = np.clip(sum(blades), 0, 1)
            angs = sorted(angs)
            cuts = [('line', (cx, yb, cx + np.cos((angs[k] + angs[k + 1]) / 2) * 400, yb + np.sin((angs[k] + angs[k + 1]) / 2) * 400))
                    for k in range(0, len(angs) - 1)]
            g.glass(m, P['reed'], cuts=cuts, flow=-np.pi / 2, flow_jit=0.15, mix=dict(streaky=0.6, cathedral=0.4))
            for k in range(n):
                a = angs[k]
                L = h * 0.7
                g.trace(S.pts([(cx + np.cos(a) * 20, yb + np.sin(a) * 20 - 30 - (yb - 1080)),
                               (cx + np.cos(a) * (L + yb - 1080), yb + np.sin(a) * (L + yb - 1080))]),
                        1.1 * s, taper=(0.2, 0.7), clip=m, opacity=0.8)
            st('reeds %d' % ci_)
        for (x, y, lean) in [(98, 846, 0.06), (212, 892, -0.05)]:
            g.trace(S.pts([(x - lean * 120, yb - 40), (x - lean * 60, y + 60), (x, y + 24)]), 2.0 * s, taper=(0.0, 0.3))
            g.glass(g.ellipse(*S.pt(x, y), 6.5 * s, 21 * s, lean), P['cattail'], mix=dict(cathedral=1.0), seeds=0.5)
        st('reeds done')

    # ================================================================ finishing: lead, weather (always run)
    g.finish(lead=6.0, grime=0.3, pits=0.25)
    img = g.composite()
    st.save(img, 'final')
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'stainedglass_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    t0 = time.perf_counter()
    im = paint(W, H, colourway=cw, bleed=bl)
    print('paint %.2fs' % (time.perf_counter() - t0))
    save_png(im, out)
