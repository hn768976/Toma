"""Coastal village on a cliff — Stained glass (彩色玻璃花窗): one full-bleed leaded panel. A headland on the
left with a whitewashed village and a striped lighthouse, sailing boats on the sea, gulls.
Built on vendor lib/stainedglass.py `StainedGlass` via scenes/_stainedglass_kit.Panel: designed cut lines (sky rows
radiating from the sun, sea in perspective rows with a glitter path of cut glass, cliff strata, turf rows), houses,
doors, windows, boats, sails and gulls all cut glass; grisaille only for fine detail (tiles, rigging, cracks).

python scripts/scenes/stainedglass_coast.py out.png [W H] [colourway] [bleed]
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drawkit  # noqa: E402,F401  (sets sys.path to the skill lib)
from drawkit import Scaler, seed_all, save_png  # noqa: E402

import numpy as np  # noqa: E402
from _stainedglass_kit import (Panel, Stager, hband, design_xy, const, polyfn, shade, bird_pts,  # noqa: E402
                               lay_cloud)

STYLE = "Stained glass · 彩色玻璃花窗"
LIB = "stainedglass"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

HORIZON = 560.0
EDGE_X = 905.0          # where the cliff top breaks over into the face

PAL = {
    "Dusk": dict(
        bands=[['#1d2a6e', '#243380', '#1a2766'], ['#3a3488', '#4a3a8a', '#33307a'], ['#7a2c5c', '#8a3466', '#6e2a5a'],
               ['#c0405a', '#b3182c', '#cc5a5a'], ['#d0601e', '#e0922a', '#d8702a'], ['#f2c230', '#e8a830', '#f4d060']],
        radial=(3, 4, 5), sun=(1500.0, 562.0, 54.0), sun_col=['#f8e070', '#f4d060'],
        cloud=[['#c27a9c', '#b86e96', '#c886a2'], ['#eaa0aa', '#f0b4b0', '#e094a4', '#f4c0b0']], cloud_lit='below',
        island=['#6e5a96', '#7c6aa0', '#66548e'],
        sea=[['#c0405a', '#cc5a5a', '#b3182c'], ['#7a2c5c', '#8a3466', '#6e2a5a'], ['#3a3488', '#4a3a8a', '#33307a'],
             ['#1d2a6e', '#172560', '#22306f']],
        glit=['#f2c230', '#e0922a', '#f4d060'], glit_x=1500.0,
        grass=['#2a5a3a', '#245236', '#30603c'], rock=['#7a3a5a', '#8a4a4a', '#6a3a6a', '#9a5248'],
        walls=['#e8c9a0', '#d8b48a', '#e0bca0'], roofs=['#8a2a2a', '#7a2a3a', '#6e3048'],
        window='lit', win_col=['#f4d060', '#f2c230'], win_dark=['#2a1a30'], door=['#3a2430', '#2e1e2a'],
        corona=['#f8d870', '#f4c860', '#fae090'],
        tower=('#e8dcd0', '#b3182c'), lantern=['#f8e070', '#f4d060'], cap='#2a1a30', beam='#f4d878',
        hulls=['#3a2430', '#2a2450', '#5a2a2a'], sails=[['#f0c8a0', '#e8b890'], ['#f4d0a8', '#e8c098'], ['#e89a80', '#d88a78']],
        boat_ref='#1a1a40', foam=['#c8b0d8', '#d8c0e0', '#bca4cc'], rocks=['#2a2040', '#33284a'],
        gull='#1c1a40', gull_tip=False, sky=('#ffffff', '#f2eee6')),
    "Day": dict(
        bands=[['#1f4fa8', '#2456b0', '#1d4a9e'], ['#3368b8', '#3d74c2', '#2f60b0'], ['#5d8fd0', '#6a9ad6', '#5588cc'],
               ['#86b0de', '#93bae2', '#7ca8da'], ['#aecde8', '#bcd6ec', '#a4c6e4'], ['#c8dcec', '#d0e2ee', '#bcd4e8']],
        radial=(), sun=(1420.0, 140.0, 44.0), sun_col=['#f2c230', '#f4d060'],
        cloud=[['#c8d4e2', '#d0dae6', '#bccce0'], ['#f4f1e6', '#eeeadb', '#f6f4ec']], cloud_lit='above',
        island=['#6f86b4', '#7a90bc', '#6880ac'],
        sea=[['#3d7cc4', '#4a86c8', '#3572bc'], ['#2a64b4', '#2f6ec0', '#245cac'], ['#1f4fa8', '#2456b0', '#1d4a9e'],
             ['#173c8f', '#1a4296', '#143686']],
        glit=['#eeeadb', '#d7e2ea', '#f4f1e6'], glit_x=1420.0,
        grass=['#4fa83f', '#2f8a3c', '#5aa844'], rock=['#c8925a', '#b07a48', '#d8a868', '#a06c40'],
        walls=['#f4f1e6', '#eeeadb', '#f0e0b8'], roofs=['#b5482a', '#c0582e', '#a03c28'],
        window='dark', win_col=None, win_dark=['#233048', '#2a3450'], door=['#4a3020', '#3e281c'],
        corona=['#f4e6a0', '#f0dc8c', '#f6eab4'],
        tower=('#f4f1e6', '#b3182c'), lantern=['#d7e2ea', '#e4e9f0'], cap='#2a2a3a', beam=None,
        hulls=['#6e4526', '#173c8f', '#7a2c2c'], sails=[['#f4f1e6', '#eeeadb'], ['#b3182c', '#c0283a'], ['#f4f1e6', '#e8e4d4']],
        boat_ref='#123070', foam=['#f4f1e6', '#e4e9f0', '#eeeadb'], rocks=['#4a3a30', '#3e3028'],
        gull='#f4f1e6', gull_tip=True, sky=('#ffffff', '#f2eee6')),
}

CLOUDS = [(330, 118, 420, 46), (1080, 92, 380, 42), (1730, 236, 340, 38)]
GULLS = [(1020, 250, 1.0, 1.0), (1105, 312, 0.78, 0.6), (1190, 214, 0.9, 0.85), (950, 336, 0.66, 0.9), (1300, 288, 0.6, 0.5)]
# village: (cx, width, wall height, roof height, front?)  -- the back row stands on the crest, the front row lower
HOUSES = [(130, 86, 62, 34, 0), (470, 92, 58, 34, 0), (640, 78, 54, 30, 0),
          (52, 92, 70, 36, 1), (212, 100, 64, 36, 1), (388, 86, 60, 32, 1), (556, 98, 66, 36, 1), (712, 80, 56, 30, 1)]
CHURCH = (300, 40, 150)
LH = (822.0, 34.0, 24.0)       # lighthouse: centre x, base half-width, top half-width
BOATS = [(1240, 768, 1.0), (1610, 650, 0.55), (1470, 930, 1.35)]
ROCKS = [(985, 908, 62, 30), (1062, 930, 46, 22), (905, 930, 74, 26), (1135, 942, 30, 14), (760, 935, 50, 18)]


def grass_y(x):
    return 455 - 95 * np.exp(-((x - 260) / 330) ** 2) + 6 * np.sin(x / 60.0)


FACE = [(EDGE_X, None), (922, 500), (914, 560), (948, 612), (940, 684), (988, 742), (1012, 820), (1062, 880), (1094, 916)]
FOOT = 916.0


def land_pts(S):
    xs = np.linspace(S.X0 - 30, EDGE_X, 90)
    top = list(zip(xs, grass_y(xs)))
    face = [(x, grass_y(EDGE_X) if y is None else y) for x, y in FACE]
    return top + face[1:] + [(S.X0 - 30, FOOT)]


def face_x(y):
    """x of the cliff face at height y (design)"""
    pts = [(x, grass_y(EDGE_X) if y_ is None else y_) for x, y_ in FACE]
    return np.interp(y, [p[1] for p in pts], [p[0] for p in pts])


def house_base(cx, front):
    return grass_y(cx) + (44 if front else -4)


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None, dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    dusk = colourway == "Dusk"
    S = Scaler(W, H, bleed)
    s = S.s
    g = Panel(S, seed, ambient=0.08, sky=P['sky'])
    st = Stager(g, stages_dir, dense_stages)
    xx, yy = design_xy(g)
    Y0, Y1 = S.Y0 - 30, S.Y1 + 30
    inc = set(GROUPS) if include is None else set(include)
    land = g.poly(S.pts(land_pts(S)))

    if 'all' in inc:
        rng = g.group('all')
        # ============================================================ sky: rows, cuts radiating from the sun
        edges = [Y0, 110, 200, 290, 380, 470, HORIZON + 10]
        sx, sy, sr = P['sun']

        def curve(k):
            if k in (0, len(edges) - 1):
                return const(edges[k])
            return lambda xs, k=k: (edges[k] + 10 * np.sin(np.asarray(xs) / 150.0 + 0.9 * k)
                                    - (14 * k if dusk else 0) * np.exp(-((np.asarray(xs) - sx) / 600.0) ** 2))
        to_sun = lambda a, c: float(np.arctan2(-(a - sx), -(c - sy) + 1e-3)) * 0.8
        size = lambda a, c: 0.5 + 0.6 * np.clip(np.hypot(a - sx, (c - sy) * 1.6) / 900.0, 0, 1)
        sun = g.circle(*S.pt(sx, sy), sr * s) * (yy < HORIZON)
        halo = g.circle(*S.pt(sx, sy), (sr + 40) * s) * (yy < HORIZON)
        for k, cols in enumerate(P['bands']):
            m = g.poly(S.pts(hband(S, curve(k), curve(k + 1)))) * (1 - halo)
            g.band(m, cols, curve(k), curve(k + 1), row_h=74, length=(190, 380), cut_dir=to_sun, size=size,
                   tilt=0.08, bend=0.3, flow=0.05)
        ring = np.clip(halo - sun, 0, 1)
        g.radial(ring, P['corona'], (sx, sy), [sr + 0.5], length=(44, 62), tilt=0.05, flow=None,
                 mix=dict(streaky=0.5, cathedral=0.5))
        g.glass(sun, P['sun_col'], mix=dict(cathedral=0.6, reamy=0.4))
        g.stain(sun * 0.8, 0.7)
        st('sky')
        for i, (cx, cy, L, h) in enumerate(CLOUDS):
            lay_cloud(g, S, cx, cy, L, h, P['cloud'], P['cloud_lit'], rng)
        st('clouds')
        # ---- lighthouse beam (dusk): a long wedge of pale glass to the left, over the village sky
        lx, ly = LH[0], 212.0
        if P['beam']:
            bt = lambda a: ly - 8 - (lx - 20 - np.asarray(a)) * 0.085
            bb = lambda a: ly + 8 + (lx - 20 - np.asarray(a)) * 0.0
            beam = g.poly(S.pts([(lx - 20, float(bt(lx - 20))), (S.X0 - 40, float(bt(S.X0 - 40))),
                                 (S.X0 - 40, float(bb(S.X0 - 40))), (lx - 20, float(bb(lx - 20)))]))
            g.band(beam, P['beam'], bt, bb, rows=1, length=(160, 300), tilt=0.15, flow=-0.04, flow_jit=0.1,
                   mix=dict(opal=0.5, seedy=0.5), opal=0.25)
            g.matt(beam * np.clip((lx - xx) / 900, 0, 1), 0.3, soft=12 * s)
            st('beam')

        # ============================================================ sea: perspective rows, glitter of glass
        far_isl = lambda xs: HORIZON - 34 * np.exp(-((xs - 1840) / 140) ** 2) - 18 * np.exp(-((xs - 1700) / 90) ** 2) \
            + 3 * np.sin(xs / 23.0)
        levels, y = [], HORIZON
        while True:
            y += (22 + (y - HORIZON) * 0.11) * rng.uniform(0.75, 1.3)
            if y > S.Y1 + 10:
                break
            levels.append(y)
        gx = P['glit_x']
        wob = rng.uniform(0, 6.3, 2)

        def feature(a, c):
            a = np.asarray(a, float); c = np.asarray(c, float)
            f = np.zeros(len(a), np.int64)
            depth = (c - HORIZON) / 520.0
            gw = 40 + 200 * depth
            off = 14 * np.sin(c / 37.0 + wob[0]) + 9 * np.sin(c / 13.0 + wob[1])
            f[(np.abs(a - gx - off - 20 * depth) < gw / 2) & (c < 1000)] = 3
            return f

        def run_edit(runs, yc, r):
            depth = (yc - HORIZON) / 520.0
            out = []
            for ra, rb, fd in runs:
                if fd != 3:
                    out.append([ra, rb, fd])
                    continue
                if r.random() < 0.6 * max(depth - 0.45, 0):
                    out.append([ra, rb, 0])
                    continue
                x = ra + r.uniform(0, 18)
                out.append([ra, x, 0])
                while x < rb - 20:
                    e = min(x + r.uniform(26, 50 + 50 * depth), rb)
                    gp = r.uniform(16, 26 + 30 * depth)
                    out.append([x, e, 3])
                    if e + gp < rb:
                        out.append([e, e + gp, 0])
                    x = e + gp
                out[-1][1] = rb
            return out

        def tone(cx, cy, pal):
            if pal is P['glit']:
                return None
            d = cy + rng.uniform(-30, 30)
            k = 0 if d < 640 else (1 if d < 760 else (2 if d < 900 else 3))
            return P['sea'][k]
        sea_m = g.poly(S.pts(hband(S, HORIZON, Y1)))
        near_glit = lambda a, c: 0.3 if abs(a - gx) < 60 + 0.45 * (c - HORIZON) else 1.0
        g.band(sea_m, P['sea'][0], const(HORIZON), const(Y1), levels=levels, length=(130, 360), tilt=0.42,
               wave=(8.0, 260.0), feature=feature, run_edit=run_edit, size=near_glit, vary=1.3,
               fid_colours={3: P['glit']}, colour_fn=tone, amin=420, tmin=11,
               flow=0.0, flow_jit=0.12, mix=dict(streaky=0.35, cathedral=0.25, reamy=0.25, seedy=0.15))
        isl = g.poly(S.pts(hband(S, far_isl, HORIZON + 1))) * (xx > 1560)
        g.contour(isl, P['island'], row_h=40, length=(120, 240), tilt=0.3, flow=0.0)
        for k in range(36):                                   # wavelets: fine painted marks, clustered, all different
            yv = HORIZON + 40 + (k / 36) ** 1.15 * 470 + rng.uniform(-6, 6)
            x0 = rng.uniform(1000 + (yv - 600) * 0.3, S.X1 - 60)
            if abs(x0 - gx) < 120 and yv < 980:
                continue
            L = rng.uniform(20, 70) * (0.5 + (yv - HORIZON) / 420)
            for j in range(int(rng.integers(1, 4))):
                xa = x0 + j * L * rng.uniform(0.6, 1.1)
                g.trace(S.pts([(xa, yv), (xa + L * 0.4, yv - 2.5), (xa + L, yv + rng.uniform(-1, 1.5))]),
                        rng.uniform(1.0, 1.7) * s, taper=(0.3, 0.5), opacity=0.55, wobble=0.3 * s)
        st('sea')

        # ============================================================ boats: sails, hulls, broken reflections, cut glass
        for bi, (bx, by, sc) in enumerate(BOATS):
            j = lambda pts, a=1.2: [(x + rng.uniform(-a, a), y + rng.uniform(-a, a)) for x, y in pts]
            q = lambda pts: S.pts([(bx + x * sc, by + y * sc) for x, y in pts])
            rf = g.poly(q(j([(-58, 6), (60, 6), (50, 24), (-48, 26)])))
            gap = g.poly(q([(-6 + rng.uniform(-14, 14), 2), (10 + rng.uniform(-14, 14), 2), (14, 30), (-2, 30)]))
            g.glass(rf * (1 - gap), P['boat_ref'], flow=0.0, mix=dict(streaky=0.6, cathedral=0.4))
            g.glass(g.poly(q(j([(-6, -158), (-6, -24), (-70, -28), (-46, -88), (-24, -130)]))),
                    P['sails'][bi][0], cuts=[('h', const(by - 92 * sc))] if sc > 0.9 else (), flow=np.pi / 2,
                    mix=dict(opal=0.5, cathedral=0.5))
            g.glass(g.poly(q(j([(6, -146), (64, -24), (6, -26)]))), P['sails'][bi][1], flow=np.pi / 2,
                    mix=dict(opal=0.5, cathedral=0.5))
            g.glass(g.poly(q(j([(-76, -16), (76, -22), (62, 4), (-60, 4)]))), P['hulls'][bi], flow=0.0,
                    cuts=[('line', (bx + 8 * sc, by - 40, bx + 2 * sc, by + 20))] if sc > 0.9 else (),
                    mix=dict(streaky=0.6, reamy=0.4))
            g.trace(q([(0, -168), (0, -14)]), 3.0 * s * max(sc, 0.7), taper=(0.1, 0.0), smooth=False)       # mast
            g.trace(q([(0, -166), (-70, -27)]), 1.1 * s * max(sc, 0.7), taper=(0.1, 0.1), smooth=False)    # rigging
            g.trace(q([(-74, -14), (0, -17), (74, -20)]), 2.0 * s * max(sc, 0.7), taper=(0.1, 0.1))
            g.shade(g.poly(q([(-6, -158), (-6, -24), (-70, -28)])), offset=(-8 * s * sc, 0), strength=0.25, soft=3 * s)
        st('boats')

        # ============================================================ the headland: strata on the face, turf on top
        grass = land * (yy < grass_y(np.minimum(xx, EDGE_X)) + 64) * (xx < EDGE_X + 10)
        face = np.clip(land - grass, 0, 1)
        ftop = lambda a: grass_y(np.minimum(np.asarray(a, float), EDGE_X)) + 60
        fbot = const(FOOT + 4)
        g.band(face, P['rock'], ftop, fbot, row_h=58, length=(150, 300), tilt=0.3,
               cut_dir=lambda a, c: 0.45 * np.sin(a / 110.0 + c / 90.0), wave=(0.22, 160.0),
               colour_fn=lambda cx, cy, pal: shade(P['rock'], 1.0 - 0.35 * np.clip((cy - 560) / 380, 0, 1)
                                                   - 0.15 * np.clip((cx - 720) / 300, 0, 1)),
               flow=0.05, mix=dict(cathedral=0.35, reamy=0.35, streaky=0.3))
        gt = lambda a: grass_y(np.asarray(a, float))
        g.band(grass, P['grass'], gt, lambda a: gt(a) + 66, rows=2, length=(170, 320), tilt=0.3, flow=0.1,
               mix=dict(streaky=0.5, cathedral=0.3, reamy=0.2))
        for k in range(16):                                    # cracks in the rock: fine painted detail
            x = rng.uniform(40, 980); y = rng.uniform(560, 860)
            if x > face_x(y) - 20:
                continue
            g.trace(S.pts([(x, y), (x + rng.uniform(-10, 10), y + rng.uniform(14, 26)), (x + rng.uniform(-14, 14), y + rng.uniform(30, 50))]),
                    rng.uniform(1.1, 1.8) * s, taper=(0.2, 0.8), clip=face, opacity=0.8)
        for k in range(48):                                    # tufts: clusters, each one different
            x = rng.uniform(S.X0 + 10, EDGE_X - 10)
            y = grass_y(x) + rng.uniform(8, 40)
            for b in range(int(rng.integers(2, 5))):
                dx = rng.uniform(-4, 4); hh = rng.uniform(6, 13); lean = rng.uniform(-6, 6)
                g.trace(S.pts([(x + dx, y), (x + dx + lean, y - hh)]), rng.uniform(1.0, 1.8) * s, taper=(0.1, 0.9),
                        smooth=False, clip=grass)
        st('headland')

        # ============================================================ village: walls, roofs, windows, doors -- all glass
        def house(cx, w, h, rh, front, wall, roof):
            base = house_base(cx, front)
            jit = lambda pts: [(x + rng.uniform(-1.5, 1.5), y + rng.uniform(-1.5, 1.5)) for x, y in pts]
            sk = rng.uniform(-4, 4)
            body = jit([(cx - w / 2, base), (cx - w / 2, base - h), (cx + w / 2, base - h + sk * 0.3), (cx + w / 2, base)])
            rf = jit([(cx - w / 2 - 8, base - h + 2), (cx + sk, base - h - rh), (cx + w / 2 + 8, base - h + 2)])
            bm = g.poly(S.pts(body))
            g.glass(bm, wall, mix=dict(cathedral=0.5, seedy=0.3, opal=0.2), seeds=0.8)
            g.glass(g.poly(S.pts(rf)), roof, flow=0.0, mix=dict(streaky=0.6, cathedral=0.4))
            g.shade(bm, offset=(-w * 0.35 * s, 0), strength=0.3, soft=3 * s)
            for k in range(3):                                 # roof tile rows
                tt = (k + 1) / 4
                g.trace(S.pts([(cx - (w / 2 + 8) * (1 - tt) - 2 + sk * tt, base - h - rh * (1 - tt) + 2),
                               (cx + (w / 2 + 8) * (1 - tt) + 2 + sk * tt, base - h - rh * (1 - tt) + 2)]),
                        rng.uniform(1.1, 1.6) * s, smooth=False)
            nwin = 2 if w < 90 else 3
            for k in range(nwin):
                wx = cx - w / 2 + w * (k + 0.5) / nwin + rng.uniform(-3, 3)
                if k == nwin // 2 and front:
                    g.glass(g.poly(S.pts(jit(rect(wx - 10, base - 32, wx + 10, base + 1)))), P['door'], mix=dict(cathedral=1.0))
                    continue
                wy = base - h * 0.62
                wc = P['win_col'] if P['window'] == 'lit' else P['win_dark']
                g.glass(g.poly(S.pts(jit(rect(wx - 9, wy - 11, wx + 9, wy + 11)))), wc, thick=0.8, mix=dict(cathedral=1.0))
                g.trace(S.pts([(wx, wy - 9), (wx, wy + 9)]), 1.3 * s, smooth=False)
                g.trace(S.pts([(wx - 7, wy), (wx + 7, wy)]), 1.1 * s, smooth=False)

        back = [hh for hh in HOUSES if not hh[4]]
        front = [hh for hh in HOUSES if hh[4]]
        for i, (cx, w, h, rh, fr) in enumerate(back):
            house(cx, w, h, rh, fr, P['walls'][i % 3], P['roofs'][i % 3])
        # church: nave and a tower with a spire, on the crest
        ccx, cw, ch = CHURCH
        cb = house_base(ccx, 0)
        nave = g.poly(S.pts([(ccx - 60, cb), (ccx - 60, cb - 56), (ccx + 50, cb - 56), (ccx + 50, cb)]))
        g.glass(nave, P['walls'][1], mix=dict(cathedral=0.6, seedy=0.4))
        g.glass(g.poly(S.pts([(ccx - 66, cb - 54), (ccx - 5, cb - 92), (ccx + 56, cb - 54)])), P['roofs'][2], flow=0.0)
        twr = g.poly(S.pts([(ccx + 22, cb), (ccx + 22, cb - ch), (ccx + 22 + cw, cb - ch), (ccx + 22 + cw, cb)]))
        g.glass(twr, P['walls'][0], cuts=[('h', const(cb - ch * 0.55))], mix=dict(cathedral=0.6, seedy=0.4))
        g.glass(g.poly(S.pts([(ccx + 18, cb - ch + 2), (ccx + 22 + cw / 2, cb - ch - 70), (ccx + 26 + cw, cb - ch + 2)])),
                P['roofs'][0], flow=np.pi / 2)
        tx = ccx + 22 + cw / 2
        g.glass(g.poly(S.pts([(tx - 7, cb - ch + 52), (tx - 7, cb - ch + 34), (tx, cb - ch + 26), (tx + 7, cb - ch + 34),
                              (tx + 7, cb - ch + 52)])), P['win_col'] if P['window'] == 'lit' else P['win_dark'],
                mix=dict(cathedral=1.0))
        g.shade(twr, offset=(-14 * s, 0), strength=0.3, soft=3 * s)
        g.trace(S.pts([(tx - 1, cb - ch - 70), (tx - 1, cb - ch - 92)]), 2.0 * s, smooth=False)
        g.trace(S.pts([(tx - 8, cb - ch - 84), (tx + 6, cb - ch - 84)]), 2.0 * s, smooth=False)
        for i, (cx, w, h, rh, fr) in enumerate(front):
            house(cx, w, h, rh, fr, P['walls'][(i + 1) % 3], P['roofs'][(i + 2) % 3])
        st('village')

        # ============================================================ lighthouse
        cx, bw, tw = LH
        base = grass_y(cx) + 30
        top = 232.0
        nb = 5
        for k in range(nb):
            ya = base - (base - top) * k / nb
            yb = base - (base - top) * (k + 1) / nb
            wa = bw - (bw - tw) * k / nb
            wb = bw - (bw - tw) * (k + 1) / nb
            band = g.poly(S.pts([(cx - wa, ya), (cx - wb, yb), (cx + wb, yb), (cx + wa, ya)]))
            g.glass(band, P['tower'][k % 2], flow=np.pi / 2, mix=dict(cathedral=0.5, opal=0.3, streaky=0.2))
        tower = g.poly(S.pts([(cx - bw, base), (cx - tw, top), (cx + tw, top), (cx + bw, base)]))
        g.shade(tower, offset=(-bw * 0.8 * s, 0), strength=0.35, soft=4 * s)
        lan = g.poly(S.pts([(cx - 20, top), (cx - 20, top - 40), (cx + 20, top - 40), (cx + 20, top)]))
        g.glass(lan, P['lantern'], thick=0.7, mix=dict(seedy=0.6, cathedral=0.4))
        g.glass(g.poly(S.pts([(cx - 30, top + 7), (cx - 30, top - 3), (cx + 30, top - 3), (cx + 30, top + 7)])), P['cap'])
        g.glass(g.poly(S.pts([(cx - 26, top - 38), (cx, top - 68), (cx + 26, top - 38)])), P['cap'])
        g.trace(S.pts([(cx, top - 40), (cx, top)]), 2.0 * s, smooth=False)
        g.trace(S.pts([(cx, top - 66), (cx, top - 84)]), 2.2 * s, smooth=False)
        g.trace(S.pts([(cx - 28, top - 14), (cx + 28, top - 14)]), 1.4 * s, smooth=False)
        if dusk:
            g.stain(lan, 0.9)
        g.glass(g.poly(S.pts(rect(cx - 11, base - 36, cx + 11, base + 1))), P['door'], mix=dict(cathedral=1.0))
        for k in (0.35, 0.62):
            wy = base - (base - top) * k
            g.glass(g.poly(S.pts(rect(cx - 6, wy - 9, cx + 6, wy + 9))), P['win_col'] if dusk else P['win_dark'],
                    mix=dict(cathedral=1.0))
        st('lighthouse')

        # ============================================================ surf and rocks at the cliff foot
        xs = np.linspace(S.X0 - 30, 1170, 70)
        ft = FOOT - 14 + 5 * np.sin(xs / 37.0) - np.clip((xs - 1000) * 0.2, 0, None)
        fb = FOOT + 20 + 6 * np.sin(xs / 29.0 + 1)
        mid, taper = (ft + fb) / 2, np.clip((1170 - xs) / 140, 0, 1) ** 0.7
        ft, fb = mid + (ft - mid) * np.maximum(taper, 0.55), mid + (fb - mid) * np.maximum(taper, 0.55)
        foam = g.poly(S.pts(list(zip(xs, ft)) + list(zip(xs[::-1], fb[::-1]))))
        g.band(foam, P['foam'], lambda a: np.interp(a, xs, ft), lambda a: np.interp(a, xs, fb), rows=1,
               length=(150, 300), tilt=0.35, flow=0.0, mix=dict(opal=0.6, seedy=0.4), opal=0.3)
        for (rx, ry, rw, rh_) in ROCKS:
            rk = g.blob(*S.pt(rx, ry), rw * s, rh_ * s, rough=0.18, rot=0.0)
            cuts = [('line', (rx + rng.uniform(-10, 10), ry - rh_, rx + rng.uniform(-20, 20), ry + rh_))] if rw > 45 else []
            g.glass(rk, P['rocks'], cuts=cuts, mix=dict(cathedral=0.6, reamy=0.4))
            g.shade(rk, offset=(-10 * s, -6 * s), strength=0.4, soft=3 * s)
            g.scratch(S.pts([(rx - rw * 0.5, ry - rh_ * 0.55), (rx, ry - rh_ * 0.8), (rx + rw * 0.4, ry - rh_ * 0.6)]), 1.8 * s)
        for k in range(20):                                    # spray: fine painted marks
            x = rng.uniform(S.X0, 1150)
            y = FOOT + rng.uniform(30, 64)
            L = rng.uniform(20, 70)
            g.trace(S.pts([(x, y), (x + L * 0.5, y - 2), (x + L, y)]), rng.uniform(1.0, 1.5) * s, opacity=0.5)
        st('surf')

        # ============================================================ gulls: cut glass, every one different
        for i, (bx, by, sc, fl) in enumerate(GULLS):
            m = g.poly(S.pts(bird_pts(bx, by, sc, fl, rng)))
            g.glass(m, P['gull'], mix=dict(cathedral=0.6, opal=0.4), seeds=0.2)
            if P['gull_tip']:
                w_ = 44 * sc
                for sgn in (-1, 1):
                    g.trace(S.pts([(bx + sgn * w_ * 0.72, by - 0.4 * w_ * fl), (bx + sgn * w_ * 0.98, by - 0.45 * w_ * fl)]),
                            4.2 * s * sc, taper=(0.0, 0.5), smooth=False, clip=m)
        st('gulls')

    # ================================================================ finishing: lead, weather (always run)
    g.finish(lead=6.0, grime=0.25, pits=0.25)
    img = g.composite()
    st.save(img, 'final')
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'stainedglass_coast.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    t0 = time.perf_counter()
    im = paint(W, H, colourway=cw, bleed=bl)
    print('paint %.2fs' % (time.perf_counter() - t0))
    save_png(im, out)
