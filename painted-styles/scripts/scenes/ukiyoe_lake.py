"""Mountain lake at dusk — Ukiyo-e woodblock print (浮世绘木版画), vendor lib/ukiyoe.py `Ukiyoe`.

python scripts/scenes/ukiyoe_lake.py out.png [W H]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from ukiyoe import Ukiyoe
from core import spline, curve, fbm1d

STYLE = "Ukiyo-e · 浮世绘木版画"
LIB = "ukiyoe"

HOR = 640


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    u = Ukiyoe(W, H, seed=seed)
    rng = u.rng
    YY, XX = u.YY, u.XX
    hor = S(HOR)

    # ---- sky: indigo wiped down from the top, dusk rose then orange rising from the horizon
    # full-bleed blocks: pin their registration so the drift never exposes a strip of bare
    # washi at the canvas edge (the lib shifts with zero fill)
    for c in ('#f0b48c', '#d9663e', '#2a3c6c', '#8d86a6', '#5d5a82', '#e6a385', '#4c6b62', '#283f3e',
              '#4f78a6', '#e7a07e', '#1d3463', '#355552'):
        u.offsets[c] = (0, 0)
    sky = u.rect(0, 0, W, hor + S(2))
    u.bokashi(sky, '#f0b48c', hor, S(60), strength=0.8)
    u.bokashi(sky, '#d9663e', hor, S(260), strength=0.85)
    u.bokashi(sky, '#2a3c6c', 0, S(300))
    u.stage('sky')

    # ---- far range: an irregular, many-shouldered ridge (highest peak ~x1250), pale violet-grey
    xs = np.linspace(0, 1920, 120)
    r1 = fbm1d(120, 14, 4, seed + 11)
    fy = (395 - 75 * np.exp(-((xs - 1250) / 120) ** 2) - 35 * np.exp(-((xs - 1390) / 90) ** 2)
          - 50 * np.exp(-((xs - 560) / 200) ** 2) - 25 * np.exp(-((xs - 1750) / 140) ** 2)
          + 25 * np.exp(-((xs - 900) / 120) ** 2) + 16 * r1)
    ridge_far = S.pts(list(zip(xs, fy)))
    far = [(0, hor + S(4))] + ridge_far + [(W, hor + S(4))]
    fm = u.poly(far)
    u.block(fm, '#8d86a6')
    u.bokashi(fm, '#5d5a82', S(300), S(470), strength=0.8)
    u.bokashi(fm, '#e6a385', hor, S(520), strength=0.6)                   # warm haze at the foot
    u.key(ridge_far, S(2.2), colour='#3b3346')
    u.stage('far mountains')

    # ---- near range: darker green-blue, big left shoulder dipping to the right
    r2 = fbm1d(120, 12, 4, seed + 21)
    ny = (600 - 150 * np.exp(-((xs - 330) / 320) ** 2) - 80 * np.exp(-((xs - 820) / 200) ** 2)
          - 50 * np.exp(-((xs - 1700) / 190) ** 2) + 10 * r2)
    ridge_near = S.pts(list(zip(xs, ny)))
    near = [(0, hor + S(4))] + ridge_near + [(W, hor + S(4))]
    nm = u.poly(near)
    u.block(nm, '#4c6b62')
    u.bokashi(nm, '#283f3e', S(450), S(600), strength=0.85)
    u.key(ridge_near, S(3.2))
    # a few key-block texture strokes on the shoulder
    for _ in range(9):
        x = rng.uniform(S(120), S(900)); yt = np.interp(x, [p[0] for p in ridge_near], [p[1] for p in ridge_near])
        ln = rng.uniform(S(30), S(70))
        u.key(spline([(x, yt + S(14)), (x - ln * 0.3, yt + S(14) + ln * 0.5), (x - ln * 0.5, yt + S(14) + ln)], 6), S(1.6))
    u.stage('near mountains')

    # ---- pines: stylised tiered conifers, two greens, key outline
    def conifer(x, top, root):
        h = root - top
        u.key([(x, root), (x, top + h * 0.2)], max(1.5, h * 0.04), colour='#4a3121')
        tiers = 4
        polys = []
        for k in range(tiers):
            ty = top + h * k * 0.19
            by = top + h * (0.30 + k * 0.19)
            half = h * (0.10 + 0.07 * k)
            polys.append([(x, ty), (x + half * 0.5, (ty + by) / 2), (x + half, by), (x - half, by), (x - half * 0.5, (ty + by) / 2)])
        for P in polys:
            m = u.poly(P)
            u.block(m, '#2b4d36')
            u.block(m * (XX < x), '#4f7c4c')
            u.key(P, max(1.0, S(1.6)), closed=True)

    left = [(75, 470), (130, 430), (190, 500), (245, 420), (300, 475), (355, 520), (400, 455),
            (455, 540), (505, 560), (165, 545), (275, 555), (425, 585)]
    for (x, top) in sorted(left, key=lambda t: t[1]):
        conifer(S(x + rng.normal(0, 4)), S(top), S(652))
    for (x, top) in [(1520, 575), (1580, 545), (1640, 590), (1720, 565), (1785, 600)]:
        conifer(S(x), S(top), S(650))
    u.stage('trees')

    # ---- water: block blue, deep bokashi from the foreground; reflections printed as broken stripes
    wat = u.rect(0, hor, W, H)
    u.block(wat, '#4f78a6')
    u.bokashi(wat, '#e7a07e', hor, S(760), strength=0.7)                   # sky colour on the far water
    u.bokashi(wat, '#1d3463', H, S(760))
    ys = np.arange(H)
    src = np.clip(2 * int(round(hor)) - ys, 0, H - 1)
    stripes = (np.sin((YY - hor) / S(5.5) + 2.0 * (u._wood(seed + 5) - 1)) > -0.1).astype(np.float32)
    below = (YY > hor + S(3)).astype(np.float32)
    fade = np.clip(1 - (YY - hor) / S(360), 0, 1)
    u.block(nm[src] * below * stripes * fade, '#355552', 0.5)
    u.block((u.poly(far)[src] - nm[src]).clip(0, 1) * below * stripes * fade, '#8d86a6', 0.4)
    for _ in range(26):
        y = rng.uniform(hor + S(30), S(1060)); x = rng.uniform(S(0), S(1880)); ln = rng.uniform(S(40), S(140))
        if S(1030) < x < S(1300) and S(760) < y < S(850):
            continue
        u.key([(x, y), (x + ln * 0.5, y - S(2)), (x + ln, y)], S(1.6), colour='#dfe6ee' if y < S(800) else '#a9c0da')
    u.stage('water')

    # ---- mist: Hiroshige-style opaque bands over the waterline, thicker at left
    u.cloud_band(-S(120), S(760), S(668), S(48), glow='#f0a27a')
    u.cloud_band(S(420), S(1060), S(622), S(30), glow='#f0a27a')
    u.cloud_band(S(1380), S(1960), S(684), S(26), glow='#f0a27a')
    u.stage('mist')

    # ---- boat: small wooden boat with a standing boatman poling
    BX, BY = S(1170), S(800)
    hull = [(BX - S(92), BY - S(18)), (BX + S(92), BY - S(16)), (BX + S(70), BY + S(2)), (BX - S(72), BY + S(2))]
    rim = [(BX - S(92), BY - S(18)), (BX + S(92), BY - S(16))]
    u.block(u.poly(hull), '#6b4429')
    u.block(u.poly(hull) * (YY < BY - S(11)), '#9b6a3e')
    u.key(hull, S(2.4), closed=True)
    u.key(rim, S(1.6))
    fx = BX - S(20)
    body = [(fx - S(10), BY - S(18)), (fx + S(10), BY - S(18)), (fx + S(8), BY - S(58)), (fx - S(7), BY - S(58))]
    u.block(u.poly(body), '#2f4a7a'); u.key(body, S(1.8), closed=True)
    u.block(u.circle(fx, BY - S(65), S(7)), '#e7c39a'); u.key([(fx + S(7) * np.cos(t), BY - S(65) + S(7) * np.sin(t)) for t in np.linspace(0, 6.3, 20)], S(1.4))
    hat = [(fx - S(17), BY - S(66)), (fx, BY - S(80)), (fx + S(17), BY - S(66))]
    u.block(u.poly(hat), '#c9a462'); u.key(hat, S(1.8), closed=True)
    u.key([(fx - S(40), BY - S(120)), (fx + S(70), BY + S(40))], S(2.6), colour='#4a3121')     # pole
    rhull = [(x, 2 * (BY + S(2)) - y) for (x, y) in hull]
    u.block(u.poly(rhull) * (np.sin((YY - BY) / S(3)) > -0.2), '#2d2a33', 0.55)
    u.key([(BX - S(130), BY + S(8)), (BX + S(140), BY + S(8))], S(1.4), colour='#dfe6ee')
    u.stage('boat')

    # ---- birds (key-block gull silhouettes)
    for (bx, by, sc) in [(1380, 250, 1.0), (1440, 222, 0.8), (1505, 262, 0.7), (1590, 205, 0.9), (1665, 242, 0.6)]:
        bx, by, sc = S(bx), S(by), sc * s
        u.key(spline([(bx - 18 * sc, by), (bx - 7 * sc, by - 8 * sc), (bx, by)], 6), S(2.4))
        u.key(spline([(bx, by), (bx + 7 * sc, by - 8 * sc), (bx + 18 * sc, by)], 6), S(2.4))
    u.stage('birds')

    # ---- reeds, lower-left foreground
    bank = [(0, H), (0, S(1035)), (S(110), S(1025)), (S(240), S(1050)), (S(300), H)]
    u.block(u.poly(bank), '#5a6b3a'); u.key(bank[1:-1], S(2.4))
    for _ in range(22):
        x = rng.uniform(0, S(290)); h = rng.uniform(S(110), S(230)) * (1.1 - x / S(420))
        lean = rng.normal(S(8), S(10))
        pts = spline([(x, H + S(2)), (x + lean * 0.4, H - h * 0.5), (x + lean, H - h)], 6)
        u.key(pts, S(4), colour='#3f5530')
        u.key(pts, S(1.2))
    u.stage('reeds')

    img = u.composite().convert('RGB')
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(u.stages):
            save_png(im, os.path.join(stages_dir, f"{i:02d}_{name.replace(' ', '_')}.png"))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'ukiyoe_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    save_png(paint(W, H), out)
    print('saved', out)
