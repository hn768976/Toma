"""Forest path — Stained glass (彩色玻璃花窗): one full-bleed leaded panel. A path winds between tall trees
toward a low sun; rays of pale glass slant through the trunks; a deer stands on the path in the distance.
Built on vendor lib/stainedglass.py `StainedGlass` via scenes/_stainedglass_kit.Panel: designed cut lines (rings and
spokes round the sun, trunks cut across in lit and shaded strips, ground and path rows converging on the vanishing
point, canopy rows following the leaf masses); grisaille only for fine detail (bark, leaflets, blades, antlers).

python scripts/scenes/stainedglass_forest.py out.png [W H] [colourway] [bleed]
"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drawkit  # noqa: E402,F401  (sets sys.path to the skill lib)
from drawkit import Scaler, seed_all, save_png  # noqa: E402

import numpy as np  # noqa: E402
from _stainedglass_kit import Panel, Stager, hband, design_xy, const, shade  # noqa: E402

STYLE = "Stained glass · 彩色玻璃花窗"
LIB = "stainedglass"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

SUN = (1120.0, 330.0)
GROUND = 640.0

PAL = {
    "Day": dict(
        glow=[['#f8f0c0', '#f4ecb0'], ['#e8e4a0', '#dce8a8', '#f0e8b0'], ['#b8d890', '#c4dc98', '#acd088'],
              ['#8cc07a', '#98c884', '#80b470']],
        far_tr=['#a8c4a0', '#9cbc98', '#b0c8a4'], mid_tr=['#6e7a5a', '#7a8460', '#646e52'],
        ground=['#4fa83f', '#5aa844', '#3f9038'], ground2=['#2f8a3c', '#2a7a38', '#357a34'],
        path=['#d8b070', '#e0bc80', '#cca060'], ray_tint='#fff8d0', ray_k=0.5, deer_matt=0.35, ray_stain=0.25,
        deer='#8a5a2c', canopy=['#2f8a3c', '#4fa83f', '#3a7a30', '#5aa844', '#7c8a2a'],
        trunk=['#6e4526', '#7a5030', '#5e3c22'], fern=['#4fa83f', '#2f8a3c', '#6aa83a'],
        flowers=['#b3182c', '#eeeadb', '#2456b0', '#f2c230'], sky=('#ffffff', '#f6f3ec')),
    "Dusk": dict(
        glow=[['#f8d880', '#f4d060'], ['#f0a050', '#e8a040', '#f4b060'], ['#c8604a', '#d07050', '#b85848'],
              ['#7a3a5a', '#8a4460', '#6e3456']],
        far_tr=['#a0607a', '#94587a', '#a86a80'], mid_tr=['#4a2e4e', '#54344e', '#402a46'],
        ground=['#5a5a2a', '#66602e', '#4e5028'], ground2=['#3a3a2a', '#34362a', '#40402c'],
        path=['#d89060', '#e0a070', '#c88058'], ray_tint='#ffe0a0', ray_k=0.45, deer_matt=0.5, ray_stain=0.35,
        deer='#4a2a22', canopy=['#1f4a3a', '#2a5a40', '#24403a', '#33504a', '#3a3a50'],
        trunk=['#3a2430', '#44283a', '#30202a'], fern=['#6a7a30', '#5a6a2a', '#7a8a3a'],
        flowers=['#f2c230', '#e0922a', '#eeeadb', '#cc5a5a'], sky=('#ffffff', '#f6f3ec')),
}

FAR_TREES = [(40, 16), (150, 14), (250, 20), (360, 13), (470, 18), (560, 14), (700, 16), (780, 12), (930, 18),
             (1010, 12), (1220, 14), (1300, 18), (1400, 13), (1520, 17), (1630, 14), (1740, 20), (1880, 15)]
MID_TREES = [(70, 30, 690), (300, 36, 700), (640, 42, 690), (860, 28, 668), (1260, 30, 672), (1450, 44, 700),
             (1680, 36, 694)]
NEAR_TREES = [(150, 128, 0.02), (440, 74, -0.015), (1340, 60, 0.01), (1570, 140, -0.02), (1830, 100, 0.015)]
RAYS = [(380, 800, 90), (700, 920, 120), (1240, 980, 120), (1560, 860, 100), (1860, 720, 70)]


def path_edges(ybot=1110.0):
    """the path's edges (design coords), run straight on below the frame to ybot so the bleed is covered"""
    k = (ybot - 1110) / 170.0
    left = [(500 - 220 * k, ybot), (720, 940), (880, 810), (970, 725), (1032, 666), (1058, 642)]
    right = [(1082, 642), (1112, 664), (1150, 720), (1190, 810), (1270, 930), (1480 + 210 * k, ybot)]
    return left, right


def trunk_pts(cx, w, lean, ytop, yroot, flare=0.5):
    ys = np.linspace(ytop, yroot, 30)
    t = (ys - ytop) / (yroot - ytop)
    half = w / 2 * (1 + flare * np.clip((t - 0.82) / 0.18, 0, 1) ** 2)
    xc = cx + lean * (ys - 540)
    return list(zip(xc - half, ys)) + list(zip((xc + half)[::-1], ys[::-1]))


def fern(cx, cy, length, ang, curl, side):
    """an arching frond: spine points and leaflet strokes (design coords)"""
    t = np.linspace(0, 1, 18)
    a = ang + curl * t ** 1.5 * side
    dx, dy = np.cos(a) * length / 17, np.sin(a) * length / 17
    xs = cx + np.concatenate([[0], np.cumsum(dx[:-1])])
    ys = cy + np.concatenate([[0], np.cumsum(dy[:-1])])
    return np.stack([xs, ys], 1)


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None, dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    s = S.s
    g = Panel(S, seed, ambient=0.08, sky=P['sky'])
    st = Stager(g, stages_dir, dense_stages)
    xx, yy = design_xy(g)
    Y0, Y1 = S.Y0 - 30, S.Y1 + 30
    inc = set(GROUPS) if include is None else set(include)
    sx, sy = SUN

    if 'all' in inc:
        rng = g.group('all')
        # ============================================================ the low sun behind the wood: rings and spokes
        r = np.hypot(xx - sx, yy - sy)
        # light shafts: every area they cross is cut along the shaft and the shaft glazed in a paler, warmer glass
        # of the same colour (leaded, like real light-shaft windows); they start wide enough to cut
        ray = np.zeros_like(xx)
        for (ex, ey, wd) in RAYS:
            d = np.array([ex - sx, ey - sy]); d /= np.hypot(*d)
            n = np.array([-d[1], d[0]])
            a0 = np.array([sx, sy]) + d * 150
            e = np.array([ex, ey])
            pts = [a0 + n * 16, e + n * wd / 2, e - n * wd / 2, a0 - n * 16]
            ray = np.maximum(ray, g.poly(S.pts([tuple(p_) for p_ in pts])))
            ray = np.maximum(ray, g.ellipse(*S.pt(ex, ey), wd * 0.62 * s, wd * 0.18 * s))
        ray = (ray > 0.5).astype(np.float32)

        def light(cols, t=P['ray_k']):
            out = []
            for c in (cols if isinstance(cols, (list, tuple)) else [cols]):
                a_ = np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], float)
                b_ = np.array([int(P['ray_tint'][i:i + 2], 16) for i in (1, 3, 5)], float)
                out.append('#%02x%02x%02x' % tuple(int(v) for v in a_ * (1 - t) + b_ * t))
            return out

        def lay(fn, m, cols, *a, **kw):
            fn(m * (1 - ray), cols, *a, **kw)
            fn(m * ray, light(cols), *a, **kw)
        above = (yy < GROUND + 40).astype(np.float32)
        g.glass(g.circle(*S.pt(sx, sy), 96 * s), P['glow'][0], thick=0.8, mix=dict(cathedral=0.6, reamy=0.4))
        g.radial(above * (r >= 96), P['glow'][1], (sx, sy), [96.5, 290, 620], length=(110, 200), tilt=0.08,
                 ring_colours=[P['glow'][0]] + P['glow'][1:], mix=dict(streaky=0.4, cathedral=0.4, seedy=0.2))
        # the shafts in the glow are their own pieces, laid over the rings
        g.radial(above * (r >= 150) * ray, light(P['glow'][2]), (sx, sy), [290, 620], length=(140, 240), tilt=0.05,
                 ring_colours=[light(P['glow'][1]), light(P['glow'][2]), light(P['glow'][3])], mix=dict(opal=0.4, seedy=0.6))
        g.stain(np.clip(1 - r / 160, 0, 1), 0.5)
        st('glow')
        # ---- far trunks: pale, in the haze; cut across every so often
        for (x, w) in FAR_TREES:
            m = g.poly(S.pts(trunk_pts(x, w, 0.0, Y0, GROUND + 6, flare=0.3)))
            lay(g.band, m, P['far_tr'], const(x - w), const(x + w), rows=1, vertical=True, length=(120, 260), tilt=0.25,
                flow=np.pi / 2, flow_jit=0.15, amin=300, tmin=8)
        st('far trees')

        # ============================================================ ground; the path in perspective
        gy = lambda xs: GROUND + 4 * np.sin(np.asarray(xs) / 90.0)
        ground = g.poly(S.pts(hband(S, gy, Y1)))
        left, right = path_edges(max(1110.0, Y1))
        path = g.poly(S.pts(left + right))
        gdep = lambda y: float(np.clip((y - GROUND) / 440.0, 0, 1))
        for rm, lt in ((1 - ray, False), (ray, True)):
            def gtone(cx, cy, fid, row, lt=lt):
                pal = P['ground'] if cy < 800 + rng.uniform(-40, 40) else P['ground2']
                return light(pal) if lt else pal
            g.waves(ground * (1 - path) * rm, GROUND, lambda y: 22 + (y - GROUND) * 0.2, gtone, run=(3.5, 7.5),
                    depth=gdep, wl=(45.0, 100.0), pinch=0.55, slant=(0.4, 0.9), flow=0.0,
                    mix=dict(streaky=0.4, cathedral=0.3, reamy=0.3), amin=500, tmin=12)
        # the path: strips running along it toward the vanishing point, cut across further apart near the viewer
        L_ = np.array(left[::-1], float); R_ = np.array(right, float)
        pl = lambda a: np.interp(a, L_[:, 1], L_[:, 0])
        pr = lambda a: np.interp(a, R_[:, 1], R_[:, 0])
        lay(g.band, path, P['path'], pl, pr, rows=3, vertical=True, length=(40, 70), tilt=0.3, wave=(0.1, 90.0),
            size=lambda a, c: 0.6 + (a - 642) / 60.0, flow=np.pi / 2, flow_jit=0.4,
            mix=dict(cathedral=0.4, seedy=0.3, reamy=0.3), amin=300, tmin=9)
        g.matt(ground * np.clip((yy - GROUND) / 440, 0, 1) * (1 - path) * (1 - 0.7 * ray), 0.3, soft=10 * s)
        for k in range(46):                                       # grass blades: clusters, each one different
            x = rng.uniform(S.X0, S.X1)
            y = rng.uniform(GROUND + 20, 1060)
            for b in range(int(rng.integers(2, 5))):
                hh = (8 + (y - GROUND) * 0.05) * rng.uniform(0.7, 1.3)
                dx, lean = rng.uniform(-5, 5), rng.uniform(-5, 5)
                g.trace(S.pts([(x + dx, y), (x + dx + lean, y - hh)]), rng.uniform(1.1, 1.8) * s, taper=(0.1, 0.9),
                        smooth=False, clip=(1 - path))
        st('ground')

        g.stain(ray * np.clip((yy - 560) / 300, 0, 1), P['ray_stain'])
        st('rays')

        # ============================================================ middle trunks: two strips, lit and shaded
        for (x, w, root) in MID_TREES:
            m = g.poly(S.pts(trunk_pts(x, w, 0.0, Y0, root, flare=0.5)))
            side = 1 if x < sx else -1
            sh = [P['mid_tr'], shade(P['mid_tr'], 0.72)]
            lay(g.band, m, P['mid_tr'], const(x - w * 0.6), const(x + w * 0.6), rows=2 if w > 34 else 1, vertical=True,
                length=(140, 300), tilt=0.3, row_colours=sh if side > 0 else sh[::-1], flow=np.pi / 2, flow_jit=0.15,
                amin=400, tmin=9)
            for k in range(3):
                bx = x + rng.uniform(-0.3, 0.3) * w
                y0_ = rng.uniform(200, root - 120)
                g.trace(S.pts([(bx, y0_), (bx + rng.uniform(-3, 3), y0_ + rng.uniform(40, 80))]), 1.5 * s, taper=(0.4, 0.4), clip=m)
        st('mid trees')

        # ============================================================ the deer on the path, far off: cut glass
        dx0, dy0, k = 996.0, 670.0, 1.8
        D = lambda pts: S.pts([(dx0 + x * k, dy0 + y * k) for x, y in pts])
        torso = g.poly(D([(-24, -58), (-8, -57), (10, -56), (26, -57), (36, -53), (40, -46), (36, -38), (28, -34),
                          (8, -35), (-10, -35), (-20, -37), (-27, -45)]))
        neck = g.poly(D([(-22, -57), (-27, -45), (-36, -60), (-43, -80), (-38, -90), (-31, -76)]))
        head = g.poly(D([(-63, -88), (-55, -96), (-45, -99), (-37, -93), (-38, -86), (-46, -83), (-57, -83)]))
        legs = [g.branch(D(leg), 7.5 * k * s, 5.0 * k * s) for leg in
                ([(-16, -40), (-15, -18), (-16, 0)], [(-23, -42), (-25, -18), (-27, 0)],
                 [(28, -40), (32, -20), (30, 0)], [(19, -40), (22, -18), (18, 0)])]
        dk = shade([P['deer']], 0.8)
        g.pieces([(legs[1], dk), (legs[3], dk), (torso, P['deer']), (legs[0], P['deer']), (legs[2], P['deer']),
                  (neck, shade([P['deer']], 1.1)), (head, P['deer'])],
                 mix=dict(cathedral=0.6, streaky=0.4), seeds=0.2, amin=60, tmin=4, matting=0.0)
        deer = np.clip(torso + neck + head + sum(legs), 0, 1)
        g.matt(deer, P['deer_matt'] * 0.6, soft=1 * s)
        g.trace(D([(32, -52), (40, -44)]), 3.0 * k * s, smooth=False)  # tail
        for sgn in (-1, 1):                                                                   # antlers
            bx, by = -42 + sgn * 3, -96
            g.trace(D([(bx, by), (bx + sgn * 6, by - 14), (bx + sgn * 4, by - 28)]), 4.0 * k * s, taper=(0.1, 0.6))
            g.trace(D([(bx + sgn * 6, by - 13), (bx + sgn * 14, by - 18)]), 2.6 * k * s, taper=(0.1, 0.7), smooth=False)
        g.trace(D([(-38, -94), (-28, -100)]), 3.0 * k * s, smooth=False)  # ear
        g.trace(D([(-58, -88), (-62, -87)]), 3.0 * k * s, smooth=False)  # muzzle
        g.trace(D([(-47, -91), (-46, -91)]), 2.0 * k * s, smooth=False)  # eye
        g.shade(deer, offset=(0, -5 * s), strength=0.3, soft=2 * s)
        st('deer')

        # ============================================================ canopy: leaf masses cut along their outline
        can = np.zeros_like(xx)
        xsb = np.arange(S.X0 - 80, S.X1 + 120, 120)
        lows = []
        for i, x in enumerate(xsb):
            dsun = abs(x - sx)
            low = 150 + 70 * np.sin(x / 170.0 + 1) - (90 if dsun < 260 else 0) + rng.uniform(-14, 14)
            lows.append(low)
            can = np.maximum(can, g.blob(*S.pt(x + rng.uniform(-20, 20), low), rng.uniform(105, 135) * s,
                                         (80 + 25 * np.sin(i * 1.7)) * rng.uniform(0.85, 1.15) * s, rough=0.05))
        can = np.maximum(can, g.poly(S.pts(hband(S, Y0, 90))))
        g.contour(can, P['canopy'], row_h=48, length=(90, 190), tilt=0.45, flow=None, mix=dict(streaky=0.35, cathedral=0.3,
                  reamy=0.2, opal=0.15), wave=(0.2, 120.0))
        g.shade(can, offset=(0, -14 * s), strength=0.4, soft=6 * s)
        for k in range(80):                                           # leaves lifted out of the shade
            x = rng.uniform(S.X0, S.X1); y = rng.uniform(S.Y0, 240)
            a = rng.uniform(0, np.pi); ln = rng.uniform(4, 8)
            g.scratch(S.pts([(x - ln * np.cos(a), y - ln * np.sin(a)), (x + ln * np.cos(a), y + ln * np.sin(a))]),
                      rng.uniform(2.2, 3.4) * s)
        st('canopy')

        # ============================================================ near trunks, boughs
        for (x, w, lean) in NEAR_TREES:
            root = Y1 if w > 90 else 1000
            m = g.poly(S.pts(trunk_pts(x, w, lean, Y0, root, flare=0.45 if w > 90 else 0.6)))
            side = 1 if x < sx else -1
            lft = lambda a, x=x, w=w, lean=lean: x - w / 2 + lean * (np.asarray(a) - 540)
            rgt = lambda a, x=x, w=w, lean=lean: x + w / 2 + lean * (np.asarray(a) - 540)
            sh = [P['trunk'], shade(P['trunk'], 0.7)]
            g.band(m, P['trunk'], lft, rgt, rows=2 if w > 70 else 1, vertical=True, length=(150, 320), tilt=0.35,
                   row_colours=sh if side > 0 else sh[::-1], flow=np.pi / 2, flow_jit=0.15,
                   mix=dict(streaky=0.5, reamy=0.3, cathedral=0.2))
            g.shade(m, offset=(-side * w * 0.45 * s, 0), strength=0.35, soft=5 * s)
            for k in range(int(w / 18) + 2):                          # bark: long wavy lines, all different
                fx = rng.uniform(-0.35, 0.35)
                ya = rng.uniform(S.Y0, 700); yb = ya + rng.uniform(120, 300)
                ph = rng.uniform(0, 6)
                pts = [(x + fx * w + lean * (y - 540) + rng.uniform(2, 4) * np.sin(y / rng.uniform(24, 36) + ph), y)
                       for y in np.linspace(ya, yb, 8)]
                g.trace(S.pts(pts), (1.2 + w / 90) * rng.uniform(0.8, 1.2) * s, taper=(0.4, 0.4), clip=m)
        for (x0, y0, x1, y1, w0) in [(214, 300, 380, 190, 30), (1508, 260, 1360, 160, 34), (1872, 340, 1980, 250, 28)]:
            b = g.branch(S.pts([(x0, y0), ((x0 + x1) / 2, (y0 + y1) / 2 - 20), (x1, y1)]), w0 * s, w0 * 0.6 * s)
            mx_ = (x0 + x1) / 2
            g.glass(b, P['trunk'], cuts=[('line', (mx_, y0 - 80, mx_ + 20, y1 + 80))], flow=float(np.arctan2(y1 - y0, x1 - x0)),
                    mix=dict(streaky=0.6, cathedral=0.4))
            g.trace(S.pts([(x1, y1), (x1 + (x1 - x0) * 0.4, y1 - 40), (x1 + (x1 - x0) * 0.7, y1 - 50)]), 3.0 * s,
                    taper=(0.2, 0.9))
        st('near trees')

        # ============================================================ foreground ferns and flowers
        fronds = [(30, 1090, 300, -1.0, 0.9, 1), (120, 1100, 340, -1.35, 0.8, 1), (260, 1100, 260, -1.9, -0.7, -1),
                  (330, 1095, 220, -2.3, -0.8, -1),
                  (1880, 1090, 300, -2.1, -0.9, -1), (1780, 1100, 320, -1.75, -0.8, -1), (1660, 1100, 260, -1.25, 0.7, 1),
                  (1600, 1095, 210, -0.9, 0.8, 1)]
        for i, (fx, fy, L, ang, curl, side) in enumerate(fronds):
            fy2 = max(fy, S.Y1 + 12)
            L = L * rng.uniform(0.85, 1.12)
            sp = fern(fx, fy2, L + (fy2 - fy), ang + rng.normal(0, 0.06), curl * rng.uniform(0.8, 1.2), side)
            m = g.branch(S.pts(sp), 48 * s, 14 * s)
            cuts = []
            for kk in (5, 10, 14):                                    # cut across the frond, square to its rib
                p_, q_ = sp[kk], sp[kk - 1]
                tv = (p_ - q_) / (np.hypot(*(p_ - q_)) + 1e-6)
                nv = np.array([-tv[1], tv[0]])
                cuts.append(('line', (p_[0] - nv[0] * 40, p_[1] - nv[1] * 40, p_[0] + nv[0] * 40, p_[1] + nv[1] * 40)))
            g.glass(m, P['fern'], cuts=cuts, flow=float(ang), flow_jit=0.3, mix=dict(streaky=0.5, cathedral=0.5),
                    amin=400, tmin=9)
            g.trace(S.pts(sp), 2.2 * s, taper=(0.0, 0.6), clip=m)
            for kk in range(2, 17, 1):                                # leaflets: little strokes off the rib
                p_, q_ = sp[kk], sp[kk - 1]
                tv = (p_ - q_) / (np.hypot(*(p_ - q_)) + 1e-6)
                nv = np.array([-tv[1], tv[0]])
                ln = (20 * (1 - kk / 18) + 4) * rng.uniform(0.8, 1.2)
                for sg in (-1, 1):
                    g.trace(S.pts([tuple(p_), tuple(p_ + nv * sg * ln + tv * rng.uniform(4, 8))]), 1.4 * s,
                            taper=(0.2, 0.8), smooth=False, clip=m)
            g.shade(m, offset=(0, -6 * s), strength=0.25, soft=2 * s)
        for k in range(22):                                           # flowers in the verge: cut glass discs
            side = -1 if k % 2 else 1
            fy = rng.uniform(900, 1050)
            f = (fy - 642) / 470
            fx = 1070 + side * (rng.uniform(70, 260) + 360 * f * 0.9)
            r0 = (10 + (fy - 900) * 0.04) * rng.uniform(0.85, 1.15)
            fm = g.ellipse(*S.pt(fx, fy), r0 * s, r0 * rng.uniform(0.75, 1.0) * s, rng.uniform(0, 3))
            g.trace(S.pts([(fx, fy + r0), (fx + rng.uniform(-3, 3), fy + r0 + rng.uniform(14, 22))]), 1.8 * s, smooth=False)
            g.glass(fm * (1 - path), P['flowers'][k % 4], mix=dict(cathedral=0.6, opal=0.4))
            g.matt(g.circle(*S.pt(fx, fy), r0 * 0.32 * s), 0.85, soft=0.5 * s)
        st('foreground')

    # ================================================================ finishing: lead, weather (always run)
    g.finish(lead=6.0, grime=0.3, pits=0.25, sweep=True)
    img = g.composite()
    st.save(img, 'final')
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'stainedglass_forest.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    t0 = time.perf_counter()
    im = paint(W, H, colourway=cw, bleed=bl)
    print('paint %.2fs' % (time.perf_counter() - t0))
    save_png(im, out)
