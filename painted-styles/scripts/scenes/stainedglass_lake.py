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
from _stainedglass_kit import (Panel, Stager, hband, design_xy, const, polyfn, shade, cloud_shape,  # noqa: E402
                               bird_pts, lay_cloud)

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
        reed=['#2a4a30', '#33502e', '#26402c'], cattail=['#4a2a1c', '#5a3422'], sky=('#ffffff', '#f2eee6')),
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
        reed=['#3a6a30', '#4a7a34', '#2f5a2c'], cattail=['#5a3422', '#6a4028'], sky=('#ffffff', '#f2eee6')),
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
    """every pine its own: tier count and spacing, side widths, droop, lean -- from a geometry generator that
    does not belong to any group (the water group needs the shapes for the reflections)"""
    r = drawkit.group_rng(seed, 'pine-geometry')
    out = []
    for (cx, top, hw, root) in PINES:
        h = root - top
        tiers = int(r.integers(4, 6)) if h > 150 else int(r.integers(3, 5))
        lean = r.uniform(-0.05, 0.05)
        gaps = r.uniform(0.75, 1.3, tiers)
        tips = top + h * 0.9 * np.cumsum(gaps) / gaps.sum()
        ax = lambda y, cx=cx, lean=lean, root=root: cx + lean * (root - y)
        left, right, ws = [], [], []
        prev = top
        for t, yt in enumerate(tips):
            f = ((t + 1) / tiers) ** r.uniform(0.7, 0.95)
            wl, wr = hw * f * r.uniform(0.82, 1.1), hw * f * r.uniform(0.82, 1.1)
            ws.append((wl, wr))
            yin = prev + (yt - prev) * r.uniform(0.5, 0.65)
            if t > 0:
                left.append((ax(yin) - max(wl * r.uniform(0.42, 0.58), 10), yin))
                right.append((ax(yin) + max(wr * r.uniform(0.42, 0.58), 10), yin))
            dl, dr = r.uniform(2, 9), r.uniform(2, 9)
            left += [(ax(yt) - wl * 0.7, yt - 6), (ax(yt) - wl, yt + dl), (ax(yt) - wl * 0.55, yt + dl * 0.4)]
            right += [(ax(yt) + wr * 0.7, yt - 6), (ax(yt) + wr, yt + dr), (ax(yt) + wr * 0.55, yt + dr * 0.4)]
            prev = yt
        tw = max(7, hw * 0.15)
        yb = tips[-1]
        pts = ([(ax(top), top)] + right + [(ax(yb) + tw, yb + 2), (cx + tw, root + 4), (cx - tw, root + 4),
                                           (ax(yb) - tw, yb + 2)] + left[::-1])
        out.append(dict(pts=pts, cx=cx, top=top, root=root, hw=hw, ax=ax, tips=list(tips), ws=ws, lean=lean))
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
    pine_ms = [g.poly(S.pts(p['pts'])) for p in PS]
    pines_m = np.clip(sum(pine_ms), 0, 1)
    pref_id = np.zeros_like(pines_m)                  # which pine each reflection pixel belongs to (1-based)
    for i, p in enumerate(PS):
        pm_ = g.poly(S.pts(flip([(p['cx'] + (x - p['cx']) * 0.7, y) for x, y in p['pts']], 0.8)))
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
            ax, tips = p['ax'], p['tips']
            cuts = [('v', lambda y, ax=ax: ax(y))] if p['hw'] >= 40 else []
            for t_, yt in enumerate(tips[:-1] if p['hw'] >= 45 else []):   # a lead under the tiers: drooping boughs
                wl, wr = p['ws'][t_]
                cuts.append(('h', lambda x, yt=yt, ax=ax, w=max(wl, wr): yt + 2 - 0.4 * np.clip(w - np.abs(x - ax(yt)), 0, None)))
            pal_t = [(rng.uniform(0.9, 1.1)) for _ in range(len(tips) + 1)]
            g.glass(pm, None, cuts=cuts,
                    colour_fn=lambda cx, cy, ax=ax, pal_t=pal_t, tips=tips: shade(
                        P['pine_lit'] if cx < ax(cy) else P['pine_sh'], pal_t[int(np.searchsorted(tips, cy))]),
                    flow=np.pi / 2, flow_jit=0.3, mix=dict(cathedral=0.4, reamy=0.3, streaky=0.3), amin=350, tmin=9)
            # needles: short drooping grisaille strokes along each tier, every one different
            for t, yt in enumerate(tips):
                f = (t + 1) / len(tips)
                w = p['hw'] * f * 0.8
                for sgn in (-1, 1):
                    n_ = int(rng.integers(2, 4))
                    for j in range(n_):
                        x0_ = ax(yt) + sgn * w * rng.uniform(0.1, 0.8)
                        y0_ = yt - rng.uniform(2, 10)
                        g.trace(S.pts([(x0_, y0_), (x0_ + sgn * rng.uniform(5, 12), y0_ + rng.uniform(2, 6))]),
                                rng.uniform(1.1, 1.8) * s, taper=(0.2, 0.8), smooth=False, clip=pm)
            st('pine %d' % i)

    # ================================================================ water: perspective rows; reflections in glass
    if 'water' in inc:
        rng = g.group('water')
        levels, y = [], HORIZON
        while True:
            y += (22 + (y - HORIZON) * 0.11) * rng.uniform(0.75, 1.3)
            if y > S.Y1 + 10:
                break
            levels.append(y)
        gx = P['glit_x']
        wob = rng.uniform(0, 6.3, 3)

        def feature(a, c):
            a = np.asarray(a, float); c = np.asarray(c, float)
            f = np.zeros(len(a), np.int64)
            nr = HORIZON + (HORIZON - near_ridge(a)) * 0.8
            f[c < nr] = 1
            iy = np.clip(np.round(S.y(c)).astype(int), 0, g.H - 1)
            ix = np.clip(np.round(S.x(a)).astype(int), 0, g.W - 1)
            pid = pref_id[iy, ix].astype(np.int64)
            f[pid > 0] = 10 + pid[pid > 0]
            depth = (c - HORIZON) / 440.0
            gw = 56 + 230 * depth
            off = 14 * np.sin(c / 37.0 + wob[0]) + 9 * np.sin(c / 13.0 + wob[1])
            f[(np.abs(a - gx - 40 * depth - off) < gw / 2) & (c < 960)] = 3
            return f

        def run_edit(runs, yc, r):
            depth = (yc - HORIZON) / 440.0
            out = []
            for ra, rb, fd in runs:
                L = rb - ra
                if (fd == 1 or fd > 10) and L > 70 and r.random() < 0.25 + 0.5 * depth:
                    m_ = ra + L * r.uniform(0.35, 0.65)
                    gp = r.uniform(18, 34)
                    out += [[ra, m_ - gp / 2, fd], [m_ - gp / 2, m_ + gp / 2, 0], [m_ + gp / 2, rb, fd]]
                elif fd == 3:
                    if r.random() < 0.6 * max(depth - 0.45, 0):
                        out.append([ra, rb, 0])
                        continue
                    x = ra + r.uniform(0, 18)
                    out.append([ra, x, 0])
                    while x < rb - 20:
                        ln = r.uniform(22, 36 + 24 * depth)
                        gp = r.uniform(16, 28 + 26 * depth)
                        e = min(x + ln, rb)
                        out.append([x, e, 3])
                        if e + gp < rb:
                            out.append([e, e + gp, 0])
                        x = e + gp
                    out[-1][1] = rb
                else:
                    out.append([ra, rb, fd])
            # reflections are a little shorter than what they reflect
            for i in range(len(out) - 1):
                a_, b_ = out[i], out[i + 1]
                if (a_[2] == 1 or a_[2] > 10) and b_[2] == 0:
                    a_[1] -= r.uniform(0, 10); b_[0] = a_[1]
                elif a_[2] == 0 and (b_[2] == 1 or b_[2] > 10):
                    b_[0] += r.uniform(0, 10); a_[1] = b_[0]
            return out

        def tone(cx, cy, pal):
            if pal is not None and pal is not P['water'][0]:
                return None
            k = 0 if cy < 745 + rng.uniform(-25, 25) else (1 if cy < 880 + rng.uniform(-30, 30) else 2)
            return P['water'][k]
        wm = g.poly(S.pts(hband(S, HORIZON, Y1)))
        near_glit = lambda a, c: 0.3 if abs(a - gx) < 70 + 0.5 * (c - HORIZON) else 1.0
        g.band(wm, P['water'][0], const(HORIZON), const(Y1), levels=levels, length=(130, 360), tilt=0.42,
               wave=(8.0, 260.0), feature=feature, run_edit=run_edit, size=near_glit, vary=1.35,
               fid_colours=dict([(1, P['nref']), (3, P['glit'])] + [(11 + i, P['pref']) for i in range(len(PS))]),
               colour_fn=tone, amin=420, tmin=11,
               flow=0.0, flow_jit=0.12, mix=dict(streaky=0.35, cathedral=0.25, reamy=0.25, seedy=0.15))
        st('water glass')
        # wavelets: a few fine painted marks, clustered, never the same twice
        for k in range(28):
            yv = HORIZON + 60 + (k / 28) ** 1.3 * 380 + rng.uniform(-8, 8)
            x0_ = rng.uniform(S.X0 + 20, S.X1 - 80)
            if abs(x0_ - gx) < 160 and yv < 900:
                continue
            L = rng.uniform(18, 60) * (0.6 + (yv - HORIZON) / 440)
            for j in range(int(rng.integers(1, 4))):
                xa = x0_ + j * L * rng.uniform(0.6, 1.1)
                ya = yv + rng.uniform(-3, 3)
                g.trace(S.pts([(xa, ya), (xa + L * 0.45, ya - rng.uniform(1, 3)), (xa + L, ya + rng.uniform(-1, 1))]),
                        rng.uniform(1.0, 1.7) * s, taper=(0.3, 0.5), opacity=0.55, wobble=0.3 * s)
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
        j = lambda pts, a=1.2: [(x + rng.uniform(-a, a), y + rng.uniform(-a, a)) for x, y in pts]
        Q = lambda pts: S.pts(boat_pts(pts))
        # reflection first (it lies on the water below the hull), broken into pieces with water between
        rf = g.poly(Q([(1096, 810), (1240, 810), (1226, 834), (1112, 836)]))
        gaps = g.poly(Q([(1150, 806), (1168, 806), (1172, 840), (1152, 840)])) + \
            g.poly(Q([(1200, 822), (1250, 822), (1250, 840), (1200, 840)]))
        g.band(rf * (1 - np.clip(gaps, 0, 1)), P['hull_ref'], const(boat_pts([(0, 810)])[0][1]), const(boat_pts([(0, 836)])[0][1]), rows=1,
               length=(60, 90), tilt=0.3, flow=0.0, mix=dict(streaky=0.6, cathedral=0.4))
        g.glass(g.poly(Q(j([(1150, 842), (1186, 842), (1180, 858), (1156, 858)]))), P['body_ref'], flow=0.0)
        st('boat reflection')
        hull = g.poly(Q(j([(1072, 776), (1120, 784), (1170, 787), (1220, 784), (1266, 770), (1250, 790), (1236, 799),
                           (1200, 808), (1130, 808), (1100, 800), (1088, 790)])))
        bc = boat_pts([(1176, 0)])[0][0]
        g.glass(hull, None, cuts=[('line', (bc - 4, 700, bc + 6, 900))],
                colour_fn=lambda cx, cy: P['hull'] if cx < bc else P['hull_dk'], flow=0.03, flow_jit=0.05,
                mix=dict(streaky=0.7, reamy=0.3))
        st('hull')
        body = g.poly(Q(j([(1150, 781), (1188, 781), (1186, 762), (1180, 748), (1170, 742), (1158, 744), (1150, 754),
                           (1147, 768)], 0.8)))
        g.glass(body, P['body'], flow=np.pi / 2, mix=dict(cathedral=0.6, streaky=0.4))
        hx, hy = boat_pts([(1170, 727)])[0]
        head = g.ellipse(*S.pt(hx, hy), 12.5 * BOAT_K * s, 14 * BOAT_K * s, 0.15)
        g.glass(head, None, cuts=[('h', lambda x: hy - 1 + 0.45 * (x - hx))],
                colour_fn=lambda cx, cy: P['head'] if cy > hy else P['hair'], mix=dict(cathedral=1.0), streak=0.4)
        st('rower')
        # grisaille: planks, gunwale, oars, arm and folds, hair and face
        g.trace(Q([(1074, 777), (1170, 788), (1265, 771)]), 2.6 * s, taper=(0.1, 0.1), clip=hull)
        g.trace(Q([(1094, 795), (1170, 799), (1246, 789)]), 1.3 * s, taper=(0.2, 0.2), clip=hull)
        g.trace(Q([(1160, 765), (1138, 790), (1100, 826)]), 3.4 * s, taper=(0.1, 0.5), smooth=False)
        g.trace(Q([(1180, 765), (1206, 792), (1242, 828)]), 3.4 * s, taper=(0.1, 0.5), smooth=False)
        g.trace(Q([(1158, 752), (1152, 764), (1160, 768)]), 1.5 * s, taper=(0.2, 0.2), clip=body)
        g.trace(Q([(1176, 750), (1181, 762), (1176, 768)]), 1.3 * s, taper=(0.2, 0.2), clip=body)
        g.shade(body, offset=(-6 * s, 0), strength=0.35, soft=2 * s)
        g.trace(Q([(1166, 733), (1170, 735)]), 1.2 * s, smooth=False)                                    # mouth
        g.trace(Q([(1178, 727), (1180, 731)]), 1.6 * s, smooth=False)                                    # ear
        g.trace(Q([(1163, 729), (1165, 729)]), 1.8 * s, smooth=False)                                     # eye
        g.trace(Q([(1159, 731), (1157, 735), (1160, 736)]), 1.0 * s, taper=(0.2, 0.2))                   # nose
        g.matt(g.ellipse(*S.pt(hx + 3, hy), 12 * s, 13 * s), 0.18, soft=3 * s)
        g.scratch(Q([(1100, 783), (1160, 790), (1230, 783)]), 1.6 * s)
        st('boat paint')

    # ================================================================ birds: gulls cut in dark glass
    if 'birds' in inc:
        rng = g.group('birds')
        for i, (bx, by, sc, fl) in enumerate(BIRDS):
            g.glass(g.poly(S.pts(bird_pts(bx, by, sc, fl, rng))), P['bird'], mix=dict(cathedral=1.0), seeds=0.2)
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
    g.finish(lead=6.0, grime=0.25, pits=0.25)
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
