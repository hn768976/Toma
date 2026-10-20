"""Coastal village on a cliff with a lighthouse, sailing boats and gulls — Watercolour (水彩),
painted with vendor lib/watercolor.py `Watercolor`. Scene B (still).

python scripts/scenes/watercolour_coast.py out.png [W H] [colourway] [bleed]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np
from PIL import Image, ImageDraw

import drawkit
from drawkit import Scaler, seed_all, save_png, group_rng
from watercolor import Watercolor, hexc
from core import blob_pts, spline, curve, fbm1d, smoothstep, blur

STYLE = "Watercolour · 水彩"
LIB = "watercolor"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

HZ = 560   # sea horizon (design px)

PAL = {
    "Dusk": dict(
        sky_top='#6c72a8', sky_bot='#d39aa6', sky_k=0.55, low='#f3ac86', low_k=0.5, glow='#f8cf88', glow_k=0.4,
        sun=(520, 532), sun_lift=0.85, cloud='#8a7fad', cloud_k=0.34, cloud_under='#f2a284', cloud_lift=0.1,
        far='#9a8ab4', sea_top='#f1b291', sea_deep='#465f98', wave='#3c4f86', glitter='#f8d08a',
        rock='#c2968a', rock_sh='#6a5a80', flank='#f2b48e', rock_dk='#3f3a55', grass='#6f7d55', grass_dk='#3f5148',
        wall='#f0d6bf', wall_sh='#8f7f9e', roof='#b25a45', roof_sh='#7a3a3c', win='#ffd27a', win_lit=True,
        tower_sh='#9c8fae', band='#b03c34', lamp='#ffe08a', bush='#3d5246', sail='#f6e2cf', sail_sh='#9d8cae',
        hull='#3b3448', gull='#3e3850'),
    "Day": dict(
        sky_top='#4a86c9', sky_bot='#c3dcef', sky_k=0.6, low='#f4e6c6', low_k=0.25, glow='#fff3cc', glow_k=0.15,
        sun=(300, -60), sun_lift=0.0, cloud='#8f9cbb', cloud_k=0.25, cloud_under='#a7b2c8', cloud_lift=0.65,
        far='#8ea3c4', sea_top='#bfe0e4', sea_deep='#1f6f9e', wave='#1d5a86', glitter='#fff6d8',
        rock='#d6b88c', rock_sh='#8a8090', flank='#f5dcae', rock_dk='#5a524c', grass='#7fa04e', grass_dk='#3f6a3c',
        wall='#f6efe2', wall_sh='#a3aebe', roof='#c4583a', roof_sh='#8a3a2c', win='#3e5068', win_lit=False,
        tower_sh='#a8b2c4', band='#c23a30', lamp='#cfe2ea', bush='#3c6a40', sail='#fbf7ee', sail_sh='#9fb0c8',
        hull='#2f4a6a', gull='#4a4f5c'),
}


class Stager:
    def __init__(self, p, stages_dir, dense):
        self.p, self.dir, self.dense, self.n = p, stages_dir, dense, 0

    def __call__(self, name, major=False):
        if not self.dir or not (self.dense or major):
            return
        save_png(self.p.composite().convert('RGB'), os.path.join(self.dir, f"{self.n:03d}_{name.replace(' ', '_')}.png"))
        self.n += 1


def ridge_noise(seed, xs, scale_px=194, octaves=4):
    n = 160
    grid = np.linspace(-1000, 2920, n)
    return np.interp(xs, grid, fbm1d(n, scale_px / (grid[1] - grid[0]), octaves, seed))


def poly_union(H, W, polys, ss=2):
    im = Image.new('L', (W * ss, H * ss), 0)
    d = ImageDraw.Draw(im)
    for pts in polys:
        d.polygon([(float(x) * ss, float(y) * ss) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BILINEAR), np.float32) / 255


def bands(H, W, lines, soft):
    """many thick soft strokes [(pts, width), ...] as ONE mask (one blur instead of one per stroke)"""
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    for pts, width in lines:
        d.line([tuple(map(float, q)) for q in pts], fill=255, width=max(1, int(round(width))), joint='curve')
    return blur(np.asarray(im, np.float32) / 255, soft)


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None,
          stages_dir=None, dense_stages=False):
    seed_all(seed)
    C = PAL[colourway]
    S = Scaler(W, H, bleed)
    s = S.s
    p = Watercolor(S.W, S.H, seed=seed)
    CH, CW = S.H, S.W
    YY, XX = p.YY, p.XX
    XD, YD = (XX - S.ox) / s, (YY - S.oy) / s
    X0, X1, Y1 = S.X0, S.X1, S.Y1
    st = Stager(p, stages_dir, dense_stages)
    dusk = colourway == 'Dusk'
    pts = lambda seq: S.pts(seq)
    if include is not None and 'all' not in include:
        p.rng = group_rng(seed, 'paper'); p.paper()
        p.rng = group_rng(seed, 'finish')
        return p.composite().convert('RGB')

    p.rng = group_rng(seed, 'paper')
    p.paper()
    st('paper', True)
    p.rng = group_rng(seed, 'all')
    r = p.rng

    # ---------------- geometry: the headland's top edge (design px) as a function of x
    def top_edge(x):
        x = np.asarray(x, np.float32)
        base = np.interp(x, [880, 905, 935, 965, 1010, 1120, 1250, 1400, 1560, 1720, 1900, 2600],
                         [712, 610, 528, 485, 473, 468, 452, 438, 424, 416, 408, 395])
        return base + 4 * ridge_noise(seed + 5, x, 90, 3)

    def base_line(x):
        x = np.asarray(x, np.float32)
        return 712 + 8 * np.sin(x / 70) + 10 * ridge_noise(seed + 13, x, 60, 3)

    ex = np.linspace(880, X1 + 30, 160)
    ey = top_edge(ex)
    bx = np.linspace(X1 + 30, 860, 90)
    land_pts = [(860, float(base_line(860)))] + list(zip(ex, ey)) + [(X1 + 30, float(base_line(X1 + 30)))] + list(zip(bx, base_line(bx)))
    land = p.shape(pts(land_pts), soft=S(2.5), ragged=0.25)
    keep = 1 - np.clip(land * 1.4, 0, 1)       # the sea and low sky never run under the cliff

    # ---------------- sky
    p.gradient_wash(S.y(0), S.y(HZ - 60), top=hexc(C['sky_top']), bottom=hexc(C['sky_bot']), strength=C['sky_k'],
                    soft_bottom=S(50), gran=0.1)
    low = np.clip((YD - 200) / 360, 0, 1) * (YD < HZ + 3) * keep
    p.glaze(low, hexc(C['low']), C['low_k'], edge=0.0, gran=0.08, variation=0.15)
    sx, sy = C['sun']
    glow = np.exp(-(((XD - sx) / 420) ** 2 + ((YD - sy) / 230) ** 2)) * (YD < HZ + 2)
    p.lift(glow, 0.4)
    p.glaze(glow, hexc(C['glow']), C['glow_k'], edge=0.0, gran=0.1, variation=0.1)
    if C['sun_lift'] > 0:     # a lifted sun disk sitting on the horizon
        sun = np.clip((40 - np.hypot(XD - sx, YD - sy)) / 3, 0, 1) * (YD < HZ)
        p.lift(p.soften(sun, S(2), 0.15), C['sun_lift'])
    st('sky', True)

    # clouds: thin streaks (dusk) / soft fair-weather clouds (day), wet-in-wet
    clouds = [(240, 150, 460, 1.0), (780, 95, 380, 0.8), (1250, 170, 520, 1.1), (1700, 110, 400, 0.9), (-80, 300, 300, 0.7),
              (2020, 250, 340, 0.8)]
    for (cx, cy, ln, k) in clouds:
        if cx + ln < X0 - 50 or cx - ln > X1 + 50:
            continue
        items = []
        for j in range(6):
            t = j / 5 - 0.5
            ry = r.uniform(8, 16) if dusk else r.uniform(18, 34)
            items.append((S.x(cx + t * ln * 0.9 + r.normal(0, 18)), S.y(cy + r.normal(0, 5) + (8 if dusk else -10) * t * t),
                          S(ln * r.uniform(0.13, 0.22)), S(ry * k * (1 - 0.8 * t * t))))
        m = p.blobs(items, rough=0.35, soft=S(12), ragged=0.4)
        if C['cloud_lift'] > 0:
            p.lift(m, C['cloud_lift'])
        p.glaze(m, hexc(C['cloud']), C['cloud_k'], edge=0.15, gran=0.15, variation=0.4)
        under = m * np.clip((YY - S.y(cy - (2 if dusk else -6))) / S(16), 0, 1)
        p.glaze(p.soften(under, S(3), 0.3) * m, hexc(C['cloud_under']), 0.3, edge=0.1, gran=0.1)
    st('clouds', True)

    # ---------------- far headland on the left horizon, pale
    xs = np.linspace(X0 - 20, 640, 60)
    fy = HZ + 2 - np.clip(60 * np.exp(-((xs - 120) / 260) ** 2) + 30 * np.exp(-((xs - 380) / 120) ** 2)
                          + 8 * ridge_noise(seed + 9, xs), 0, None) * np.clip((600 - xs) / 140, 0, 1)
    far_m = p.shape(pts([(X0 - 20, HZ + 4)] + list(zip(xs, fy)) + [(640, HZ + 4)]), soft=S(5), ragged=0.3)
    p.glaze(far_m, hexc(C['far']), 0.55, edge=0.3, gran=0.2)
    p.lift(far_m * np.clip((YD - (HZ - 40)) / 50, 0, 1), 0.35)
    st('far headland', True)

    # ---------------- sea: horizon tint, deepening toward us, wave marks, sun glitter
    sea = np.clip((YD - HZ) * s / 2, 0, 1) * keep
    p.glaze(sea * np.exp(-(YD - HZ) / 170), hexc(C['sea_top']), 0.5, edge=0.0, gran=0.1, variation=0.15)
    p.glaze(sea * np.clip(0.18 + (YD - HZ) / 420, 0, 1) ** 1.1, hexc(C['sea_deep']), 0.8, edge=0.0, gran=0.25, variation=0.25)
    p.lift(np.exp(-((YD - HZ - 3) / 3) ** 2) * keep, 0.35)            # bright horizon line
    p.glaze(p.mirror(far_m * (YY < S.y(HZ)), S.y(HZ), soft=S(5), breakup=0.4), hexc(C['far']), 0.3, edge=0.05)
    # sky colour reflected in the sea at the sun's column
    p.glaze(p.mirror(glow, S.y(HZ), soft=S(10), breakup=0.5) * keep, hexc(C['glow']), 0.35, edge=0.0)
    waves, lifts = [], []
    n_w = int(150 * (X1 - X0) / 1920 * (Y1 - HZ) / 520)
    for _ in range(n_w):
        yd = HZ + 8 + (Y1 - HZ - 8) * r.uniform(0, 1) ** 1.25
        f = (yd - HZ) / 520
        xd = r.uniform(X0 - 40, X1)
        ln = (25 + 140 * f) * r.uniform(0.6, 1.4)
        wd = max(1.0, (1.2 + 4.5 * f) * r.uniform(0.7, 1.2))
        a = [(S.x(xd), S.y(yd)), (S.x(xd + ln * 0.5), S.y(yd - wd * 0.6)), (S.x(xd + ln), S.y(yd + r.normal(0, 0.6)))]
        (waves if r.uniform() < 0.62 else lifts).append((a, S(wd)))
    waves, lifts = bands(CH, CW, waves, S(1.1)), bands(CH, CW, lifts, S(1.1))
    p.glaze(waves * sea, hexc(C['wave']), 0.38, edge=0.0, gran=0.2, variation=0.3)
    p.lift(lifts * sea, 0.4)
    # glitter path under the sun (dusk) / scattered sparkle (day)
    gl = []
    for _ in range(int(70 * (Y1 - HZ) / 520)):
        yd = HZ + 4 + (Y1 - HZ) * r.uniform(0, 1) ** 1.6
        f = (yd - HZ) / 520
        if dusk:
            xd = sx + r.normal(0, 18 + 140 * f)
        else:
            xd = r.uniform(200, 1400) + 300 * f
        ln = (10 + 60 * f) * r.uniform(0.5, 1.3)
        gl.append(([(S.x(xd - ln / 2), S.y(yd)), (S.x(xd + ln / 2), S.y(yd))], S(max(1.0, 1 + 2.5 * f))))
    gl = bands(CH, CW, gl, S(0.8))
    if dusk:
        col = sea * np.exp(-((XD - sx) / (25 + 0.35 * (YD - HZ))) ** 2)
        p.lift(p.soften(col, S(6), 0.3), 0.3)
    p.lift(gl * sea, 0.85 if dusk else 0.6)
    if dusk:
        p.glaze(gl * sea, hexc(C['glitter']), 0.35, edge=0.0, gran=0.0)
    st('sea', True)

    # ---------------- the headland: rock face, fissures, strata, grass cap
    p.glaze(land, hexc(C['rock']), 0.7, edge=0.45, gran=0.45, variation=0.35)
    # patchy second pigment (cooler) so the face is not one flat colour
    patch = land * smoothstep(0.45, 0.7, p.noise(S(110), 4))
    p.glaze(p.soften(patch, S(4), 0.4) * land, hexc(C['rock_sh']), 0.28, edge=0.25, gran=0.4)
    st('rock wash')
    tops = top_edge(np.clip(XD, 880, 4000))
    # face darkens toward the sea, plus a shadow band under the grass lip
    depth = land * np.clip((YD - tops - 20) / 220, 0, 1) ** 1.3
    p.glaze(depth, hexc(C['rock_sh']), 0.45, edge=0.0, gran=0.35, variation=0.3)
    lip = land * np.exp(-((YD - tops - 26) / 12) ** 2) * (XD > 960)
    p.glaze(p.soften(lip, S(3), 0.45) * land, hexc(C['rock_sh']), 0.45, edge=0.1, gran=0.3)
    # the seaward flank catches the low light
    flank = land * np.clip((1015 - XD) / 70, 0, 1)
    p.lift(p.soften(flank, S(5), 0.4) * land, 0.3)
    p.glaze(p.soften(flank, S(5), 0.4) * land, hexc(C['flank']), 0.35, edge=0.1, gran=0.3)
    # fissures: dry vertical strokes, longer high up
    for k in range(int(34 * (X1 - 960) / 960)):
        fx = r.uniform(975, X1 - 5)
        ty = float(top_edge(fx)) + r.uniform(30, 90)
        ln = r.uniform(40, 150)
        if ty + ln > float(base_line(fx)) - 8:
            ln = float(base_line(fx)) - 8 - ty
        if ln < 20:
            continue
        p.stroke(pts([(fx, ty), (fx + r.normal(0, 4), ty + ln * 0.5), (fx + r.normal(0, 6), ty + ln)]), S(r.uniform(1.5, 3.2)),
                 hexc(C['rock_dk']), r.uniform(0.25, 0.45), dry=0.55, taper=(0.3, 0.5))
    # strata: dry horizontal strokes following the slope
    for k in range(9):
        xa = r.uniform(970, X1 - 60)
        yy = float(top_edge(xa)) + r.uniform(45, 200)
        ln = r.uniform(50, 170)
        if yy > float(base_line(xa)) - 15:
            continue
        p.stroke(pts([(xa, yy), (xa + ln * 0.5, yy - ln * 0.02 + r.normal(0, 2)), (xa + ln, yy - ln * 0.035)]), S(r.uniform(1.5, 2.6)),
                 hexc(C['rock_dk']), 0.22, dry=0.6, taper=(0.3, 0.4))
    st('cliff face')
    # base: wet dark rock band, a few boulders, foam
    bl = base_line(np.clip(XD, 860, 4000))
    base_band = land * np.clip((YD - (bl - 40)) / 30, 0, 1)
    p.glaze(p.soften(base_band, S(5), 0.4) * land, hexc(C['rock_dk']), 0.5, edge=0.2, gran=0.4)
    rocks = []
    for k in range(int(12 * (X1 - 800) / 1120)):
        x = r.uniform(905, X1 + 20)
        rocks.append((S.x(x), S.y(float(base_line(x)) + r.uniform(-2, 6)), S(r.uniform(16, 40)), S(r.uniform(6, 12))))
    rk = p.blobs(rocks, rough=0.3, soft=S(2), ragged=0.25)
    p.glaze(rk, hexc(C['rock_dk']), 0.55, edge=0.5, gran=0.4)
    p.glaze(p.mirror(land * (YD < bl + 2), S.y(745), soft=S(4), breakup=0.55) * (YD > bl + 4), hexc(C['rock_sh']), 0.3, edge=0.05)
    foam = []
    for k in range(int(30 * (X1 - 800) / 1120)):
        x = r.uniform(820, X1 + 10); y = float(base_line(x)) + r.uniform(4, 26); ln = r.uniform(30, 110)
        foam.append((pts([(x, y), (x + ln / 2, y - 2), (x + ln, y + r.normal(0, 1.5))]), S(r.uniform(2, 4.5))))
    p.lift(bands(CH, CW, foam, S(1.2)), 0.7)
    st('cliff base')
    # grass cap along the top edge, tapering away down the flank
    gx = np.linspace(930, X1 + 30, 140)
    gy = top_edge(gx)
    thick = lambda x: (14 + 9 * (1 + np.sin(x / 37))) * np.clip((x - 930) / 50, 0.15, 1)
    cap = [(x, y - 3) for x, y in zip(gx, gy)] + [(x, y + thick(x)) for x, y in zip(gx[::-1], gy[::-1])]
    capm = p.shape(pts(cap), soft=S(3), ragged=0.45)
    p.glaze(capm, hexc(C['grass']), 0.8, edge=0.5, gran=0.35, variation=0.35)
    p.glaze(p.soften(capm * np.clip((YD - tops - 8) / 12, 0, 1), S(3), 0.4) * capm, hexc(C['grass_dk']), 0.5, edge=0.1, gran=0.3)
    # tufts hanging over the lip
    for k in range(int(30 * (X1 - 940) / 980)):
        x = r.uniform(940, X1); y = float(top_edge(x)) + thick(x) - 4
        p.stroke(pts([(x, y - 6), (x + r.normal(0, 3), y + r.uniform(6, 16))]), S(r.uniform(2, 3.5)), hexc(C['grass_dk']), 0.6, dry=0.4, taper=(0.1, 0.8))
    st('grass', True)

    # ---------------- village houses on the clifftop (back row first)
    houses = []
    xh = 1120.0
    while xh < X1 - 20:
        w = r.uniform(52, 92); h = r.uniform(38, 62)
        houses.append((xh + r.uniform(-6, 6), w, h, 1))
        xh += w + r.uniform(-10, 34)
    xh = 1160.0
    front = []
    while xh < X1 - 20:
        w = r.uniform(58, 100); h = r.uniform(34, 52)
        front.append((xh + r.uniform(-6, 6), w, h, 0))
        xh += w + r.uniform(40, 120)
    walls_all = np.zeros((CH, CW), np.float32)
    for (hx, w, h, back) in houses + front:
        gy0 = float(top_edge(hx + w / 2)) + (2 if back else 14)
        if back:
            gy0 -= r.uniform(14, 30)
        side = w * 0.32
        x_l, x_r = hx, hx + w
        front_poly = [(x_l, gy0), (x_l, gy0 - h), (x_r, gy0 - h), (x_r, gy0)]
        side_poly = [(x_r, gy0), (x_r, gy0 - h), (x_r + side, gy0 - h - side * 0.25), (x_r + side, gy0 - side * 0.25)]
        ridge_h = h * r.uniform(0.45, 0.65)
        gable = [(x_l - 3, gy0 - h), ((x_l + x_r) / 2, gy0 - h - ridge_h), (x_r + 3, gy0 - h)]
        roof_side = [((x_l + x_r) / 2, gy0 - h - ridge_h), (x_r + 3, gy0 - h), (x_r + side + 3, gy0 - h - side * 0.25),
                     ((x_l + x_r) / 2 + side, gy0 - h - ridge_h - side * 0.25)]
        fm = poly_union(CH, CW, [pts(front_poly)])
        sm = poly_union(CH, CW, [pts(side_poly)])
        gm_ = poly_union(CH, CW, [pts(gable)])
        rm = poly_union(CH, CW, [pts(roof_side)])
        body = np.maximum(fm, sm)
        p.lift(np.maximum(body, np.maximum(gm_, rm)), 0.95)          # knock the house out of the cliff wash
        p.glaze(p.soften(np.maximum(fm, gm_), S(1.2), 0.15), hexc(C['wall']), 0.55, edge=0.35, gran=0.25)
        p.glaze(p.soften(sm, S(1.2), 0.15), hexc(C['wall_sh']), 0.55 if dusk else 0.45, edge=0.3, gran=0.3)
        p.glaze(p.soften(rm, S(1.2), 0.15), hexc(C['roof']), 0.9, edge=0.5, gran=0.3)
        p.glaze(p.soften(rm * np.clip((YY - S.y(gy0 - h - ridge_h)) / S(ridge_h + 1), 0, 1), S(2), 0.2) * rm,
                hexc(C['roof_sh']), 0.35, edge=0.1, gran=0.3)
        # windows and a door on the front face
        nwin = max(1, int(w // 30))
        wins = []
        for k in range(nwin):
            wx = x_l + w * (k + 0.5) / nwin
            wy = gy0 - h * 0.62
            wins.append(pts([(wx - 5, wy - 7), (wx + 5, wy - 7), (wx + 5, wy + 6), (wx - 5, wy + 6)]))
        win = poly_union(CH, CW, wins)
        p.glaze(p.soften(win, S(0.8), 0.1), hexc(C['win']), 0.95 if C['win_lit'] else 0.75, edge=0.3, gran=0.1)
        walls_all = np.maximum(walls_all, body)
    st('village')
    # bushes / small trees between the houses
    bushes = []
    for k in range(12):
        x = r.uniform(1080, X1 - 10)
        bushes.append((S.x(x), S.y(float(top_edge(x)) + r.uniform(-2, 10)), S(r.uniform(12, 26)), S(r.uniform(9, 18))))
    bm = p.blobs(bushes, rough=0.35, soft=S(2.5), ragged=0.4)
    p.glaze(bm, hexc(C['bush']), 0.8, edge=0.55, gran=0.35, variation=0.3)
    st('bushes', True)

    # ---------------- lighthouse on the tip of the headland
    LX = 990
    LB = float(top_edge(LX)) + 6
    LT = 262
    bw, tw = 25, 17
    tower = [(LX - bw, LB), (LX - tw, LT), (LX + tw, LT), (LX + bw, LB)]
    tm = poly_union(CH, CW, [pts(tower)])
    p.lift(p.soften(tm, S(1), 0.1), 0.92)
    shade = tm * np.clip((XD - LX + 4) / 20, 0, 1)
    p.glaze(p.soften(shade, S(1.5), 0.2) * tm, hexc(C['tower_sh']), 0.45, edge=0.1, gran=0.2)
    for (fa, fb) in [(0.22, 0.34), (0.56, 0.68)]:
        ya, yb = LB + (LT - LB) * fa, LB + (LT - LB) * fb
        wa, wb = bw + (tw - bw) * fa, bw + (tw - bw) * fb
        band = poly_union(CH, CW, [pts([(LX - wa, ya), (LX - wb, yb), (LX + wb, yb), (LX + wa, ya)])]) * tm
        p.glaze(band, hexc(C['band']), 0.9, edge=0.3, gran=0.2)
    # gallery, lantern, cap
    gal = poly_union(CH, CW, [pts([(LX - 25, LT + 1), (LX - 25, LT - 6), (LX + 25, LT - 6), (LX + 25, LT + 1)])])
    p.glaze(gal, hexc('#3a3440'), 0.85, edge=0.2, gran=0.1)
    lan = poly_union(CH, CW, [pts([(LX - 12, LT - 6), (LX - 12, LT - 32), (LX + 12, LT - 32), (LX + 12, LT - 6)])])
    if dusk:
        halo = np.exp(-((XD - LX) ** 2 + (YD - LT + 19) ** 2) / (2 * 34 ** 2))
        p.lift(halo * (1 - tm), 0.45)
        beam = np.clip(1 - np.abs((YD - (LT - 19)) - (XD - LX) * 0.06) / (6 + np.abs(XD - LX) * 0.11), 0, 1) * (XD < LX) * np.exp(-(LX - XD) / 520)
        p.lift(p.soften(beam, S(4), 0.2), 0.35)
        p.glaze(p.soften(beam, S(4), 0.2), hexc(C['lamp']), 0.25, edge=0.0)
        p.glaze(halo * (1 - tm), hexc(C['lamp']), 0.3, edge=0.0)
    p.lift(lan, 0.9)
    p.glaze(lan, hexc(C['lamp']), 0.85 if dusk else 0.5, edge=0.5, gran=0.1)
    for dx in (-12, 0, 12):
        p.stroke(pts([(LX + dx, LT - 6), (LX + dx, LT - 32)]), S(1.6), hexc('#3a3440'), 0.7, dry=0.1, taper=(0.1, 0.1))
    cap = poly_union(CH, CW, [pts([(LX - 15, LT - 31), (LX, LT - 48), (LX + 15, LT - 31)])])
    p.glaze(cap, hexc(C['band']), 0.95, edge=0.4, gran=0.2)
    p.stroke(pts([(LX, LT - 48), (LX, LT - 58)]), S(2), hexc('#3a3440'), 0.8, dry=0.1, taper=(0.1, 0.3))
    # keeper's cottage
    kx, kw, kh = 1018, 62, 34
    ky = float(top_edge(kx + kw / 2)) + 10
    km = poly_union(CH, CW, [pts([(kx, ky), (kx, ky - kh), (kx + kw, ky - kh), (kx + kw, ky)])])
    kr = poly_union(CH, CW, [pts([(kx - 5, ky - kh), (kx + 10, ky - kh - 20), (kx + kw - 8, ky - kh - 20), (kx + kw + 5, ky - kh)])])
    p.lift(np.maximum(km, kr), 0.85)
    p.glaze(p.soften(km, S(1), 0.1), hexc(C['wall']), 0.5, edge=0.35, gran=0.2)
    p.glaze(p.soften(kr, S(1), 0.1), hexc(C['roof']), 0.9, edge=0.45, gran=0.3)
    win = poly_union(CH, CW, [pts([(kx + 38, ky - 24), (kx + 48, ky - 24), (kx + 48, ky - 12), (kx + 38, ky - 12)])])
    p.glaze(win, hexc(C['win']), 0.9, edge=0.2)
    st('lighthouse', True)

    # ---------------- sailing boats (hull, mast, mainsail, jib) with their reflections
    def sailboat(x, yw, size, flip=1):
        L = size
        hull = spline(pts([(x - L * 0.5, yw - L * 0.07), (x - L * 0.3, yw + L * 0.03), (x + L * 0.32, yw + L * 0.03),
                           (x + L * 0.55, yw - L * 0.09), (x, yw - L * 0.05), (x - L * 0.5, yw - L * 0.07)]), 8)
        hm = p.shape(hull, soft=S(0.8), ragged=0.08)
        mx = x + flip * L * 0.02
        mtop = yw - L * 1.15
        main = [(mx - flip * L * 0.02, mtop + L * 0.04), (mx - flip * L * 0.02, yw - L * 0.12), (mx - flip * L * 0.46, yw - L * 0.14)]
        jib = [(mx + flip * L * 0.02, mtop + L * 0.12), (mx + flip * L * 0.5, yw - L * 0.12), (mx + flip * L * 0.03, yw - L * 0.13)]
        mm = poly_union(CH, CW, [pts(main)])
        jm = poly_union(CH, CW, [pts(jib)])
        sails = p.soften(np.maximum(mm, jm), S(0.9), 0.12)
        # reflections first (beneath)
        y_w = S.y(yw)
        p.glaze(p.mirror(sails, y_w, soft=S(3), breakup=0.55), hexc(C['sail_sh']), 0.25, edge=0.05)
        p.lift(p.mirror(sails, y_w, soft=S(3), breakup=0.55), 0.35)
        p.glaze(p.mirror(hm, y_w - S(L * 0.02), soft=S(2), breakup=0.4), hexc(C['hull']), 0.45, edge=0.05)
        p.lift(sails, 0.95)
        p.glaze(sails, hexc(C['sail']), 0.5, edge=0.35, gran=0.15)
        shade = p.soften(jm, S(0.9), 0.12) if dusk else p.soften(mm * np.clip((YY - S.y(mtop)) / S(L), 0, 1), S(1), 0.1)
        p.glaze(shade, hexc(C['sail_sh']), 0.4, edge=0.1, gran=0.15)
        p.stroke(pts([(mx, yw - L * 0.05), (mx, mtop)]), S(max(1.2, L * 0.012)), hexc(C['hull']), 0.85, dry=0.1, taper=(0.05, 0.2))
        p.glaze(hm, hexc(C['hull']), 0.9, edge=0.4, gran=0.2)
        p.lift(p.band(pts([(x - L * 0.7, yw + L * 0.05), (x + L * 0.75, yw + L * 0.05)]), S(max(1.2, L * 0.012)), soft=S(1)), 0.45)

    sailboat(760, 600, 46, -1)
    sailboat(250, 650, 80, 1)
    sailboat(560, 870, 165, 1)
    st('boats', True)

    # ---------------- gulls: two curved strokes each, larger nearer
    gulls = [(380, 300, 1.4), (455, 262, 1.1), (1080, 205, 0.9), (1150, 175, 0.75), (1215, 228, 0.8), (700, 380, 0.7), (1500, 300, 0.6)]
    for (gx_, gy_, k) in gulls:
        bx, by, sc = S.x(gx_), S.y(gy_), k * s
        p.stroke(curve((bx - 18 * sc, by - 4 * sc), (bx, by + 3 * sc), -9 * sc, 10), S(2.6 * max(0.9, k)), hexc(C['gull']), 0.85, dry=0.15, taper=(0.1, 0.5))
        p.stroke(curve((bx, by + 3 * sc), (bx + 18 * sc, by - 5 * sc), -9 * sc, 10), S(2.6 * max(0.9, k)), hexc(C['gull']), 0.85, dry=0.15, taper=(0.5, 0.1))
    st('gulls')

    p.rng = group_rng(seed, 'finish')
    img = p.composite().convert('RGB')
    st('final', True)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'watercolour_coast.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=bl), out)
    print('saved', out)
