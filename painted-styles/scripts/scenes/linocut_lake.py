"""Mountain lake at dusk — Linocut (黑白麻胶版画), vendor lib/linocut.py `Linocut`.
Key block in black plus one spot-colour block (dusk rose-orange) for the afterglow and its reflection.
Full-bleed: the block is larger than the sheet, so no paper margin, rim, pencil or chop.

python scripts/scenes/linocut_lake.py out.png [W H]
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from linocut import Linocut
from core import spline, fbm1d

STYLE = "Linocut · 黑白麻胶版画"
LIB = "linocut"

HOR = 640


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    pad = int(S(40))
    L = Linocut(W, H, block=(-pad, -pad, W + pad, H + pad), seed=seed)
    rng = L.rng
    KEY = [L.key]
    glowc = L.colour_block('#e0845a', offset=(int(round(S(4))), int(round(-S(3)))))
    hor = S(HOR)
    X0, X1 = -S(20), W + S(20)

    def line(ctrl):
        P = spline(S.pts(ctrl), 16)
        xs = np.arange(X0, X1 + 1, max(2.0, S(4)), dtype=np.float32)
        return xs, np.interp(xs, P[:, 0], P[:, 1]).astype(np.float32)

    # far ridge: irregular, many shoulders, highest point near x=1250
    fx = np.linspace(-20, 1940, 60)
    fr = fbm1d(60, 8, 3, seed + 11)
    fy = (392 - 80 * np.exp(-((fx - 1250) / 130) ** 2) - 30 * np.exp(-((fx - 1400) / 80) ** 2)
          - 48 * np.exp(-((fx - 560) / 200) ** 2) - 22 * np.exp(-((fx - 1760) / 130) ** 2)
          + 22 * np.exp(-((fx - 900) / 110) ** 2) + 12 * fr)
    FX, FY = line(list(zip(fx, fy)))
    nx = np.linspace(-20, 1940, 40)
    ny = (600 - 150 * np.exp(-((nx - 320) / 330) ** 2) - 80 * np.exp(-((nx - 820) / 200) ** 2)
          - 50 * np.exp(-((nx - 1700) / 190) ** 2) + 8 * fbm1d(40, 6, 3, seed + 21))
    NX, NY = line(list(zip(nx, ny)))
    far_r = lambda x: np.interp(x, FX, FY)
    near_r = lambda x: np.interp(x, NX, NY)

    top = [(X0, -S(20)), (X1, -S(20))]
    sky = top + list(zip(FX[::-1], FY[::-1]))
    far = list(zip(FX, FY)) + [(X1, hor + S(2)), (X0, hor + S(2))]
    near = list(zip(NX, NY)) + [(X1, hor + S(2)), (X0, hor + S(2))]
    water = [(X0, hor), (X1, hor), (X1, H + S(20)), (X0, H + S(20))]
    GX, GY = S(1240), S(560)
    L.stage('inked', blocks=KEY)

    # ---- sky: black at the top, carved lighter toward the horizon with long horizontal V cuts,
    # the low sky cleared
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    L.clear(L.poly([(X0, S(400)), (X1, S(400)), (X1, hor), (X0, hor)]), chatter=0.35, angle=2)
    L.hatch([(X0, S(60)), (X1, S(60)), (X1, S(420)), (X0, S(420))], angle=0, spacing=S(8), width=S(3.4),
            dash=(S(60), S(320)), gap=(S(8), S(50)), cut=True,
            density=lambda x, y: np.clip((y - S(110)) / S(290), 0.0, 1) ** 1.2,
            bend=lambda x, y: S(6) * np.sin(x / S(260) + y / S(90)))
    # spot colour: the afterglow, printed as horizontal streaks left standing on the colour block,
    # thick round the hidden sun and thinning out; it only shows where the key block was carved
    gd = lambda x, y: float(np.hypot((y - GY) * 1.6, x - GX))
    L.hatch(sky, angle=0, spacing=S(5), width=S(5.0), dash=(S(40), S(260)), gap=(S(4), S(30)), cut=False, on=glowc,
            density=lambda x, y: np.clip(1.15 - gd(x, y) / S(900), 0.05, 1) * (y > S(150)))
    L.stage('sky')

    # ---- far range: pale and hazy -> mostly cut white, a black contour and sparse contour lines left standing
    L.clear(L.poly(far), chatter=0.3, angle=0)
    L.outline(L.poly(far), S(2.2), cut=False)
    L.hatch(far, angle=0, spacing=S(10), width=S(2.2), dash=(S(18), S(110)), gap=(S(14), S(70)), cut=False,
            bend=lambda x, y: far_r(x) - far_r(S(1000)),
            density=lambda x, y: np.clip(0.06 + 0.35 * np.exp(-(y - far_r(x)) / S(30)) + 0.2 * (x < GX - S(300)), 0, 0.6))
    L.stage('far mountains', blocks=None)

    # ---- near range: dark -> left standing black, with contour cuts thinning toward the shoulder's lit side
    L.outline(L.poly(near), S(2.5))
    L.leave(L.poly(near))
    L.hatch(near, angle=0, spacing=S(9), width=S(2.4), dash=(S(20), S(140)), gap=(S(10), S(70)), cut=True,
            bend=lambda x, y: near_r(x) - near_r(S(600)),
            density=lambda x, y: np.clip(0.35 + 0.4 * np.exp(-(y - near_r(x)) / S(50)) + 0.25 * (x > S(700)), 0, 0.9))
    L.stage('near mountains', blocks=KEY)

    # ---- pines on both shores (standing black spruces, white halo where they cross the black hill)
    left = [(75, 470), (130, 430), (190, 500), (245, 420), (300, 475), (355, 520), (400, 455),
            (455, 540), (505, 560), (165, 545), (275, 555), (425, 585)]
    for (x, ty) in sorted(left, key=lambda t: t[1]):
        L.pine(S(x + rng.normal(0, 4)), S(652), S(652 - ty), snow=0, halo=S(2.4), nicks=0.3)
    for (x, ty) in [(1520, 575), (1580, 545), (1640, 590), (1720, 565), (1785, 600)]:
        L.pine(S(x), S(650), S(650 - ty), snow=0, halo=S(4.0), nicks=0.2)
    L.stage('trees', blocks=KEY)

    # ---- water: cleared white near the horizon, horizontal ridges left standing, denser toward the viewer;
    # the hills and pines mirrored as black shapes broken by ripple cuts; the glow's reflection on the colour block
    L.clear(L.poly(water), chatter=0.45, angle=0)
    key1 = (np.asarray(L.key.a, np.float32)[::L.ss, ::L.ss] / 255)[:H, :W]
    hz = int(round(hor))
    src = np.clip(2 * hz - np.arange(H), 0, H - 1)
    refl = key1[src] * (np.arange(H)[:, None] > hz + S(3))
    fadein = np.clip(1 - (np.arange(H)[:, None] - hor) / S(330), 0, 1)
    refl = refl * (fadein > 0.05)
    L.leave(refl)
    L.hatch(water, angle=0, spacing=S(6), width=S(2.6), dash=(S(40), S(300)), gap=(S(6), S(40)), cut=True,
            density=lambda x, y: np.clip(0.35 + (y - hor) / S(300), 0, 1),
            box=(0, hz, W, min(H, hz + int(S(360)))))
    L.hatch(water, angle=0, spacing=S(11), width=S(2.6), dash=(S(30), S(260)), gap=(S(10), S(90)), cut=False,
            bend=lambda x, y: S(2) * np.sin(x / S(140) + y / S(30)),
            density=lambda x, y: np.clip(0.12 + 0.9 * max(0.0, (y - hor) / (H - hor)) ** 1.4, 0, 0.95))
    # the afterglow's reflection: short horizontal streaks on the colour block under the hidden sun
    L.hatch([(GX - S(420), hor + S(4)), (GX + S(420), hor + S(4)), (GX + S(420), S(1000)), (GX - S(420), S(1000))],
            angle=0, spacing=S(7), width=S(4.4), dash=(S(16), S(110)), gap=(S(8), S(50)), cut=False, on=glowc,
            density=lambda x, y: np.clip(np.exp(-abs(x - GX) / S(110)) * (1.2 - (y - hor) / S(420)), 0, 1))
    L.stage('water', blocks=KEY)

    # ---- mist: a band carved white across the waterline, thicker at left, with a few wisps left standing
    mtop = [(x, 610 - 26 * max(0, 1 - x / 1500) + 8 * np.sin(x / 140)) for x in np.linspace(-20, 1940, 40)]
    mbot = [(x, 684 + 18 * max(0, 1 - x / 1400) + 6 * np.sin(x / 110 + 1)) for x in np.linspace(1940, -20, 40)]
    mist = L.poly(spline(S.pts(mtop), 6).tolist() + spline(S.pts(mbot), 6).tolist())
    L.clear(mist, chatter=0.25, angle=0)
    L.clear(mist, on=glowc, chatter=0)
    for _ in range(9):
        x = rng.uniform(S(0), S(1700)); y = rng.uniform(S(625), S(675)); ln = rng.uniform(S(80), S(260))
        L.gouge([(x, y), (x + ln * 0.5, y - S(3)), (x + ln, y)], S(2.0), 'v', cut=False)
    L.stage('mist', blocks=KEY)

    # ---- the boat: a black rowing boat with a seated rower, white halo, its broken reflection
    BX, BY = S(1170), S(800)
    hull = [(BX - S(92), BY - S(18)), (BX - S(50), BY - S(10)), (BX + S(50), BY - S(10)), (BX + S(94), BY - S(20)),
            (BX + S(66), BY + S(4)), (BX - S(66), BY + S(4))]
    rower = [(BX - S(16), BY - S(12)), (BX - S(18), BY - S(42)), (BX - S(10), BY - S(52)), (BX + S(2), BY - S(50)),
             (BX + S(4), BY - S(36)), (BX + S(6), BY - S(12))]
    parts = [np.array(hull, np.float32), np.array(rower, np.float32),
             np.array([(BX - S(6) + S(8) * np.cos(t), BY - S(62) + S(8) * np.sin(t)) for t in np.linspace(0, 6.3, 20)], np.float32),
             L.stroke([(BX - S(40), BY - S(40)), (BX + S(10), BY - S(26)), (BX + S(72), BY + S(14))], S(4), 'knife')]
    bm = L.mask_of(parts)
    L.outline(bm, S(3))
    L.leave(bm)
    L.gouge([(BX - S(80), BY - S(14)), (BX, BY - S(5)), (BX + S(82), BY - S(16))], S(1.8), 'v')    # gunwale highlight
    for k, yy_ in enumerate((812, 822, 834, 846)):
        w = S(80 - k * 14)
        L.gouge([(BX - w, S(yy_)), (BX + w * 0.9, S(yy_) + S(1))], S(4.0 - k * 0.5), 'brush', end=S(2), cut=False)
    L.stage('boat', blocks=KEY)

    # ---- birds: white V cuts in the dark upper sky
    for (bx, by, sc) in [(1380, 250, 1.0), (1440, 222, 0.8), (1505, 262, 0.7), (1590, 205, 0.9), (1665, 242, 0.6)]:
        bx, by, sc = S(bx), S(by), sc * s * 1.4
        L.gouge(spline([(bx - 20 * sc, by + 2 * sc), (bx - 9 * sc, by - 8 * sc), (bx, by)], 6), S(5.0) * max(sc / s, 0.7), 'v', smooth=False)
        L.gouge(spline([(bx, by), (bx + 9 * sc, by - 9 * sc), (bx + 20 * sc, by)], 6), S(5.0) * max(sc / s, 0.7), 'v', smooth=False)
    L.stage('birds', blocks=KEY)

    # ---- reeds in the lower-left foreground: brush strokes left standing, white halo
    reeds = []
    for _ in range(26):
        x = rng.uniform(-S(10), S(300)); h = rng.uniform(S(90), S(210)) * (1.15 - x / S(420))
        lean = rng.normal(S(10), S(12))
        reeds.append(L.stroke(spline([(x, H + S(4)), (x + lean * 0.4, H - h * 0.5), (x + lean, H - h)], 8), S(5), 'brush', end=S(1.2)))
        if rng.random() < 0.5:
            q = (x + lean * 0.3, H - h * 0.35); side = rng.choice([-1, 1])
            reeds.append(L.stroke([q, (q[0] + side * S(30), q[1] - S(40)), (q[0] + side * S(55), q[1] - S(46))], S(6), 'v'))
    rmk = L.mask_of(reeds)
    L.outline(rmk, S(2.4))
    L.leave(rmk)
    L.stage('reeds')

    img = L.pull().convert('RGB')
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(L.stages):
            save_png(im, os.path.join(stages_dir, f"{i:02d}_{name.replace(' ', '_')}.png"))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'linocut_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    save_png(paint(W, H), out)
    print('saved', out)
