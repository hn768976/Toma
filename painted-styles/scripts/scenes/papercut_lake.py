"""Mountain lake at dusk — torn-paper collage (Collage): stacked torn sky strips, paper mountain
ranges with white torn rims, cut-paper pines, a kraft boat, crayon ripples and birds."""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from papercut import Collage, hexc
from core import spline, fbm1d, polygon_mask

STYLE = "Paper collage · 剪纸拼贴"
LIB = "papercut"

WL = 640


def far_ridge(x):
    return 372 - 70 * np.exp(-((x - 1250) / 170) ** 2) - 40 * np.exp(-((x - 820) / 140) ** 2) \
        - 34 * np.exp(-((x - 1620) / 150) ** 2) - 30 * np.exp(-((x - 300) / 180) ** 2) - 6 * np.sin(x / 37)


def near_ridge(x):
    return 470 - 30 * np.exp(-((x - 330) / 260) ** 2) - 14 * np.exp(-((x - 720) / 120) ** 2) \
        + 120 * (1 / (1 + np.exp(-(x - 1180) / 120))) - 50 * np.exp(-((x - 1720) / 150) ** 2) - 4 * np.sin(x / 29)


PINES_L = [(30, 560, 30), (80, 515, 40), (140, 470, 48), (200, 430, 54), (262, 455, 50), (318, 495, 44),
           (372, 470, 46), (428, 520, 38), (476, 545, 32), (515, 562, 26)]
PINES_R = [(1520, 585, 20), (1565, 560, 26), (1612, 592, 18), (1705, 575, 24), (1765, 600, 17)]


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    c = Collage(W, H, seed=seed)
    rng = np.random.default_rng(seed + 11)

    def ridge_poly(fn, x0=-30, x1=1950, n=90, bottom=WL + 4, wob=0.0, wseed=0):
        xs = np.linspace(x0, x1, n)
        jit = fbm1d(n, 10, 3, wseed) * wob
        top = [(x, fn(x) + jit[i]) for i, x in enumerate(xs)]
        return S.pts(top + [(x1, bottom), (x0, bottom)])

    # ---- sky: torn strips of paper stacked from the top down (indigo -> violet -> rose -> peach)
    c.background('#27305e', texture='paper')
    bands = [(85, '#363c74'), (150, '#4e4886'), (205, '#7a5a92'), (250, '#b56f90'), (292, '#e2948c'), (330, '#f5ba90')]
    for i, (y, col) in enumerate(bands):
        n = 70
        xs = np.linspace(-30, 1950, n)
        edge = y + fbm1d(n, 12, 3, seed + 20 + i) * 16 + 10 * np.sin(xs / 300 + i)
        pts = S.pts([(x, edge[j]) for j, x in enumerate(xs)] + [(1950, WL + 10), (-30, WL + 10)])
        c.piece(pts, col, texture='paper', torn=0.7, rim=0.6, shadow=0.25)
    # sun: a torn pale-gold paper disc low behind the far range, with a soft glow (no face, no rays)
    c.glow(S(1200), S(340), S(110), '#ffe2a8', 0.45)
    c.piece(mask=c.circle_mask(S(1180), S(330), S(52)), colour='#fde3a8', texture='paper', torn=0.35, rim=0.7, shadow=0.15)
    c.stage('sky')

    # ---- two mountain ranges
    c.piece(ridge_poly(far_ridge, wob=6, wseed=seed + 3), '#9e8db8', texture='paper', torn=0.6, rim=0.9, shadow=0.35)
    # a lighter paper facet on the glow side of the highest peak
    c.stage('far_mountains')
    c.piece(ridge_poly(near_ridge, wob=5, wseed=seed + 4), '#4e4a78', texture='paper', torn=0.6, rim=0.9, shadow=0.45)
    c.stage('near_mountains')

    # ---- water: deep blue-violet paper; mirrored ranges as darker paper; glow path as torn peach slips
    c.piece(S.pts([(-30, WL), (1950, WL), (1950, 1110), (-30, 1110)]), '#4a4f86', texture='paper', torn=0.3, rim=0.5, shadow=0.4)
    c.piece(S.pts([(-30, 860), (1950, 840), (1950, 1110), (-30, 1110)]), '#363d6e', texture='paper', torn=0.6, rim=0.4, shadow=0.25)
    mir = lambda fn: (lambda x: 2 * WL - fn(x))
    xs = np.linspace(-30, 1950, 90)
    far_r = [(x, WL + (WL - far_ridge(x)) * 0.55) for x in xs]
    c.piece(S.pts([(-30, WL)] + far_r + [(1950, WL)]), '#7a6ea0', texture='paper', torn=0.7, rim=0.5, shadow=0.0)
    near_r = [(x, WL + (WL - near_ridge(x)) * 0.6) for x in xs]
    c.piece(S.pts([(-30, WL)] + near_r + [(1950, WL)]), '#3c3b66', texture='paper', torn=0.7, rim=0.5, shadow=0.0)
    for k in range(7):
        y = 668 + k * 34 + rng.uniform(-6, 6)
        half = 70 - k * 6 + rng.uniform(-12, 12)
        x0 = 1180 + rng.uniform(-25, 25)
        pts = S.pts([(x0 - half, y), (x0 + half, y - 3), (x0 + half * 0.8, y + 9), (x0 - half * 0.85, y + 10)])
        c.piece(pts, '#f3c08e' if k < 4 else '#d99a8c', texture='paper', torn=0.5, rim=0.6, shadow=0.2)
    c.stage('water')

    # ---- pines: cut-paper tiers, the same tier level of every tree glued as one sheet
    def pine_masks(pines, flip=False):
        tiers = [np.zeros((H, W), np.float32) for _ in range(3)]
        trunks = np.zeros((H, W), np.float32)
        for (px, top, hw) in pines:
            hgt = 650 - top
            for k in range(3):
                t0 = k / 3.3; t1 = (k + 1.6) / 3.3
                ya = top + hgt * t0; yb = top + hgt * min(t1, 0.92)
                wb = hw * (0.55 + 0.45 * (k + 1) / 3)
                pts = [(px, ya), (px + wb, yb), (px - wb, yb)]
                if flip:
                    pts = [(x, 2 * 652 - y) for x, y in pts]
                tiers[k] = np.maximum(tiers[k], polygon_mask(H, W, S.pts(pts), 2))
            tw = max(4, hw * 0.13)
            tp = [(px - tw, 600 if top < 600 else top + hgt * 0.6), (px + tw, 600 if top < 600 else top + hgt * 0.6), (px + tw, 654), (px - tw, 654)]
            if flip:
                tp = [(x, 2 * 652 - y) for x, y in tp]
            trunks = np.maximum(trunks, polygon_mask(H, W, S.pts(tp), 2))
        return tiers, trunks

    # reflections first (they sit on the water, under the mist)
    tiers_r, trunks_r = pine_masks(PINES_L + PINES_R, flip=True)
    cut = (c.YY > S(652)).astype(np.float32) * (c.YY < S(890)).astype(np.float32)
    for k, col in enumerate(['#2a3a4c', '#2c3e50', '#2f4254']):
        c.piece(mask=tiers_r[k] * cut, colour=col, texture='paper', torn=0.5, rim=0.25, shadow=0.0)
    # shore strips
    c.piece(S.pts([(-30, 628), (600, 636), (640, 652), (-30, 656)]), '#2f3a2e', texture='kraft', torn=0.6, rim=0.6, shadow=0.35)
    c.piece(S.pts([(1460, 640), (1950, 632), (1950, 656), (1480, 654)]), '#2f3a2e', texture='kraft', torn=0.6, rim=0.6, shadow=0.35)
    tiers, trunks = pine_masks(PINES_L + PINES_R)
    c.piece(mask=trunks, colour='#4a3326', texture='kraft', torn=0.2, rim=0.2, shadow=0.3)
    for k, col in enumerate(['#1f4a3f', '#1b4238', '#173a31']):
        c.piece(mask=tiers[k], colour=col, texture='paper', torn=0.45, rim=0.35, shadow=0.4)
    c.stage('trees')

    # ---- boat (kraft hull) with a seated rower, and its reflection
    hull = S.pts([(1080, 778), (1262, 774), (1238, 801), (1102, 802)])
    hull_r = S.pts([(1102, 804), (1238, 803), (1252, 822), (1092, 824)])
    c.piece(hull_r, '#33304e', texture='paper', torn=0.4, rim=0.2, shadow=0.0)
    c.piece(mask=c.circle_mask(S(1172), S(812), S(13)) * (c.YY > S(804)), colour='#2e2b48', texture='paper', torn=0.3, rim=0.0, shadow=0.0)
    c.crayon(S.pts([(1150, 768), (1112, 812)]), 4.5 * s, '#6b4a34', 0.95)        # oar
    body = S.pts([(1158, 778), (1186, 778), (1182, 748), (1172, 740), (1162, 748)])
    c.piece(body, '#3d5a8a', texture='paper', torn=0.2, rim=0.5, shadow=0.3)
    c.piece(mask=c.circle_mask(S(1172), S(731), S(10)), colour='#e9b48c', texture='paper', torn=0.15, rim=0.4, shadow=0.25)
    c.piece(S.pts([(1160, 728), (1184, 728), (1178, 716), (1166, 716)]), '#c0503c', texture='paper', torn=0.15, rim=0.3, shadow=0.2)   # knit cap
    c.piece(hull, '#c8955c', texture='kraft', torn=0.3, rim=0.7, shadow=0.45)
    c.crayon(S.pts([(1086, 783), (1256, 779)]), 3 * s, '#8a5d34', 0.9)
    c.crayon(S.pts([(1196, 777), (1232, 806)]), 4.5 * s, '#6b4a34', 0.95)      # second oar dipping in
    c.stage('boat')

    # ---- mist: pale torn paper wisps over the water, heavier on the left
    for (cx, cy, w, h, col) in [(300, 664, 760, 34, '#b7a9cc'), (720, 694, 520, 20, '#a99dc4'),
                                (160, 704, 380, 22, '#c4b6d4'), (1060, 672, 420, 14, '#a297c0'), (1600, 664, 300, 12, '#a297c0')]:
        sx, sy = S.pt(cx, cy)
        n = 60
        xs = np.linspace(-0.5, 0.5, n)
        top = cy - h * (0.35 + 0.65 * np.sqrt(np.clip(1 - (2 * xs) ** 2, 0, 1))) + fbm1d(n, 8, 2, int(cx))[:] * h * 0.25
        pts = [(cx + x * w, top[i]) for i, x in enumerate(xs)] + [(cx + 0.5 * w, cy), (cx - 0.5 * w, cy + 4)]
        c.piece(S.pts(pts), col, texture='paper', torn=0.8, rim=0.3, shadow=0.1)
    c.stage('mist')

    # ---- crayon ripples across the water
    for _ in range(26):
        x = rng.uniform(560, 1800); y = rng.uniform(700, 1050)
        ln = rng.uniform(30, 90) * (0.6 + (y - WL) / 400)
        col = '#f2c79c' if abs(x - 1180) < 140 and y < 900 else '#8f88c0'
        c.crayon(S.pts([(x - ln / 2, y), (x + ln / 2, y + rng.uniform(-2, 2))]), 3.0 * s, col, 0.8)
    c.stage('ripples')

    # ---- foreground reeds: kraft blades + crayon stems, lower-left
    for i in range(14):
        x = 20 + i * 19 + rng.uniform(-6, 6); top = 950 + rng.uniform(-30, 40); lean = rng.uniform(-30, 30)
        pts = spline([(x - 7, 1090), (x - 3 + lean * 0.4, (top + 1090) / 2), (x + lean, top), (x + 4 + lean * 0.4, (top + 1090) / 2), (x + 7, 1090)], 8)
        c.piece(S.pts(pts.tolist()), '#2b3326' if i % 2 else '#3a432e', texture='paper', torn=0.3, rim=0.4, shadow=0.35)
    for i in range(8):
        x = 40 + i * 32 + rng.uniform(-8, 8); top = 940 + rng.uniform(-20, 30)
        c.crayon(S.pts([(x, 1085), (x + rng.uniform(-10, 10), top)]), 2.8 * s, '#1f261c', 0.9)
    c.stage('reeds')

    # ---- birds: two thin crayon arcs each
    for (bx, by, sc) in [(1390, 230, 1.0), (1470, 196, 0.85), (1545, 258, 0.9), (1620, 212, 0.7), (1680, 285, 0.6)]:
        c.crayon(S.pts(spline([(bx - 30 * sc, by - 10 * sc), (bx - 14 * sc, by - 12 * sc), (bx, by)], 8).tolist()), 2.6 * s, '#2a2440', 0.95)
        c.crayon(S.pts(spline([(bx, by), (bx + 14 * sc, by - 12 * sc), (bx + 30 * sc, by - 10 * sc)], 8).tolist()), 2.6 * s, '#2a2440', 0.95)
    c.stage('birds')

    img = c.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(c.stages):
            save_png(im, f"{stages_dir}/{i:02d}_{name}.png")
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'papercut_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    st = sys.argv[4] if len(sys.argv) > 4 else None
    t0 = time.perf_counter()
    img = paint(W, H, seed=1, stages_dir=st)
    print(f"paint {time.perf_counter() - t0:.2f}s")
    save_png(img, out)
