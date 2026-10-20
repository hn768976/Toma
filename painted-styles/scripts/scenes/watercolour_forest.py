"""Forest path through tall trees, sun rays, a deer in the distance — Watercolour (水彩),
painted with vendor lib/watercolor.py `Watercolor`. Scene C (still).

python scripts/scenes/watercolour_forest.py out.png [W H] [colourway] [bleed]
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

VP = (990, 604)    # where the path disappears (design px)
GY = 606           # far forest floor line

PAL = {
    "Day": dict(
        bg='#a9c98c', bg_edge='#5f8f6c', glow='#fbe7a4', far='#8fb0a2', far_k=0.32, mid='#6f7a62', mid_k=0.55,
        near='#5d4836', near_sh='#2c2724', bark='#3a2e26', can_l='#a6c55a', can_m='#5f8c45', can_d='#2c5034',
        ground='#93ad5c', ground_d='#46683a', path='#e6c690', path_sh='#7f8a72', ray='#fff3c4', ray_k=0.3,
        deer='#7a4c2e', deer_d='#45301f', fern='#4b7a36', fern_d='#2e5a2c', mist=0.35, spark='#fff6c8'),
    "Dusk": dict(
        bg='#eab19a', bg_edge='#6f6596', glow='#fbcf92', far='#a491b4', far_k=0.36, mid='#6f5c7c', mid_k=0.6,
        near='#4e3c48', near_sh='#221c30', bark='#2a2232', can_l='#a07f9e', can_m='#47417c', can_d='#241f4a',
        ground='#c0868a', ground_d='#463d72', path='#f3c7a0', path_sh='#6d5f86', ray='#ffd39c', ray_k=0.32,
        deer='#5e3a36', deer_d='#2e2028', fern='#4a4274', fern_d='#29224a', mist=0.4, spark='#ffd8a0'),
}


class Stager:
    def __init__(self, p, stages_dir, dense):
        self.p, self.dir, self.dense, self.n = p, stages_dir, dense, 0

    def __call__(self, name, major=False):
        if not self.dir or not (self.dense or major):
            return
        save_png(self.p.composite().convert('RGB'), os.path.join(self.dir, f"{self.n:03d}_{name.replace(' ', '_')}.png"))
        self.n += 1


def poly_union(H, W, polys, ss=2):
    im = Image.new('L', (W * ss, H * ss), 0)
    d = ImageDraw.Draw(im)
    for pts in polys:
        d.polygon([(float(x) * ss, float(y) * ss) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BILINEAR), np.float32) / 255


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
    X0, X1, Ya, Y1 = S.X0, S.X1, S.Y0, S.Y1
    st = Stager(p, stages_dir, dense_stages)
    pts = S.pts
    if include is not None and 'all' not in include:
        p.rng = group_rng(seed, 'paper'); p.paper()
        p.rng = group_rng(seed, 'finish')
        return p.composite().convert('RGB')

    p.rng = group_rng(seed, 'paper')
    p.paper()
    st('paper', True)
    p.rng = group_rng(seed, 'all')
    r = p.rng
    vx, vy = VP

    # ---------------- the path: S-curve from the bottom edge to the vanishing point
    t = np.linspace(0, 1, 60)
    cxs = np.interp(t, [0, 0.35, 0.7, 1], [1010, 860, 1060, vx])
    cys = Y1 + 10 - (Y1 + 10 - vy) * (1 - (1 - t) ** 1.6)
    half = 4 + 380 * (1 - t) ** 1.7
    left = [(x - h, y) for x, y, h in zip(cxs, cys, half)]
    right = [(x + h, y) for x, y, h in zip(cxs, cys, half)][::-1]
    path_m = p.shape(pts(left + right), soft=S(5), ragged=0.45)

    # ---------------- background: light glowing at the end of the path, cooler at the edges
    dist = np.hypot((XD - vx) / 1.3, YD - (vy - 60))
    p.glaze(np.ones((CH, CW), np.float32), hexc(C['bg']), 0.45, edge=0.0, gran=0.15, variation=0.3)
    edge = np.clip((dist - 180) / 700, 0, 1)
    p.glaze(edge, hexc(C['bg_edge']), 0.55, edge=0.0, gran=0.2, variation=0.3)
    glow = np.exp(-(dist / 260) ** 2)
    p.lift(glow, 0.55)
    p.glaze(glow, hexc(C['glow']), 0.4, edge=0.0, gran=0.05)
    st('background', True)

    # ---------------- far trees: pale thin trunks fading into the light, a hazy far canopy
    far_m = np.zeros((CH, CW), np.float32)
    xs = np.arange(X0 - 30, X1 + 30, 46) + r.normal(0, 12, len(np.arange(X0 - 30, X1 + 30, 46)))
    for x in xs:
        if abs(x - vx) < 26:
            continue
        w = r.uniform(7, 15)
        base = GY + r.uniform(-4, 6)
        far_m = np.maximum(far_m, poly_union(CH, CW, [pts([(x - w / 2, base), (x - w * 0.4, Ya - 20), (x + w * 0.4, Ya - 20), (x + w / 2, base)])]))
    far_m = p.soften(far_m, S(1.5), 0.25)
    haze = 1 - 0.6 * np.exp(-(dist / 330) ** 2)
    p.glaze(far_m * haze, hexc(C['far']), C['far_k'] * 1.6, edge=0.25, gran=0.25)
    fc = []
    for x in np.arange(X0 - 60, X1 + 60, 70):
        fc.append((S.x(x + r.normal(0, 20)), S.y(r.uniform(Ya + 20, 260) if Ya < 0 else r.uniform(30, 260)), S(r.uniform(60, 110)), S(r.uniform(50, 90))))
    fcm = p.blobs(fc, rough=0.35, soft=S(10), ragged=0.45)
    p.glaze(fcm * np.clip((300 - YD) / 120, 0.3, 1) * haze, hexc(C['far']), C['far_k'] * 1.4, edge=0.2, gran=0.2, variation=0.4)
    st('far trees', True)

    # ---------------- forest floor and the path
    ground = np.clip((YD - GY + 6) / 10, 0, 1)
    g_band = ground * (1 - path_m)
    p.glaze(g_band, hexc(C['ground']), 0.6, edge=0.0, gran=0.35, variation=0.4)
    deep = ground * np.clip((YD - GY) / (Y1 - GY), 0, 1) ** 1.1
    p.glaze(p.soften(deep * (1 - path_m), S(6), 0.3), hexc(C['ground_d']), 0.6, edge=0.0, gran=0.35, variation=0.4)
    p.glaze(path_m, hexc(C['path']), 0.6, edge=0.4, gran=0.45, variation=0.35)
    p.glaze(path_m * np.clip((YD - 700) / 400, 0, 1), hexc(C['path_sh']), 0.25, edge=0.0, gran=0.3)
    st('floor', True)

    # ---------------- mid trees: darker trunks standing on the floor between far and near
    mids = [(150, 660, 30), (330, 650, 24), (560, 642, 26), (720, 630, 18), (840, 622, 14), (1120, 622, 14),
            (1230, 632, 20), (1390, 648, 28), (1520, 655, 22), (1700, 668, 32), (1850, 650, 22), (-90, 670, 30), (2010, 665, 30)]
    mid_m = np.zeros((CH, CW), np.float32)
    for (x, base, w) in mids:
        if x + w < X0 or x - w > X1:
            continue
        x += r.normal(0, 6)
        flare = w * 0.35
        mid_m = np.maximum(mid_m, poly_union(CH, CW, [pts([(x - w / 2 - flare, base + 3), (x - w / 2, base - w * 0.8), (x - w * 0.38, Ya - 20),
                                                           (x + w * 0.38, Ya - 20), (x + w / 2, base - w * 0.8), (x + w / 2 + flare, base + 3)])]))
    mid_m = p.soften(mid_m, S(1.5), 0.25)
    p.glaze(mid_m, hexc(C['mid']), C['mid_k'], edge=0.45, gran=0.3, variation=0.3)
    st('mid trees', True)

    # ---------------- near trees: big trunks framing the path, bark strokes, shadow side
    nears = [(110, 1000, 130), (395, 905, 78), (650, 790, 44), (1330, 800, 46), (1580, 900, 86), (1800, 1020, 150),
             (-170, 1060, 120), (2080, 1050, 120)]
    shadows = np.zeros((CH, CW), np.float32)
    for (x, base, w) in nears:
        if x + w < X0 - 20 or x - w > X1 + 20:
            continue
        flare = w * 0.2
        lean = r.normal(0, w * 0.08)
        poly = [(x - w / 2 - flare, base + 8), (x - w / 2 - flare * 0.55, base - w * 0.12), (x - w / 2 - flare * 0.15, base - w * 0.35),
                (x - w / 2, base - w * 0.7), (x - w * 0.42 + lean, Ya - 30), (x + w * 0.42 + lean, Ya - 30), (x + w / 2, base - w * 0.7),
                (x + w / 2 + flare * 0.15, base - w * 0.35), (x + w / 2 + flare * 0.55, base - w * 0.12), (x + w / 2 + flare, base + 8)]
        tm = p.shape(pts(poly), soft=S(1.6), ragged=0.2)
        p.glaze(tm, hexc(C['near']), 0.85, edge=0.55, gran=0.4, variation=0.35)
        # the side away from the light (left) in shadow, wet-in-wet, kept inside the trunk
        side = tm * np.clip((x + lean * (1 - YD / 1080) - XD) / (w * 0.5) + 0.35, 0, 1)
        p.glaze(p.soften(side, S(6), 0.35) * tm, hexc(C['near_sh']), 0.55, edge=0.05, gran=0.35)
        for k in range(int(w / 9)):
            bx_ = x + r.uniform(-w * 0.38, w * 0.38)
            y_a = r.uniform(80, base - 40); ln = r.uniform(60, 220)
            p.stroke(pts([(bx_, y_a), (bx_ + r.normal(0, 3), y_a + ln * 0.5), (bx_ + r.normal(0, 4), min(base - 10, y_a + ln))]),
                     S(r.uniform(2, 4)), hexc(C['bark']), 0.35, dry=0.55, taper=(0.3, 0.4))
        clump = p.blobs([(S.x(x + dx_ * w), S.y(base + 4), S(w * 0.35), S(w * 0.09 + 5)) for dx_ in (-0.55, 0.0, 0.55)], rough=0.4, soft=S(3), ragged=0.45)
        p.glaze(clump, hexc(C['fern_d']), 0.6, edge=0.4, gran=0.35)
        for k in range(int(4 + w / 12)):
            gx_ = x + r.uniform(-w * 0.9, w * 0.9); gh = r.uniform(14, 34) * (0.6 + w / 150)
            p.stroke(pts([(gx_, base + 8), (gx_ + r.normal(0, 4), base + 8 - gh)]), S(r.uniform(1.6, 2.6)), hexc(C['fern']), 0.6, dry=0.4, taper=(0.05, 0.8))
        # cast shadow across the floor / path, away from the sun (down-left)
        dxs, dys = (x - vx) * 0.35 - 120, 120 + (base - GY) * 0.6
        sh = [(x - w * 0.45, base), (x + w * 0.45, base), (x + dxs + w * 0.9, base + dys), (x + dxs - w * 0.9, base + dys)]
        shadows = np.maximum(shadows, poly_union(CH, CW, [pts(sh)]) * np.clip(1 - (YD - base) / (dys + 1), 0, 1) ** 0.5)
    st('near trees', True)
    shadows = p.soften(shadows * ground, S(10), 0.4)
    p.glaze(shadows, hexc(C['path_sh']), 0.35, edge=0.1, gran=0.25)
    st('cast shadows', True)

    # ---------------- canopy: foliage masses along the top, three glazes kept inside the crown
    crown = []
    for x in np.arange(X0 - 80, X1 + 80, 85):
        yc = r.uniform(Ya - 40, 120) if Ya < 0 else r.uniform(-40, 120)
        crown.append((S.x(x + r.normal(0, 25)), S.y(yc), S(r.uniform(90, 150)), S(r.uniform(70, 120))))
    for (x, y_) in [(110, 230), (395, 200), (1580, 210), (1800, 240), (650, 160), (1330, 170)]:
        crown.append((S.x(x + r.normal(0, 30)), S.y(y_), S(r.uniform(110, 160)), S(r.uniform(70, 100))))
    keep_open = np.exp(-(((XD - 1250) / 360) ** 2 + ((YD - 120) / 220) ** 2))       # a gap where the light comes in
    cm = p.blobs(crown, rough=0.45, soft=S(6), ragged=0.5) * (1 - 0.85 * keep_open)
    p.glaze(cm, hexc(C['can_l']), 0.7, edge=0.5, gran=0.4, variation=0.4, bloom=2)
    items = [(cx_ + S(30), cy_ + S(25), rx * 0.7, ry * 0.6) for (cx_, cy_, rx, ry) in crown]
    m2 = p.blobs(items, rough=0.45, soft=S(10), ragged=0.5) * np.clip(cm * 1.3, 0, 1)
    p.glaze(m2, hexc(C['can_m']), 0.7, edge=0.35, gran=0.4, variation=0.4, bloom=1)
    items = [(cx_ + S(40), cy_ + S(45), rx * 0.45, ry * 0.4) for (cx_, cy_, rx, ry) in crown]
    m3 = p.blobs(items, rough=0.45, soft=S(14), ragged=0.5) * np.clip(cm * 1.3, 0, 1)
    p.glaze(m3, hexc(C['can_d']), 0.6, edge=0.2, gran=0.4, variation=0.4)
    st('canopy', True)

    # ---------------- sun rays: soft lifted wedges falling from the upper right toward the path
    sxr, syr = 1450, -160
    ang = np.arctan2(YD - syr, XD - sxr)
    rays = np.zeros((CH, CW), np.float32)
    for a0, wdt, k in [(1.93, 0.028, 0.9), (2.02, 0.018, 0.7), (2.11, 0.04, 1.0), (2.21, 0.022, 0.75), (2.30, 0.03, 0.85), (1.82, 0.02, 0.6), (2.40, 0.02, 0.5)]:
        rays = np.maximum(rays, k * np.exp(-((ang - a0) / wdt) ** 2))
    rays *= np.clip((YD + 40) / 200, 0, 1) * np.clip((GY + 260 - YD) / 200, 0, 1) * (0.55 + 0.45 * p.noise(S(160), 3))
    rays = blur(rays, S(5))
    p.lift(rays, 0.62)
    p.glaze(rays, hexc(C['ray']), C['ray_k'], edge=0.0, gran=0.05)
    st('rays', True)

    # ---------------- low mist where the path meets the light
    band = np.exp(-((YD - GY - 8 - 30 * (p.noise(S(300), 3) - 0.5)) / 46) ** 2) * (0.5 + 0.5 * p.noise(S(140), 3))
    p.lift(band, C['mist'])
    st('mist', True)

    # ---------------- the deer, standing on the path in the light, head up
    DX, DY = vx + 8, vy + 14          # hooves
    u = 1.2
    body = blob_pts(DX, DY - 34 * u, 25 * u, 11 * u, rough=0.04, seed=seed + 31)
    neck = [(DX - 22 * u, DY - 40 * u), (DX - 27 * u, DY - 56 * u), (DX - 18 * u, DY - 61 * u), (DX - 9 * u, DY - 42 * u)]
    chest = blob_pts(DX - 15 * u, DY - 35 * u, 11 * u, 11 * u, rough=0.03, seed=seed + 33)
    haunch = blob_pts(DX + 15 * u, DY - 36 * u, 11 * u, 11.5 * u, rough=0.03, seed=seed + 34)
    head = blob_pts(DX - 25 * u, DY - 60 * u, 8 * u, 5.5 * u, rough=0.03, seed=seed + 32, rot=0.45)
    snout = [(DX - 29 * u, DY - 63 * u), (DX - 37 * u, DY - 56 * u), (DX - 34 * u, DY - 53 * u), (DX - 24 * u, DY - 56 * u)]
    ear1 = Watercolor.petal_pts(DX - 20 * u, DY - 63 * u, -1.05, 10 * u, 3.4 * u, n=16)
    ear2 = Watercolor.petal_pts(DX - 24 * u, DY - 64 * u, -2.0, 9 * u, 3.2 * u, n=16)
    tail = [(DX + 23 * u, DY - 40 * u), (DX + 30 * u, DY - 38 * u), (DX + 25 * u, DY - 33 * u)]
    deer = poly_union(CH, CW, [pts(body), pts(chest), pts(haunch), pts(neck), pts(head), pts(snout), pts(ear1), pts(ear2), pts(tail)], ss=3)
    for (lx, kx, ex_) in [(-18, -18, -19), (-11, -10, -9), (12, 16, 13), (18, 22, 20)]:
        deer = np.maximum(deer, p.band(pts([(DX + lx * u, DY - 30 * u), (DX + kx * u, DY - 13 * u), (DX + ex_ * u, DY)]), S(3.6 * u), soft=S(0.6)))
    deer = np.clip(blur(np.clip(deer, 0, 1), S(0.6)) * 1.15, 0, 1)
    p.lift(deer, 0.2)
    p.glaze(deer, hexc(C['deer']), 0.9, edge=0.4, gran=0.15, variation=0.15)
    p.glaze(deer * np.clip((YD - (DY - 36)) / 14, 0, 1) * (YD < DY - 12), hexc(C['deer_d']), 0.35, edge=0.0)
    p.lift(p.band(pts([(DX + 23 * u, DY - 37 * u), (DX + 27 * u, DY - 36 * u)]), S(2.5), soft=S(0.6)), 0.6)   # white tail tip
    p.glaze(p.soften(np.exp(-(((XD - DX) / 26) ** 2 + ((YD - DY - 1) / 2.5) ** 2)), S(1), 0.1), hexc(C['path_sh']), 0.35, edge=0.0)
    st('deer', True)

    # ---------------- foreground: ferns and grass tufts at the path edges
    def fern(x, y, size, ang0):
        polys = ([], [])
        for k in range(5):
            a = ang0 + (k - 2) * 0.35 + r.normal(0, 0.08)
            ln = size * r.uniform(0.7, 1.0)
            ex_, ey_ = x + np.cos(a) * ln, y + np.sin(a) * ln
            p.stroke(pts(curve((x, y), (ex_, ey_), ln * 0.12, 12)), S(2.2), hexc(C['fern_d']), 0.6, dry=0.2, taper=(0.1, 0.8))
            for j in range(1, 10):
                f = j / 10
                px_, py_ = x + (ex_ - x) * f, y + (ey_ - y) * f
                for sgn in (-1, 1):
                    la = a + sgn * 1.05
                    ll = ln * 0.24 * (1 - f) + ln * 0.04
                    polys[(j + k) % 2].append(pts(Watercolor.petal_pts(px_, py_, la, ll, ll * 0.24, n=16)))
        for i, col in enumerate((C['fern'], C['fern_d'])):
            lm = p.soften(poly_union(CH, CW, polys[i]), S(0.8), 0.1)
            p.glaze(lm, hexc(col), 0.75, edge=0.4, gran=0.2)

    for (x, y, sz, a) in [(130, 1090, 230, -1.75), (330, 1100, 200, -1.35), (1640, 1095, 220, -1.6), (1840, 1080, 250, -1.9)]:
        fern(x, y, sz, a)
    for _ in range(int(45 * (X1 - X0) / 1920)):
        x = r.uniform(X0, X1)
        cx_ = np.interp(Y1, cys[::-1], cxs[::-1])
        y = r.uniform(820, Y1 + 5)
        fy_ = (y - vy) / (Y1 - vy)
        if abs(x - np.interp(y, cys[::-1], cxs[::-1])) < 400 * fy_ ** 1.7 * 0.9:
            continue
        h = r.uniform(25, 60) * (0.5 + fy_)
        col = hexc(C['fern'] if r.uniform() < 0.5 else C['fern_d'])
        for b in range(3):
            lean = (b - 1) * h * 0.3 + r.normal(0, h * 0.08)
            p.stroke(pts([(x, y), (x + lean * 0.4, y - h * 0.55), (x + lean, y - h * r.uniform(0.75, 1.0))]), S(r.uniform(1.6, 2.6)), col, 0.6, dry=0.4, taper=(0.05, 0.8))
    st('foreground', True)

    p.rng = group_rng(seed, 'finish')
    img = p.composite().convert('RGB')
    st('final', True)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'watercolour_forest.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    bl = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=bl), out)
    print('saved', out)
