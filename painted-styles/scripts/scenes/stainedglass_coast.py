"""Coastal village on a cliff — Stained glass (彩色玻璃花窗): one full-bleed leaded panel. A headland on the
left with a whitewashed village and a striped lighthouse, sailing boats on the sea, gulls.
Painted with vendor lib/stainedglass.py `StainedGlass` (via scenes/_stainedglass_kit.Panel).

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
from _stainedglass_kit import Panel, Stager, hband, design_xy  # noqa: E402

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
        cloud=['#c86a8c', '#d88aa0', '#b8608a'], cloud_lit='below',
        island=['#6e5a96', '#7c6aa0', '#66548e'],
        sea=[['#c0405a', '#cc5a5a', '#b3182c'], ['#7a2c5c', '#8a3466', '#6e2a5a'], ['#3a3488', '#4a3a8a', '#33307a'],
             ['#1d2a6e', '#172560', '#22306f']],
        glit=['#f2c230', '#e0922a', '#f4d060'], glit_x=1500.0,
        grass=['#2a5a3a', '#245236', '#30603c'], rock=['#7a3a5a', '#8a4a4a', '#6a3a6a', '#9a5248'],
        walls=['#e8c9a0', '#d8b48a', '#e0bca0'], roofs=['#8a2a2a', '#7a2a3a', '#6e3048'],
        window='lit', win_col=['#f4d060', '#f2c230'],
        tower=('#e8dcd0', '#b3182c'), lantern=['#f8e070', '#f4d060'], cap='#2a1a30', beam='#f4d878',
        hulls=['#3a2430', '#2a2450', '#5a2a2a'], sails=[['#f0c8a0', '#e8b890'], ['#f4d0a8', '#e8c098'], ['#e89a80', '#d88a78']],
        boat_ref='#1a1a40', foam=['#c8b0d8', '#d8c0e0', '#bca4cc'], rocks=['#2a2040', '#33284a'],
        gull='#1c1a40', gull_tip=False, sky=('#ffffff', '#f2eee6')),
    "Day": dict(
        bands=[['#1f4fa8', '#2456b0', '#1d4a9e'], ['#3368b8', '#3d74c2', '#2f60b0'], ['#5d8fd0', '#6a9ad6', '#5588cc'],
               ['#86b0de', '#93bae2', '#7ca8da'], ['#aecde8', '#bcd6ec', '#a4c6e4'], ['#c8dcec', '#d0e2ee', '#bcd4e8']],
        radial=(), sun=(1420.0, 140.0, 44.0), sun_col=['#f2c230', '#f4d060'],
        cloud=['#eeeadb', '#f4f1e6', '#e2e6ea'], cloud_lit='above',
        island=['#6f86b4', '#7a90bc', '#6880ac'],
        sea=[['#3d7cc4', '#4a86c8', '#3572bc'], ['#2a64b4', '#2f6ec0', '#245cac'], ['#1f4fa8', '#2456b0', '#1d4a9e'],
             ['#173c8f', '#1a4296', '#143686']],
        glit=['#eeeadb', '#d7e2ea', '#f4f1e6'], glit_x=1420.0,
        grass=['#4fa83f', '#2f8a3c', '#5aa844'], rock=['#c8925a', '#b07a48', '#d8a868', '#a06c40'],
        walls=['#f4f1e6', '#eeeadb', '#f0e0b8'], roofs=['#b5482a', '#c0582e', '#a03c28'],
        window='dark', win_col=None,
        tower=('#f4f1e6', '#b3182c'), lantern=['#d7e2ea', '#e4e9f0'], cap='#2a2a3a', beam=None,
        hulls=['#6e4526', '#173c8f', '#7a2c2c'], sails=[['#f4f1e6', '#eeeadb'], ['#b3182c', '#c0283a'], ['#f4f1e6', '#e8e4d4']],
        boat_ref='#123070', foam=['#f4f1e6', '#e4e9f0', '#eeeadb'], rocks=['#4a3a30', '#3e3028'],
        gull='#f4f1e6', gull_tip=True, sky=('#ffffff', '#f2eee6')),
}

CLOUDS = [(330, 118, 420, 32), (1080, 92, 380, 28), (1730, 236, 340, 22)]
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


def cloud_pts(cx, cy, L, h, phase=0.0):
    t = np.linspace(-1, 1, 40)
    env = np.clip(1 - t ** 2, 0, 1) ** 0.7
    top = cy - h * env * (0.75 + 0.35 * np.abs(np.sin(t * 4.2 + phase)))
    bot = cy + h * 0.35 * env
    xs = cx + t * L / 2
    return list(zip(xs, top)) + list(zip(xs[::-1], bot[::-1]))


def house_base(cx, front):
    return grass_y(cx) + (44 if front else -4)


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
        # ============================================================ sky
        edges = [Y0, 110, 200, 290, 380, 470, HORIZON + 10]
        curve = lambda k: (lambda xs: np.full(len(xs), float(edges[k])) if k in (0, len(edges) - 1)
                           else edges[k] + 10 * np.sin(xs / 150.0 + 0.9 * k))
        sx, sy, sr = P['sun']
        for k, cols in enumerate(P['bands']):
            m = g.poly(S.pts(hband(S, curve(k), curve(k + 1))))
            if k in P['radial']:
                g.glass(m, cols, cell=58 * s, around=S.pt(sx, sy), streak=0.5, flashed=cols[1] == '#b3182c')
            else:
                g.glass(m, cols, cell=80 * s, streak=0.6, aspect=1.6, angle=0.05)
        sun = g.circle(*S.pt(sx, sy), sr * s) * (yy < HORIZON)
        g.glass(sun, P['sun_col'], streak=0.3)
        if not dusk:
            for k in range(16):
                a = k * np.pi / 8 + 0.2
                r0, r1 = sr + 10, sr + (34 if k % 2 else 22)
                g.trace(S.pts([(sx + r0 * np.cos(a), sy + r0 * np.sin(a)), (sx + r1 * np.cos(a), sy + r1 * np.sin(a))]),
                        5.0 * s, taper=(0.2, 0.9), smooth=False)
        g.trace(S.pts([(sx + (sr - 9) * np.cos(t), sy + (sr - 9) * np.sin(t)) for t in np.linspace(0, 2 * np.pi, 40)]),
                1.6 * s, taper=(0.0, 0.0), wobble=0, clip=(yy < HORIZON - 4))
        g.stain(sun * 0.8, 0.7)
        g.matt(np.clip((150 - yy) / 150, 0, 1), 0.25, soft=20 * s)
        st('sky')
        for i, (cx, cy, L, h) in enumerate(CLOUDS):
            m = g.poly(S.pts(cloud_pts(cx, cy, L, h, phase=i * 1.7)))
            g.glass(m, P['cloud'], cell=max(L / 3.2, 60) * s, aspect=3.2, angle=0.0, streak=0.4, streak_dir=0.0, seeds=0.4)
            g.shade(m, offset=(0, (7 if P['cloud_lit'] == 'below' else -6) * s), strength=0.45, soft=4 * s)
            for j in range(2):
                xs = np.linspace(cx - L * (0.32 - 0.1 * j), cx + L * (0.3 - 0.08 * j), 14)
                ys = cy - h * (0.05 + 0.3 * j) - 3 * np.abs(np.sin((xs - cx) / 22.0 + j))
                g.trace(S.pts(list(zip(xs, ys))), 1.5 * s, taper=(0.4, 0.4), wobble=0.3 * s, clip=m)
        st('clouds')
        # ---- lighthouse beam (dusk): a long wedge of pale glass to the left, over the village sky
        lx, ly = LH[0], 212.0
        if P['beam']:
            beam = g.poly(S.pts([(lx - 20, ly - 6), (S.X0 - 40, ly - 78), (S.X0 - 40, ly - 6), (lx - 20, ly + 6)]))
            g.glass(beam, P['beam'], cell=110 * s, aspect=3.0, angle=-0.05, streak=0.3, thick=0.9, seeds=0.3)
            g.matt(beam * np.clip((lx - xx) / 900, 0, 1), 0.35, soft=12 * s)
            st('beam')

        # ============================================================ sea
        far_isl = lambda xs: HORIZON - 34 * np.exp(-((xs - 1840) / 140) ** 2) - 18 * np.exp(-((xs - 1700) / 90) ** 2) \
            + 3 * np.sin(xs / 23.0)
        wedges = [(HORIZON, 640), (640, 760), (760, 900), (900, 1080)]
        wcurve = lambda y: (lambda xs: np.full(len(xs), float(y)) if y in (HORIZON, 1080)
                            else y + 7 * np.sin(xs / 95.0 + y))
        for (y0, y1), cols in zip(wedges, P['sea']):
            bot = (lambda xs: np.full(len(xs), Y1)) if y1 == 1080 else wcurve(y1)
            m = g.poly(S.pts(hband(S, wcurve(y0), bot)))
            g.glass(m, cols, cell=(64 + 0.06 * (y0 - HORIZON)) * s, aspect=2.8, angle=0.0, streak=0.6, streak_dir=0.0)
        isl = g.poly(S.pts(hband(S, far_isl, HORIZON + 1))) * (xx > 1560)
        g.glass(isl, P['island'], cell=70 * s, aspect=2.0, angle=0.0, streak=0.4)
        g.trace(S.pts(list(zip(np.linspace(1600, S.X1, 60), far_isl(np.linspace(1600, S.X1, 60))))), 1.6 * s,
                taper=(0.3, 0.0), wobble=0.3 * s)
        gx = P['glit_x']
        for k in range(11):
            y = HORIZON + 14 + k * 30 * (1 + k * 0.06) + rng.uniform(-4, 4)
            w = (40 + k * 9) * rng.uniform(0.8, 1.15)
            g.glass(g.ellipse(*S.pt(gx + rng.uniform(-14, 14) + k * 6, y), w * s, (5 + k * 0.6) * s), P['glit'][k % 3],
                    streak=0.3, streak_dir=0.0)
        sea = (yy > HORIZON).astype(np.float32)
        g.matt(sea * np.clip((yy - 640) / 440, 0, 1), 0.42, soft=10 * s)
        for k in range(46):                                   # wave crests lifted out of the matt
            y = 600 + (k / 46) ** 1.15 * 470 + rng.uniform(-6, 6)
            x0 = rng.uniform(980 + (y - 600) * 0.3, S.X1 - 60)
            L = rng.uniform(40, 150) * (0.5 + (y - HORIZON) / 420)
            g.scratch(S.pts([(x0, y), (x0 + L * 0.3, y - 2.5), (x0 + L * 0.6, y - 1), (x0 + L, y + 1.5)]), 2.2 * s)
        st('sea')

        # ============================================================ boats (behind the headland's foot is fine)
        for bi, (bx, by, sc) in enumerate(BOATS):
            q = lambda pts: S.pts([(bx + x * sc, by + y * sc) for x, y in pts])
            g.glass(g.poly(q([(-58, 6), (60, 6), (50, 22), (-48, 24)])), P['boat_ref'], streak=0.3)
            g.glass(g.poly(q([(-6, -158), (-6, -24), (-70, -28), (-46, -88), (-24, -130)])),
                    P['sails'][bi][0], streak=0.4, streak_dir=np.pi / 2)
            g.glass(g.poly(q([(6, -146), (64, -24), (6, -26)])), P['sails'][bi][1], streak=0.4, streak_dir=np.pi / 2)
            g.glass(g.poly(q([(-76, -16), (76, -22), (62, 4), (-60, 4)])), P['hulls'][bi], streak=0.3, streak_dir=0.0)
            g.trace(q([(0, -168), (0, -14)]), 3.0 * s * max(sc, 0.7), taper=(0.1, 0.0), smooth=False)
            g.trace(q([(-74, -14), (0, -17), (74, -20)]), 2.4 * s * max(sc, 0.7), taper=(0.1, 0.1))
            g.trace(q([(-70, -26), (0, -24)]), 2.0 * s * max(sc, 0.7), smooth=False, taper=(0.1, 0.1))
            g.shade(g.poly(q([(-6, -158), (-6, -24), (-70, -28)])), offset=(-8 * s * sc, 0), strength=0.3, soft=3 * s)
            g.scratch(q([(-48, 14), (0, 15), (40, 13)]), 1.8 * s)
        st('boats')

        # ============================================================ the headland
        grass = land * (yy < grass_y(np.minimum(xx, EDGE_X)) + 64) * (xx < EDGE_X + 10)
        face = np.clip(land - grass, 0, 1)
        g.glass(face, P['rock'], cell=78 * s, aspect=1.8, angle=0.08, streak=0.5, streak_dir=0.0)
        g.glass(grass, P['grass'], cell=70 * s, aspect=2.4, angle=0.1, streak=0.5)
        # strata, cracks, and the face darkening toward the sea
        for k in range(9):
            yb = 520 + k * 44 + rng.uniform(-8, 8)
            xs = np.linspace(S.X0, 1100, 50)
            ys = yb + 10 * np.sin(xs / 140.0 + k) + 0.03 * (xs - 500)
            g.trace(S.pts(list(zip(xs, ys))), 1.7 * s, taper=(0.0, 0.0), wobble=0.6 * s, clip=face)
        for k in range(12):
            x = rng.uniform(40, 980)
            y = rng.uniform(520, 860)
            g.trace(S.pts([(x, y), (x + rng.uniform(-10, 10), y + 22), (x + rng.uniform(-14, 14), y + 44)]),
                    1.6 * s, taper=(0.2, 0.8), clip=face)
        g.matt(face * np.clip((yy - 520) / 420, 0, 1), 0.4, soft=8 * s)
        g.matt(face * np.clip((xx - 700) / 300, 0, 1), 0.3, soft=8 * s)
        g.shade(grass, offset=(0, -10 * s), strength=0.3, soft=4 * s)
        for k in range(40):                                    # tufts on the grass
            x = rng.uniform(S.X0 + 10, EDGE_X - 10)
            y = grass_y(x) + rng.uniform(8, 34)
            g.trace(S.pts([(x, y), (x - 4, y - 9)]), 1.6 * s, taper=(0.1, 0.9), smooth=False, clip=grass)
            g.trace(S.pts([(x + 3, y), (x + 6, y - 8)]), 1.6 * s, taper=(0.1, 0.9), smooth=False, clip=grass)
        for k in range(10):                                    # scrub clinging to the face
            x = rng.uniform(80, 900); y = rng.uniform(560, 860)
            g.matt(g.ellipse(*S.pt(x, y), 16 * s, 6 * s), 0.55, soft=2 * s)
        st('headland')

        # ============================================================ village
        def house(cx, w, h, rh, front, wall, roof):
            base = house_base(cx, front)
            body = [(cx - w / 2, base), (cx - w / 2, base - h), (cx + w / 2, base - h), (cx + w / 2, base)]
            rf = [(cx - w / 2 - 8, base - h + 2), (cx, base - h - rh), (cx + w / 2 + 8, base - h + 2)]
            bm = g.poly(S.pts(body))
            g.glass(bm, wall, streak=0.3, seeds=0.5)
            g.glass(g.poly(S.pts(rf)), roof, streak=0.4, streak_dir=0.0)
            g.shade(bm, offset=(-w * 0.35 * s, 0), strength=0.35, soft=3 * s)
            for k in range(3):                                 # roof tile rows
                t = (k + 1) / 4
                g.trace(S.pts([(cx - (w / 2 + 8) * (1 - t) - 2, base - h - rh * (1 - t) + 2),
                               (cx + (w / 2 + 8) * (1 - t) + 2, base - h - rh * (1 - t) + 2)]), 1.4 * s, smooth=False)
            nwin = 2 if w < 90 else 3
            for k in range(nwin):
                wx = cx - w / 2 + w * (k + 0.5) / nwin
                if k == nwin // 2 and front:
                    door = g.poly(S.pts([(wx - 9, base), (wx - 9, base - 30), (wx + 9, base - 30), (wx + 9, base)]))
                    g.matt(door, 0.92, soft=0.5 * s)
                    continue
                wy = base - h * 0.62
                if P['window'] == 'lit':
                    g.glass(g.poly(S.pts([(wx - 8, wy - 10), (wx + 8, wy - 10), (wx + 8, wy + 10), (wx - 8, wy + 10)])),
                            P['win_col'][k % 2], streak=0.2, thick=0.8)
                    g.trace(S.pts([(wx, wy - 9), (wx, wy + 9)]), 1.3 * s, smooth=False)
                else:
                    g.matt(g.poly(S.pts([(wx - 7, wy - 9), (wx + 7, wy - 9), (wx + 7, wy + 9), (wx - 7, wy + 9)])), 0.92, soft=0.5 * s)
                    g.scratch(S.pts([(wx, wy - 8), (wx, wy + 8)]), 1.2 * s)

        back = [hh for hh in HOUSES if not hh[4]]
        front = [hh for hh in HOUSES if hh[4]]
        for i, (cx, w, h, rh, fr) in enumerate(back):
            house(cx, w, h, rh, fr, P['walls'][i % 3], P['roofs'][i % 3])
        # church: nave and a tower with a spire, on the crest
        ccx, cw, ch = CHURCH
        cb = house_base(ccx, 0)
        nave = g.poly(S.pts([(ccx - 60, cb), (ccx - 60, cb - 56), (ccx + 50, cb - 56), (ccx + 50, cb)]))
        g.glass(nave, P['walls'][1], streak=0.3)
        g.glass(g.poly(S.pts([(ccx - 66, cb - 54), (ccx - 5, cb - 92), (ccx + 56, cb - 54)])), P['roofs'][2], streak=0.4)
        twr = g.poly(S.pts([(ccx + 22, cb), (ccx + 22, cb - ch), (ccx + 22 + cw, cb - ch), (ccx + 22 + cw, cb)]))
        g.glass(twr, P['walls'][0], streak=0.3)
        g.glass(g.poly(S.pts([(ccx + 18, cb - ch + 2), (ccx + 22 + cw / 2, cb - ch - 70), (ccx + 26 + cw, cb - ch + 2)])),
                P['roofs'][0], streak=0.4, streak_dir=np.pi / 2)
        g.shade(twr, offset=(-14 * s, 0), strength=0.35, soft=3 * s)
        g.trace(S.pts([(ccx + 22 + cw / 2, cb - ch + 30), (ccx + 22 + cw / 2, cb - ch + 52)]), 8 * s, smooth=False,
                taper=(0.0, 0.0))
        g.trace(S.pts([(ccx + 22 + cw / 2 - 1, cb - ch - 70), (ccx + 22 + cw / 2 - 1, cb - ch - 92)]), 2.0 * s, smooth=False)
        g.trace(S.pts([(ccx + 22 + cw / 2 - 8, cb - ch - 84), (ccx + 22 + cw / 2 + 6, cb - ch - 84)]), 2.0 * s, smooth=False)
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
            g.glass(band, P['tower'][k % 2], streak=0.3, streak_dir=np.pi / 2)
        tower = g.poly(S.pts([(cx - bw, base), (cx - tw, top), (cx + tw, top), (cx + bw, base)]))
        g.shade(tower, offset=(-bw * 0.8 * s, 0), strength=0.4, soft=4 * s)
        g.scratch(S.pts([(cx - bw * 0.55, base - 6), (cx - tw * 0.55, top + 8)]), 2.4 * s)
        lan = g.poly(S.pts([(cx - 20, top), (cx - 20, top - 40), (cx + 20, top - 40), (cx + 20, top)]))
        g.glass(lan, P['lantern'], streak=0.2, thick=0.7)
        g.glass(g.poly(S.pts([(cx - 30, top + 6), (cx - 30, top - 2), (cx + 30, top - 2), (cx + 30, top + 6)])), P['cap'])
        g.glass(g.poly(S.pts([(cx - 26, top - 38), (cx, top - 68), (cx + 26, top - 38)])), P['cap'], streak=0.2)
        g.trace(S.pts([(cx, top - 40), (cx, top)]), 2.0 * s, smooth=False)
        g.trace(S.pts([(cx, top - 66), (cx, top - 84)]), 2.2 * s, smooth=False)
        g.trace(S.pts([(cx - 28, top - 14), (cx + 28, top - 14)]), 1.4 * s, smooth=False)
        if dusk:
            g.stain(lan, 0.9)
        door = g.poly(S.pts([(cx - 10, base), (cx - 10, base - 34), (cx + 10, base - 34), (cx + 10, base)]))
        g.matt(door, 0.92, soft=0.5 * s)
        for k in (0.35, 0.62):
            wy = base - (base - top) * k
            g.trace(S.pts([(cx, wy - 7), (cx, wy + 7)]), 7 * s, smooth=False, taper=(0.0, 0.0))
        st('lighthouse')

        # ============================================================ surf and rocks at the cliff foot
        xs = np.linspace(S.X0 - 30, 1170, 70)
        ft = FOOT - 12 + 5 * np.sin(xs / 37.0) - np.clip((xs - 1000) * 0.2, 0, None)
        fb = FOOT + 16 + 6 * np.sin(xs / 29.0 + 1)
        mid, taper = (ft + fb) / 2, np.clip((1170 - xs) / 140, 0, 1) ** 0.7
        ft, fb = mid + (ft - mid) * taper, mid + (fb - mid) * taper
        foam = g.poly(S.pts(list(zip(xs, ft)) + list(zip(xs[::-1], fb[::-1]))))
        g.glass(foam, P['foam'], cell=90 * s, aspect=3.5, angle=0.0, streak=0.3, seeds=0.8)
        for (rx, ry, rw, rh_) in ROCKS:
            rk = g.blob(*S.pt(rx, ry), rw * s, rh_ * s, rough=0.18, rot=0.0)
            g.glass(rk, P['rocks'], cell=40 * s, streak=0.3)
            g.shade(rk, offset=(-10 * s, -6 * s), strength=0.45, soft=3 * s)
            g.scratch(S.pts([(rx - rw * 0.5, ry - rh_ * 0.55), (rx, ry - rh_ * 0.8), (rx + rw * 0.4, ry - rh_ * 0.6)]), 1.8 * s)
        for k in range(20):                                    # spray scratched out of the matt
            x = rng.uniform(S.X0, 1150)
            y = FOOT + rng.uniform(26, 60)
            L = rng.uniform(30, 90)
            g.scratch(S.pts([(x, y), (x + L * 0.5, y - 2), (x + L, y)]), 2.0 * s)
        st('surf')

        # ============================================================ gulls
        for i, (bx, by, sc, fl) in enumerate(GULLS):
            w_ = 44 * sc
            up = [(-w_, -0.45 * w_ * fl), (-0.55 * w_, -0.36 * w_), (-0.15 * w_, -0.1 * w_), (0, -0.02 * w_),
                  (0.15 * w_, -0.1 * w_), (0.55 * w_, -0.36 * w_), (w_, -0.45 * w_ * fl)]
            lo = [(0.55 * w_, -0.16 * w_), (0.16 * w_, 0.1 * w_), (0, 0.2 * w_), (-0.16 * w_, 0.1 * w_), (-0.55 * w_, -0.16 * w_)]
            pts = [(bx + x, by + y) for x, y in up + lo]
            m = g.poly(S.pts(pts))
            g.glass(m, P['gull'], streak=0.2, seeds=0.2)
            if P['gull_tip']:
                for sgn in (-1, 1):
                    g.trace(S.pts([(bx + sgn * w_ * 0.72, by - 0.4 * w_ * fl), (bx + sgn * w_ * 0.98, by - 0.45 * w_ * fl)]),
                            4.2 * s * sc, taper=(0.0, 0.5), smooth=False, clip=m)
                g.shade(m, offset=(0, -5 * s * sc), strength=0.3, soft=2 * s)
        st('gulls')

    # ================================================================ finishing: lead, weather (always run)
    g.finish(lead=6.0, grime=0.35, pits=0.3)
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
